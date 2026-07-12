import type { BrainPlan } from "./HermesBrain";

export interface ProjectMemory {
  projectName: string;
  preferredStack: string[];
  goal: string;
  currentStage: string;
  recentDecision: string;
  createdAt: number;
}

function extractStack(plan: BrainPlan): string[] {
  const stack: string[] = [];
  const factors = plan.complexityFactors;
  if (factors.includes("tech-stack")) stack.push("Multi-technology stack");
  if (factors.includes("frontend-ui") || factors.includes("ui-design")) stack.push("Frontend");
  if (factors.includes("backend-api")) stack.push("Backend API");
  if (factors.includes("database")) stack.push("Database");
  if (factors.includes("full-stack")) stack.push("Full-stack");
  if (stack.length === 0) stack.push("To be determined");
  return stack;
}

export function createMemory(plan: BrainPlan): ProjectMemory {
  return {
    projectName: plan.workspace.suggestedName || "New Project",
    preferredStack: extractStack(plan),
    goal: plan.goal,
    currentStage: "Planning — execution engine initialized",
    recentDecision: `Intent: ${plan.intent.replace(/_/g, " ")}. Complexity: ${plan.complexity}. ${plan.agents.length} agent(s) queued.`,
    createdAt: Date.now()
  };
}
