import { useEffect, useState } from "react";
import {
  getHealth,
  getIntegrations,
  getSelfModule,
  createSelfModuleItem
} from "./api";
import AgentChatLayout from "./components/AgentChatLayout";
import type { Integration, IntegrationSnapshot, Health, SelfModuleState } from "./types";

import Sidebar, { allNavItems } from "./pages/Sidebar";
import TopBar from "./pages/TopBar";
import MissionControl from "./pages/MissionControl";
import HermesHome from "./pages/HermesHome";
import AgentBuilderPage from "./pages/AgentBuilderPage";
import SetupPage from "./pages/SetupPage";
import Drawer from "./pages/Drawer";
import { ExecutionResultsPage } from "./pages/ExecutionResultsPage";
import { GoalsPage } from "./pages/GoalsPage";
import { NotebookPage } from "./pages/NotebookPage";
import { KanbanPage } from "./pages/KanbanPage";
import { MemoryPage } from "./pages/MemoryPage";

const CHAT_FIRST_IDS = new Set([
  "claude",
  "openclaw",
  "openclaude",
  "gemini",
  "codex",
  "opencode",
  "free-claude-code"
]);

const localSelfModuleIds = new Set(["goals", "seo", "video", "notebook", "kanban", "usage-credits"]);

const agentItems = [
  { id: "claude" },
  { id: "openclaw" },
  { id: "openclaude" },
  { id: "gemini" },
  { id: "codex" },
  { id: "opencode" },
  { id: "free-claude-code" }
];

const automationItems = [
  { id: "scheduler" },
  { id: "skill-registry" },
  { id: "provider-router" }
];

const selfItems = [
  { id: "seo" },
  { id: "video" }
];

function useRuntime() {
  const [snapshot, setSnapshot] = useState<IntegrationSnapshot | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setError(null);
      const [healthData, integrationData] = await Promise.all([getHealth(), getIntegrations()]);
      setHealth(healthData);
      setSnapshot(integrationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load backend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 20000);
    return () => window.clearInterval(timer);
  }, []);

  return { snapshot, health, error, loading, refresh };
}

function currentSectionLabel(selected: string) {
  return allNavItems.find((item) => item.id === selected)?.label || "Hermes Agent Hub";
}

function defaultSelfForm(id: string): Record<string, string> {
  if (id === "usage-credits") return { title: "", provider: "", units: "", estimatedCost: "" };
  if (id === "kanban") return { title: "", column: "todo", notes: "" };
  if (id === "notebook") return { title: "", body: "" };
  if (id === "seo") return { title: "", url: "", keyword: "", status: "planned", notes: "" };
  if (id === "video") return { title: "", sourcePath: "", workflow: "captioning", status: "queued", notes: "" };
  return { title: "", status: "open", notes: "" };
}

function itemDetail(item: any) {
  const parts = [
    item.status,
    item.column,
    item.provider,
    item.keyword,
    item.workflow,
    item.url,
    item.sourcePath,
    item.units != null ? `${item.units} units` : "",
    item.estimatedCost != null ? `$${Number(item.estimatedCost).toFixed(4)}` : ""
  ].filter(Boolean);
  return parts.join(" / ") || "local item";
}

function statusLabel(status: string) {
  if (status === "ready_to_connect") return "Ready";
  if (status === "ready_to_configure") return "Configure";
  if (status === "missing_dependency") return "Missing";
  return status;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <b title={value}>{value}</b>
    </div>
  );
}

