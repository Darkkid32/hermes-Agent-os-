import { Gauge, Loader2, ShieldCheck, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { testIntegration } from "../api";
import Metric from "../components/ui/Metric";
import { statusLabel } from "../components/ui/statusLabel";
import type { Integration } from "../types";

export default function Drawer({
  integration,
  onClose
}: {
  integration: Integration | null;
  onClose: () => void;
}) {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Escape key closes drawer
  useEffect(() => {
    if (!integration) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [integration, onClose]);

  // Focus trap within drawer
  useEffect(() => {
    if (!integration || !drawerRef.current) return;
    const el = drawerRef.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [integration]);

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
      <aside className="drawer" ref={drawerRef} onClick={(event) => event.stopPropagation()}>
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
