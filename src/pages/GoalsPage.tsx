import { useState, useEffect } from "react";
import {
  CheckCircle,
  CircleDot,
  Clock,
  Plus,
  Trash2,
  RefreshCw
} from "lucide-react";
import {
  getState,
  subscribe,
  updateGoalStatus,
  type HermesState
} from "../hermes/IntegrationManager";
import type { Goal } from "../hermes/GoalService";

export function GoalsPage() {
  const [state, setState] = useState<HermesState>(getState);

  useEffect(() => {
    return subscribe(setState);
  }, []);

  const goal = state.goal;

  if (!goal) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Goals</h1>
          <p className="sub">No goal yet. Run Hermes to create one.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Goals</h1>
      </header>

      <div className="module-card">
        <div className="module-card-header">
          <CircleDot size={18} />
          <span>Current Goal</span>
          <span className={`status-badge status-${goal.status}`}>{goal.status}</span>
        </div>
        <div className="module-card-body">
          <h3>{goal.title}</h3>
          <p>{goal.description}</p>
          <div className="module-meta">
            <span>Priority: {goal.priority}</span>
            <span>Created: {new Date(goal.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="module-card-actions">
          {goal.status === "pending" && (
            <button onClick={() => updateGoalStatus("in_progress")}>
              <Clock size={14} /> Start
            </button>
          )}
          {goal.status === "in_progress" && (
            <button onClick={() => updateGoalStatus("completed")}>
              <CheckCircle size={14} /> Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
