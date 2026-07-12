import type { BrainPlan } from "./HermesBrain";

export interface KanbanCard {
  id: string;
  title: string;
  status: "planning" | "in_progress" | "completed";
  createdAt: number;
}

export interface KanbanBoard {
  id: string;
  planning: KanbanCard[];
  inProgress: KanbanCard[];
  completed: KanbanCard[];
}

let kbCounter = 0;

function nextKbId(): string {
  return `kb-${Date.now()}-${++kbCounter}`;
}

function nextCardId(): string {
  return `card-${Date.now()}-${++kbCounter}`;
}

export function createKanbanBoard(plan: BrainPlan): KanbanBoard {
  const planning: KanbanCard[] = [];
  const inProgress: KanbanCard[] = [];
  const completed: KanbanCard[] = [];

  planning.push({
    id: nextCardId(),
    title: "Project setup and initialization",
    status: "planning",
    createdAt: Date.now()
  });

  for (const mod of plan.modules) {
    if (mod.required) {
      planning.push({
        id: nextCardId(),
        title: `Set up ${mod.module} — ${mod.reason}`,
        status: "planning",
        createdAt: Date.now()
      });
    }
  }

  if (plan.workspace.create) {
    planning.push({
      id: nextCardId(),
      title: "Create workspace structure",
      status: "planning",
      createdAt: Date.now()
    });
  }

  for (const agent of plan.agents) {
    planning.push({
      id: nextCardId(),
      title: `Execute with ${agent.agent} — ${agent.reason}`,
      status: "planning",
      createdAt: Date.now()
    });
  }

  return {
    id: nextKbId(),
    planning,
    inProgress,
    completed
  };
}
