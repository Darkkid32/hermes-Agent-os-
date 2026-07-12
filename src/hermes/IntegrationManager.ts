import type { BrainPlan } from "./HermesBrain";
import { createTimeline, addEvent, type Timeline, type TimelineEvent } from "./TimelineService";
import { createWorkspace, type Workspace } from "./WorkspaceService";
import { createGoal, type Goal } from "./GoalService";
import { createNotebookEntry, type NotebookEntry } from "./NotebookService";
import { createKanbanBoard, type KanbanBoard } from "./KanbanService";
import { createMemory, type ProjectMemory } from "./MemoryBootstrap";
import { createQueue, type AgentQueue, type QueueItem } from "./QueueService";
import type { ExecutionLog, TaskStatus } from "./BusinessAgentRuntime";
import { saveState, loadState } from "./PersistenceService";

export interface HermesState {
  workspace: Workspace | null;
  goal: Goal | null;
  notebook: NotebookEntry | null;
  kanban: KanbanBoard | null;
  memory: ProjectMemory | null;
  queue: AgentQueue;
  timeline: Timeline;
  response: string[];
  executionLogs: ExecutionLog[];
  currentExecutions: ExecutionLog[];
}

type Listener = (state: HermesState) => void;

function createInitialState(): HermesState {
  return {
    workspace: null,
    goal: null,
    notebook: null,
    kanban: null,
    memory: null,
    queue: { items: [] },
    timeline: createTimeline(),
    response: [],
    executionLogs: [],
    currentExecutions: []
  };
}

function loadPersistedState(): HermesState {
  const saved = loadState();
  if (!saved) return createInitialState();
  return {
    ...createInitialState(),
    ...saved,
    queue: { items: [] },
    response: [],
    currentExecutions: []
  };
}

let state: HermesState = loadPersistedState();

const listeners: Set<Listener> = new Set();

function emit(): void {
  saveState(state);
  for (const fn of listeners) {
    fn({ ...state });
  }
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  fn({ ...state });
  return () => { listeners.delete(fn); };
}

export function getState(): HermesState {
  return { ...state };
}

export function executePlan(plan: BrainPlan): HermesState {
  const response: string[] = [];
  state.response = [];

  response.push("Hermes understood your request.");

  if (plan.workspace.create && !state.workspace) {
    const ws = createWorkspace(plan);
    state.workspace = ws;
    addEvent(state.timeline, "workspace", "created", `Workspace "${ws.title}" created`);
    response.push(`Workspace "${ws.title}" created.`);
  } else if (state.workspace) {
    response.push(`Workspace "${state.workspace.title}" already exists.`);
  }

  const hasGoals = plan.modules.some((m) => m.module === "goals");
  if (hasGoals && !state.goal) {
    const goal = createGoal(plan);
    state.goal = goal;
    addEvent(state.timeline, "goal", "created", "Goal generated");
    response.push("Goal generated.");
  } else if (state.goal) {
    response.push("Goal already exists.");
  }

  if (!state.notebook) {
    const nb = createNotebookEntry(plan);
    state.notebook = nb;
    addEvent(state.timeline, "notebook", "initialized", "Notebook initialized");
    response.push("Notebook prepared.");
  } else {
    response.push("Notebook already exists.");
  }

  if (!state.kanban) {
    const kb = createKanbanBoard(plan);
    state.kanban = kb;
    addEvent(state.timeline, "kanban", "initialized", "Kanban board generated");
    response.push(`Kanban initialized with ${kb.planning.length} cards.`);
  } else {
    response.push("Kanban already exists.");
  }

  if (!state.memory) {
    const mem = createMemory(plan);
    state.memory = mem;
    addEvent(state.timeline, "memory", "initialized", "Memory initialized");
    response.push("Memory initialized.");
  } else {
    response.push("Memory already exists.");
  }

  const q = createQueue(plan);
  state.queue = q;
  for (const item of q.items) {
    addEvent(state.timeline, "queue", "queued", `${item.agent} queued`);
  }
  if (q.items.length > 0) {
    response.push(`Agents queued: ${q.items.map((q) => q.agent).join(", ")}.`);
  }

  response.push("Ready for execution.");
  state.response = response;

  emit();
  return { ...state };
}

export function updateGoalStatus(status: Goal["status"]): void {
  if (!state.goal) return;
  state.goal = { ...state.goal, status };
  addEvent(state.timeline, "goal", "completed", `Goal status → ${status}`);
  emit();
}

export function moveKanbanCard(cardId: string, to: "planning" | "inProgress" | "completed"): void {
  if (!state.kanban) return;
  const kb = state.kanban;
  let card: import("./KanbanService").KanbanCard | undefined;

  for (const list of [kb.planning, kb.inProgress, kb.completed]) {
    const idx = list.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      card = list.splice(idx, 1)[0];
      break;
    }
  }

  if (!card) return;

  const statusMap = { planning: "planning" as const, inProgress: "in_progress" as const, completed: "completed" as const };
  card = { ...card, status: statusMap[to] };

  if (to === "planning") kb.planning.push(card);
  else if (to === "inProgress") kb.inProgress.push(card);
  else kb.completed.push(card);

  addEvent(state.timeline, "kanban", to === "completed" ? "completed" : "started", `Card moved → ${to.replace("_", " ")}`);
  emit();
}

export function updateMemoryStage(stage: string): void {
  if (!state.memory) return;
  state.memory = { ...state.memory, currentStage: stage };
  addEvent(state.timeline, "memory", "created", `Memory stage → ${stage}`);
  emit();
}

export function updateNotebook(updates: Partial<import("./NotebookService").NotebookEntry>): void {
  if (!state.notebook) return;
  state.notebook = { ...state.notebook, ...updates };
  addEvent(state.timeline, "notebook", "updated", "Notebook updated");
  emit();
}

export function updateQueueItemStatus(agent: string, status: QueueItem["status"]): void {
  const item = state.queue.items.find((q) => q.agent === agent);
  if (!item) return;
  state.queue = {
    ...state.queue,
    items: state.queue.items.map((q) => q.agent === agent ? { ...q, status } : q)
  };
  addEvent(state.timeline, "queue", status === "completed" ? "completed" : "started", `${agent} → ${status}`);
  emit();
}

export function addExecutionLog(log: ExecutionLog): void {
  state.executionLogs = [log, ...state.executionLogs];
  if (log.status === "queued" || log.status === "preparing" || log.status === "executing") {
    state.currentExecutions = [log, ...state.currentExecutions];
  }
  emit();
}

export function updateExecutionLog(taskId: string, updates: Partial<ExecutionLog>): void {
  state.executionLogs = state.executionLogs.map((l) => l.id === taskId ? { ...l, ...updates } : l);
  state.currentExecutions = state.currentExecutions.map((l) => l.id === taskId ? { ...l, ...updates } : l);
  if (updates.status === "completed" || updates.status === "failed" || updates.status === "cancelled") {
    state.currentExecutions = state.currentExecutions.filter((l) => l.id !== taskId);
  }
  emit();
}

export function reset(): void {
  state = createInitialState();
  emit();
}
