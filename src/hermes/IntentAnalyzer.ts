export type Intent =
  | "software_project"
  | "bug_fix"
  | "research"
  | "documentation"
  | "automation"
  | "content_creation"
  | "seo"
  | "video"
  | "image"
  | "planning"
  | "brainstorm"
  | "chat"
  | "unknown";

export interface IntentResult {
  intent: Intent;
  confidence: number;
  keywords: string[];
}

const intentPatterns: Array<{ intent: Intent; patterns: RegExp[] }> = [
  {
    intent: "software_project",
    patterns: [
      /\b(build|create|develop|implement|code|app|website|system|feature|module|api|endpoint|component|page|layout)\b/i,
      /\b(project|application|platform|tool|utility|service)\b/i,
      /\b(frontend|backend|fullstack|database|schema|migration)\b/i
    ]
  },
  {
    intent: "bug_fix",
    patterns: [
      /\b(fix|bug|error|crash|broken|issue|problem|debug|trace|stack)\b/i,
      /\b(not working|doesn't work|won't work|failing|failed|fails)\b/i,
      /\b(exception|undefined|null|NaN|syntax)\b/i
    ]
  },
  {
    intent: "research",
    patterns: [
      /\b(research|investigate|analyze|explore|study|compare|evaluate|review)\b/i,
      /\b(what is|how does|explain|tell me about|compare|difference between)\b/i,
      /\b(trends|market|industry|landscape|alternatives|options)\b/i
    ]
  },
  {
    intent: "documentation",
    patterns: [
      /\b(document|docs|readme|changelog|guide|tutorial|spec|rfc|adr)\b/i,
      /\b(write|generate|create|update).*(doc|readme|guide|comment)\b/i,
      /\b(explain|describe|outline|summarize)\b/i
    ]
  },
  {
    intent: "automation",
    patterns: [
      /\b(automate|workflow|pipeline|ci|cd|deploy|schedule|cron|job|task)\b/i,
      /\b(hook|trigger|watch|monitor|alert|notify|webhook)\b/i,
      /\b(repeat|batch|bulk|process|queue)\b/i
    ]
  },
  {
    intent: "content_creation",
    patterns: [
      /\b(write|draft|compose|blog|article|post|newsletter|copy|content)\b/i,
      /\b(marketing|email|campaign|social|twitter|linkedin|thread)\b/i,
      /\b(script|story|narrative|outline)\b/i
    ]
  },
  {
    intent: "seo",
    patterns: [
      /\b(seo|search engine|keyword|ranking|backlink|meta|sitemap|robots)\b/i,
      /\b(google|bing|serp|organic|traffic|authority)\b/i,
      /\b(analyze|optimize|audit).*(seo|site|website|page)\b/i
    ]
  },
  {
    intent: "video",
    patterns: [
      /\b(video|animation|motion|render|ffmpeg|remotion|manim)\b/i,
      /\b(caption|subtitle|transcript|audio|voiceover|narration)\b/i,
      /\b(record|capture|screen|demo|walkthrough)\b/i
    ]
  },
  {
    intent: "image",
    patterns: [
      /\b(image|photo|picture|screenshot|diagram|mockup|wireframe|ui)\b/i,
      /\b(generate|create|design|draw|illustrate|icon|logo|banner)\b/i,
      /\b(thumbnail|hero|background|graphic|visual)\b/i
    ]
  },
  {
    intent: "planning",
    patterns: [
      /\b(plan|roadmap|strategy|approach|architecture|design|structure)\b/i,
      /\b(sprint|milestone|phase|scope|requirements|spec)\b/i,
      /\b(think|consider|evaluate|decide|choose|prioritize)\b/i
    ]
  },
  {
    intent: "brainstorm",
    patterns: [
      /\b(brainstorm|ideate|ideas|suggest|propose|creative|innovative)\b/i,
      /\b(what if|how about|could we|should we|might)\b/i,
      /\b(pitch|concept|vision|direction|explore)\b/i
    ]
  },
  {
    intent: "chat",
    patterns: [
      /\b(hello|hi|hey|how are you|good morning|good evening)\b/i,
      /\b(thanks|thank you|appreciate|great|awesome|perfect)\b/i,
      /\b(help|what can you|what do you|who are you)\b/i
    ]
  }
];

export function analyzeIntent(message: string): IntentResult {
  const lower = message.toLowerCase();
  const scores: Record<Intent, number> = {
    software_project: 0,
    bug_fix: 0,
    research: 0,
    documentation: 0,
    automation: 0,
    content_creation: 0,
    seo: 0,
    video: 0,
    image: 0,
    planning: 0,
    brainstorm: 0,
    chat: 0,
    unknown: 0
  };

  const matchedKeywords: string[] = [];

  for (const { intent, patterns } of intentPatterns) {
    for (const pattern of patterns) {
      const match = lower.match(pattern);
      if (match) {
        scores[intent] += 1;
        matchedKeywords.push(match[0]);
      }
    }
  }

  let bestIntent: Intent = "unknown";
  let bestScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as Intent;
    }
  }

  const totalMatches = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalMatches > 0 ? Math.min(bestScore / Math.max(totalMatches * 0.3, 1), 1) : 0;

  return {
    intent: bestIntent,
    confidence: Math.round(confidence * 100) / 100,
    keywords: [...new Set(matchedKeywords)].slice(0, 5)
  };
}
