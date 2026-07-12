import { Gauge, Loader2, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { testIntegration } from "../api";
import type { Integration } from "../types";

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

export default function Drawer({
  integration,
  onClose
}: {
  integration: Integration | null;
  onClose: () => void;
}) {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!integration) return null;

  async function runTest() {
    setBusy(true);
    setResult(null);
    try {
      const data = await testIntegration(integration!.id);
      setResult(data.message);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <span className="eyebrow">
          <ShieldCheck size={16} />
          Connection detail
        </span>
        <h2>{integration.label}</h2>
        <p>{integration.connection}</p>
        <div className="drawer-stack">
          <Metric label="Status" value={statusLabel(String(integration.status))} />
          <Metric label="Category" value={integration.category || integration.type} />
          <Metric label="Configured" value={integration.configured ? "yes" : "needs setup"} />
          <Metric label="Missing" value={integration.missing?.length ? integration.missing.join(", ") : "none"} />
        </div>
        <button className="wide-action" onClick={runTest} disabled={busy}>
          {busy ? <Loader2 className="spin" size={18} /> : <Gauge size={18} />}
          Test connection
        </button>
        {result ? <div className="test-result">{result}</div> : null}
      </aside>
    </div>
  );
}
