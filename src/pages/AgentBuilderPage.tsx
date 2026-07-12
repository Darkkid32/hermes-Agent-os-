import {
  ArrowLeft,
  Bot,
  Check,
  CircleDot,
  Eye,
  FileText,
  Globe,
  LayoutGrid,
  Power,
  Save,
  TerminalSquare,
  Trash2,
  X,
  Zap
} from "lucide-react";
import { useState, useEffect } from "react";
import type {
  BusinessAgent,
  ExecutionEngineId,
  CapabilityId,
  ModuleId,
  PermissionId
} from "../hermes/BusinessAgent";
import {
  createBlankAgent,
  EXECUTION_ENGINES,
  CAPABILITIES,
  MODULES,
  PERMISSIONS,
  DEPARTMENTS,
  AVATAR_COLORS
} from "../hermes/BusinessAgent";
import {
  loadAgents,
  addAgent,
  updateAgent,
  deleteAgent,
  duplicateAgent,
  exportAgents,
  importAgents,
  resetAgents,
  validateAgent,
  subscribeAgents
} from "../hermes/AgentStore";
import AgentLibrary from "./AgentLibrary";

const capIcons: Record<string, typeof TerminalSquare> = {
  coding: TerminalSquare,
  research: Globe,
  writing: FileText,
  vision: Eye,
  browser: Globe,
  planning: LayoutGrid,
  automation: Zap
};

type View = "library" | "editor";

