import type { BusinessAgent, PermissionId, ModuleId } from "./BusinessAgent";
import type { BrainPlan } from "./HermesBrain";
import { getAdapter, getEngineLabel, type ExecutionEvent, type EngineResult } from "./ExecutionAdapter";
import { getState, updateGoalStatus, moveKanbanCard, updateMemoryStage, type HermesState } from "./IntegrationManager";
import {
  classifyRisk,
  shouldAutoExecute,
  createApprovalRequest,
  approveTask,
  rejectTask,
  markExecuted,
  markCompleted,
  markFailed,
  type ApprovalRequest,
  type RiskLevel
} from "./ApprovalManager";
import { storeResult, type ExecutionResult } from "./ExecutionResults";

export type TaskStatus = "queued" | "preparing" | "executing" | "waiting" | "completed" | "failed" | "cancelled" | "awaiting_approval";

export interface ExecutionLog {
  id: string;
  agentId: string;
  agentName: string;
  engine: string;
  status: TaskStatus;
  prompt: string;
  output: string;
  error: string | null;
  startTime: number;
  endTime: number | null;
  duration: number;
  tokens: number;
  events: ExecutionEvent[];
  approvalId: string | null;
  risk: RiskLevel;
}

export interface TaskProgress {
  taskId: string;
  status: TaskStatus;
  message: string;
  timestamp: number;
}

type TaskListener = (progress: TaskProgress) => void;

let taskCounter = 0;
const taskListeners: Set<TaskListener> = new Set();
const activeTasks: Map<string, { agent: BusinessAgent; status: TaskStatus; log: ExecutionLog }> = new Map();
const pendingApprovalsByTask: Map<string, { approval: ApprovalRequest; resolve: (approved: boolean) => void }> = new Map();

function nextTaskId(): string {
  return `task-${Date.now()}-${++taskCounter}`;
}

export function onTaskProgress(fn: TaskListener): () => void {
  taskListeners.add(fn);
  return () => { taskListeners.delete(fn); };
}

function emitProgress(progress: TaskProgress): void {
  for (const fn of taskListeners) {
    fn(progress);
  }
}

export function approveTaskExecution(taskId: string): boolean {
  const pending = pendingApprovalsByTask.get(taskId);
  if (!pending) return false;
  approveTask(pending.approval.id, "Approved for execution");
  pending.resolve(true);
  pendingApprovalsByTask.delete(taskId);
  return true;
}

export function rejectTaskExecution(taskId: string, reason?: string): boolean {
  const pending = pendingApprovalsByTask.get(taskId);
  if (!pending) return false;
  rejectTask(pending.approval.id, reason || "Rejected by user");
  pending.resolve(false);
  pendingApprovalsByTask.delete(taskId);
  return true;
}

export function getPendingTaskApprovals(): Array<{ taskId: string; approval: ApprovalRequest }> {
  return [...pendingApprovalsByTask.entries()].map(([taskId, { approval }]) => ({ taskId, approval }));
}

function validatePermissions(agent: BusinessAgent, required: PermissionId[]): string | null {
  for (const perm of required) {
    if (!agent.permissions.includes(perm)) {
      return `Missing permission: ${perm}`;
    }
  }
  return null;
}

function validateModules(agent: BusinessAgent, required: ModuleId[]): string | null {
  for (const mod of required) {
    if (!agent.enabledModules.includes(mod)) {
      return `Module not enabled: ${mod}`;
    }
  }
  return null;
}

export function validateExecution(agent: BusinessAgent, plan: BrainPlan, state: HermesState): string[] {
  const errors: string[] = [];

  if (!agent.active) {
    errors.push("Agent is disabled.");
  }

  if (agent.capabilities.length === 0) {
    errors.push("Agent has no capabilities.");
  }

  const permError = validatePermissions(agent, ["memory"]);
  if (permError) errors.push(permError);

  const moduleError = validateModules(agent, ["memory"]);
  if (moduleError) errors.push(moduleError);

  if (plan.workspace.create && !state.workspace) {
    errors.push("Workspace required but not created.");
  }

  if (!plan.goal) {
    errors.push("Goal is missing.");
  }

  return errors;
}

