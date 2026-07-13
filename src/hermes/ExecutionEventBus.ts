export type ExecutionEventType =
  | "execution_created"
  | "execution_started"
  | "agent_started"
  | "agent_progress"
  | "agent_stream"
  | "agent_finished"
  | "review_started"
  | "review_finished"
  | "qa_started"
  | "qa_finished"
  | "workspace_updated"
  | "artifact_created"
  | "execution_completed"
  | "execution_failed";

export interface ExecutionBusEvent {
  type: ExecutionEventType;
  executionId: string;
  workspaceId: string | null;
  agentName: string;
  timestamp: number;
  status: "pending" | "running" | "completed" | "failed";
  message: string;
  progress: number;
  metadata: Record<string, unknown>;
}

type EventListener = (event: ExecutionBusEvent) => void;

let eventCounter = 0;
const listeners: Set<EventListener> = new Set();
const history: ExecutionBusEvent[] = [];
const MAX_HISTORY = 500;

function emit(event: ExecutionBusEvent): void {
  history.push(event);
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
  for (const fn of listeners) {
    try {
      fn(event);
    } catch {
      // Listener error — do not break other listeners
    }
  }
}

function subscribe(fn: EventListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function getHistory(): ExecutionBusEvent[] {
  return [...history];
}

function getHistoryForExecution(executionId: string): ExecutionBusEvent[] {
  return history.filter((e) => e.executionId === executionId);
}

function clearHistory(): void {
  history.length = 0;
}

function createEvent(
  type: ExecutionEventType,
  executionId: string,
  workspaceId: string | null,
  agentName: string,
  status: ExecutionBusEvent["status"],
  message: string,
  progress: number,
  metadata: Record<string, unknown> = {}
): ExecutionBusEvent {
  return {
    type,
    executionId,
    workspaceId,
    agentName,
    timestamp: Date.now(),
    status,
    message,
    progress,
    metadata
  };
}

export const ExecutionBus = {
  emit,
  subscribe,
  getHistory,
  getHistoryForExecution,
  clearHistory,
  createEvent
} as const;
