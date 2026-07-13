import type { BusinessAgent, PermissionId, ModuleId, ExecutionEngineId } from "./BusinessAgent";
import type { BrainPlan } from "./HermesBrain";
import { getAdapter, getEngineLabel, type ExecutionEvent, type EngineResult } from "./ExecutionAdapter";
import { getState, updateGoalStatus, moveKanbanCard, updateMemoryStage, type HermesState } from "./IntegrationManager";
import { loadAgents } from "./AgentStore";
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
import { storeResult, type ExecutionResult, type WorkspaceArtifact } from "./ExecutionResults";
import { ExecutionBus } from "./ExecutionEventBus";
import type { WorkspaceFile } from "./WorkspaceService";

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

const EXEC_STORAGE_KEY = "hermes-exec-tasks";

function persistActiveTasks(): void {
  try {
    const serializable: Array<{ agent: BusinessAgent; status: TaskStatus; log: ExecutionLog }> = [];
    for (const entry of activeTasks.values()) {
      serializable.push({ agent: entry.agent, status: entry.status, log: entry.log });
    }
    localStorage.setItem(EXEC_STORAGE_KEY, JSON.stringify(serializable));
  } catch {}
}

function restoreActiveTasks(): void {
  try {
    const raw = localStorage.getItem(EXEC_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed) {
      if (entry.agent && entry.status && entry.log) {
        activeTasks.set(entry.log.id, { agent: entry.agent, status: entry.status, log: entry.log });
      }
    }
  } catch {}
}

restoreActiveTasks();

function nextTaskId(): string {
  return `task-${Date.now()}-${++taskCounter}`;
}

export function onTaskProgress(fn: TaskListener): () => void {
  taskListeners.add(fn);
  return () => { taskListeners.delete(fn); };
}

