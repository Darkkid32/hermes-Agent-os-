import type { BrainPlan } from "./HermesBrain";
import type { BusinessAgent, CapabilityId, ExecutionEngineId } from "./BusinessAgent";
import { EXECUTION_ENGINES } from "./BusinessAgent";

export interface AgentMatch {
  agent: BusinessAgent;
  score: number;
  matchedCapabilities: CapabilityId[];
  missingCapabilities: CapabilityId[];
  executionEngine: ExecutionEngineId;
  executionEngineLabel: string;
  reason: string;
}

export interface CapabilityAnalysis {
  requestedCapabilities: CapabilityId[];
  topMatch: AgentMatch | null;
  runnerUp: AgentMatch | null;
  allMatches: AgentMatch[];
  hasMatches: boolean;
  fallbackMessage: string;
}

const intentCapabilityMap: Record<string, CapabilityId[]> = {
  software_project: ["coding", "planning"],
  bug_fix: ["coding"],
  research: ["research", "browser"],
  documentation: ["writing", "research"],
  automation: ["automation", "coding"],
  content_creation: ["writing", "research"],
  seo: ["research", "writing", "browser"],
  video: ["writing", "vision"],
  image: ["vision", "writing"],
  planning: ["planning", "research"],
  brainstorm: ["planning", "research", "writing"],
  chat: ["writing"],
  unknown: ["writing"]
};

function deriveCapabilities(plan: BrainPlan, message: string): CapabilityId[] {
  const caps = new Set<CapabilityId>();

  const intentCaps = intentCapabilityMap[plan.intent] || [];
  for (const c of intentCaps) caps.add(c);

  const lower = message.toLowerCase();
  if (/\b(code|build|develop|implement|debug|fix|program|script|api|endpoint)\b/i.test(lower)) caps.add("coding");
  if (/\b(research|analyze|investigate|study|compare|explore)\b/i.test(lower)) caps.add("research");
  if (/\b(write|draft|blog|article|document|content|copy|readme)\b/i.test(lower)) caps.add("writing");
  if (/\b(plan|roadmap|strategy|architecture|design|structure|organize)\b/i.test(lower)) caps.add("planning");
  if (/\b(vision|image|screenshot|photo|design|visual|ui|mockup)\b/i.test(lower)) caps.add("vision");
  if (/\b(browse|browser|website|scrape|crawl|fetch|web)\b/i.test(lower)) caps.add("browser");
  if (/\b(automate|workflow|pipeline|schedule|cron|batch|trigger)\b/i.test(lower)) caps.add("automation");

  if (plan.complexityFactors.includes("ui-design") || plan.complexityFactors.includes("frontend-ui")) caps.add("vision");
  if (plan.complexityFactors.includes("backend-api")) caps.add("coding");
  if (plan.complexityFactors.includes("database")) caps.add("coding");
  if (plan.complexityFactors.includes("full-stack") || plan.complexityFactors.includes("tech-stack")) caps.add("coding");

  return [...caps];
}

function scoreAgent(
  agent: BusinessAgent,
  requested: CapabilityId[]
): { score: number; matched: CapabilityId[]; missing: CapabilityId[] } {
  const matched: CapabilityId[] = [];
  const missing: CapabilityId[] = [];

  for (const cap of requested) {
    if (agent.capabilities.includes(cap)) {
      matched.push(cap);
    } else {
      missing.push(cap);
    }
  }

  if (requested.length === 0) {
    return { score: agent.capabilities.length > 0 ? 50 : 30, matched: [], missing: [] };
  }

  const matchRatio = matched.length / requested.length;
  const moduleBonus = Math.min(agent.enabledModules.length * 2, 10);
  const memoryBonus = agent.memoryEnabled ? 5 : 0;
  const base = Math.round(matchRatio * 80 + moduleBonus + memoryBonus);

  return { score: Math.min(base, 99), matched, missing };
}

function buildReason(matched: CapabilityId[], agent: BusinessAgent): string {
  if (matched.length === 0) {
    return `${agent.department} agent — no direct capability match but available as fallback`;
  }
  return `Matches ${matched.join(" + ")}`;
}

export function matchAgents(
  plan: BrainPlan,
  agents: BusinessAgent[]
): CapabilityAnalysis {
  const activeAgents = agents.filter((a) => a.active && a.capabilities.length > 0);
  const requested = deriveCapabilities(plan, plan.goal);

  if (activeAgents.length === 0) {
    return {
      requestedCapabilities: requested,
      topMatch: null,
      runnerUp: null,
      allMatches: [],
      hasMatches: false,
      fallbackMessage: "No Business Agent matches this request. Create a new Business Agent in Agent Builder."
    };
  }

  const matches: AgentMatch[] = activeAgents.map((agent) => {
    const { score, matched, missing } = scoreAgent(agent, requested);
    const engineLabel = EXECUTION_ENGINES.find((e) => e.id === agent.executionEngine)?.label || agent.executionEngine;
    return {
      agent,
      score,
      matchedCapabilities: matched,
      missingCapabilities: missing,
      executionEngine: agent.executionEngine,
      executionEngineLabel: engineLabel,
      reason: buildReason(matched, agent)
    };
  });

  matches.sort((a, b) => b.score - a.score);

  const topMatch = matches[0] || null;
  const runnerUp = matches[1] || null;

  const hasMatches = topMatch !== null && topMatch.score > 0;
  const fallbackMessage = hasMatches
    ? ""
    : "No Business Agent matches this request. Create a new Business Agent in Agent Builder.";

  return {
    requestedCapabilities: requested,
    topMatch,
    runnerUp,
    allMatches: matches,
    hasMatches,
    fallbackMessage
  };
}
