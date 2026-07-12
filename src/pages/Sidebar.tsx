import {
  Activity,
  BrainCircuit,
  CircleDot,
  Cpu,
  DatabaseZap,
  KanbanSquare,
  LayoutDashboard,
  NotebookTabs,
  PlugZap,
  Radio,
  Rocket,
  Search,
  Settings,
  Sparkles,
  TerminalSquare,
  Video,
  Workflow
} from "lucide-react";

const workspaceItems = [
  { id: "mission", label: "Mission Control", icon: LayoutDashboard },
  { id: "hermes", label: "Hermes", icon: BrainCircuit },
  { id: "agent-builder", label: "Agent Builder", icon: Workflow },
  { id: "execution-results", label: "Execution Results", icon: Activity }
];
const agentItems = [
  { id: "claude", label: "Claude Code", icon: TerminalSquare },
  { id: "openclaw", label: "OpenClaw", icon: Sparkles },
  { id: "openclaude", label: "OpenClaude", icon: Sparkles },
  { id: "gemini", label: "Gemini", icon: Sparkles },
  { id: "codex", label: "Codex", icon: Sparkles },
  { id: "opencode", label: "OpenCode", icon: Sparkles },
  { id: "free-claude-code", label: "Free Claude", icon: PlugZap }
];
const automationItems = [
  { id: "scheduler", label: "Scheduler", icon: Rocket },
  { id: "skill-registry", label: "Skills", icon: Sparkles },
  { id: "provider-router", label: "Provider Router", icon: Cpu }
];
const selfItems = [
  { id: "goals", label: "Goals", icon: CircleDot },
  { id: "notebook", label: "Notebook", icon: NotebookTabs },
  { id: "kanban", label: "Kanban", icon: KanbanSquare },
  { id: "memory", label: "Memory", icon: DatabaseZap },
  { id: "seo", label: "SEO", icon: Search },
  { id: "video", label: "Video", icon: Video }
];
const providerItems = [
  { id: "provider-router", label: "Provider Router", icon: Cpu }
];
const setupItems = [
  { id: "setup", label: "Setup", icon: Settings }
];

function NavGroup({
  title,
  items,
  selected,
  onSelect
}: {
  title: string;
  items: Array<{ id: string; label: string; icon: typeof Activity }>;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="nav-group">
      <p>{title}</p>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            className={selected === item.id ? "nav-item active" : "nav-item"}
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <Icon size={17} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </section>
  );
}

export default function Sidebar({
  selected,
  onSelect
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">H</div>
        <div>
          <strong>Hermes Agent Hub</strong>
          <span>v1.0 backend wired</span>
        </div>
      </div>

      <NavGroup title="Workspace" items={workspaceItems} selected={selected} onSelect={onSelect} />
      <NavGroup title="Agents" items={agentItems} selected={selected} onSelect={onSelect} />
      <NavGroup title="Automation" items={automationItems} selected={selected} onSelect={onSelect} />
      <NavGroup title="Productivity" items={selfItems} selected={selected} onSelect={onSelect} />
      <NavGroup title="" items={setupItems} selected={selected} onSelect={onSelect} />

      <div className="gateway-pill">
        <Radio size={15} />
        <span>Gateway</span>
        <b>API backed</b>
      </div>
    </aside>
  );
}

export const allNavItems = [...workspaceItems, ...agentItems, ...automationItems, ...selfItems, ...setupItems];
