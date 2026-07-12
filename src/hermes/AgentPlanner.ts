import type { Intent } from "./IntentAnalyzer";
import type { Complexity } from "./ComplexityAnalyzer";

export type AgentId =
  | "claude"
  | "openclaw"
  | "openclaude"
  | "gemini"
  | "codex"
  | "opencode"
  | "free-claude-code"
  | "hermes";

export interface AgentRecommendation {
  agent: AgentId;
  reason: string;
  priority: number;
}

const intentAgentMap: Record<Intent, Array<{ agent: AgentId; reason: string; priority: number }>> = {
  software_project: [
    { agent: "claude", reason: "Primary coding agent", priority: 1 },
    { agent: "codex", reason: "Code generation and explanation", priority: 2 },
    { agent: "openclaw", reason: "Code review and analysis", priority: 3 }
  ],
  bug_fix: [
    { agent: "claude", reason: "Debugging and code analysis", priority: 1 },
    { agent: "codex", reason: "Error explanation and fix suggestions", priority: 2 }
  ],
  research: [
    { agent: "gemini", reason: "Research and analysis", priority: 1 },
    { agent: "openclaw", reason: "Deep analysis and summarization", priority: 2 }
  ],
  documentation: [
    { agent: "claude", reason: "Technical writing", priority: 1 },
    { agent: "openclaw", reason: "Documentation generation", priority: 2 }
  ],
  automation: [
    { agent: "claude", reason: "Workflow automation", priority: 1 },
    { agent: "codex", reason: "Script generation", priority: 2 }
  ],
  content_creation: [
    { agent: "claude", reason: "Content writing", priority: 1 },
    { agent: "openclaw", reason: "Content editing and refinement", priority: 2 }
  ],
  seo: [
    { agent: "gemini", reason: "SEO research and analysis", priority: 1 },
    { agent: "claude", reason: "SEO content optimization", priority: 2 }
  ],
  video: [
    { agent: "claude", reason: "Video scripting and planning", priority: 1 },
    { agent: "gemini", reason: "Video research", priority: 2 }
  ],
  image: [
    { agent: "claude", reason: "Image generation prompts and planning", priority: 1 },
    { agent: "gemini", reason: "Visual research", priority: 2 }
  ],
  planning: [
    { agent: "claude", reason: "Strategic planning", priority: 1 },
    { agent: "openclaw", reason: "Analysis and evaluation", priority: 2 },
    { agent: "gemini", reason: "Research for planning", priority: 3 }
  ],
  brainstorm: [
    { agent: "claude", reason: "Idea generation", priority: 1 },
    { agent: "gemini", reason: "Research and context", priority: 2 },
    { agent: "openclaw", reason: "Idea evaluation", priority: 3 }
  ],
  chat: [
    { agent: "claude", reason: "Conversational agent", priority: 1 }
  ],
  unknown: [
    { agent: "claude", reason: "General-purpose agent", priority: 1 }
  ]
};

export function planAgents(
  intent: Intent,
  complexity: Complexity,
  message: string
): AgentRecommendation[] {
  const base = intentAgentMap[intent] || intentAgentMap.unknown;

  let recommendations = [...base];

  if (complexity === "HIGH") {
    const highComplexityExtras: Array<{ agent: AgentId; reason: string; priority: number }> = [
      { agent: "openclaw", reason: "Architecture review", priority: 2 },
      { agent: "codex", reason: "Implementation support", priority: 3 }
    ];
    for (const extra of highComplexityExtras) {
      if (!recommendations.find((r) => r.agent === extra.agent)) {
        recommendations.push(extra);
      }
    }
  }

  if (complexity === "LOW") {
    recommendations = recommendations.slice(0, 2);
  }

  const lower = message.toLowerCase();
  if (/\b(free|cheap|budget|no.?cost)\b/i.test(lower)) {
    const freeAgent: AgentRecommendation = {
      agent: "free-claude-code",
      reason: "Free-tier option",
      priority: 0
    };
    if (!recommendations.find((r) => r.agent === "free-claude-code")) {
      recommendations.unshift(freeAgent);
    }
  }

  if (/\b(gemini|google|search)\b/i.test(lower)) {
    if (!recommendations.find((r) => r.agent === "gemini")) {
      recommendations.push({ agent: "gemini", reason: "Requested by user", priority: 1 });
    }
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}
