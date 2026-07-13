import { useEffect, useState, memo } from "react";
import { Brain, CheckCircle, Clock, ArrowRight, GitBranch, Terminal, Search, Zap, FileCode2, Box } from "lucide-react";
import { subscribeExecutionEvents, type ExecutionBusEvent } from "../hermes/ExecutionEventBusBridge";

interface PipelineStage {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "pending" | "running" | "completed" | "failed";
  message: string;
}

const INITIAL_STAGES: PipelineStage[] = [
  { id: "brain", label: "Brain", icon: Brain, status: "pending", message: "Analyzing..." },
  { id: "claude", label: "Claude Code", icon: Terminal, status: "pending", message: "" },
  { id: "opencode", label: "OpenCode", icon: FileCode2, status: "pending", message: "" },
  { id: "gemini", label: "Gemini", icon: Search, status: "pending", message: "" },
  { id: "workspace", label: "Workspace", icon: Box, status: "pending", message: "" }
];

function mapEventToStage(event: ExecutionBusEvent): Partial<PipelineStage> | null {
  const isClaude = event.agentName.toLowerCase().includes("claude");
  const isOpenCode = event.agentName.toLowerCase().includes("opencode") || event.agentName.toLowerCase().includes("openclaw");
  const isGemini = event.agentName.toLowerCase().includes("gemini");
  const isBrain = event.agentName.toLowerCase().includes("brain");

  switch (event.type) {
    case "execution_created":
      return isBrain ? { status: "running", message: "Queued" } :
             isClaude ? { status: "pending", message: "Waiting..." } : null;
    case "execution_started":
      return isBrain ? { status: "running", message: event.message } :
             isClaude ? { status: "running", message: "Starting..." } : null;
    case "agent_started":
      if (isClaude) return { status: "running", message: "Executing..." };
      if (isOpenCode) return { status: "running", message: "Reviewing..." };
      if (isGemini) return { status: "running", message: "Validating..." };
      return null;
    case "agent_progress":
      if (isClaude) return { status: "running", message: event.message.slice(0, 60) };
      if (isOpenCode) return { status: "running", message: event.message.slice(0, 60) };
      if (isGemini) return { status: "running", message: event.message.slice(0, 60) };
      return null;
    case "agent_finished":
      if (isBrain) return { status: "completed", message: "Complete" };
      if (isClaude) return { status: "completed", message: "Done" };
      if (isOpenCode) return { status: "completed", message: "Reviewed" };
      if (isGemini) return { status: "completed", message: "Validated" };
      return null;
    case "review_started":
      return { status: "running", message: "Review started" };
    case "review_finished":
      return { status: "completed", message: "Review complete" };
    case "qa_started":
      return { status: "running", message: "QA started" };
    case "qa_finished":
      return { status: "completed", message: "QA complete" };
    case "workspace_updated":
      return { status: "running", message: event.message.slice(0, 60) };
    case "artifact_created":
      return { status: "running", message: `${event.metadata?.artifactName || "File"} created` };
    case "execution_completed":
      return { status: "completed", message: event.message };
    case "execution_failed":
      return { status: "failed", message: event.message };
    default:
      return null;
  }
}

export const WorkflowPipeline = memo(function WorkflowPipeline({
  executionId
}: {
  executionId?: string;
}) {
  const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(executionId || null);

  useEffect(() => {
    const unsubscribe = subscribeExecutionEvents((event) => {
      if (activeExecutionId && event.executionId !== activeExecutionId) return;

      const stageUpdate = mapEventToStage(event);
      if (!stageUpdate) return;

      if (!activeExecutionId && event.executionId) {
        setActiveExecutionId(event.executionId);
      }

      setStages((prev) => {
        const next = [...prev];
        const idx = findStageIndex(next, event);
        if (idx >= 0) {
          next[idx] = { ...next[idx], ...stageUpdate };
        } else if (stageUpdate.status === "running") {
          for (let i = 0; i < next.length; i++) {
            if (next[i].status === "pending") {
              next[i] = { ...next[i], ...stageUpdate };
              break;
            }
          }
        }
        return next;
      });
    });

    return () => { unsubscribe(); };
  }, [activeExecutionId]);

  const totalStages = stages.length;
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const progress = totalStages > 0 ? (completedCount / totalStages) * 100 : 0;

  return (
    <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--fg)] flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-violet-400" />
          Workflow Pipeline
        </h3>
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{Math.round(progress)}%</span>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isLast = idx === stages.length - 1;
          const statusColor =
            stage.status === "completed" ? "text-emerald-400 bg-emerald-500/20 border-emerald-500/30" :
            stage.status === "running" ? "text-violet-400 bg-violet-500/20 border-violet-500/30 animate-pulse" :
            stage.status === "failed" ? "text-rose-400 bg-rose-500/20 border-rose-500/30" :
            "text-slate-500 bg-[var(--bg)] border-[var(--border)]";

          return (
            <div key={stage.id} className="flex items-center">
              <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border ${statusColor} min-w-[80px]`}>
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{stage.label}</span>
                {stage.message && (
                  <span className="text-[9px] opacity-60 truncate max-w-[80px]">{stage.message}</span>
                )}
              </div>
              {!isLast && (
                <ArrowRight className="w-4 h-4 text-slate-600 mx-1 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

function findStageIndex(stages: PipelineStage[], event: ExecutionBusEvent): number {
  const isClaude = event.agentName.toLowerCase().includes("claude");
  const isOpenCode = event.agentName.toLowerCase().includes("opencode") || event.agentName.toLowerCase().includes("openclaw");
  const isGemini = event.agentName.toLowerCase().includes("gemini");
  const isBrain = event.agentName.toLowerCase().includes("brain");

  if (isBrain) return 0;
  if (isClaude) return 1;
  if (isOpenCode) return 2;
  if (isGemini) return 3;

  if (event.type === "workspace_updated" || event.type === "artifact_created") return 4;

  return -1;
}
