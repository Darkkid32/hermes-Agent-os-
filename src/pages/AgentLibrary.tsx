import {
  ArrowUpDown,
  Bot,
  BrainCircuit,
  CheckCircle,
  CircleDot,
  Copy,
  Download,
  Edit3,
  Filter,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  TerminalSquare,
  Trash2,
  Upload
} from "lucide-react";
import { useState, useMemo } from "react";
import type { BusinessAgent, ExecutionEngineId } from "../hermes/BusinessAgent";
import { EXECUTION_ENGINES, DEPARTMENTS } from "../hermes/BusinessAgent";
import { isDefaultAgent } from "../hermes/DefaultAgents";

const engineLabels: Record<ExecutionEngineId, string> = Object.fromEntries(
  EXECUTION_ENGINES.map((e) => [e.id, e.label])
) as Record<ExecutionEngineId, string>;

type SortKey = "name" | "updated" | "department";

function agentInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function AgentLibrary({
  agents,
  onEdit,
  onToggle,
  onDelete,
  onNew,
  onDuplicate,
  onExport,
  onImport,
  onReset
}: {
  agents: BusinessAgent[];
  onEdit: (agent: BusinessAgent) => void;
  onToggle: (agent: BusinessAgent) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onDuplicate: (agent: BusinessAgent) => void;
  onExport: () => void;
  onImport: (json: string) => { success: boolean; message: string };
  onReset: () => void;
}) {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [engineFilter, setEngineFilter] = useState<string>("all");
  const [capFilter, setCapFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  const allDepts = useMemo(() => {
    const set = new Set(agents.map((a) => a.department));
    return ["all", ...set];
  }, [agents]);

  const allCaps = useMemo(() => {
    const set = new Set<string>();
    agents.forEach((a) => a.capabilities.forEach((c) => set.add(c)));
    return ["all", ...set];
  }, [agents]);

  const filtered = useMemo(() => {
    let list = [...agents];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.department.toLowerCase().includes(q)
      );
    }

    if (deptFilter !== "all") {
      list = list.filter((a) => a.department === deptFilter);
    }

    if (engineFilter !== "all") {
      list = list.filter((a) => a.executionEngine === engineFilter);
    }

    if (capFilter !== "all") {
      list = list.filter((a) => a.capabilities.includes(capFilter as any));
    }

    if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "updated") {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    } else if (sortBy === "department") {
      list.sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
    }

    return list;
  }, [agents, search, deptFilter, engineFilter, capFilter, sortBy]);

  function handleImport() {
    const result = onImport(importText);
    setImportMsg(result.message);
    if (result.success) {
      setImportText("");
      setTimeout(() => {
        setShowImport(false);
        setImportMsg(null);
      }, 1500);
    }
  }

  function handleReset() {
    onReset();
    setShowReset(false);
  }

  return (
    <div className="agent-library">
      <div className="agent-library-header">
        <div>
          <h2>Agent Library</h2>
          <p className="agent-library-sub">{agents.length} agent{agents.length !== 1 ? "s" : ""} configured</p>
        </div>
        <div className="agent-library-actions">
          <button className="agent-action-btn" onClick={onExport} title="Export Agents">
            <Download size={14} />
          </button>
          <button className="agent-action-btn" onClick={() => setShowImport(!showImport)} title="Import Agents">
            <Upload size={14} />
          </button>
          <button className="agent-action-btn agent-action-danger" onClick={() => setShowReset(!showReset)} title="Reset to Defaults">
            <RefreshCw size={14} />
          </button>
          <button className="agent-new-btn" onClick={onNew}>
            <CircleDot size={16} />
            New Agent
          </button>
        </div>
      </div>

      {showImport && (
        <div className="agent-import-panel">
          <span className="agent-import-label">Import Agents (JSON)</span>
          <textarea
            className="agent-import-textarea"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='[{"id":"...","name":"...","department":"...","executionEngine":"claude","capabilities":["coding"],...}]'
            rows={4}
          />
          <div className="agent-import-actions">
            <button className="agent-import-btn" onClick={handleImport} disabled={!importText.trim()}>
              <Upload size={14} />
              Import
            </button>
            <button className="agent-import-cancel" onClick={() => { setShowImport(false); setImportMsg(null); }}>
              Cancel
            </button>
          </div>
          {importMsg && <span className="agent-import-msg">{importMsg}</span>}
        </div>
      )}

      {showReset && (
        <div className="agent-reset-panel">
          <p>Reset all Business Agents to defaults? This will delete all custom agents.</p>
          <div className="agent-reset-actions">
            <button className="agent-reset-confirm" onClick={handleReset}>
              <RefreshCw size={14} />
              Reset to Defaults
            </button>
            <button className="agent-import-cancel" onClick={() => setShowReset(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {agents.length > 0 && (
        <div className="agent-filters">
          <div className="agent-filter-row">
            <div className="agent-search-wrap">
              <Search size={14} />
              <input
                className="agent-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents..."
              />
            </div>
            <select className="agent-filter-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              {allDepts.map((d) => (
                <option key={d} value={d}>{d === "all" ? "All Departments" : d}</option>
              ))}
            </select>
            <select className="agent-filter-select" value={engineFilter} onChange={(e) => setEngineFilter(e.target.value)}>
              <option value="all">All Engines</option>
              {EXECUTION_ENGINES.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
            <select className="agent-filter-select" value={capFilter} onChange={(e) => setCapFilter(e.target.value)}>
              {allCaps.map((c) => (
                <option key={c} value={c}>{c === "all" ? "All Capabilities" : c}</option>
              ))}
            </select>
            <select className="agent-filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
              <option value="name">Sort A-Z</option>
              <option value="updated">Recently Updated</option>
              <option value="department">Sort Department</option>
            </select>
          </div>
        </div>
      )}

      {filtered.length === 0 && agents.length > 0 ? (
        <div className="agent-library-empty">
          <Search size={48} />
          <h3>No agents match filters</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="agent-library-empty">
          <BrainCircuit size={48} />
          <h3>No agents yet</h3>
          <p>Create your first Business Agent to get started.</p>
          <button className="agent-new-btn" onClick={onNew}>
            <CircleDot size={16} />
            Create Agent
          </button>
        </div>
      ) : (
        <div className="agent-library-grid">
          {filtered.map((agent) => (
            <div key={agent.id} className={`agent-lib-card ${agent.active ? "" : "is-disabled"}`}>
              <div className="agent-lib-card-header">
                <div className="agent-lib-avatar" style={{ background: agent.color }}>
                  {agent.avatar ? (
                    <span>{agent.avatar}</span>
                  ) : (
                    <span>{agentInitials(agent.name || "NA")}</span>
                  )}
                </div>
                <div className="agent-lib-card-info">
                  <strong>{agent.name || "Untitled"}</strong>
                  <span className="agent-lib-dept">{agent.department}</span>
                </div>
                <div className="agent-lib-card-actions">
                  <button title="Edit" onClick={() => onEdit(agent)}>
                    <Edit3 size={14} />
                  </button>
                  <button title="Duplicate" onClick={() => onDuplicate(agent)}>
                    <Copy size={14} />
                  </button>
                  <button title={agent.active ? "Disable" : "Enable"} onClick={() => onToggle(agent)}>
                    {agent.active ? <Power size={14} /> : <PowerOff size={14} />}
                  </button>
                  <button title="Delete" onClick={() => onDelete(agent.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {agent.description && (
                <p className="agent-lib-desc">{agent.description}</p>
              )}

              <div className="agent-lib-meta">
                <span className="agent-lib-engine">
                  <TerminalSquare size={12} />
                  {engineLabels[agent.executionEngine]}
                </span>
                <span className="agent-lib-caps">{agent.capabilities.length} capabilities</span>
                <span className={`agent-lib-badge ${isDefaultAgent(agent.id) ? "is-default" : "is-custom"}`}>
                  {isDefaultAgent(agent.id) ? "Default" : "Custom"}
                </span>
              </div>

              {agent.enabledModules.length > 0 && (
                <div className="agent-lib-modules">
                  {agent.enabledModules.map((m) => (
                    <span key={m} className="agent-lib-module-chip">{m}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