export default function AgentBuilderPage() {
  const [agents, setAgents] = useState<BusinessAgent[]>(loadAgents);
  const [view, setView] = useState<View>("library");
  const [editing, setEditing] = useState<BusinessAgent>(createBlankAgent);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    return subscribeAgents(setAgents);
  }, []);

  function handleNew() {
    setEditing(createBlankAgent());
    setView("editor");
    setResult(null);
  }

  function handleEdit(agent: BusinessAgent) {
    setEditing({ ...agent });
    setView("editor");
    setResult(null);
  }

  function handleToggle(agent: BusinessAgent) {
    const updated = { ...agent, active: !agent.active, updatedAt: Date.now() };
    const next = updateAgent(updated);
    setAgents(next);
  }

  function handleDelete(id: string) {
    const next = deleteAgent(id);
    setAgents(next);
  }

  function handleDuplicate(agent: BusinessAgent) {
    const next = duplicateAgent(agent);
    setAgents(next);
  }

  function handleExport() {
    const json = exportAgents();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hermes-business-agents.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(json: string) {
    const result = importAgents(json);
    if (result.success) {
      setAgents(result.agents);
    }
    return result;
  }

  function handleReset() {
    const next = resetAgents();
    setAgents(next);
  }

  function handleSave() {
    const err = validateAgent(editing, agents);
    if (err) {
      setResult(err);
      return;
    }
    let next: BusinessAgent[];
    const exists = agents.some((a) => a.id === editing.id);
    if (exists) {
      next = updateAgent(editing);
    } else {
      next = addAgent(editing);
    }
    setAgents(next);
    setResult("Agent saved.");
    setTimeout(() => {
      setView("library");
      setResult(null);
    }, 600);
  }

  function handleCancel() {
    setView("library");
    setResult(null);
  }

  function toggleArray<T extends string>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  if (view === "library") {
    return (
      <main className="content agent-builder-page">
        <AgentLibrary
          agents={agents}
          onEdit={handleEdit}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onNew={handleNew}
          onDuplicate={handleDuplicate}
          onExport={handleExport}
          onImport={handleImport}
          onReset={handleReset}
        />
      </main>
    );
  }

  return (
    <main className="content agent-builder-page">
      <div className="ab-editor">
        <div className="ab-editor-header">
          <button className="ab-back-btn" onClick={handleCancel}>
            <ArrowLeft size={16} />
            Library
          </button>
          <h2>{agents.some((a) => a.id === editing.id) ? "Edit Agent" : "New Agent"}</h2>
          <div className="ab-editor-actions">
            <button className="ab-cancel-btn" onClick={handleCancel}>
              <X size={14} />
              Cancel
            </button>
            <button className="ab-save-btn" onClick={handleSave}>
              <Save size={14} />
              Save
            </button>
          </div>
        </div>

        {result && (
          <div className={`ab-result ${result.includes("required") || result.includes("Invalid") || result.includes("already") ? "is-error" : "is-success"}`}>
            {result}
          </div>
        )}

        <div className="ab-sections">
          <section className="ab-section">
            <h3 className="ab-section-title">General</h3>
            <div className="ab-field-grid">
              <label className="ab-field ab-field-wide">
                <span>Name *</span>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Marketing Agent"
                />
              </label>
              <label className="ab-field ab-field-wide">
                <span>Description</span>
                <textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="What does this agent do?"
                  rows={2}
                />
              </label>
              <label className="ab-field">
                <span>Department</span>
                <select
                  value={editing.department}
                  onChange={(e) => setEditing({ ...editing, department: e.target.value })}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="ab-field">
                <span>Role</span>
                <input
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  placeholder="e.g. Content strategist"
                />
              </label>
              <label className="ab-field">
                <span>Avatar (emoji or text)</span>
                <input
                  value={editing.avatar}
                  onChange={(e) => setEditing({ ...editing, avatar: e.target.value })}
                  placeholder="e.g. 🎯"
                />
              </label>
              <label className="ab-field">
                <span>Color</span>
                <div className="ab-color-row">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`ab-color-swatch ${editing.color === c ? "is-selected" : ""}`}
                      style={{ background: c }}
                      onClick={() => setEditing({ ...editing, color: c })}
                    />
                  ))}
                </div>
              </label>
            </div>
          </section>

          <section className="ab-section">
            <h3 className="ab-section-title">Execution Engine</h3>
            <div className="ab-engine-grid">
              {EXECUTION_ENGINES.map((eng) => (
                <button
                  key={eng.id}
                  className={`ab-engine-card ${editing.executionEngine === eng.id ? "is-selected" : ""}`}
                  onClick={() => setEditing({ ...editing, executionEngine: eng.id })}
                >
                  <TerminalSquare size={18} />
                  <strong>{eng.label}</strong>
                  <span>{eng.description}</span>
                  {editing.executionEngine === eng.id && (
                    <span className="ab-engine-check"><Check size={14} /></span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="ab-section">
            <h3 className="ab-section-title">Capabilities</h3>
            <div className="ab-cap-grid">
              {CAPABILITIES.map((cap) => {
                const Icon = capIcons[cap.id] || Bot;
                const active = editing.capabilities.includes(cap.id);
                return (
                  <button
                    key={cap.id}
                    className={`ab-cap-card ${active ? "is-selected" : ""}`}
                    onClick={() => setEditing({ ...editing, capabilities: toggleArray(editing.capabilities, cap.id) })}
                  >
                    <Icon size={16} />
                    <span>{cap.label}</span>
                    {active && <Check size={12} />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="ab-section">
            <h3 className="ab-section-title">Enabled Modules</h3>
            <div className="ab-module-grid">
              {MODULES.map((mod) => {
                const active = editing.enabledModules.includes(mod.id);
                return (
                  <label key={mod.id} className={`ab-module-check ${active ? "is-selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => setEditing({ ...editing, enabledModules: toggleArray(editing.enabledModules, mod.id) })}
                    />
                    <Check size={12} />
                    <span>{mod.label}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="ab-section">
            <h3 className="ab-section-title">Permissions</h3>
            <div className="ab-perm-list">
              {PERMISSIONS.map((perm) => {
                const active = editing.permissions.includes(perm.id);
                return (
                  <label key={perm.id} className={`ab-perm-row ${active ? "is-selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => setEditing({ ...editing, permissions: toggleArray(editing.permissions, perm.id) })}
                    />
                    <Check size={12} />
                    <div className="ab-perm-info">
                      <span className="ab-perm-label">{perm.label}</span>
                      <span className="ab-perm-desc">{perm.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="ab-section">
            <h3 className="ab-section-title">Instructions</h3>
            <label className="ab-field ab-field-wide">
              <span>System Prompt</span>
              <textarea
                className="ab-instructions-editor"
                value={editing.systemPrompt}
                onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })}
                placeholder="Custom instructions for this agent. Defines how it behaves, what it prioritizes, and how it interacts with other modules."
                rows={8}
              />
            </label>
          </section>
        </div>
      </div>
    </main>
  );
}
