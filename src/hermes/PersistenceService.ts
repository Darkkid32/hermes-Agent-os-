import type { HermesState } from "./IntegrationManager";
import type { Workspace } from "./WorkspaceService";
import type { Goal } from "./GoalService";
import type { NotebookEntry } from "./NotebookService";
import type { KanbanBoard } from "./KanbanService";
import type { ProjectMemory } from "./MemoryBootstrap";
import type { Timeline } from "./TimelineService";
import type { ExecutionLog } from "./BusinessAgentRuntime";

const STORAGE_KEY = "hermes-state";
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: HermesState | null = null;

interface PersistedState {
  workspace: Workspace | null;
  goal: Goal | null;
  notebook: NotebookEntry | null;
  kanban: KanbanBoard | null;
  memory: ProjectMemory | null;
  timeline: Timeline;
  executionLogs: ExecutionLog[];
  savedAt: number;
}

export function saveState(state: HermesState): void {
  pendingState = state;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!pendingState) return;
    const s = pendingState;
    pendingState = null;
    try {
      const toSave: PersistedState = {
        workspace: s.workspace,
        goal: s.goal,
        notebook: s.notebook,
        kanban: s.kanban,
        memory: s.memory,
        timeline: s.timeline,
        executionLogs: s.executionLogs.slice(0, 100),
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error("[PersistenceService] Failed to save:", e);
    }
  }, 1000);
}

export function loadState(): Partial<HermesState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      workspace: parsed.workspace || null,
      goal: parsed.goal || null,
      notebook: parsed.notebook || null,
      kanban: parsed.kanban || null,
      memory: parsed.memory || null,
      timeline: parsed.timeline || { events: [] },
      executionLogs: parsed.executionLogs || []
    };
  } catch (e) {
    console.error("[PersistenceService] Failed to load:", e);
    return null;
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getLastSavedAt(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    return parsed.savedAt || null;
  } catch {
    return null;
  }
}
