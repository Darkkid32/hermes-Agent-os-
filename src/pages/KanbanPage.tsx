import { useState, useEffect } from "react";
import {
  KanbanSquare,
  ArrowRight,
  CheckCircle
} from "lucide-react";
import {
  getState,
  subscribe,
  moveKanbanCard,
  type HermesState
} from "../hermes/IntegrationManager";
import type { KanbanCard } from "../hermes/KanbanService";

function KanbanColumn({
  title,
  cards,
  color,
  onMove
}: {
  title: string;
  cards: KanbanCard[];
  color: string;
  onMove: (cardId: string) => void;
}) {
  return (
    <div className="kanban-column">
      <div className="kanban-column-header" style={{ borderColor: color }}>
        <span>{title}</span>
        <span className="kanban-count">{cards.length}</span>
      </div>
      <div className="kanban-cards">
        {cards.map((card) => (
          <div key={card.id} className="kanban-card">
            <span>{card.title}</span>
            <button className="kanban-move-btn" onClick={() => onMove(card.id)}>
              <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KanbanPage() {
  const [state, setState] = useState<HermesState>(getState);

  useEffect(() => {
    return subscribe(setState);
  }, []);

  const kanban = state.kanban;

  if (!kanban) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Kanban</h1>
          <p className="sub">No kanban board yet. Run Hermes to create one.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Kanban</h1>
      </header>

      <div className="kanban-board">
        <KanbanColumn
          title="Planning"
          cards={kanban.planning}
          color="#f59e0b"
          onMove={(id) => moveKanbanCard(id, "inProgress")}
        />
        <KanbanColumn
          title="In Progress"
          cards={kanban.inProgress}
          color="#3b82f6"
          onMove={(id) => moveKanbanCard(id, "completed")}
        />
        <KanbanColumn
          title="Completed"
          cards={kanban.completed}
          color="#10b981"
          onMove={() => {}}
        />
      </div>
    </div>
  );
}
