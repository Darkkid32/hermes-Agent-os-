import {
  Activity,
  Bot,
  BrainCircuit,
  Cable,
  CheckCircle,
  CircleDot,
  Cpu,
  DatabaseZap,
  Gauge,
  Globe2,
  PlugZap,
  Radio,
  Rocket,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow
} from "lucide-react";
import type { Integration, IntegrationSnapshot } from "../types";
import Metric from "../components/ui/Metric";
import SectionHeading from "../components/ui/SectionHeading";
import { statusLabel } from "../components/ui/statusLabel";

const iconMap: Record<string, typeof Activity> = {
  claude: TerminalSquare,
  openclaw: Bot,
  openclaude: Sparkles,
  hermes: BrainCircuit,
  gemini: Sparkles,
  codex: Sparkles,
  opencode: Sparkles,
  "free-claude-code": PlugZap,
  "provider-nvidia": ServerCog,
  "provider-openai": Sparkles,
  "provider-anthropic": BrainCircuit,
  "provider-gemini": Sparkles,
  "provider-openrouter": Cable,
  "provider-ollama": Cpu,
  "provider-minimax": Cpu,
  "provider-firecrawl": Globe2,
  "provider-convex": DatabaseZap,
  "provider-clerk": ShieldCheck,
  memory: DatabaseZap,
  scheduler: Rocket,
  "skill-registry": Sparkles,
  "provider-router": Cpu,
  "voice-control": Sparkles,
  goals: CircleDot,
  seo: Search,
  video: Sparkles,
  notebook: Sparkles,
  kanban: Sparkles,
  "usage-credits": Gauge,
  gateway: Radio,
  minimax: Cpu,
  "elizaos-runtime": ServerCog,
  "firecrawl-builder": Workflow
};

function statusClass(status: string) {
  if (status === "connected") return "is-online";
  if (status === "ready_to_connect" || status === "ready_to_configure") return "is-ready";
  return "is-muted";
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  onClick
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone?: string;
  onClick?: () => void;
}) {
  return (
    <button className={`stat-card ${tone || ""}`} onClick={onClick}>
      <div className="stat-icon">
        <Icon size={20} />
      </div>
      <div className="stat-content">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
      </div>
    </button>
  );
}

function AgentRow({
  integration,
  onOpen
}: {
  integration: Integration;
  onOpen: () => void;
}) {
  const Icon = iconMap[integration.id] || Bot;
  return (
    <button className="agent-row" onClick={onOpen}>
      <div className="agent-row-icon">
        <Icon size={18} />
      </div>
      <div className="agent-row-info">
        <strong>{integration.label}</strong>
        <span>{integration.connection}</span>
      </div>
      <span className={statusClass(String(integration.status))}>{statusLabel(String(integration.status))}</span>
    </button>
  );
}

export default function MissionControl({
  snapshot,
  onOpenAgent,
  onOpenDrawer
}: {
  snapshot: IntegrationSnapshot | null;
  onOpenAgent: (id: string) => void;
  onOpenDrawer: (integration: Integration) => void;
}) {
  const integrations = snapshot?.integrations || [];
  const connected = integrations.filter((item) => item.status === "connected");
  const providers = integrations.filter((item) => item.category === "provider");
  const platformModules = integrations.filter((item) =>
    ["memory", "scheduler", "skill-registry", "provider-router"].includes(item.id)
  );
  const agents = integrations.filter((item) =>
    ["claude", "openclaw", "openclaude", "hermes", "gemini", "codex", "opencode", "free-claude-code"].includes(item.id)
  );
  const selfModules = integrations.filter((item) => item.category === "self");
  const totalModules = integrations.length;
  const connectedCount = connected.length;
  const healthPct = totalModules > 0 ? Math.round((connectedCount / totalModules) * 100) : 0;

  const connectedProviders = providers.filter((p) => p.status === "connected");
  const connectedAgents = agents.filter((a) => a.status === "connected");
  const connectedPlatform = platformModules.filter((p) => p.status === "connected");
  const connectedSelf = selfModules.filter((s) => s.status === "connected");

  return (
    <main className="content mission-control">
      {/* Hero */}
      <section className="mc-hero">
        <div className="mc-hero-content">
          <span className="eyebrow">
            <ShieldCheck size={16} />
            System Overview
          </span>
          <h1>Mission Control</h1>
          <p>Real-time view of your AI operating system. Monitor agents, providers, and platform services.</p>
        </div>
      </section>

      {/* Health Stats Row */}
      <section className="mc-stats-grid">
        <StatCard
          icon={CheckCircle}
          label="System Health"
          value={`${healthPct}%`}
          tone={healthPct > 80 ? "is-online" : healthPct > 50 ? "is-ready" : "is-muted"}
        />
        <StatCard icon={Bot} label="Connected Agents" value={`${connectedAgents.length}/${agents.length}`} />
        <StatCard icon={Cpu} label="Model Providers" value={`${connectedProviders.length}/${providers.length}`} />
        <StatCard icon={Rocket} label="Platform Services" value={`${connectedPlatform.length}/${platformModules.length}`} />
        <StatCard icon={DatabaseZap} label="Local Modules" value={`${connectedSelf.length}/${selfModules.length}`} />
        <StatCard icon={Gauge} label="Total Modules" value={`${connectedCount}/${totalModules}`} />
      </section>

      {/* Quick Actions */}
      <section className="mc-quick-actions">
        <button className="mc-action-btn" onClick={() => onOpenAgent("claude")}>
          <TerminalSquare size={16} />
          Open Claude Code
        </button>
        <button className="mc-action-btn" onClick={() => onOpenAgent("hermes")}>
          <BrainCircuit size={16} />
          Open Hermes
        </button>
        <button className="mc-action-btn" onClick={() => onOpenAgent("provider-router")}>
          <Cpu size={16} />
          Provider Router
        </button>
        <button className="mc-action-btn" onClick={() => onOpenAgent("setup")}>
          <Settings size={16} />
          Setup
        </button>
      </section>

      {/* Agents */}
      <SectionHeading title="Agents" suffix={`${connectedAgents.length} connected`} />
      <section className="mc-list">
        {agents.map((item) => (
          <AgentRow integration={item} key={item.id} onOpen={() => onOpenAgent(item.id)} />
        ))}
      </section>

      {/* Providers */}
      <SectionHeading title="Model Providers" suffix={`${connectedProviders.length} configured`} />
      <section className="mc-list">
        {providers.map((item) => (
          <AgentRow integration={item} key={item.id} onOpen={() => onOpenAgent(item.id)} />
        ))}
      </section>

      {/* Platform */}
      <SectionHeading title="Platform Services" suffix="runtime and automation" />
      <section className="mc-list">
        {platformModules.map((item) => (
          <AgentRow integration={item} key={item.id} onOpen={() => onOpenAgent(item.id)} />
        ))}
      </section>

      {/* Local Workspace */}
      <SectionHeading title="Local Workspace" suffix="works without API keys" />
      <section className="mc-list">
        {selfModules.map((item) => (
          <AgentRow integration={item} key={item.id} onOpen={() => onOpenAgent(item.id)} />
        ))}
      </section>
    </main>
  );
}