export async function executeTask(
  agent: BusinessAgent,
  plan: BrainPlan,
  state: HermesState
): Promise<ExecutionLog> {
  const taskId = nextTaskId();
  const risk = classifyRisk(plan, agent);
  const log: ExecutionLog = {
    id: taskId,
    agentId: agent.id,
    agentName: agent.name,
    engine: getEngineLabel(agent.executionEngine),
    status: "queued",
    prompt: plan.goal,
    output: "",
    error: null,
    startTime: Date.now(),
    endTime: null,
    duration: 0,
    tokens: 0,
    events: [],
    approvalId: null,
    risk
  };

  activeTasks.set(taskId, { agent, status: "queued", log });

  emitProgress({ taskId, status: "queued", message: `Task queued for ${agent.name}`, timestamp: Date.now() });

  const errors = validateExecution(agent, plan, state);
  if (errors.length > 0) {
    log.status = "failed";
    log.error = errors.join("; ");
    log.endTime = Date.now();
    log.duration = log.endTime - log.startTime;
    activeTasks.set(taskId, { agent, status: "failed", log });
    emitProgress({ taskId, status: "failed", message: log.error, timestamp: Date.now() });
    return log;
  }

  if (!shouldAutoExecute(risk)) {
    log.status = "awaiting_approval";
    activeTasks.set(taskId, { agent, status: "awaiting_approval", log });
    emitProgress({ taskId, status: "awaiting_approval", message: `Awaiting approval (${risk} risk)...`, timestamp: Date.now() });

    const approval = createApprovalRequest(taskId, plan, agent, state);
    log.approvalId = approval.id;

    const approved = await new Promise<boolean>((resolve) => {
      pendingApprovalsByTask.set(taskId, { approval, resolve });
    });

    if (!approved) {
      log.status = "cancelled";
      log.error = "Approval denied.";
      log.endTime = Date.now();
      log.duration = log.endTime - log.startTime;
      activeTasks.set(taskId, { agent, status: "cancelled", log });
      emitProgress({ taskId, status: "cancelled", message: "Task cancelled — approval denied.", timestamp: Date.now() });
      return log;
    }

    emitProgress({ taskId, status: "preparing", message: "Approved. Preparing execution...", timestamp: Date.now() });
  }

  markExecuted(log.approvalId || "");

  log.status = "preparing";
  activeTasks.set(taskId, { agent, status: "preparing", log });
  emitProgress({ taskId, status: "preparing", message: "Preparing execution context...", timestamp: Date.now() });

  const payload = {
    agent,
    prompt: plan.goal,
    systemPrompt: agent.systemPrompt || `You are ${agent.name}. ${agent.description}`,
    context: {
      workspaceId: state.workspace?.id || null,
      goal: plan.goal,
      capabilities: agent.capabilities,
      modules: agent.enabledModules,
      permissions: agent.permissions
    }
  };

  log.status = "executing";
  activeTasks.set(taskId, { agent, status: "executing", log });
  emitProgress({ taskId, status: "executing", message: `Executing with ${getEngineLabel(agent.executionEngine)}...`, timestamp: Date.now() });

  const adapter = getAdapter(agent.executionEngine);

  try {
    const result = await adapter.execute(payload, (event) => {
      log.events.push(event);
      emitProgress({ taskId, status: "executing", message: event.message, timestamp: event.timestamp });
    });

    log.output = result.output;
    log.tokens = result.tokens;
    log.duration = result.duration;
    log.endTime = Date.now();

    if (result.status === "completed") {
      log.status = "completed";
      markCompleted(log.approvalId || "");
      emitProgress({ taskId, status: "completed", message: "Execution completed successfully.", timestamp: Date.now() });

      storeResult(
        agent,
        agent.executionEngine,
        plan.goal,
        agent.systemPrompt || `You are ${agent.name}. ${agent.description}`,
        result.output,
        result.duration,
        "completed",
        result.tokens,
        null,
        log.events,
        {
          workspaceId: state.workspace?.id || null,
          goal: plan.goal,
          capabilities: agent.capabilities,
          modules: agent.enabledModules,
          permissions: agent.permissions
        }
      );

      const currentState = getState();

      if (agent.permissions.includes("modify_notebook") && currentState.notebook) {
        import("./IntegrationManager").then(({ updateNotebook }) => {
          updateNotebook({
            summary: `${currentState.notebook!.summary}\n\nExecution by ${agent.name}: ${result.output.slice(0, 500)}`,
            brainReasoning: [...currentState.notebook!.brainReasoning, `Executed by ${agent.name} via ${result.engine}`]
          });
        });
      }

      if (agent.permissions.includes("create_goals") && currentState.goal) {
        updateGoalStatus("in_progress");
      }

      if (agent.permissions.includes("create_kanban") && currentState.kanban && currentState.kanban.planning.length > 0) {
        const card = currentState.kanban.planning[0];
        moveKanbanCard(card.id, "inProgress");
      }

      if (agent.memoryEnabled && currentState.memory) {
        updateMemoryStage(`Executed by ${agent.name} — task completed`);
      }
    } else {
      log.status = "failed";
      log.error = result.error || "Execution failed.";
      markFailed(log.approvalId || "", log.error);
      emitProgress({ taskId, status: "failed", message: log.error, timestamp: Date.now() });
    }
  } catch (err) {
    log.status = "failed";
    log.error = err instanceof Error ? err.message : "Unknown error.";
    log.endTime = Date.now();
    log.duration = log.endTime - log.startTime;
    markFailed(log.approvalId || "", log.error);
    emitProgress({ taskId, status: "failed", message: log.error, timestamp: Date.now() });
  }

  activeTasks.set(taskId, { agent, status: log.status, log });
  return log;
}