function emitProgress(progress: TaskProgress): void {
  persistActiveTasks();
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
  state: HermesState,
  options?: { autoApprove?: boolean }
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

  ExecutionBus.emit(ExecutionBus.createEvent(
    "execution_created", taskId, state.workspace?.id || null, agent.name,
    "pending", `Task queued for ${agent.name}`, 0
  ));

  const errors = validateExecution(agent, plan, state);
  if (errors.length > 0) {
    log.status = "failed";
    log.error = errors.join("; ");
    log.endTime = Date.now();
    log.duration = log.endTime - log.startTime;
    activeTasks.set(taskId, { agent, status: "failed", log });
    emitProgress({ taskId, status: "failed", message: log.error, timestamp: Date.now() });
    ExecutionBus.emit(ExecutionBus.createEvent(
      "execution_failed", taskId, state.workspace?.id || null, agent.name,
      "failed", log.error, 100
    ));
    return log;
  }

  if (!shouldAutoExecute(risk)) {
    if (options?.autoApprove) {
      log.status = "preparing";
      activeTasks.set(taskId, { agent, status: "preparing", log });
      emitProgress({ taskId, status: "preparing", message: "Auto-approved. Preparing execution...", timestamp: Date.now() });
    } else {
      log.status = "awaiting_approval";
      activeTasks.set(taskId, { agent, status: "awaiting_approval", log });
      emitProgress({ taskId, status: "awaiting_approval", message: `Awaiting approval (${risk} risk)...`, timestamp: Date.now() });
      ExecutionBus.emit(ExecutionBus.createEvent(
        "execution_started", taskId, state.workspace?.id || null, agent.name,
        "pending", `Awaiting approval (${risk} risk)`, 10
      ));

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
  ExecutionBus.emit(ExecutionBus.createEvent(
    "agent_started", taskId, state.workspace?.id || null, agent.name,
    "running", `Executing with ${getEngineLabel(agent.executionEngine)}...`, 30
  ));

  const adapter = getAdapter(agent.executionEngine);

  try {
    const result = await adapter.execute(payload, (event) => {
      log.events.push(event);
      emitProgress({ taskId, status: "executing", message: event.message, timestamp: event.timestamp });
      ExecutionBus.emit(ExecutionBus.createEvent(
        "agent_progress", taskId, state.workspace?.id || null, agent.name,
        "running", event.message, 50, { eventType: event.type }
      ));
    });

    log.output = result.output;
    log.tokens = result.tokens;
    log.duration = result.duration;
    log.endTime = Date.now();

    if (result.status === "completed") {
      log.status = "completed";
      markCompleted(log.approvalId || "");
      emitProgress({ taskId, status: "completed", message: "Execution completed successfully.", timestamp: Date.now() });

      ExecutionBus.emit(ExecutionBus.createEvent(
        "agent_finished", taskId, state.workspace?.id || null, agent.name,
        "completed", `${agent.name} finished — ${result.tokens} tokens, ${result.duration}ms`, 70,
        { tokens: result.tokens, duration: result.duration, outputLength: result.output.length }
      ));

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

      // Write extracted artifacts to workspace files
      if (state.workspace) {
        const { extractArtifacts } = await import("./ExecutionResults");
        const artifacts = extractArtifacts(result.output, agent.name);
        if (artifacts.length > 0) {
          const workspaceFiles: WorkspaceFile[] = artifacts.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            content: a.content,
            size: a.size,
            createdAt: a.createdAt
          }));
          import("./IntegrationManager").then(({ addFilesToWorkspace }) => {
            addFilesToWorkspace(workspaceFiles);
          });
          ExecutionBus.emit(ExecutionBus.createEvent(
            "workspace_updated", taskId, state.workspace?.id || null, agent.name,
            "completed", `${workspaceFiles.length} file(s) written to workspace`, 95,
            { fileCount: workspaceFiles.length }
          ));
        }
      }

      ExecutionBus.emit(ExecutionBus.createEvent(
        "execution_completed", taskId, state.workspace?.id || null, agent.name,
        "completed", "Execution completed and results stored", 100,
        { tokens: result.tokens, duration: result.duration }
      ));

      const currentState = getState();

      if (agent.permissions.includes("modify_notebook") && currentState.notebook) {
        import("./IntegrationManager").then(({ updateNotebook }) => {
          updateNotebook({
            summary: `${currentState.notebook!.summary}\n\nExecution by ${agent.name}: ${result.output.slice(0, 500)}`,
            brainReasoning: [...currentState.notebook!.brainReasoning, `Executed by ${agent.name} via ${result.engine}`]
          });
        });
        ExecutionBus.emit(ExecutionBus.createEvent(
          "workspace_updated", taskId, state.workspace?.id || null, agent.name,
          "completed", "Notebook updated", 80
        ));
      }

      if (agent.permissions.includes("create_goals") && currentState.goal) {
        updateGoalStatus("in_progress");
        ExecutionBus.emit(ExecutionBus.createEvent(
          "workspace_updated", taskId, state.workspace?.id || null, agent.name,
          "completed", "Goal status updated to in_progress", 85
        ));
      }

      if (agent.permissions.includes("create_kanban") && currentState.kanban && currentState.kanban.planning.length > 0) {
        const card = currentState.kanban.planning[0];
        moveKanbanCard(card.id, "inProgress");
        ExecutionBus.emit(ExecutionBus.createEvent(
          "workspace_updated", taskId, state.workspace?.id || null, agent.name,
          "completed", `Kanban card "${card.title}" moved to in progress`, 90
        ));
      }

      if (agent.memoryEnabled && currentState.memory) {
        updateMemoryStage(`Executed by ${agent.name} — task completed`);
        ExecutionBus.emit(ExecutionBus.createEvent(
          "workspace_updated", taskId, state.workspace?.id || null, agent.name,
          "completed", "Memory stage updated", 95
        ));
      }

      // Chain next agent: claude -> opencode (review) -> gemini (QA)
      const nextEngine = getNextExecutionEngine(agent.executionEngine);
      if (nextEngine) {
        const allAgents = loadAgents();
        const nextAgent = allAgents.find((a: BusinessAgent) => a.executionEngine === nextEngine);
        if (nextAgent) {
          const reviewPrompt = buildReviewPrompt(nextEngine, agent.name, result.output, plan.goal);
          const reviewPlan: BrainPlan = {
            ...plan,
            goal: reviewPrompt,
            agents: [{ agent: nextAgent.id as any, reason: "Chained review agent", priority: 1 }]
          };
          const newTaskId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          ExecutionBus.emit(ExecutionBus.createEvent(
            nextEngine === "opencode" ? "review_started" : "qa_started",
            newTaskId, state.workspace?.id || null, nextAgent.name,
            "pending", `${getEngineLabel(nextEngine)} starting review...`, 10
          ));
          setTimeout(() => executeTask(nextAgent, reviewPlan, state), 100);
        }
      }
    } else {
      log.status = "failed";
      log.error = result.error || "Execution failed.";
      markFailed(log.approvalId || "", log.error);
      emitProgress({ taskId, status: "failed", message: log.error, timestamp: Date.now() });
      ExecutionBus.emit(ExecutionBus.createEvent(
        "execution_failed", taskId, state.workspace?.id || null, agent.name,
        "failed", log.error, 100, { error: log.error }
      ));
    }
  } catch (err) {
    log.status = "failed";
    log.error = err instanceof Error ? err.message : "Unknown error.";
    log.endTime = Date.now();
    log.duration = log.endTime - log.startTime;
    markFailed(log.approvalId || "", log.error);
    emitProgress({ taskId, status: "failed", message: log.error, timestamp: Date.now() });
    ExecutionBus.emit(ExecutionBus.createEvent(
      "execution_failed", taskId, state.workspace?.id || null, agent.name,
      "failed", log.error, 100, { error: log.error }
    ));
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

function getNextExecutionEngine(current: ExecutionEngineId): ExecutionEngineId | null {
  const chain: Record<ExecutionEngineId, ExecutionEngineId | null> = {
    claude: "opencode",
    opencode: "gemini",
    gemini: null,
    codex: null,
    openclaw: null,
    "free-claude-code": null
  };
  return chain[current] ?? null;
}

function buildReviewPrompt(
  engine: ExecutionEngineId,
  previousAgent: string,
  previousOutput: string,
  originalGoal: string
): string {
  if (engine === "opencode") {
    return `CODE REVIEW REQUEST

Original Goal: ${originalGoal}
Previous Agent: ${previousAgent}

Generated Code/Output:
\`\`\`
${previousOutput.slice(0, 8000)}
\`\`\`

Please review the above code/output for:
1. Correctness and completeness
2. Best practices and patterns
3. Security considerations
4. Performance implications
5. Missing edge cases or error handling
6. Code style and maintainability

Provide a concise review with specific suggestions for improvement.`;
  } else if (engine === "gemini") {
    return `QA VALIDATION REQUEST

Original Goal: ${originalGoal}
Previous Agent: ${previousAgent} (reviewed by OpenCode)

Generated Code/Output:
\`\`\`
${previousOutput.slice(0, 8000)}
\`\`\`

Please perform QA validation for:
1. Accessibility (ARIA, semantic HTML, keyboard nav, color contrast)
2. Performance (bundle size, lazy loading, Core Web Vitals)
3. SEO (meta tags, structured data, sitemap)
4. Responsive design (mobile, tablet, desktop breakpoints)
5. Cross-browser compatibility
6. Error boundaries and graceful degradation
7. Security (XSS, CSRF, input validation)

Provide a pass/fail summary with specific findings.`;
  }
  return "";
}
