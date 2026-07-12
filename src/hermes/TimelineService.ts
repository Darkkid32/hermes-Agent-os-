export interface TimelineEvent {
  id: string;
  type: "workspace" | "goal" | "notebook" | "kanban" | "memory" | "queue" | "agent";
  action: "created" | "initialized" | "queued" | "started" | "completed" | "updated";
  label: string;
  timestamp: number;
}

export interface Timeline {
  events: TimelineEvent[];
}

let counter = 0;

function nextId(): string {
  return `evt-${Date.now()}-${++counter}`;
}

export function createTimeline(): Timeline {
  return { events: [] };
}

export function addEvent(
  timeline: Timeline,
  type: TimelineEvent["type"],
  action: TimelineEvent["action"],
  label: string
): TimelineEvent {
  const event: TimelineEvent = {
    id: nextId(),
    type,
    action,
    label,
    timestamp: Date.now()
  };
  timeline.events.push(event);
  return event;
}

export function formatEventTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
