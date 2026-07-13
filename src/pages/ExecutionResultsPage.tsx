import { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Bot,
  Zap,
  Filter,
  ChevronDown,
  ChevronUp,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  FileCode2,
  Copy,
  Code2
} from "lucide-react";
import {
  getExecutionStats,
  getAllLogs,
  type ExecutionLog
} from "../hermes/BusinessAgentRuntime";
import {
  getAllResults,
  onResultsUpdate,
  type ExecutionResult
} from "../hermes/ExecutionResults";

export function ExecutionResultsPage() {
  const [results, setResults] = useState<ExecutionResult[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [filter, setFilter] = useState<"all" | "completed" | "failed">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    loadResults();
    loadLogs();
    const unsubscribe = onResultsUpdate(() => loadResults());
    const interval = setInterval(() => { loadResults(); loadLogs(); }, 5000);
    return () => { unsubscribe(); clearInterval(interval); };
  }, []);

  function loadResults() {
    setResults(getAllResults());
  }
  function loadLogs() {
    setLogs(getAllLogs());
  }

  const filtered = results.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const stats = getExecutionStats();

  function formatDate(ts: number) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString();
  }

  function formatDuration(ms: number) {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "completed":
        return <CheckCircle size={16} className="text-emerald-400" />;
      case "failed":
        return <XCircle size={16} className="text-red-400" />;
      case "queued":
        return <Clock size={16} className="text-amber-400" />;
      default:
        return <AlertTriangle size={16} className="text-zinc-500" />;
    }
  }

  function renderArtifacts(artifacts: ExecutionResult["artifacts"]) {
    if (!artifacts || artifacts.length === 0) return null;
    return (
      <div className="artifacts-section">
        <h4 className="artifacts-title">Artifacts ({artifacts.length})</h4>
        <div className="artifacts-grid">
          {artifacts.map((a) => (
            <div key={a.id} className="artifact-card">
              <div className="artifact-header">
                <Code2 size={14} />
                <span className="artifact-name">{a.name}</span>
                <span className="artifact-type">{a.type}</span>
                <span className="artifact-size">{(a.size / 1024).toFixed(1)} KB</span>
              </div>
              <pre className="artifact-preview">{a.content.slice(0, 500)}</pre>
              <button className="artifact-copy" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(a.content); }}>
                <Copy size={12} /> Copy
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Execution Results</h1>
          <p className="sub">View all Business Agent execution history and outcomes.</p>
        </div>
      </header>

      <div className="exec-stats-grid">
        <div className="exec-stat-card">
          <div className="stat-icon"><Bot size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Executions</span>
          </div>
        </div>
        <div className="exec-stat-card">
          <div className="stat-icon is-online"><CheckCircle size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats.completed}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>
        <div className="exec-stat-card">
          <div className="stat-icon is-error"><XCircle size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats.failed}</span>
            <span className="stat-label">Failed</span>
          </div>
        </div>
        <div className="exec-stat-card">
          <div className="stat-icon"><Zap size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats.active}</span>
            <span className="stat-label">Active</span>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          {(["all", "completed", "failed"] as const).map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn-refresh" onClick={() => { loadResults(); loadLogs(); }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="results-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Bot size={48} className="text-zinc-600" />
            <p>No execution results found.</p>
            <p className="sub">Run a Business Agent to see results here.</p>
          </div>
        ) : (
          filtered.map((result) => (
            <div
              key={result.id}
              className={`result-card ${result.status}`}
              onClick={() =>
                setExpandedId(expandedId === result.id ? null : result.id)
              }
            >
              <div className="result-header">
                <div className="result-info">
                  {getStatusIcon(result.status)}
                  <span className="result-agent">{result.agentName}</span>
                  <span className="result-engine">{result.engineLabel}</span>
                </div>
                <div className="result-meta">
                  <span className="result-duration">
                    {formatDuration(result.duration)}
                  </span>
                  <span className="result-tokens">
                    {result.tokens.toLocaleString()} tokens
                  </span>
                  <span className="result-time">
                    {formatDate(result.timestamp)}
                  </span>
                  {expandedId === result.id ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </div>
              </div>

              <div className="result-goal">{result.prompt}</div>

              {expandedId === result.id && (
                <div className="result-details">
                  <div className="detail-tabs">
                    <button
                      className={`tab ${!showRaw ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRaw(false);
                      }}
                    >
                      <Eye size={14} /> Formatted
                    </button>
                    <button
                      className={`tab ${showRaw ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRaw(true);
                      }}
                    >
                      <EyeOff size={14} /> Raw
                    </button>
                  </div>
                  <div className="result-output">
                    <pre>
                      {showRaw ? result.rawResponse : result.formattedMarkdown}
                    </pre>
                  </div>
                  {renderArtifacts(result.artifacts)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
