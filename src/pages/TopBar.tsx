import { Activity, ChevronRight, Loader2, Radio } from "lucide-react";
import type { Health, IntegrationSnapshot } from "../types";

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return <span className={active ? "status-pill active" : "status-pill"}>{label}</span>;
}

export default function TopBar({
  sectionLabel,
  health,
  snapshot,
  loading,
  onRefresh
}: {
  sectionLabel: string;
  health: Health | null;
  snapshot: IntegrationSnapshot | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="topbar">
      <div>
        <span>Workspace</span>
        <ChevronRight size={14} />
        <b>{sectionLabel}</b>
      </div>
      <div className="topbar-actions">
        <StatusPill label="MiniMax M3" active={Boolean(snapshot?.integrations.find((i) => i.id === "minimax" && i.status === "connected"))} />
        <StatusPill label="Hermes GW" active={Boolean(snapshot?.integrations.find((i) => i.id === "gateway" && i.status === "connected"))} />
        <StatusPill label={health?.mode || "backend"} active={Boolean(health?.ok)} />
        <button className="icon-button" onClick={onRefresh} aria-label="Refresh runtime">
          {loading ? <Loader2 className="spin" size={17} /> : <Activity size={17} />}
        </button>
      </div>
    </header>
  );
}
