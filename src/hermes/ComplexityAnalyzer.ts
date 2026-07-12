export type Complexity = "LOW" | "MEDIUM" | "HIGH";

export interface ComplexityResult {
  level: Complexity;
  score: number;
  factors: string[];
}

const complexityIndicators: Array<{ factor: string; pattern: RegExp; weight: number }> = [
  { factor: "multi-file", pattern: /\b(multiple|many|several|files?|modules?|components?|services?)\b/i, weight: 2 },
  { factor: "architecture", pattern: /\b(architecture|design|structure|pattern|system|framework)\b/i, weight: 3 },
  { factor: "database", pattern: /\b(database|schema|migration|sql|query|orm|model)\b/i, weight: 2 },
  { factor: "authentication", pattern: /\b(auth|login|signup|password|jwt|token|session|oauth)\b/i, weight: 2 },
  { factor: "api", pattern: /\b(api|endpoint|rest|graphql|webhook|route)\b/i, weight: 2 },
  { factor: "deployment", pattern: /\b(deploy|ci|cd|docker|kubernetes|aws|vercel|netlify)\b/i, weight: 3 },
  { factor: "integration", pattern: /\b(integrate|integration|third.party|external|webhook|sdk)\b/i, weight: 2 },
  { factor: "security", pattern: /\b(security|encrypt|hash|sanitize|csrf|xss|injection)\b/i, weight: 3 },
  { factor: "performance", pattern: /\b(performance|optimize|cache|lazy|bundle|speed|fast)\b/i, weight: 2 },
  { factor: "testing", pattern: /\b(test|spec|coverage|mock|assert|expect|jest|vitest|playwright)\b/i, weight: 2 },
  { factor: "ui-design", pattern: /\b(ui|ux|design|layout|responsive|animation|theme|css)\b/i, weight: 1 },
  { factor: "state-management", pattern: /\b(state|store|context|redux|zustand|recoil|signal)\b/i, weight: 2 },
  { factor: "real-time", pattern: /\b(real.time|websocket|socket|live|stream|subscribe)\b/i, weight: 3 },
  { factor: "ai/ml", pattern: /\b(ai|ml|model|llm|embedding|vector|training|inference)\b/i, weight: 3 },
  { factor: "full-stack", pattern: /\b(full.stack|frontend.?backend|end.to.end)\b/i, weight: 4 },
  { factor: "tech-stack", pattern: /\b(react|vue|angular|node|express|next|django|flask|spring|laravel)\b.*\b(and|&|with)\b.*\b(react|vue|angular|node|express|next|django|flask|spring|laravel|typescript|javascript|python|java|go|rust)\b/i, weight: 3 },
  { factor: "backend-api", pattern: /\b(node|express|api|backend|server|database)\b/i, weight: 2 },
  { factor: "frontend-ui", pattern: /\b(react|vue|angular|frontend|ui|interface|component|page)\b/i, weight: 1 },
  { factor: "multi-step", pattern: /\b(and then|after that|first.*then|step.*step|phase)\b/i, weight: 2 },
  { factor: "complex-logic", pattern: /\b(algorithm|recursive|dynamic|optimize|heuristic|complex)\b/i, weight: 3 }
];

export function analyzeComplexity(message: string): ComplexityResult {
  let score = 0;
  const factors: string[] = [];

  for (const { factor, pattern, weight } of complexityIndicators) {
    if (pattern.test(message)) {
      score += weight;
      factors.push(factor);
    }
  }

  const wordCount = message.split(/\s+/).length;
  if (wordCount > 100) score += 3;
  else if (wordCount > 50) score += 2;
  else if (wordCount > 20) score += 1;

  if (factors.length > 5) score += 2;

  let level: Complexity;
  if (score >= 8) level = "HIGH";
  else if (score >= 4) level = "MEDIUM";
  else level = "LOW";

  return { level, score, factors };
}
