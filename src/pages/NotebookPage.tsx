import { useState, useEffect } from "react";
import {
  NotebookTabs,
  RefreshCw
} from "lucide-react";
import {
  getState,
  subscribe,
  type HermesState
} from "../hermes/IntegrationManager";

export function NotebookPage() {
  const [state, setState] = useState<HermesState>(getState);

  useEffect(() => {
    return subscribe(setState);
  }, []);

  const notebook = state.notebook;

  if (!notebook) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Notebook</h1>
          <p className="sub">No notebook yet. Run Hermes to create one.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Notebook</h1>
      </header>

      <div className="module-card">
        <div className="module-card-header">
          <NotebookTabs size={18} />
          <span>{notebook.title}</span>
        </div>
        <div className="module-card-body">
          <div className="notebook-section">
            <h4>Summary</h4>
            <p>{notebook.summary}</p>
          </div>

          {notebook.requirements.length > 0 && (
            <div className="notebook-section">
              <h4>Requirements</h4>
              <ul>
                {notebook.requirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {notebook.brainReasoning.length > 0 && (
            <div className="notebook-section">
              <h4>Brain Reasoning</h4>
              <ul>
                {notebook.brainReasoning.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="notebook-section">
            <h4>Suggested Architecture</h4>
            <p>{notebook.suggestedArchitecture}</p>
          </div>

          <div className="module-meta">
            <span>Created: {new Date(notebook.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
