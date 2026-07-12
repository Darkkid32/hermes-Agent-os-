import type { ExecutionEngineId, BusinessAgent } from "./BusinessAgent";
import { EXECUTION_ENGINES } from "./BusinessAgent";

const API_BASE = "";

export interface EngineResult {
  engine: ExecutionEngineId;
  status: "completed" | "failed";
  output: string;
  rawResponse: string;
  error?: string;
  duration: number;
  tokens: number;
}

export interface ExecutionAdapter {
  execute(payload: ExecutionPayload, onEvent: (event: ExecutionEvent) => void): Promise<EngineResult>;
}

export interface ExecutionPayload {
  agent: BusinessAgent;
  prompt: string;
  systemPrompt: string;
  context: {
    workspaceId: string | null;
    goal: string;
    capabilities: string[];
    modules: string[];
    permissions: string[];
  };
}

export type ExecutionEventType =
  | "queued"
  | "preparing"
  | "executing"
  | "thinking"
  | "tool_call"
  | "completed"
  | "failed";

export interface ExecutionEvent {
  type: ExecutionEventType;
  message: string;
  timestamp: number;
}

async function callBackend(
  engine: ExecutionEngineId,
  messages: Array<{ role: string; content: string }>,
  onEvent: (e: ExecutionEvent) => void
): Promise<{ content: string; tokens: number }> {
  onEvent({ type: "executing", message: `Sending request to ${engine} via backend...`, timestamp: Date.now() });

  const response = await fetch(`${API_BASE}/api/llm/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engine, messages })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(errorData.error || `API error ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "Execution failed");
  }

  return { content: data.content, tokens: data.tokens };
}

class ClaudeAdapter implements ExecutionAdapter {
  async execute(payload: ExecutionPayload, onEvent: (e: ExecutionEvent) => void): Promise<EngineResult> {
    const start = Date.now();
    try {
      onEvent({ type: "preparing", message: "Preparing Claude Code context...", timestamp: Date.now() });
      const messages = [
        { role: "system", content: payload.systemPrompt },
        { role: "user", content: `Goal: ${payload.context.goal}\n\nTask: ${payload.prompt}\n\nCapabilities: ${payload.context.capabilities.join(", ")}\nModules: ${payload.context.modules.join(", ")}` }
      ];
      const result = await callBackend("claude", messages, onEvent);
      onEvent({ type: "completed", message: "Claude Code execution completed.", timestamp: Date.now() });
      return { engine: "claude", status: "completed", output: result.content, rawResponse: result.content, duration: Date.now() - start, tokens: result.tokens };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      onEvent({ type: "failed", message: `Execution failed: ${errorMsg}`, timestamp: Date.now() });
      return { engine: "claude", status: "failed", output: "", rawResponse: "", error: errorMsg, duration: Date.now() - start, tokens: 0 };
    }
  }
}

class GeminiAdapter implements ExecutionAdapter {
  async execute(payload: ExecutionPayload, onEvent: (e: ExecutionEvent) => void): Promise<EngineResult> {
    const start = Date.now();
    try {
      onEvent({ type: "preparing", message: "Preparing research context...", timestamp: Date.now() });
      const messages = [
        { role: "system", content: "You are a research agent. Provide comprehensive, well-structured research with citations and analysis." },
        { role: "user", content: `Research topic: ${payload.prompt}\n\nGoal: ${payload.context.goal}` }
      ];
      const result = await callBackend("gemini", messages, onEvent);
      onEvent({ type: "completed", message: "Gemini research completed.", timestamp: Date.now() });
      return { engine: "gemini", status: "completed", output: result.content, rawResponse: result.content, duration: Date.now() - start, tokens: result.tokens };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      onEvent({ type: "failed", message: `Research failed: ${errorMsg}`, timestamp: Date.now() });
      return { engine: "gemini", status: "failed", output: "", rawResponse: "", error: errorMsg, duration: Date.now() - start, tokens: 0 };
    }
  }
}

class CodexAdapter implements ExecutionAdapter {
  async execute(payload: ExecutionPayload, onEvent: (e: ExecutionEvent) => void): Promise<EngineResult> {
    const start = Date.now();
    try {
      onEvent({ type: "preparing", message: "Preparing code generation context...", timestamp: Date.now() });
      const messages = [
        { role: "system", content: "You are a code generation agent. Generate clean, well-documented code with proper error handling." },
        { role: "user", content: `Task: ${payload.prompt}\n\nGoal: ${payload.context.goal}\n\nGenerate the implementation.` }
      ];
      const result = await callBackend("codex", messages, onEvent);
      onEvent({ type: "completed", message: "Code generation completed.", timestamp: Date.now() });
      return { engine: "codex", status: "completed", output: result.content, rawResponse: result.content, duration: Date.now() - start, tokens: result.tokens };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      onEvent({ type: "failed", message: `Code generation failed: ${errorMsg}`, timestamp: Date.now() });
      return { engine: "codex", status: "failed", output: "", rawResponse: "", error: errorMsg, duration: Date.now() - start, tokens: 0 };
    }
  }
}

