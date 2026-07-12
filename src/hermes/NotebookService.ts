import type { BrainPlan } from "./HermesBrain";

export interface NotebookEntry {
  id: string;
  title: string;
  summary: string;
  requirements: string[];
  brainReasoning: string[];
  suggestedArchitecture: string;
  createdAt: number;
}

let nbCounter = 0;

function nextNbId(): string {
  return `nb-${Date.now()}-${++nbCounter}`;
}

function suggestArchitecture(plan: BrainPlan): string {
  const parts: string[] = [];
  if (plan.agents.length > 0) {
    parts.push(`Primary agent: ${plan.agents[0].agent}`);
  }
  const techHints = plan.complexityFactors;
  if (techHints.includes("full-stack") || techHints.includes("tech-stack")) {
    parts.push("Full-stack architecture recommended");
  }
  if (techHints.includes("database")) {
    parts.push("Database layer required");
  }
  if (techHints.includes("api") || techHints.includes("backend-api")) {
    parts.push("API layer required");
  }
  if (techHints.includes("frontend-ui") || techHints.includes("ui-design")) {
    parts.push("Frontend UI component layer");
  }
  if (parts.length === 0) {
    parts.push("Standard project structure");
  }
  return parts.join(". ");
}

export function createNotebookEntry(plan: BrainPlan): NotebookEntry {
  const requirements: string[] = [];
  if (plan.workspace.create) {
    requirements.push("Dedicated workspace setup");
  }
  for (const mod of plan.modules) {
    if (mod.required) {
      requirements.push(`${mod.module} module: ${mod.reason}`);
    }
  }
  if (plan.complexity === "HIGH") {
    requirements.push("High complexity — phased approach recommended");
  }
  if (plan.complexity === "MEDIUM") {
    requirements.push("Medium complexity — structured approach");
  }

  return {
    id: nextNbId(),
    title: plan.goal.length > 80 ? plan.goal.slice(0, 77) + "..." : plan.goal,
    summary: `Project: ${plan.goal}. Intent: ${plan.intent.replace(/_/g, " ")}. Complexity: ${plan.complexity}.`,
    requirements,
    brainReasoning: plan.reasoning,
    suggestedArchitecture: suggestArchitecture(plan),
    createdAt: Date.now()
  };
}
