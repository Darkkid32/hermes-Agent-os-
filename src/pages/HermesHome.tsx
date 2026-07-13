import {
  Bot,
  BrainCircuit,
  CheckCircle,
  CircleDot,
  Cpu,
  DatabaseZap,
  FileText,
  FolderOpen,
  Gauge,
  LayoutGrid,
  Loader2,
  MessageSquare,
  PlugZap,
  Search,
  Send,
  Sparkles,
  TerminalSquare,
  Zap,
  Clock,
  Activity,
  XCircle,
  BarChart3,
  Shield,
  AlertTriangle,
  ShieldCheck,
  ShieldX,
  Clock3,
  Eye,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import type { Integration, IntegrationSnapshot } from "../types";
import { think, type BrainPlan } from "../hermes/HermesBrain";
import { loadAgents, subscribeAgents } from "../hermes/AgentStore";
import type { BusinessAgent } from "../hermes/BusinessAgent";
import { EXECUTION_ENGINES } from "../hermes/BusinessAgent";
import type { CapabilityAnalysis, AgentMatch } from "../hermes/CapabilityMatcher";
import agentIcons from "../services/agentIcons";
import { getGreeting } from "../services/greeting";
import {
  executePlan,
  subscribe,
  getState,
  type HermesState
} from "../hermes/IntegrationManager";
import { validate, type ValidationResult } from "../hermes/ValidationService";
import { formatEventTime } from "../hermes/TimelineService";
import type { Workspace } from "../hermes/WorkspaceService";
import type { Goal } from "../hermes/GoalService";
import type { KanbanBoard } from "../hermes/KanbanService";
import type { ProjectMemory } from "../hermes/MemoryBootstrap";
import type { AgentQueue } from "../hermes/QueueService";
import type { NotebookEntry } from "../hermes/NotebookService";
import { executeTask, onTaskProgress, getAllLogs, getExecutionStats, approveTaskExecution, rejectTaskExecution, getPendingTaskApprovals, type ExecutionLog, type TaskProgress } from "../hermes/BusinessAgentRuntime";
import {
  onApprovalUpdate,
  getPendingApprovals,
  getApprovalStats,
  classifyRisk,
  type ApprovalRequest,
  type RiskLevel
} from "../hermes/ApprovalManager";

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  return (
    <div className="exec-card exec-workspace">
      <div className="exec-card-header">
        <FolderOpen size={18} />
        <span>Workspace</span>
        <span className={`exec-status exec-status-${workspace.status}`}>{workspace.status}</span>
      </div>
      <div className="exec-card-body">
        <strong>{workspace.title}</strong>
        <p className="exec-card-goal">{workspace.goal}</p>
        <div className="exec-card-meta">
          <span>{workspace.activeAgents.length} agents</span>
          <span>{workspace.modules.length} modules</span>
        </div>
      </div>
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  return (
    <div className="exec-card exec-goal">
      <div className="exec-card-header">
        <CircleDot size={18} />
        <span>Goal</span>
        <span className={`exec-priority exec-priority-${goal.priority}`}>{goal.priority}</span>
      </div>
      <div className="exec-card-body">
        <strong>{goal.title}</strong>
        <p className="exec-card-desc">{goal.description}</p>
        <div className="exec-card-meta">
          <span className={`exec-status exec-status-${goal.status}`}>{goal.status.replace("_", " ")}</span>
        </div>
      </div>
    </div>
  );
}

function NotebookCard({ entry }: { entry: NotebookEntry }) {
  return (
    <div className="exec-card exec-notebook">
      <div className="exec-card-header">
        <FileText size={18} />
        <span>Notebook</span>
      </div>
      <div className="exec-card-body">
        <strong>{entry.title}</strong>
        <p className="exec-card-desc">{entry.summary}</p>
        {entry.requirements.length > 0 && (
          <div className="exec-requirements">
            <span className="exec-req-label">Requirements:</span>
            <ul>
              {entry.requirements.slice(0, 4).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="exec-architecture">
          <span className="exec-req-label">Architecture:</span>
          <p>{entry.suggestedArchitecture}</p>
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ board }: { board: KanbanBoard }) {
  return (
    <div className="exec-card exec-kanban">
      <div className="exec-card-header">
        <LayoutGrid size={18} />
        <span>Kanban Board</span>
      </div>
      <div className="exec-card-body">
        <div className="exec-kanban-columns">
          <div className="exec-kanban-col">
            <span className="exec-kanban-col-title">Planning ({board.planning.length})</span>
            {board.planning.slice(0, 4).map((card) => (
              <div key={card.id} className="exec-kanban-item">{card.title}</div>
            ))}
            {board.planning.length > 4 && (
              <span className="exec-kanban-more">+{board.planning.length - 4} more</span>
            )}
          </div>
          <div className="exec-kanban-col">
            <span className="exec-kanban-col-title">In Progress ({board.inProgress.length})</span>
            {board.inProgress.length === 0 && (
              <span className="exec-kanban-empty">No tasks yet</span>
            )}
          </div>
          <div className="exec-kanban-col">
            <span className="exec-kanban-col-title">Completed ({board.completed.length})</span>
            {board.completed.length === 0 && (
              <span className="exec-kanban-empty">No tasks yet</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoryCard({ memory }: { memory: ProjectMemory }) {
  return (
    <div className="exec-card exec-memory">
      <div className="exec-card-header">
        <BrainCircuit size={18} />
        <span>Memory</span>
      </div>
      <div className="exec-card-body">
        <div className="exec-memory-row">
          <span className="exec-memory-label">Project</span>
          <span>{memory.projectName}</span>
        </div>
        <div className="exec-memory-row">
          <span className="exec-memory-label">Stack</span>
          <span>{memory.preferredStack.join(", ")}</span>
        </div>
        <div className="exec-memory-row">
          <span className="exec-memory-label">Stage</span>
          <span>{memory.currentStage}</span>
        </div>
        <div className="exec-memory-row">
          <span className="exec-memory-label">Decision</span>
          <span>{memory.recentDecision}</span>
        </div>
      </div>
    </div>
  );
}

function QueueCard({ queue }: { queue: AgentQueue }) {
  return (
    <div className="exec-card exec-queue">
      <div className="exec-card-header">
        <TerminalSquare size={18} />
        <span>Agent Queue</span>
      </div>
      <div className="exec-card-body">
        {queue.items.length === 0 ? (
          <span className="exec-queue-empty">No agents queued</span>
        ) : (
          <div className="exec-queue-list">
            {queue.items.map((item) => {
              const Icon = agentIcons[item.agent] || Bot;
              return (
                <div key={item.agent} className="exec-queue-item">
                  <Icon size={16} />
                  <span className="exec-queue-agent">{item.agent}</span>
                  <span className="exec-queue-reason">{item.reason}</span>
                  <span className={`exec-queue-status exec-queue-status-${item.status}`}>{item.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineCard({ state }: { state: HermesState }) {
  const events = state.timeline.events;
  return (
    <div className="exec-card exec-timeline">
      <div className="exec-card-header">
        <Gauge size={18} />
        <span>Timeline</span>
        <span className="exec-timeline-count">{events.length} events</span>
      </div>
      <div className="exec-card-body">
        <div className="exec-timeline-list">
          {events.map((evt) => (
            <div key={evt.id} className="exec-timeline-event">
              <span className="exec-timeline-dot" />
              <span className="exec-timeline-label">{evt.label}</span>
              <span className="exec-timeline-time">{formatEventTime(evt.timestamp)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResponseCard({ state }: { state: HermesState }) {
  return (
    <div className="exec-card exec-response">
      <div className="exec-card-header">
        <Sparkles size={18} />
        <span>Hermes Response</span>
      </div>
      <div className="exec-card-body">
        <ul className="exec-response-list">
          {state.response.map((line, idx) => (
            <li key={idx} className="exec-response-line">
              <CheckCircle size={14} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ValidationCard({ result }: { result: ValidationResult }) {
  return (
    <div className="exec-card exec-validation">
      <div className="exec-card-header">
        <CheckCircle size={18} />
        <span>Consistency Validation</span>
        <span className={`exec-status ${result.pass ? "exec-status-completed" : "exec-status-pending"}`}>
          {result.pass ? "PASS" : "FAIL"}
        </span>
      </div>
      <div className="exec-card-body">
        <div className="exec-validation-list">
          {result.checks.map((check) => (
            <div key={check.name} className={`exec-validation-item ${check.pass ? "is-pass" : "is-fail"}`}>
              <CheckCircle size={14} />
              <span className="exec-validation-name">{check.name}</span>
              <span className="exec-validation-detail">{check.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExecutionDashboardCard({ logs, stats }: { logs: ExecutionLog[]; stats: ReturnType<typeof getExecutionStats> }) {
  const recentLogs = logs.slice(0, 8);

  return (
    <div className="exec-card exec-dashboard-card">
      <div className="exec-card-header">
        <Activity size={18} />
        <span>Execution Dashboard</span>
      </div>
      <div className="exec-card-body">
        <div className="exec-stats-row">
          <div className="exec-stat">
            <span className="exec-stat-value">{stats.total}</span>
            <span className="exec-stat-label">Total</span>
          </div>
          <div className="exec-stat exec-stat-success">
            <span className="exec-stat-value">{stats.completed}</span>
            <span className="exec-stat-label">Completed</span>
          </div>
          <div className="exec-stat exec-stat-fail">
            <span className="exec-stat-value">{stats.failed}</span>
            <span className="exec-stat-label">Failed</span>
          </div>
          <div className="exec-stat exec-stat-active">
            <span className="exec-stat-value">{stats.active}</span>
            <span className="exec-stat-label">Active</span>
          </div>
        </div>
        <div className="exec-stats-row">
          <div className="exec-stat-wide">
            <Clock size={14} />
            <span>Avg Duration: {(stats.avgDuration / 1000).toFixed(1)}s</span>
          </div>
          <div className="exec-stat-wide">
            <BarChart3 size={14} />
            <span>Success Rate: {stats.successRate}%</span>
          </div>
        </div>
        {recentLogs.length > 0 && (
          <div className="exec-recent">
            <span className="exec-recent-label">Recent Executions</span>
            {recentLogs.map((log) => (
              <div key={log.id} className="exec-recent-item">
                <span className={`exec-recent-status exec-recent-status-${log.status}`}>
                  {log.status === "completed" ? <CheckCircle size={12} /> : log.status === "failed" ? <XCircle size={12} /> : <Loader2 size={12} className="spin" />}
                </span>
                <span className="exec-recent-agent">{log.agentName}</span>
                <span className="exec-recent-engine">{log.engine}</span>
                <span className="exec-recent-prompt">{log.prompt.slice(0, 50)}{log.prompt.length > 50 ? "..." : ""}</span>
                <span className="exec-recent-time">{log.duration > 0 ? `${(log.duration / 1000).toFixed(1)}s` : "running..."}</span>
              </div>
            ))}
          </div>
        )}
        {recentLogs.length === 0 && (
          <div className="exec-empty">
            <p>No executions yet. Type a task above and click "Think & Execute".</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const config: Record<RiskLevel, { icon: typeof Shield; label: string; className: string }> = {
    low: { icon: ShieldCheck, label: "LOW", className: "risk-low" },
    medium: { icon: AlertTriangle, label: "MEDIUM", className: "risk-medium" },
    high: { icon: Shield, label: "HIGH", className: "risk-high" },
    critical: { icon: ShieldX, label: "CRITICAL", className: "risk-critical" }
  };
  const { icon: Icon, label, className } = config[risk];
  return (
    <span className={`risk-badge ${className}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function ApprovalPanelCard({ approvals, stats }: { approvals: ApprovalRequest[]; stats: ReturnType<typeof getApprovalStats> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const pending = approvals.filter((a) => a.status === "pending");

  return (
    <div className="exec-card exec-approval-panel">
      <div className="exec-card-header">
        <Shield size={18} />
        <span>Approvals</span>
        {pending.length > 0 && (
          <span className="approval-pending-count">{pending.length} pending</span>
        )}
      </div>
      <div className="exec-card-body">
        <div className="approval-stats-row">
          <div className="approval-stat">
            <span className="approval-stat-value">{stats.pending}</span>
            <span className="approval-stat-label">Pending</span>
          </div>
          <div className="approval-stat approval-stat-approved">
            <span className="approval-stat-value">{stats.approvedToday}</span>
            <span className="approval-stat-label">Approved Today</span>
          </div>
          <div className="approval-stat approval-stat-rejected">
            <span className="approval-stat-value">{stats.rejectedToday}</span>
            <span className="approval-stat-label">Rejected Today</span>
          </div>
          <div className="approval-stat">
            <Clock3 size={14} />
            <span className="approval-stat-value">{stats.avgApprovalTime > 0 ? `${(stats.avgApprovalTime / 1000).toFixed(0)}s` : "—"}</span>
            <span className="approval-stat-label">Avg Time</span>
          </div>
        </div>

        {pending.length > 0 && (
          <div className="approval-list">
            <span className="approval-list-label">Pending Approvals</span>
            {pending.map((approval) => (
              <div key={approval.id} className="approval-item">
                <div className="approval-item-header">
                  <RiskBadge risk={approval.risk} />
                  <span className="approval-item-agent">{approval.agent.name}</span>
                  <span className="approval-item-engine">{approval.agent.executionEngine}</span>
                  <button
                    className="approval-expand-btn"
                    onClick={() => setExpanded(expanded === approval.id ? null : approval.id)}
                  >
                    <Eye size={14} />
                    {expanded === approval.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                <div className="approval-item-prompt">{approval.plan.goal}</div>
                <div className="approval-item-meta">
                  <span>Est: {approval.estimatedDuration}</span>
                  <span>Modules: {approval.modulesAffected.join(", ")}</span>
                </div>

                {expanded === approval.id && (
                  <div className="approval-preview">
                    <div className="approval-preview-section">
                      <span className="approval-preview-label">Goal</span>
                      <span className="approval-preview-value">{approval.plan.goal}</span>
                    </div>
                    {approval.state.workspace && (
                      <div className="approval-preview-section">
                        <span className="approval-preview-label">Workspace</span>
                        <span className="approval-preview-value">{approval.state.workspace.title}</span>
                      </div>
                    )}
                    {approval.state.notebook && (
                      <div className="approval-preview-section">
                        <span className="approval-preview-label">Notebook</span>
                        <span className="approval-preview-value">{approval.state.notebook.title}</span>
                      </div>
                    )}
                    {approval.state.goal && (
                      <div className="approval-preview-section">
                        <span className="approval-preview-label">Goal</span>
                        <span className="approval-preview-value">{approval.state.goal.title}</span>
                      </div>
                    )}
                    {approval.state.kanban && (
                      <div className="approval-preview-section">
                        <span className="approval-preview-label">Kanban</span>
                        <span className="approval-preview-value">{approval.state.kanban.planning.length} cards planned</span>
                      </div>
                    )}
                    {approval.state.memory && (
                      <div className="approval-preview-section">
                        <span className="approval-preview-label">Memory</span>
                        <span className="approval-preview-value">{approval.state.memory.currentStage}</span>
                      </div>
                    )}
                    <div className="approval-preview-section">
                      <span className="approval-preview-label">Permissions Required</span>
                      <div className="approval-preview-chips">
                        {approval.permissionsRequired.map((p) => (
                          <span key={p} className="approval-chip">{p}</span>
                        ))}
                      </div>
                    </div>
                    <div className="approval-preview-section">
                      <span className="approval-preview-label">Modules Affected</span>
                      <div className="approval-preview-chips">
                        {approval.modulesAffected.map((m) => (
                          <span key={m} className="approval-chip approval-chip-module">{m}</span>
                        ))}
                      </div>
                    </div>
                    <div className="approval-preview-section">
                      <span className="approval-preview-label">Execution Engine</span>
                      <span className="approval-preview-value">{approval.agent.executionEngine}</span>
                    </div>
                  </div>
                )}

                <div className="approval-actions">
                  <button
                    className="approval-btn approval-btn-approve"
                    onClick={() => approveTaskExecution(approval.taskId)}
                  >
                    <CheckCircle size={14} />
                    Approve
                  </button>
                  <button
                    className="approval-btn approval-btn-reject"
                    onClick={() => rejectTaskExecution(approval.taskId, "Rejected by user")}
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                  <button
                    className="approval-btn approval-btn-later"
                    onClick={() => rejectTaskExecution(approval.taskId, "Deferred")}
                  >
                    <Clock3 size={14} />
                    Later
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pending.length === 0 && (
          <div className="approval-empty">
            <p>No pending approvals. All clear.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CapabilityAnalysisCard({ analysis }: { analysis: CapabilityAnalysis }) {
  return (
    <div className="exec-card exec-capability">
      <div className="exec-card-header">
        <BrainCircuit size={18} />
        <span>Capability Analysis</span>
      </div>
      <div className="exec-card-body">
        {analysis.requestedCapabilities.length > 0 && (
          <div className="cap-section">
            <span className="cap-label">Requested Capabilities</span>
            <div className="cap-chips">
              {analysis.requestedCapabilities.map((cap) => (
                <span key={cap} className="cap-chip cap-chip-requested">{cap}</span>
              ))}
            </div>
          </div>
        )}

        {analysis.topMatch && (
          <div className="cap-section">
            <span className="cap-label">Top Match</span>
            <div className="cap-match cap-match-top">
              <div className="cap-match-header">
                <div className="cap-match-avatar" style={{ background: analysis.topMatch.agent.color }}>
                  {analysis.topMatch.agent.avatar || analysis.topMatch.agent.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="cap-match-info">
                  <strong>{analysis.topMatch.agent.name}</strong>
                  <span className="cap-match-dept">{analysis.topMatch.agent.department}</span>
                </div>
                <span className="cap-match-score">{analysis.topMatch.score}%</span>
              </div>
              <div className="cap-match-details">
                {analysis.topMatch.matchedCapabilities.length > 0 && (
                  <div className="cap-match-caps">
                    <span className="cap-match-caps-label">Matched:</span>
                    {analysis.topMatch.matchedCapabilities.map((c) => (
                      <span key={c} className="cap-chip cap-chip-matched">{c}</span>
                    ))}
                  </div>
                )}
                {analysis.topMatch.missingCapabilities.length > 0 && (
                  <div className="cap-match-caps">
                    <span className="cap-match-caps-label">Missing:</span>
                    {analysis.topMatch.missingCapabilities.map((c) => (
                      <span key={c} className="cap-chip cap-chip-missing">{c}</span>
                    ))}
                  </div>
                )}
                <div className="cap-match-engine">
                  <TerminalSquare size={12} />
                  <span>Engine: {analysis.topMatch.executionEngineLabel}</span>
                </div>
                <div className="cap-match-reason">{analysis.topMatch.reason}</div>
              </div>
            </div>
          </div>
        )}

        {analysis.runnerUp && (
          <div className="cap-section">
            <span className="cap-label">Runner-up</span>
            <div className="cap-match cap-match-runner">
              <div className="cap-match-header">
                <div className="cap-match-avatar cap-match-avatar-sm" style={{ background: analysis.runnerUp.agent.color }}>
                  {analysis.runnerUp.agent.avatar || analysis.runnerUp.agent.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="cap-match-info">
                  <strong>{analysis.runnerUp.agent.name}</strong>
                  <span className="cap-match-dept">{analysis.runnerUp.agent.department}</span>
                </div>
                <span className="cap-match-score">{analysis.runnerUp.score}%</span>
              </div>
              <div className="cap-match-details">
                <div className="cap-match-engine">
                  <TerminalSquare size={12} />
                  <span>Engine: {analysis.runnerUp.executionEngineLabel}</span>
                </div>
                <div className="cap-match-reason">{analysis.runnerUp.reason}</div>
              </div>
            </div>
          </div>
        )}

        {!analysis.hasMatches && (
          <div className="cap-fallback">
            <p>{analysis.fallbackMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HermesHome({
  snapshot,
  onOpenAgent
}: {
  snapshot: IntegrationSnapshot | null;
  onOpenAgent: (id: string) => void;
}) {
  const integrations = snapshot?.integrations || [];
  const connected = integrations.filter((i) => i.status === "connected");
  const agents = integrations.filter((i) =>
    ["claude", "openclaw", "openclaude", "hermes", "gemini", "codex", "opencode", "free-claude-code"].includes(i.id)
  );
  const connectedAgents = agents.filter((a) => a.status === "connected");
  const providers = integrations.filter((i) => i.category === "provider");
  const connectedProviders = providers.filter((p) => p.status === "connected");

  const [message, setMessage] = useState("");
  const [thinking, setThinking] = useState(false);
  const [brainPlan, setBrainPlan] = useState<BrainPlan | null>(null);
  const [hermesState, setHermesState] = useState<HermesState>(getState);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [businessAgents, setBusinessAgents] = useState<BusinessAgent[]>(loadAgents);
  const [execLogs, setExecLogs] = useState<ExecutionLog[]>([]);
  const [execStats, setExecStats] = useState(getExecutionStats);
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalStats, setApprovalStats] = useState(getApprovalStats);

  useEffect(() => {
    return subscribe((s) => {
      setHermesState(s);
      setValidation(validate(s));
    });
  }, []);

  useEffect(() => {
    return subscribeAgents(setBusinessAgents);
  }, []);

  useEffect(() => {
    const unsub = onTaskProgress((progress) => {
      setTaskProgress(progress);
      setExecLogs(getAllLogs());
      setExecStats(getExecutionStats());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onApprovalUpdate((allApprovals) => {
      setApprovals(allApprovals);
      setApprovalStats(getApprovalStats());
    });
    return unsub;
  }, []);

  const hasExecution = hermesState.response.length > 0;

  const handleThink = useCallback(async () => {
    if (!message.trim()) return;
    setThinking(true);
    setBrainPlan(null);
    setTaskProgress(null);

    const plan = think(message, businessAgents);
    setBrainPlan(plan);

    executePlan(plan);

    if (plan.capabilityAnalysis.topMatch) {
      const agent = plan.capabilityAnalysis.topMatch.agent;
      const state = getState();
      await executeTask(agent, plan, state);
      setExecLogs(getAllLogs());
      setExecStats(getExecutionStats());
    }

    setThinking(false);
  }, [message, businessAgents]);

  return (
    <main className="content hermes-home">
      <section className="hh-welcome">
        <div className="hh-welcome-icon">
          <BrainCircuit size={32} />
        </div>
        <div className="hh-welcome-text">
          <span className="eyebrow">
            <Sparkles size={16} />
            Hermes AI OS
          </span>
          <h1>{getGreeting()}</h1>
          <p className="hh-question">What would you like to accomplish today?</p>
        </div>
      </section>

      <section className="brain-input-section">
        <div className="brain-input-wrap">
          <textarea
            className="brain-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleThink();
              }
            }}
            placeholder="Describe what you want to accomplish..."
            rows={2}
          />
          <button
            className="brain-input-btn"
            onClick={handleThink}
            disabled={thinking || !message.trim()}
          >
            {thinking ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            {thinking ? "Thinking..." : "Think & Execute"}
          </button>
        </div>
        <p className="brain-input-hint">Hermes will analyze, plan, and prepare your project for execution.</p>
      </section>

      {thinking && (
        <section className="brain-thinking">
          <div className="brain-thinking-icon">
            <Loader2 className="spin" size={24} />
          </div>
          <div className="brain-thinking-text">
            <strong>Analyzing your request...</strong>
            <span>Brain → Workspace → Goals → Notebook → Kanban → Memory → Queue</span>
          </div>
        </section>
      )}

      {brainPlan && !hasExecution && (
        <section className="brain-output">
          <div className="brain-plan">
            <div className="brain-plan-header">
              <BrainCircuit size={18} />
              <span>Execution Plan</span>
            </div>
            <div className="brain-plan-grid">
              <div className="brain-plan-card">
                <span className="brain-plan-label">Intent</span>
                <span className="brain-plan-value brain-intent">{brainPlan.intent.replace(/_/g, " ")}</span>
                <span className="brain-plan-meta">confidence: {Math.round(brainPlan.intentConfidence * 100)}%</span>
              </div>
              <div className="brain-plan-card">
                <span className="brain-plan-label">Complexity</span>
                <span className={`brain-plan-value brain-complexity brain-complexity-${brainPlan.complexity.toLowerCase()}`}>
                  {brainPlan.complexity}
                </span>
                <span className="brain-plan-meta">score: {brainPlan.complexityScore}</span>
              </div>
              <div className="brain-plan-card">
                <span className="brain-plan-label">Workspace</span>
                <span className={`brain-plan-value brain-workspace ${brainPlan.workspace.create ? "brain-workspace-yes" : "brain-workspace-no"}`}>
                  {brainPlan.workspace.create ? "Create" : "No"}
                </span>
                {brainPlan.workspace.suggestedName && (
                  <span className="brain-plan-meta">{brainPlan.workspace.suggestedName}</span>
                )}
              </div>
            </div>
          </div>
          <CapabilityAnalysisCard analysis={brainPlan.capabilityAnalysis} />
          {brainPlan.capabilityAnalysis.topMatch && (
            <div className="brain-execute-hint">
              <Sparkles size={14} />
              <span>
                Matched agent: <strong>{brainPlan.capabilityAnalysis.topMatch.agent.name}</strong> ({brainPlan.capabilityAnalysis.topMatch.score}%). Preparing execution...
              </span>
            </div>
          )}
        </section>
      )}

      {taskProgress && (
        <section className="brain-task-progress">
          <div className="brain-task-progress-header">
            {taskProgress.status === "completed" ? (
              <CheckCircle size={18} className="text-success" />
            ) : taskProgress.status === "failed" ? (
              <XCircle size={18} className="text-fail" />
            ) : (
              <Loader2 size={18} className="spin" />
            )}
            <span className={`task-status task-status-${taskProgress.status}`}>{taskProgress.status}</span>
          </div>
          <span className="brain-task-progress-message">{taskProgress.message}</span>
        </section>
      )}

      {(hasExecution || execLogs.length > 0) && (
        <section className="exec-dashboard">
          <div className="exec-dashboard-header">
            <CheckCircle size={20} />
            <h2>Execution Dashboard</h2>
          </div>

          <div className="exec-grid">
            <ApprovalPanelCard approvals={approvals} stats={approvalStats} />
            <ExecutionDashboardCard logs={execLogs} stats={execStats} />
            {hermesState.workspace && <WorkspaceCard workspace={hermesState.workspace} />}
            {hermesState.goal && <GoalCard goal={hermesState.goal} />}
            {hermesState.notebook && <NotebookCard entry={hermesState.notebook} />}
            {hermesState.kanban && <KanbanCard board={hermesState.kanban} />}
            {hermesState.memory && <MemoryCard memory={hermesState.memory} />}
            <QueueCard queue={hermesState.queue} />
            <TimelineCard state={hermesState} />
            <ResponseCard state={hermesState} />
            {validation && <ValidationCard result={validation} />}
          </div>
        </section>
      )}

      <section className="hh-summary">
        <div className="hh-summary-card">
          <CheckCircle size={18} />
          <div>
            <strong>{connected.length}/{integrations.length}</strong>
            <span>Modules Online</span>
          </div>
        </div>
        <div className="hh-summary-card">
          <Bot size={18} />
          <div>
            <strong>{connectedAgents.length}</strong>
            <span>Agents Ready</span>
          </div>
        </div>
        <div className="hh-summary-card">
          <Cpu size={18} />
          <div>
            <strong>{connectedProviders.length}</strong>
            <span>Providers</span>
          </div>
        </div>
        <div className="hh-summary-card">
          <MessageSquare size={18} />
          <div>
            <strong>{connected.length}</strong>
            <span>Services</span>
          </div>
        </div>
      </section>

      <section className="hh-actions">
        <h2>Quick Actions</h2>
        <div className="hh-actions-grid">
          <button className="hh-action-card" onClick={() => onOpenAgent("claude")}>
            <TerminalSquare size={20} />
            <span>Claude Code</span>
            <small>Code, debug, build</small>
          </button>
          <button className="hh-action-card" onClick={() => onOpenAgent("gemini")}>
            <Sparkles size={20} />
            <span>Gemini</span>
            <small>Research, analyze</small>
          </button>
          <button className="hh-action-card" onClick={() => onOpenAgent("codex")}>
            <Zap size={20} />
            <span>Codex</span>
            <small>Generate, explain</small>
          </button>
          <button className="hh-action-card" onClick={() => onOpenAgent("goals")}>
            <CircleDot size={20} />
            <span>Goals</span>
            <small>Set objectives</small>
          </button>
          <button className="hh-action-card" onClick={() => onOpenAgent("seo")}>
            <Search size={20} />
            <span>SEO</span>
            <small>Analyze visibility</small>
          </button>
          <button className="hh-action-card" onClick={() => onOpenAgent("notebook")}>
            <DatabaseZap size={20} />
            <span>Notebook</span>
            <small>Capture ideas</small>
          </button>
        </div>
      </section>

      <section className="hh-agents">
        <h2>Your Agents</h2>
        {businessAgents.length > 0 && (
          <div className="hh-business-agents">
            <span className="hh-business-agents-label">Business Agents</span>
            <div className="hh-agent-grid">
              {businessAgents.filter((a) => a.active).map((agent) => (
                <button key={agent.id} className="hh-agent-card" onClick={() => onOpenAgent("agent-builder")}>
                  <div className="hh-agent-icon" style={{ background: agent.color }}>
                    {agent.avatar ? (
                      <span className="hh-agent-avatar-text">{agent.avatar}</span>
                    ) : (
                      <Bot size={22} />
                    )}
                  </div>
                  <div className="hh-agent-info">
                    <strong>{agent.name}</strong>
                    <span className="is-online">{agent.department}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="hh-agent-grid">
          {agents.map((item) => {
            const Icon = agentIcons[item.id] || Bot;
            return (
              <button key={item.id} className="hh-agent-card" onClick={() => onOpenAgent(item.id)}>
                <div className="hh-agent-icon">
                  <Icon size={22} />
                </div>
                <div className="hh-agent-info">
                  <strong>{item.label}</strong>
                  <span className={item.status === "connected" ? "is-online" : "is-muted"}>
                    {item.status === "connected" ? "Connected" : item.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
