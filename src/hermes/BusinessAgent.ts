export type ExecutionEngineId =
  | "claude"
  | "gemini"
  | "codex"
  | "openclaw"
  | "opencode"
  | "free-claude-code";

export type CapabilityId =
  | "coding"
  | "research"
  | "writing"
  | "vision"
  | "browser"
  | "planning"
  | "automation";

export type ModuleId =
  | "goals"
  | "notebook"
  | "kanban"
  | "memory"
  | "scheduler"
  | "seo"
  | "video"
  | "skills"
  | "provider-router"
  | "usage-credits";

export type PermissionId =
  | "memory"
  | "create_goals"
  | "modify_notebook"
  | "create_kanban"
  | "schedule_jobs"
  | "call_workers";

export interface BusinessAgent {
  id: string;
  name: string;
  description: string;
  department: string;
  role: string;
  avatar: string;
  color: string;
  systemPrompt: string;
  executionEngine: ExecutionEngineId;
  capabilities: CapabilityId[];
  enabledModules: ModuleId[];
  permissions: PermissionId[];
  memoryEnabled: boolean;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export const EXECUTION_ENGINES: Array<{ id: ExecutionEngineId; label: string; description: string }> = [
  { id: "claude", label: "Claude Code", description: "Primary coding agent — code, debug, build" },
  { id: "gemini", label: "Gemini", description: "Research and analysis" },
  { id: "codex", label: "Codex", description: "Code generation and explanation" },
  { id: "openclaw", label: "OpenClaw", description: "Code review and analysis" },
  { id: "opencode", label: "OpenCode", description: "Interactive coding" },
  { id: "free-claude-code", label: "Free Claude Code", description: "Free-tier coding agent" }
];

export const CAPABILITIES: Array<{ id: CapabilityId; label: string; icon: string }> = [
  { id: "coding", label: "Coding", icon: "terminal" },
  { id: "research", label: "Research", icon: "search" },
  { id: "writing", label: "Writing", icon: "file-text" },
  { id: "vision", label: "Vision", icon: "eye" },
  { id: "browser", label: "Browser", icon: "globe" },
  { id: "planning", label: "Planning", icon: "layout" },
  { id: "automation", label: "Automation", icon: "zap" }
];

export const MODULES: Array<{ id: ModuleId; label: string }> = [
  { id: "goals", label: "Goals" },
  { id: "notebook", label: "Notebook" },
  { id: "kanban", label: "Kanban" },
  { id: "memory", label: "Memory" },
  { id: "scheduler", label: "Scheduler" },
  { id: "seo", label: "SEO" },
  { id: "video", label: "Video" },
  { id: "skills", label: "Skills" },
  { id: "provider-router", label: "Provider Router" },
  { id: "usage-credits", label: "Usage Credits" }
];

export const PERMISSIONS: Array<{ id: PermissionId; label: string; description: string }> = [
  { id: "memory", label: "Memory", description: "Read and write project memory" },
  { id: "create_goals", label: "Create Goals", description: "Create and manage goals" },
  { id: "modify_notebook", label: "Modify Notebook", description: "Create and edit notebook entries" },
  { id: "create_kanban", label: "Create Kanban", description: "Create and move kanban cards" },
  { id: "schedule_jobs", label: "Schedule Jobs", description: "Create scheduled tasks" },
  { id: "call_workers", label: "Call Workers", description: "Invoke other agents" }
];

export const DEPARTMENTS = [
  "Engineering",
  "Marketing",
  "Research",
  "Sales",
  "Design",
  "Operations",
  "Finance",
  "Legal",
  "Support",
  "Custom"
];

export const AVATAR_COLORS = [
  "#a76cff",
  "#ff3db2",
  "#5eeaff",
  "#3ecf8e",
  "#ffc837",
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#96e6a1",
  "#dda0dd"
];

export function createBlankAgent(): BusinessAgent {
  return {
    id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    description: "",
    department: "Engineering",
    role: "",
    avatar: "",
    color: "#a76cff",
    systemPrompt: "",
    executionEngine: "claude",
    capabilities: [],
    enabledModules: ["memory"],
    permissions: ["memory"],
    memoryEnabled: true,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}
