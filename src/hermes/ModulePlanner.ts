import type { Intent } from "./IntentAnalyzer";
import type { Complexity } from "./ComplexityAnalyzer";

export type ModuleId =
  | "goals"
  | "notebook"
  | "kanban"
  | "memory"
  | "scheduler"
  | "seo"
  | "video"
  | "skills"
  | "provider-router"
  | "usage-credits";

export interface ModuleRecommendation {
  module: ModuleId;
  reason: string;
  required: boolean;
}

const intentModuleMap: Record<Intent, Array<{ module: ModuleId; reason: string; required: boolean }>> = {
  software_project: [
    { module: "goals", reason: "Track project objectives", required: false },
    { module: "kanban", reason: "Task management", required: false },
    { module: "memory", reason: "Remember project context", required: false },
    { module: "notebook", reason: "Design notes and specs", required: false }
  ],
  bug_fix: [
    { module: "memory", reason: "Remember bug context", required: false },
    { module: "kanban", reason: "Track fix progress", required: false }
  ],
  research: [
    { module: "notebook", reason: "Capture research findings", required: false },
    { module: "memory", reason: "Remember research context", required: false }
  ],
  documentation: [
    { module: "notebook", reason: "Store documentation drafts", required: false },
    { module: "memory", reason: "Remember documentation context", required: false }
  ],
  automation: [
    { module: "scheduler", reason: "Schedule automated tasks", required: false },
    { module: "goals", reason: "Track automation objectives", required: false },
    { module: "memory", reason: "Remember automation context", required: false }
  ],
  content_creation: [
    { module: "notebook", reason: "Draft content", required: false },
    { module: "memory", reason: "Remember brand voice and context", required: false }
  ],
  seo: [
    { module: "seo", reason: "SEO workflow module", required: true },
    { module: "notebook", reason: "SEO research notes", required: false }
  ],
  video: [
    { module: "video", reason: "Video workflow module", required: true },
    { module: "notebook", reason: "Video scripts and notes", required: false }
  ],
  image: [
    { module: "notebook", reason: "Image generation prompts", required: false }
  ],
  planning: [
    { module: "goals", reason: "Set and track goals", required: true },
    { module: "kanban", reason: "Break down into tasks", required: false },
    { module: "notebook", reason: "Planning notes", required: false }
  ],
  brainstorm: [
    { module: "notebook", reason: "Capture brainstorm ideas", required: false },
    { module: "goals", reason: "Turn ideas into goals", required: false }
  ],
  chat: [],
  unknown: []
};

export function planModules(
  intent: Intent,
  complexity: Complexity,
  message: string
): ModuleRecommendation[] {
  const base = intentModuleMap[intent] || intentModuleMap.unknown;
  let recommendations = [...base];

  if (complexity === "HIGH") {
    const essentials: Array<{ module: ModuleId; reason: string; required: boolean }> = [
      { module: "goals", reason: "High complexity needs goal tracking", required: true },
      { module: "kanban", reason: "High complexity needs task management", required: true },
      { module: "memory", reason: "High complexity needs context retention", required: true }
    ];
    for (const essential of essentials) {
      if (!recommendations.find((r) => r.module === essential.module)) {
        recommendations.push(essential);
      }
    }
  }

  if (complexity === "LOW" && intent !== "software_project" && intent !== "planning") {
    recommendations = recommendations.filter((r) => r.required);
  }

  const lower = message.toLowerCase();
  if (/\b(track|measure|cost|usage|budget|credit)\b/i.test(lower)) {
    if (!recommendations.find((r) => r.module === "usage-credits")) {
      recommendations.push({ module: "usage-credits", reason: "Cost/usage tracking requested", required: false });
    }
  }

  if (/\b(schedule|remind|later|tomorrow|weekly|daily)\b/i.test(lower)) {
    if (!recommendations.find((r) => r.module === "scheduler")) {
      recommendations.push({ module: "scheduler", reason: "Scheduling mentioned", required: false });
    }
  }

  if (/\b(skill|plugin|install|tool|capability)\b/i.test(lower)) {
    if (!recommendations.find((r) => r.module === "skills")) {
      recommendations.push({ module: "skills", reason: "Skills/plugins mentioned", required: false });
    }
  }

  return recommendations;
}
