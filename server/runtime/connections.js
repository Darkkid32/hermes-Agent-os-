import path from "node:path";
import { appendModuleLog } from "./module-logs.js";
import { ensureRuntimeStore, readJson, runtimePaths, writeJson } from "./store.js";
import { sanitizeObject } from "./safety.js";

function secretsPath() {
  return path.join(runtimePaths().config, "connections.local.json");
}

export const CONNECTION_TEMPLATES = [
  {
    id: "claude",
    label: "Claude Code",
    fields: ["CLAUDE_CODE_PATH", "ANTHROPIC_API_KEY"],
    notes: "Claude Code can be detected by PATH. API keys stay local and are never returned."
  },
  {
    id: "codex",
    label: "Codex",
    fields: ["CODEX_CLI_PATH", "OPENAI_API_KEY"],
    notes: "Codex can be detected by PATH or configured with a local CLI path."
  },
  {
    id: "gemini",
    label: "Gemini",
    fields: ["GEMINI_CLI_PATH", "GEMINI_API_KEY"],
    notes: "Gemini connects through a local CLI or user-provided Gemini API key."
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    fields: ["OPENCLAW_CLI_PATH", "OPENCLAW_HOME"],
    notes: "OpenClaw connects through a local CLI and optional workspace path."
  },
  {
    id: "openclaude",
    label: "OpenClaude",
    fields: ["OPENCLAUDE_CLI_PATH", "OPENCLAUDE_API_KEY", "OPENROUTER_API_KEY", "OLLAMA_HOST"],
    notes: "OpenClaude is configurable when a real local compatible CLI/provider is available. Hermes does not bundle the reserved npm placeholder package."
  },
  {
    id: "opencode",
    label: "OpenCode",
    fields: ["OPENCODE_CLI_PATH"],
    notes: "OpenCode connects through a local CLI."
  },
  {
    id: "firecrawl-builder",
    label: "Firecrawl Agent Builder",
    fields: [
      "NEXT_PUBLIC_CONVEX_URL",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
      "CLERK_JWT_ISSUER_DOMAIN",
      "FIRECRAWL_API_KEY",
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "GROQ_API_KEY",
      "ARCADE_API_KEY"
    ],
    notes: "The real upstream builder needs Convex + Clerk to render and Firecrawl/LLM keys to execute workflows. Values stay local."
  },
  {
    id: "free-claude-code",
    label: "Free Claude Code",
    fields: ["OPENROUTER_API_KEY", "OLLAMA_HOST", "MINIMAX_API_KEY"],
    notes: "Routes Claude-style workflows through user-owned or local providers."
  },
  {
    id: "provider-anthropic",
    label: "Anthropic",
    fields: ["ANTHROPIC_API_KEY"],
    notes: "User-owned Anthropic key for Claude models and Claude Code workflows."
  },
  {
    id: "provider-openai",
    label: "OpenAI",
    fields: ["OPENAI_API_KEY"],
    notes: "User-owned OpenAI key for Codex and OpenAI model routing."
  },
  {
    id: "provider-gemini",
    label: "Gemini API",
    fields: ["GEMINI_API_KEY"],
    notes: "User-owned Gemini API key."
  },
  {
    id: "provider-openrouter",
    label: "OpenRouter",
    fields: ["OPENROUTER_API_KEY"],
    notes: "User-owned OpenRouter key for open-provider routing."
  },
  {
    id: "provider-ollama",
    label: "Ollama",
    fields: ["OLLAMA_HOST"],
    notes: "Local Ollama endpoint, for example http://127.0.0.1:11434."
  },
  {
    id: "provider-minimax",
    label: "MiniMax",
    fields: ["MINIMAX_API_KEY"],
    notes: "User-owned MiniMax API key."
  },
  {
    id: "provider-nvidia",
    label: "NVIDIA NIM",
    fields: ["NVIDIA_API_KEY", "NVIDIA_BASE_URL", "NVIDIA_MODEL"],
    notes: "User-owned NVIDIA NIM key for NVIDIA model routing. Default base URL is https://integrate.api.nvidia.com/v1."
  },
  {
    id: "provider-firecrawl",
    label: "Firecrawl",
    fields: ["FIRECRAWL_API_KEY"],
    notes: "User-owned Firecrawl API key for web/data tools."
  },
  {
    id: "provider-convex",
    label: "Convex",
    fields: ["NEXT_PUBLIC_CONVEX_URL"],
    notes: "Convex URL required by upstream Open Agent Builder workflow storage."
  },
  {
    id: "provider-clerk",
    label: "Clerk",
    fields: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "CLERK_JWT_ISSUER_DOMAIN"],
    notes: "Clerk auth values required by upstream Open Agent Builder."
  }
];

export async function getStoredConnectionConfig() {
  await ensureRuntimeStore();
  return readJson(secretsPath(), {});
}

export async function getConnections() {
  const stored = await getStoredConnectionConfig();
  return {
    templates: CONNECTION_TEMPLATES.map((template) => ({
      ...template,
      configuredFields: Object.keys(stored[template.id] || {})
    }))
  };
}

export async function configureConnection(id, fields = {}) {
  await ensureRuntimeStore();
  const current = await getStoredConnectionConfig();
  current[id] = {
    ...(current[id] || {}),
    ...Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value != null && String(value).trim() !== "")
    )
  };
  await writeJson(secretsPath(), current);
  await appendModuleLog(id, {
    message: "Connection configuration saved",
    details: {
      configuredFields: Object.keys(current[id] || {})
    }
  });
  return {
    ok: true,
    id,
    configuredFields: Object.keys(current[id] || {}),
    details: sanitizeObject(current[id] || {})
  };
}

export function getConfiguredValue(stored, id, key) {
  return process.env[key] || stored?.[id]?.[key] || null;
}
