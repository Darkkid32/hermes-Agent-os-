import { analyzeIntent, type Intent, type IntentResult } from "./IntentAnalyzer";
import { analyzeComplexity, type Complexity, type ComplexityResult } from "./ComplexityAnalyzer";
import { planAgents, type AgentRecommendation, type AgentId } from "./AgentPlanner";
import { planModules, type ModuleRecommendation, type ModuleId } from "./ModulePlanner";
import { planWorkspace, type WorkspaceDecision } from "./WorkspacePlanner";
import { matchAgents, type CapabilityAnalysis } from "./CapabilityMatcher";
import type { BusinessAgent } from "./BusinessAgent";

export type { Intent, IntentResult, Complexity, ComplexityResult, AgentRecommendation, AgentId, ModuleRecommendation, ModuleId, WorkspaceDecision, CapabilityAnalysis };

export interface BrainPlan {
  intent: Intent;
  intentConfidence: number;
  complexity: Complexity;
  complexityScore: number;
  complexityFactors: string[];
  goal: string;
  agents: AgentRecommendation[];
  modules: ModuleRecommendation[];
  workspace: WorkspaceDecision;
  capabilityAnalysis: CapabilityAnalysis;
  reasoning: string[];
  timestamp: number;
}

export function think(message: string, businessAgents: BusinessAgent[] = []): BrainPlan {
  const intentResult = analyzeIntent(message);
  const complexityResult = analyzeComplexity(message);
  const agentRecommendations = planAgents(intentResult.intent, complexityResult.level, message);
  const moduleRecommendations = planModules(intentResult.intent, complexityResult.level, message);
  const workspaceDecision = planWorkspace(intentResult.intent, complexityResult.level, message);

  const reasoning: string[] = [];

  reasoning.push(`Intent: ${intentResult.intent} (confidence: ${intentResult.confidence})`);
  if (intentResult.keywords.length > 0) {
    reasoning.push(`Keywords detected: ${intentResult.keywords.join(", ")}`);
  }

  reasoning.push(`Complexity: ${complexityResult.level} (score: ${complexityResult.score})`);
  if (complexityResult.factors.length > 0) {
    reasoning.push(`Complexity factors: ${complexityResult.factors.join(", ")}`);
  }

  const capabilityAnalysis = matchAgents(
    {
      intent: intentResult.intent,
      intentConfidence: intentResult.confidence,
      complexity: complexityResult.level,
      complexityScore: complexityResult.score,
      complexityFactors: complexityResult.factors,
      goal: extractGoal(message),
      agents: agentRecommendations,
      modules: moduleRecommendations,
      workspace: workspaceDecision,
      capabilityAnalysis: { requestedCapabilities: [], topMatch: null, runnerUp: null, allMatches: [], hasMatches: false, fallbackMessage: "" },
      reasoning: [],
      timestamp: Date.now()
    },
    businessAgents
  );

  if (capabilityAnalysis.hasMatches && capabilityAnalysis.topMatch) {
    reasoning.push(`Recommended Business Agent: ${capabilityAnalysis.topMatch.agent.name} (${capabilityAnalysis.topMatch.score}% confidence)`);
    if (capabilityAnalysis.topMatch.matchedCapabilities.length > 0) {
      reasoning.push(`Matched capabilities: ${capabilityAnalysis.topMatch.matchedCapabilities.join(", ")}`);
    }
    reasoning.push(`Execution engine: ${capabilityAnalysis.topMatch.executionEngineLabel}`);
    if (capabilityAnalysis.runnerUp) {
      reasoning.push(`Runner-up: ${capabilityAnalysis.runnerUp.agent.name} (${capabilityAnalysis.runnerUp.score}%)`);
    }
  } else if (businessAgents.length > 0) {
    reasoning.push("No Business Agent matches this request — fallback to platform agents.");
  }

  if (agentRecommendations.length > 0 && !capabilityAnalysis.hasMatches) {
    reasoning.push(`Platform agents: ${agentRecommendations.map((a) => a.agent).join(", ")}`);
  }

  const requiredModules = moduleRecommendations.filter((m) => m.required);
  const optionalModules = moduleRecommendations.filter((m) => !m.required);
  if (requiredModules.length > 0) {
    reasoning.push(`Required modules: ${requiredModules.map((m) => m.module).join(", ")}`);
  }
  if (optionalModules.length > 0) {
    reasoning.push(`Optional modules: ${optionalModules.map((m) => m.module).join(", ")}`);
  }

  reasoning.push(`Workspace: ${workspaceDecision.create ? "Create" : "No"} — ${workspaceDecision.reason}`);

  return {
    intent: intentResult.intent,
    intentConfidence: intentResult.confidence,
    complexity: complexityResult.level,
    complexityScore: complexityResult.score,
    complexityFactors: complexityResult.factors,
    goal: extractGoal(message),
    agents: agentRecommendations,
    modules: moduleRecommendations,
    workspace: workspaceDecision,
    capabilityAnalysis,
    reasoning,
    timestamp: Date.now()
  };
}

function extractGoal(message: string): string {
  const cleaned = message
    .replace(/\b(please|can you|could you|i want to|i need to|help me|let's|we should)\b/gi, "")
    .trim();

  const sentences = cleaned.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const goal = sentences[0]?.trim() || message;

  return goal.length > 120 ? goal.slice(0, 117) + "..." : goal;
}
