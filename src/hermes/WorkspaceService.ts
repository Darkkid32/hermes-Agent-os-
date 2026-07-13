import type { BrainPlan } from "./HermesBrain";

export interface WorkspaceFile {
  id: string;
  name: string;
  type: string;
  content: string;
  size: number;
  createdAt: number;
}

export interface Workspace {
  id: string;
  title: string;
  status: "active" | "paused" | "completed";
  createdAt: number;
  goal: string;
  timeline: string[];
  activeAgents: string[];
  modules: string[];
  files: WorkspaceFile[];
}

let wsCounter = 0;

function nextWsId(): string {
  return `ws-${Date.now()}-${++wsCounter}`;
}

export function createWorkspace(plan: BrainPlan): Workspace {
  const title = plan.workspace.suggestedName || "New Project";
  const modules = plan.modules.map((m) => m.module);
  const agents = plan.agents.map((a) => a.agent);

  return {
    id: nextWsId(),
    title,
    status: "active",
    createdAt: Date.now(),
    goal: plan.goal,
    timeline: [],
    activeAgents: agents,
    modules,
    files: []
  };
}

export function addWorkspaceFiles(ws: Workspace, files: WorkspaceFile[]): Workspace {
  return {
    ...ws,
    files: [...ws.files, ...files]
  };
}