export function cancelTask(taskId: string): boolean {
  const task = activeTasks.get(taskId);
  if (!task || task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
    return false;
  }
  task.status = "cancelled";
  task.log.status = "cancelled";
  task.log.endTime = Date.now();
  task.log.duration = task.log.endTime - task.log.startTime;
  emitProgress({ taskId, status: "cancelled", message: "Task cancelled.", timestamp: Date.now() });
  return true;
}

export function getActiveTasks(): Map<string, { agent: BusinessAgent; status: TaskStatus; log: ExecutionLog }> {
  return activeTasks;
}

export function getTaskLog(taskId: string): ExecutionLog | null {
  return activeTasks.get(taskId)?.log || null;
}

export function getAllLogs(): ExecutionLog[] {
  return [...activeTasks.values()].map((t) => t.log).sort((a, b) => b.startTime - a.startTime);
}

export function getExecutionStats(): {
  total: number;
  completed: number;
  failed: number;
  active: number;
  awaitingApproval: number;
  avgDuration: number;
  successRate: number;
} {
  const logs = getAllLogs();
  const completed = logs.filter((l) => l.status === "completed");
  const failed = logs.filter((l) => l.status === "failed");
  const active = logs.filter((l) => l.status === "queued" || l.status === "preparing" || l.status === "executing");
  const awaitingApproval = logs.filter((l) => l.status === "awaiting_approval");
  const avgDuration = completed.length > 0
    ? completed.reduce((sum, l) => sum + l.duration, 0) / completed.length
    : 0;
  const total = completed.length + failed.length;
  const successRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  return {
    total: logs.length,
    completed: completed.length,
    failed: failed.length,
    active: active.length,
    awaitingApproval: awaitingApproval.length,
    avgDuration: Math.round(avgDuration),
    successRate
  };
}
