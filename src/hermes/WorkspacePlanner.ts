import type { Intent } from "./IntentAnalyzer";
import type { Complexity } from "./ComplexityAnalyzer";

export interface WorkspaceDecision {
  create: boolean;
  reason: string;
  suggestedName?: string;
}

export function planWorkspace(
  intent: Intent,
  complexity: Complexity,
  message: string
): WorkspaceDecision {
  const requiresWorkspace =
    intent === "software_project" ||
    intent === "planning" ||
    (complexity === "HIGH" && intent !== "chat" && intent !== "unknown");

  if (requiresWorkspace) {
    const name = extractProjectName(message);
    return {
      create: true,
      reason: `${intent.replace(/_/g, " ")} requires a dedicated workspace for goal tracking, task management, and context retention.`,
      suggestedName: name
    };
  }

  if (intent === "brainstorm" || intent === "research") {
    return {
      create: false,
      reason: `${intent.replace(/_/g, " ")} can use the notebook without a full workspace.`
    };
  }

  if (complexity === "MEDIUM" && intent !== "chat" && intent !== "unknown") {
    return {
      create: false,
      reason: "Medium complexity can be handled without a dedicated workspace."
    };
  }

  return {
    create: false,
    reason: "Simple or conversational request does not require a workspace."
  };
}

function extractProjectName(message: string): string {
  const lower = message.toLowerCase();

  const buildPatterns = [
    /\b(?:build|create|develop|make|design)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+using|\s+with|\s+that|\s+for|\s+in|\s*$)/i,
    /\b(?:build|create|develop|make|design)\s+(.+)/i
  ];

  for (const pattern of buildPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1]
        .trim()
        .replace(/[^\w\s-]/g, "")
        .split(/\s+/)
        .slice(0, 3)
        .join(" ");
      if (name.length > 2) {
        return name;
      }
    }
  }

  return "New Project";
}
