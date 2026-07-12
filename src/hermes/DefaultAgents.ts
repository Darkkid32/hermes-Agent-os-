import type { BusinessAgent } from "./BusinessAgent";

const DEFAULT_AGENTS: BusinessAgent[] = [
  {
    id: "agent-default-coding",
    name: "Coding Agent",
    description: "Primary software engineering agent.",
    department: "Engineering",
    role: "Software Engineer",
    avatar: "💻",
    color: "#a76cff",
    systemPrompt: "You are a software engineering agent. You write, debug, and build code.",
    executionEngine: "claude",
    capabilities: ["coding", "planning", "automation"],
    enabledModules: ["goals", "notebook", "kanban", "memory"],
    permissions: ["memory", "create_goals", "modify_notebook", "create_kanban", "call_workers"],
    memoryEnabled: true,
    active: true,
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: "agent-default-research",
    name: "Research Agent",
    description: "Researches topics and gathers information.",
    department: "Research",
    role: "Research Analyst",
    avatar: "🔬",
    color: "#5eeaff",
    systemPrompt: "You are a research agent. You investigate topics and gather comprehensive information.",
    executionEngine: "gemini",
    capabilities: ["research", "writing", "planning"],
    enabledModules: ["notebook", "memory"],
    permissions: ["memory", "modify_notebook"],
    memoryEnabled: true,
    active: true,
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: "agent-default-qa",
    name: "QA Agent",
    description: "Reviews code and validates implementations.",
    department: "Quality Assurance",
    role: "QA Engineer",
    avatar: "🧪",
    color: "#3ecf8e",
    systemPrompt: "You are a QA agent. You review code, write tests, and validate implementations.",
    executionEngine: "codex",
    capabilities: ["coding", "planning"],
    enabledModules: ["goals", "kanban", "notebook"],
    permissions: ["create_goals", "modify_notebook", "create_kanban"],
    memoryEnabled: false,
    active: true,
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: "agent-default-marketing",
    name: "Marketing Agent",
    description: "Creates marketing plans and SEO strategies.",
    department: "Marketing",
    role: "Marketing Strategist",
    avatar: "📢",
    color: "#ff3db2",
    systemPrompt: "You are a marketing agent. You create marketing plans, SEO strategies, and content.",
    executionEngine: "claude",
    capabilities: ["writing", "planning"],
    enabledModules: ["seo", "goals", "notebook"],
    permissions: ["create_goals", "modify_notebook"],
    memoryEnabled: false,
    active: true,
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: "agent-default-automation",
    name: "Automation Agent",
    description: "Automates repetitive operational workflows.",
    department: "Operations",
    role: "Automation Engineer",
    avatar: "⚡",
    color: "#ffc837",
    systemPrompt: "You are an automation agent. You automate workflows and operational tasks.",
    executionEngine: "opencode",
    capabilities: ["automation", "planning"],
    enabledModules: ["scheduler", "goals", "memory"],
    permissions: ["schedule_jobs", "memory", "create_goals"],
    memoryEnabled: true,
    active: true,
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: "agent-default-vision",
    name: "Vision Agent",
    description: "Image analysis and visual reasoning specialist.",
    department: "AI",
    role: "Vision Specialist",
    avatar: "👁️",
    color: "#45b7d1",
    systemPrompt: "You are a vision agent. You analyze images and perform visual reasoning.",
    executionEngine: "openclaw",
    capabilities: ["vision", "research"],
    enabledModules: ["notebook", "memory"],
    permissions: ["memory", "modify_notebook"],
    memoryEnabled: true,
    active: true,
    createdAt: 0,
    updatedAt: 0
  }
];

export function getDefaultAgents(): BusinessAgent[] {
  const now = Date.now();
  return DEFAULT_AGENTS.map((a) => ({
    ...a,
    createdAt: now,
    updatedAt: now
  }));
}

export function isDefaultAgent(id: string): boolean {
  return id.startsWith("agent-default-");
}
