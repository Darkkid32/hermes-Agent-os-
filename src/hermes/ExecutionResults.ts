import type { BusinessAgent } from "./BusinessAgent";
import type { ExecutionEngineId } from "./BusinessAgent";
import type { ExecutionEvent } from "./ExecutionAdapter";
import { ExecutionBus } from "./ExecutionEventBus";

export interface ExecutionResult {
  id: string;
  agentId: string;
  agentName: string;
  engine: ExecutionEngineId;
  engineLabel: string;
  prompt: string;
  systemPrompt: string;
  rawResponse: string;
  formattedMarkdown: string;
  artifacts: WorkspaceArtifact[];
  duration: number;
  status: "completed" | "failed" | "cancelled";
  tokens: number;
  timestamp: number;
  error: string | null;
  events: ExecutionEvent[];
  context: {
    workspaceId: string | null;
    goal: string;
    capabilities: string[];
    modules: string[];
    permissions: string[];
  };
}

export interface WorkspaceArtifact {
  id: string;
  name: string;
  type: "html" | "tsx" | "ts" | "css" | "md" | "json" | "txt" | "other";
  content: string;
  size: number;
  createdAt: number;
}

type ResultsListener = (results: ExecutionResult[]) => void;

let resultCounter = 0;
const resultsListeners: Set<ResultsListener> = new Set();
const results: Map<string, ExecutionResult> = new Map();

function nextResultId(): string {
  return `result-${Date.now()}-${++resultCounter}`;
}

function emitResults(): void {
  const all = [...results.values()].sort((a, b) => b.timestamp - a.timestamp);
  for (const fn of resultsListeners) {
    fn(all);
  }
}

export function onResultsUpdate(fn: ResultsListener): () => void {
  resultsListeners.add(fn);
  return () => { resultsListeners.delete(fn); };
}

export function getAllResults(): ExecutionResult[] {
  return [...results.values()].sort((a, b) => b.timestamp - a.timestamp);
}

export function getResult(id: string): ExecutionResult | undefined {
  return results.get(id);
}

export function getResultsByAgent(agentId: string): ExecutionResult[] {
  return getAllResults().filter((r) => r.agentId === agentId);
}

export function getResultsByEngine(engine: ExecutionEngineId): ExecutionResult[] {
  return getAllResults().filter((r) => r.engine === engine);
}

export function getResultsStats(): {
  total: number;
  completed: number;
  failed: number;
  totalTokens: number;
  avgDuration: number;
  byEngine: Record<string, number>;
  byAgent: Record<string, number>;
} {
  const all = getAllResults();
  const completed = all.filter((r) => r.status === "completed");
  const failed = all.filter((r) => r.status === "failed");
  const totalTokens = all.reduce((sum, r) => sum + r.tokens, 0);
  const avgDuration = completed.length > 0
    ? completed.reduce((sum, r) => sum + r.duration, 0) / completed.length
    : 0;

  const byEngine: Record<string, number> = {};
  const byAgent: Record<string, number> = {};
  for (const r of all) {
    byEngine[r.engine] = (byEngine[r.engine] || 0) + 1;
    byAgent[r.agentName] = (byAgent[r.agentName] || 0) + 1;
  }

  return {
    total: all.length,
    completed: completed.length,
    failed: failed.length,
    totalTokens,
    avgDuration: Math.round(avgDuration),
    byEngine,
    byAgent
  };
}

function formatMarkdown(raw: string): string {
  let md = raw;
  md = md.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
    return `\n\`\`\`${lang || ""}\n${code.trim()}\n\`\`\`\n`;
  });
  md = md.replace(/\*\*(.*?)\*\*/g, "**$1**");
  md = md.replace(/\*(.*?)\*/g, "_$1_");
  md = md.replace(/^### (.*$)/gm, "\n### $1\n");
  md = md.replace(/^## (.*$)/gm, "\n## $1\n");
  md = md.replace(/^# (.*$)/gm, "\n# $1\n");
  return md.trim();
}

export function extractArtifacts(raw: string, agentName: string): WorkspaceArtifact[] {
  const artifacts: WorkspaceArtifact[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  let artifactIndex = 0;

  while ((match = codeBlockRegex.exec(raw)) !== null) {
    const lang = match[1] || "txt";
    const code = match[2].trim();
    if (code.length < 20) continue;

    let type: WorkspaceArtifact["type"] = "other";
    let ext = "txt";
    if (lang === "html" || lang === "htm") { type = "html"; ext = "html"; }
    else if (lang === "tsx" || lang === "jsx") { type = "tsx"; ext = "tsx"; }
    else if (lang === "ts" || lang === "typescript") { type = "ts"; ext = "ts"; }
    else if (lang === "css" || lang === "scss") { type = "css"; ext = "css"; }
    else if (lang === "md" || lang === "markdown") { type = "md"; ext = "md"; }
    else if (lang === "json") { type = "json"; ext = "json"; }
    else if (lang === "javascript" || lang === "js") { type = "ts"; ext = "js"; }
    else if (lang === "python" || lang === "py") { type = "ts"; ext = "py"; }

    const name = `${agentName.replace(/\s+/g, "")}_output_${artifactIndex + 1}.${ext}`;

    artifacts.push({
      id: `artifact-${Date.now()}-${artifactIndex}`,
      name,
      type,
      content: code,
      size: code.length,
      createdAt: Date.now()
    });
    artifactIndex++;
  }

  if (artifacts.length === 0 && raw.length > 50) {
    artifacts.push({
      id: `artifact-${Date.now()}-0`,
      name: `${agentName.replace(/\s+/g, "")}_output.md`,
      type: "md",
      content: raw,
      size: raw.length,
      createdAt: Date.now()
    });
  }

  return artifacts;
}

export function storeResult(
  agent: BusinessAgent,
  engine: ExecutionEngineId,
  prompt: string,
  systemPrompt: string,
  rawResponse: string,
  duration: number,
  status: ExecutionResult["status"],
  tokens: number,
  error: string | null,
  events: ExecutionEvent[],
  context: ExecutionResult["context"]
): ExecutionResult {
  const id = nextResultId();
  const formattedMarkdown = formatMarkdown(rawResponse);
  const artifacts = extractArtifacts(rawResponse, agent.name);

  const result: ExecutionResult = {
    id,
    agentId: agent.id,
    agentName: agent.name,
    engine,
    engineLabel: engine,
    prompt,
    systemPrompt,
    rawResponse,
    formattedMarkdown,
    artifacts,
    duration,
    status,
    tokens,
    timestamp: Date.now(),
    error,
    events,
    context
  };

  results.set(id, result);
  emitResults();

  // Emit artifact_created events for each extracted artifact
  for (const artifact of artifacts) {
    ExecutionBus.emit(ExecutionBus.createEvent(
      "artifact_created",
      id,
      context.workspaceId,
      agent.name,
      "completed",
      `Artifact "${artifact.name}" created`,
      100,
      { artifactName: artifact.name, artifactType: artifact.type, artifactSize: artifact.size }
    ));
  }

  // Emit workspace_updated for the batch
  if (artifacts.length > 0) {
    ExecutionBus.emit(ExecutionBus.createEvent(
      "workspace_updated",
      id,
      context.workspaceId,
      agent.name,
      "completed",
      `${artifacts.length} artifact(s) added to workspace`,
      100,
      { artifactCount: artifacts.length }
    ));
  }

  return result;
}

export function deleteResult(id: string): boolean {
  const deleted = results.delete(id);
  if (deleted) emitResults();
  return deleted;
}

export function clearResults(): void {
  results.clear();
  emitResults();
}
