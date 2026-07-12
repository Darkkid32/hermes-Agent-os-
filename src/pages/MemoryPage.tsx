import { useState, useEffect } from "react";
import {
  DatabaseZap,
  RefreshCw
} from "lucide-react";
import {
  getState,
  subscribe,
  type HermesState
} from "../hermes/IntegrationManager";

export function MemoryPage() {
  const [state, setState] = useState<HermesState>(getState);

  useEffect(() => {
    return subscribe(setState);
  }, []);

  const memory = state.memory;

  if (!memory) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Memory</h1>
          <p className="sub">No memory yet. Run Hermes to create one.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Memory</h1>
      </header>

      <div className="module-card">
        <div className="module-card-header">
          <DatabaseZap size={18} />
          <span>{memory.projectName}</span>
        </div>
        <div className="module-card-body">
          <div className="memory-section">
            <h4>Goal</h4>
            <p>{memory.goal}</p>
          </div>

          <div className="memory-section">
            <h4>Current Stage</h4>
            <p>{memory.currentStage}</p>
          </div>

          <div className="memory-section">
            <h4>Recent Decision</h4>
            <p>{memory.recentDecision}</p>
          </div>

          <div className="memory-section">
            <h4>Preferred Stack</h4>
            <div className="tag-list">
              {memory.preferredStack.map((tech, i) => (
                <span key={i} className="tag">{tech}</span>
              ))}
            </div>
          </div>

          <div className="module-meta">
            <span>Created: {new Date(memory.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