class OpenClawAdapter implements ExecutionAdapter {
  async execute(payload: ExecutionPayload, onEvent: (e: ExecutionEvent) => void): Promise<EngineResult> {
    const start = Date.now();
    try {
      onEvent({ type: "preparing", message: "Preparing code review context...", timestamp: Date.now() });
      const messages = [
        { role: "system", content: "You are a code review agent. Analyze code for bugs, security issues, performance problems, and suggest improvements." },
        { role: "user", content: `Review task: ${payload.prompt}\n\nGoal: ${payload.context.goal}\n\nProvide a detailed code review.` }
      ];
      const result = await callBackend("openclaw", messages, onEvent);
      onEvent({ type: "completed", message: "Code review completed.", timestamp: Date.now() });
      return { engine: "openclaw", status: "completed", output: result.content, rawResponse: result.content, duration: Date.now() - start, tokens: result.tokens };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      onEvent({ type: "failed", message: `Code review failed: ${errorMsg}`, timestamp: Date.now() });
      return { engine: "openclaw", status: "failed", output: "", rawResponse: "", error: errorMsg, duration: Date.now() - start, tokens: 0 };
    }
  }
}

class OpenCodeAdapter implements ExecutionAdapter {
  async execute(payload: ExecutionPayload, onEvent: (e: ExecutionEvent) => void): Promise<EngineResult> {
    const start = Date.now();
    try {
      onEvent({ type: "preparing", message: "Preparing interactive coding context...", timestamp: Date.now() });
      const messages = [
        { role: "system", content: "You are an interactive coding agent. Help users write, debug, and improve code step by step." },
        { role: "user", content: `Task: ${payload.prompt}\n\nGoal: ${payload.context.goal}\n\nProvide the solution.` }
      ];
      const result = await callBackend("opencode", messages, onEvent);
      onEvent({ type: "completed", message: "Interactive coding completed.", timestamp: Date.now() });
      return { engine: "opencode", status: "completed", output: result.content, rawResponse: result.content, duration: Date.now() - start, tokens: result.tokens };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      onEvent({ type: "failed", message: `Interactive coding failed: ${errorMsg}`, timestamp: Date.now() });
      return { engine: "opencode", status: "failed", output: "", rawResponse: "", error: errorMsg, duration: Date.now() - start, tokens: 0 };
    }
  }
}

class FreeClaudeAdapter implements ExecutionAdapter {
  async execute(payload: ExecutionPayload, onEvent: (e: ExecutionEvent) => void): Promise<EngineResult> {
    const start = Date.now();
    try {
      onEvent({ type: "preparing", message: "Preparing free tier context...", timestamp: Date.now() });
      const messages = [
        { role: "system", content: payload.systemPrompt },
        { role: "user", content: `Task: ${payload.prompt}\n\nGoal: ${payload.context.goal}` }
      ];
      const result = await callBackend("free-claude-code", messages, onEvent);
      onEvent({ type: "completed", message: "Free Claude execution completed.", timestamp: Date.now() });
      return { engine: "free-claude-code", status: "completed", output: result.content, rawResponse: result.content, duration: Date.now() - start, tokens: result.tokens };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      onEvent({ type: "failed", message: `Free Claude execution failed: ${errorMsg}`, timestamp: Date.now() });
      return { engine: "free-claude-code", status: "failed", output: "", rawResponse: "", error: errorMsg, duration: Date.now() - start, tokens: 0 };
    }
  }
}

const adapters: Record<ExecutionEngineId, ExecutionAdapter> = {
  claude: new ClaudeAdapter(),
  gemini: new GeminiAdapter(),
  codex: new CodexAdapter(),
  openclaw: new OpenClawAdapter(),
  opencode: new OpenCodeAdapter(),
  "free-claude-code": new FreeClaudeAdapter()
};

export function getAdapter(engine: ExecutionEngineId): ExecutionAdapter {
  return adapters[engine];
}

export function getEngineLabel(engine: ExecutionEngineId): string {
  return EXECUTION_ENGINES.find((e) => e.id === engine)?.label || engine;
}
