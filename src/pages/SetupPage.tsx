import { Mic, Settings } from "lucide-react";
import Metric from "../components/ui/Metric";
import SectionHeading from "../components/ui/SectionHeading";

export default function SetupPage() {
  return (
    <main className="content">
      <section className="hero-panel compact">
        <div className="hero-copy">
          <span className="eyebrow">
            <Settings size={16} />
            Setup
          </span>
          <h1>Platform Setup</h1>
          <p>Configure providers, manage connections, and explore experimental features.</p>
        </div>
      </section>

      <SectionHeading title="Experimental Features" suffix="not yet active" />
      <section className="agent-grid">
        <article className="agent-card">
          <div className="agent-card-head">
            <div className="agent-icon">
              <Mic size={22} />
            </div>
            <div>
              <h3>Voice Control</h3>
              <p>Desktop voice automation with wake-word, click, type, and screenshot support.</p>
            </div>
            <span className="status-pill">Coming Soon</span>
          </div>
          <div className="metric-row">
            <Metric label="Status" value="experimental" />
            <Metric label="Requirement" value="desktop integration" />
          </div>
          <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.7 }}>
            Requires desktop integration. This feature is under development and will be available in a future release.
          </p>
        </article>
      </section>
    </main>
  );
}
