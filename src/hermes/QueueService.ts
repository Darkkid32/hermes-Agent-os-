import type { BrainPlan } from "./HermesBrain";
import type { AgentId } from "./HermesBrain";

export interface QueueItem {
  agent: AgentId;
  status: "queued" | "running" | "completed" | "failed";
  priority: number;
  reason: string;
  queuedAt: number;
}

export interface AgentQueue {
  items: QueueItem[];
}

let qCounter = 0;

function nextQId(): string {
  return `q-${Date.now()}-${++qCounter}`;
}

export function createQueue(plan: BrainPlan): AgentQueue {
  const items: QueueItem[] = plan.agents.map((rec) => ({
    agent: rec.agent,
    status: "queued" as const,
    priority: rec.priority,
    reason: rec.reason,
    queuedAt: Date.now()
  }));

  return { items };
}