function SelfModuleControl({
  integration,
  onOpenPlugins
}: {
  integration: Integration;
  onOpenPlugins: () => void;
}) {
  const [state, setState] = useState<SelfModuleState | null>(null);
  const [form, setForm] = useState<Record<string, string>>(() => defaultSelfForm(integration.id));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    setState(null);
    setForm(defaultSelfForm(integration.id));
    setResult(null);
    getSelfModule(integration.id)
      .then(setState)
      .catch((err) => setResult(err instanceof Error ? err.message : "Unable to load local module"));
  }, [integration.id]);

  function updateField(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createItem() {
    setBusy(true);
    setResult(null);
    try {
      const payload: Record<string, string | number> = { ...form };
      if (integration.id === "usage-credits") {
        payload.units = Number(form.units || 0);
        payload.estimatedCost = Number(form.estimatedCost || 0);
      }
      const next = await createSelfModuleItem(integration.id, payload);
      setState(next);
      setForm(defaultSelfForm(integration.id));
      setResult(`Saved ${next.itemName}.`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="content two-column">
      <section className="control-room">
        <div className="control-header">
          <span className="eyebrow">Local module</span>
          <h1>{integration.label}</h1>
          <p>{integration.publicSummary}</p>
        </div>

        <section className="setup-panel">
          <div className="setup-row">
            <b>Create {state?.itemName || "item"}</b>
            <div className="config-grid">
              <label>
                <span>Title</span>
                <input
                  value={form.title || ""}
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder={`${integration.label} title`}
                />
              </label>
              {integration.id === "goals" ? (
                <label>
                  <span>Status</span>
                  <input value={form.status || ""} onChange={(event) => updateField("status", event.target.value)} />
                </label>
              ) : null}
              {integration.id === "kanban" ? (
                <label>
                  <span>Column</span>
                  <input value={form.column || ""} onChange={(event) => updateField("column", event.target.value)} />
                </label>
              ) : null}
              {integration.id === "seo" ? (
                <>
                  <label>
                    <span>URL</span>
                    <input value={form.url || ""} onChange={(event) => updateField("url", event.target.value)} placeholder="https://example.com" />
                  </label>
                  <label>
                    <span>Keyword</span>
                    <input value={form.keyword || ""} onChange={(event) => updateField("keyword", event.target.value)} placeholder="target keyword" />
                  </label>
                  <label>
                    <span>Status</span>
                    <input value={form.status || ""} onChange={(event) => updateField("status", event.target.value)} />
                  </label>
                </>
              ) : null}
              {integration.id === "video" ? (
                <>
                  <label>
                    <span>Source path</span>
                    <input value={form.sourcePath || ""} onChange={(event) => updateField("sourcePath", event.target.value)} placeholder="/path/to/video.mp4" />
                  </label>
                  <label>
                    <span>Workflow</span>
                    <input value={form.workflow || ""} onChange={(event) => updateField("workflow", event.target.value)} />
                  </label>
                  <label>
                    <span>Status</span>
                    <input value={form.status || ""} onChange={(event) => updateField("status", event.target.value)} />
                  </label>
                </>
              ) : null}
              {integration.id === "usage-credits" ? (
                <>
                  <label>
                    <span>Provider</span>
                    <input value={form.provider || ""} onChange={(event) => updateField("provider", event.target.value)} placeholder="openai" />
                  </label>
                  <label>
                    <span>Units</span>
                    <input value={form.units || ""} onChange={(event) => updateField("units", event.target.value)} inputMode="decimal" />
                  </label>
                  <label>
                    <span>Estimated cost</span>
                    <input value={form.estimatedCost || ""} onChange={(event) => updateField("estimatedCost", event.target.value)} inputMode="decimal" />
                  </label>
                </>
              ) : null}
              {integration.id !== "usage-credits" ? (
                <label className="is-wide">
                  <span>{integration.id === "notebook" ? "Body" : "Notes"}</span>
                  <textarea
                    value={form.body || form.notes || ""}
                    onChange={(event) => updateField(integration.id === "notebook" ? "body" : "notes", event.target.value)}
                    placeholder="Local private text"
                  />
                </label>
              ) : null}
            </div>
            <button className="wide-action" onClick={createItem} disabled={busy}>
              Save local {state?.itemName || "item"}
            </button>
            {result ? <div className="test-result">{result}</div> : null}
          </div>

          <div className="setup-row">
            <b>Local records</b>
            <div className="local-list">
              {state?.items.length ? (
                state.items.slice(0, 12).map((item) => (
                  <article key={item.id} className="local-item">
                    <strong>{item.title}</strong>
                    <span>{itemDetail(item)}</span>
                    {item.body || item.notes ? <p>{item.body || item.notes}</p> : null}
                  </article>
                ))
              ) : (
                <p>No local records yet.</p>
              )}
            </div>
          </div>
        </section>
      </section>

      <aside className="side-panel">
        <h3>Local status</h3>
        <Metric label="Status" value={statusLabel(String(integration.status))} />
        <Metric label="Items" value={String(state?.summary.total ?? 0)} />
        <Metric label="Updated" value={state?.updatedAt ? new Date(state.updatedAt).toLocaleString() : "not yet"} />
        {integration.id === "usage-credits" ? (
          <>
            <Metric label="Units" value={String(state?.summary.usage.units ?? 0)} />
            <Metric label="Estimated spend" value={`$${Number(state?.summary.usage.estimatedCost || 0).toFixed(4)}`} />
          </>
        ) : null}
        <Metric label="Capabilities" value={integration.capabilities?.join(", ") || "local app"} />
        <button className="wide-action" onClick={onOpenPlugins}>
          Open plugin matrix
        </button>
      </aside>
    </main>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <main className="content">
      <section className="hero-panel">
        <div className="hero-copy">
          <h1>{title}</h1>
          <p>{body}</p>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const { snapshot, health, error, loading, refresh } = useRuntime();
  const [selected, setSelected] = useState("mission");
  const [drawer, setDrawer] = useState<Integration | null>(null);
  const sectionLabel = currentSectionLabel(selected);
  const selectedModule = Boolean(snapshot?.integrations.some((item) => item.id === selected));

  return (
    <div className="app-shell">
      <Sidebar selected={selected} onSelect={setSelected} />
      <section className="workspace">
        <TopBar sectionLabel={sectionLabel} health={health} snapshot={snapshot} loading={loading} onRefresh={refresh} />
        {selected === "mission" ? (
          <MissionControl snapshot={snapshot} onOpenAgent={setSelected} onOpenDrawer={setDrawer} />
        ) : selected === "hermes" ? (
          <HermesHome snapshot={snapshot} onOpenAgent={setSelected} />
        ) : selected === "agent-builder" ? (
          <AgentBuilderPage />
        ) : selected === "execution-results" ? (
          <ExecutionResultsPage />
        ) : selected === "goals" ? (
          <GoalsPage />
        ) : selected === "notebook" ? (
          <NotebookPage />
        ) : selected === "kanban" ? (
          <KanbanPage />
        ) : selected === "memory" ? (
          <MemoryPage />
        ) : selected === "setup" ? (
          <SetupPage />
        ) : selectedModule || agentItems.some((item) => item.id === selected) || selfItems.some((item) => item.id === selected) || automationItems.some((item) => item.id === selected) ? (
          CHAT_FIRST_IDS.has(selected) ? (
            <AgentChatLayout key={selected} id={selected} snapshot={snapshot} onOpenPlugins={() => setSelected("setup")} />
          ) : (
            <SelfModuleControl key={selected} integration={snapshot?.integrations.find((item) => item.id === selected)!} onOpenPlugins={() => setSelected("setup")} />
          )
        ) : (
          <EmptyPanel title="Workspace module wired" body={`${selected} is part of the hub shell and ready for the next workflow panel.`} />
        )}
      </section>
      <Drawer integration={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
