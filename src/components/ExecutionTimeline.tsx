import { useEffect, useRef, useState, memo } from "react";
import { Clock, Play, Pause, CheckCircle, AlertCircle, Loader2, GitBranch, FileCode2, Search, Zap, Brain, Terminal } from "lucide-react";
import { ExecutionBus, subscribeExecutionEvents, type ExecutionBusEvent, type ExecutionEventType } from "../hermes/ExecutionEventBusBridge";

const ICON_MAP: Record<ExecutionEventType, React.ComponentType<{ className?: string }>> = {
  execution_created: GitBranch,
  execution_started: Play,
  agent_started: Terminal,
  agent_progress: Loader2,
  agent_stream: FileCode2,
  agent_finished: CheckCircle,
  review_started: Search,
  review_finished: CheckCircle,
  qa_started: Zap,
  qa_finished: CheckCircle,
  workspace_updated: Brain,
  artifact_created: FileCode2,
  execution_completed: CheckCircle,
  execution_failed: AlertCircle
};

const STATUS_COLORS: Record<ExecutionBusEvent["status"], string> = {
  pending: "text-slate-400",
  running: "text-violet-400",
  completed: "text-emerald-400",
  failed: "text-rose-400"
};

function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getEventColor(event: ExecutionBusEvent): string {
  return STATUS_COLORS[event.status];
}

function getEventIcon(event: ExecutionBusEvent): React.ComponentType<{ className?: string }> {
  return ICON_MAP[event.type] || GitBranch;
}

function getEventLabel(event: ExecutionBusEvent): string {
  switch (event.type) {
    case "execution_created": return "Created";
    case "execution_started": return "Started";
    case "agent_started": return "Agent Start";
    case "agent_progress": return "Progress";
    case "agent_stream": return "Streaming";
    case "agent_finished": return "Finished";
    case "review_started": return "Review";
    case "review_finished": return "Review Done";
    case "qa_started": return "QA Start";
    case "qa_finished": return "QA Done";
    case "workspace_updated": return "Workspace";
    case "artifact_created": return "Artifact";
    case "execution_completed": return "Complete";
    case "execution_failed": return "Failed";
    default: return event.type;
  }
}

export const ExecutionTimeline = memo(function ExecutionTimeline({
  executionId,
  autoScroll = true
}: {
  executionId?: string;
  autoScroll?: boolean;
}) {
  const [events, setEvents] = useState<ExecutionBusEvent[]>(() => {
    if (executionId) {
      return ExecutionBus.getHistoryForExecution(executionId);
    }
    return ExecutionBus.getHistory();
  });
  const [paused, setPaused] = useState(false);
  const [filterType, setFilterType] = useState<ExecutionEventType | "all">("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeExecutionEvents((event) => {
      if (executionId && event.executionId !== executionId) return;
      if (paused) return;
      setEvents((prev) => [...prev, event]);
    });

    if (executionId) {
      const initial = ExecutionBus.getHistoryForExecution(executionId);
      setEvents(initial);
    } else {
      setEvents(ExecutionBus.getHistory());
    }

    return () => { unsubscribe(); };
  }, [executionId, paused]);

  useEffect(() => {
    if (autoScroll && !paused && eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length, autoScroll, paused]);

  const filteredEvents = events.filter((e) => filterType === "all" || e.type === filterType);

  return (
    <div className="flex flex-col h-full bg-[var(--surface)] rounded-lg border border-[var(--border)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg)]">
        <h3 className="text-sm font-semibold text-[var(--fg)] flex items-center gap-2">
          <Terminal className="w-4 h-4 text-violet-400" />
          Execution Timeline
        </h3>
        <div className="flex-1" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as ExecutionEventType | "all")}
          className="px-2 py-1 text-xs bg-[var(--bg)] border border-[var(--border)] rounded text-[var(--fg)]"
        >
          <option value="all">All Events</option>
          <option value="execution_created">Created</option>
          <option value="execution_started">Started</option>
          <option value="agent_started">Agent Start</option>
          <option value="agent_progress">Progress</option>
          <option value="agent_stream">Streaming</option>
          <option value="agent_finished">Finished</option>
          <option value="review_started">Review</option>
          <option value="review_finished">Review Done</option>
          <option value="qa_started">QA Start</option>
          <option value="qa_finished">QA Done</option>
          <option value="workspace_updated">Workspace</option>
          <option value="artifact_created">Artifact</option>
          <option value="execution_completed">Complete</option>
          <option value="execution_failed">Failed</option>
        </select>
        <button
          onClick={() => setPaused(!paused)}
          className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${paused ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}
          title={paused ? "Resume" : "Pause"}
        >
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          <span>{paused ? "Paused" : "Live"}</span>
        </button>
        <button
          onClick={() => setEvents([])}
          className="px-2 py-1 text-xs rounded text-rose-400 hover:bg-rose-500/10"
          title="Clear"
        >
          <span className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Clear
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2" ref={containerRef}>
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 py-8">
            <GitBranch className="w-12 h-12 opacity-30 mb-2" />
            <p className="text-sm">No events yet</p>
            <p className="text-xs opacity-50">Execute a task to see timeline</p>
          </div>
        ) : (
          filteredEvents.map((event, idx) => {
            const Icon = getEventIcon(event);
            return (
              <div
                key={`${event.executionId}-${event.timestamp}-${idx}`}
                className="flex gap-3 group relative before:content-[''] before:absolute before:left-5 before:top-full before:h-full before:w-[1px] before:bg-[var(--border)] last:before:hidden"
              >
                <div className="flex flex-col items-center relative z-10">
                  <Icon className={`w-4 h-4 ${getEventColor(event)}`} />
                  <div className={`w-2 h-2 rounded-full ${getEventColor(event)} mt-1`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--fg)]">{getEventLabel(event)}</span>
                    <span className="text-xs text-slate-500">{event.agentName}</span>
                    <span className={`text-xs ${getEventColor(event)}`}>●</span>
                  </div>
                  <p className="text-sm text-slate-300 truncate">{event.message}</p>
                  {event.progress !== undefined && event.progress > 0 && event.progress < 100 && (
                    <div className="mt-1 h-1 bg-[var(--border)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 transition-all duration-300"
                        style={{ width: `${event.progress}%` }}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(event.timestamp)}</span>
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <span className="opacity-50">| {JSON.stringify(event.metadata).slice(0, 60)}...</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={eventsEndRef} />
      </div>
    </div>
  );
});