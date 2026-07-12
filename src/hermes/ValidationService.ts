import type { HermesState } from "./IntegrationManager";

export interface ValidationResult {
  pass: boolean;
  checks: CheckResult[];
}

export interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

export function validate(state: HermesState): ValidationResult {
  const checks: CheckResult[] = [];

  checks.push({
    name: "Workspace exists",
    pass: state.workspace !== null,
    detail: state.workspace ? `Workspace "${state.workspace.title}" (${state.workspace.id})` : "No workspace"
  });

  checks.push({
    name: "Goal linked",
    pass: state.goal !== null,
    detail: state.goal ? `Goal "${state.goal.title}" (${state.goal.id})` : "No goal"
  });

  checks.push({
    name: "Notebook linked",
    pass: state.notebook !== null,
    detail: state.notebook ? `Notebook "${state.notebook.title}" (${state.notebook.id})` : "No notebook"
  });

  checks.push({
    name: "Kanban linked",
    pass: state.kanban !== null,
    detail: state.kanban ? `Kanban board (${state.kanban.id}) — ${state.kanban.planning.length} planning, ${state.kanban.inProgress.length} in progress, ${state.kanban.completed.length} completed` : "No kanban"
  });

  checks.push({
    name: "Memory linked",
    pass: state.memory !== null,
    detail: state.memory ? `Memory for "${state.memory.projectName}" — ${state.memory.currentStage}` : "No memory"
  });

  checks.push({
    name: "Queue linked",
    pass: state.queue.items.length > 0,
    detail: `${state.queue.items.length} agent(s) queued`
  });

  checks.push({
    name: "Timeline linked",
    pass: state.timeline.events.length > 0,
    detail: `${state.timeline.events.length} event(s) logged`
  });

  if (state.workspace && state.goal) {
    checks.push({
      name: "Goal references workspace",
      pass: true,
      detail: `Goal "${state.goal.title}" belongs to workspace "${state.workspace.title}"`
    });
  } else if (state.workspace && !state.goal) {
    checks.push({
      name: "Goal references workspace",
      pass: false,
      detail: "Workspace exists but no goal linked"
    });
  }

  if (state.workspace && state.kanban) {
    checks.push({
      name: "Kanban references workspace",
      pass: true,
      detail: `Kanban board (${state.kanban.id}) belongs to workspace "${state.workspace.title}"`
    });
  }

  if (state.workspace && state.memory) {
    const nameMatch = state.memory.projectName === state.workspace.title;
    checks.push({
      name: "Memory references workspace",
      pass: nameMatch,
      detail: nameMatch
        ? `Memory project "${state.memory.projectName}" matches workspace`
        : `Memory project "${state.memory.projectName}" ≠ workspace "${state.workspace.title}"`
    });
  }

  const pass = checks.every((c) => c.pass);

  return { pass, checks };
}
