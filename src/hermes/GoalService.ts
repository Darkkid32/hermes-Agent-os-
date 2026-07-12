import type { BrainPlan } from "./HermesBrain";

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  createdAt: number;
}

let goalCounter = 0;

function nextGoalId(): string {
  return `goal-${Date.now()}-${++goalCounter}`;
}

export function createGoal(plan: BrainPlan): Goal {
  const priorityMap = { LOW: "low" as const, MEDIUM: "medium" as const, HIGH: "high" as const };
  return {
    id: nextGoalId(),
    title: plan.goal.length > 80 ? plan.goal.slice(0, 77) + "..." : plan.goal,
    description: plan.goal,
    status: "pending",
    priority: priorityMap[plan.complexity],
    createdAt: Date.now()
  };
}
