import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getConfiguredValue, getStoredConnectionConfig } from "./connections.js";
import { getElizaStatus } from "./eliza.js";
import { getInstallRecipe } from "./installers.js";
import { appendModuleLog, readModuleLogs } from "./module-logs.js";
import { commandVersion, publicEnvConfigured, runCommand, sanitizeObject, which } from "./safety.js";
import { getLocalSelfModuleStatus, isLocalSelfModule } from "./self-modules.js";
import { ensureRuntimeStore, expandHome, publicRuntimePath, runtimePaths, RUNTIME_VERSION } from "./store.js";

const PROJECT_ROOT = path.resolve(process.cwd());
const MAX_HISTORY = Number(process.env.HERMES_CHAT_HISTORY_LIMIT || 20);
const MAX_CONTEXT_CHARS = Number(process.env.HERMES_PROJECT_CONTEXT_LIMIT || 25000);
const conversationHistory = new Map();

function getHistory(sessionId) {
  if (!sessionId) return [];
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, []);
  }
  return conversationHistory.get(sessionId);
}

function addToHistory(sessionId, role, content) {
  if (!sessionId) return;
  const history = getHistory(sessionId);
  history.push({ role, content });
  while (history.length > MAX_HISTORY) {
    history.shift();
  }
}

function clearHistory(sessionId) {
  if (!sessionId) return;
  conversationHistory.delete(sessionId);
}

function isInsideProjectRoot(filePath) {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(PROJECT_ROOT);
}

async function readProjectFile(relativePath) {
  const fullPath = path.resolve(PROJECT_ROOT, relativePath);
  if (!isInsideProjectRoot(fullPath)) return null;
  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile() || stat.size > 100000) return null;
    const content = await fs.readFile(fullPath, "utf-8");
    return content;
  } catch {
    return null;
  }
}

async function listProjectFiles(dir = "", depth = 0) {
  if (depth > 3) return [];
  const fullDir = path.resolve(PROJECT_ROOT, dir);
  if (!isInsideProjectRoot(fullDir)) return [];
  const entries = [];
  try {
    const items = await fs.readdir(fullDir, { withFileTypes: true });
    for (const item of items) {
      if (item.name === "node_modules" || item.name === ".git" || item.name === "dist" || item.name === "vendor") continue;
      const relative = path.join(dir, item.name);
      if (item.isDirectory()) {
        entries.push({ type: "dir", path: relative });
        const children = await listProjectFiles(relative, depth + 1);
        entries.push(...children);
      } else if (item.isFile()) {
        entries.push({ type: "file", path: relative });
      }
    }
  } catch {}
  return entries;
}

function findRelevantFiles(message, files) {
  const keywords = message.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const scored = files
    .filter((f) => f.type === "file")
    .map((f) => {
      const name = f.path.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (name.includes(kw)) score += 10;
        if (name.endsWith(".js") && (name.includes("module") || name.includes("provider") || name.includes("route"))) score += 2;
        if (name.endsWith(".tsx") && name.includes("app")) score += 2;
      }
      if (name.includes("connections")) score += 3;
      if (name.includes("modules")) score += 3;
      if (name.includes("index.js") && name.includes("server")) score += 3;
      return { ...f, score };
    })
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  return scored;
}

async function buildProjectContext(message) {
  const files = await listProjectFiles();
  const relevant = findRelevantFiles(message, files);
  if (relevant.length === 0) return "";
  const parts = [];
  let totalChars = 0;
  for (const file of relevant) {
    const content = await readProjectFile(file.path);
    if (!content) continue;
    let truncated = content.slice(0, 5000);
    if (file.path.includes("modules.js") && content.includes("const PROVIDER_MODULES =")) {
      const start = content.indexOf("const PROVIDER_MODULES =");
      if (start > 0) {
        truncated = content.slice(start, start + 6000);
      }
    }
    if (file.path.includes("modules.js") && content.includes("async function runNvidiaProvider(input, stored) {")) {
      const marker = "async function runNvidiaProvider(input, stored) {";
      const idx = content.lastIndexOf(marker);
      if (idx > 0) {
        truncated = content.slice(idx, idx + 3000);
      }
    }
    if (file.path.includes("connections.js") && content.includes("export const CONNECTION_TEMPLATES")) {
      const start = content.indexOf("export const CONNECTION_TEMPLATES");
      if (start > 0) {
        truncated = content.slice(start, start + 5000);
      }
    }
    const entry = `--- ${file.path} ---\n${truncated}\n`;
    if (totalChars + entry.length > MAX_CONTEXT_CHARS) break;
    parts.push(entry);
    totalChars += entry.length;
  }
  return parts.join("\n");
}

const pendingEdits = new Map();

function generateDiff(original, modified, filePath) {
  const originalLines = original.split("\n");
  const modifiedLines = modified.split("\n");
  const diff = [];
  const maxLen = Math.max(originalLines.length, modifiedLines.length);
  let i = 0;
  while (i < maxLen) {
    if (originalLines[i] === modifiedLines[i]) {
      diff.push(`  ${originalLines[i] || ""}`);
      i++;
    } else {
      let start = i;
      while (i < maxLen && originalLines[i] !== modifiedLines[i]) i++;
      let end = i;
      diff.push(`@@ -${start + 1},${end - start} +${start + 1},${end - start} @@`);
      for (let j = start; j < end; j++) {
        if (j < originalLines.length) diff.push(`- ${originalLines[j]}`);
        if (j < modifiedLines.length) diff.push(`+ ${modifiedLines[j]}`);
      }
    }
  }
  return `--- a/${filePath}\n+++ b/${filePath}\n${diff.join("\n")}`;
}

async function backupFile(relativePath) {
  const fullPath = path.resolve(PROJECT_ROOT, relativePath);
  if (!isInsideProjectRoot(fullPath)) return null;
  const backupPath = fullPath + ".hermes-backup";
  try {
    await fs.copyFile(fullPath, backupPath);
    return backupPath;
  } catch {
    return null;
  }
}

async function proposeEdit(filePath, originalContent, newContent, sessionId) {
  if (!isInsideProjectRoot(path.resolve(PROJECT_ROOT, filePath))) {
    return { ok: false, error: "Edit rejected: path is outside project root." };
  }
  const currentContent = await readProjectFile(filePath);
  if (currentContent === null) {
    return { ok: false, error: "File not found or cannot be read." };
  }
  if (originalContent && currentContent !== originalContent) {
    return { ok: false, error: "File has been modified since it was read. Please re-read and try again." };
  }
  const diff = generateDiff(currentContent, newContent, filePath);
  const editId = `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pendingEdits.set(editId, { filePath, currentContent, newContent, sessionId, createdAt: Date.now() });
  return { ok: true, editId, diff, filePath };
}

async function applyEdit(editId) {
  const edit = pendingEdits.get(editId);
  if (!edit) return { ok: false, error: "Edit not found or expired." };
  const fullPath = path.resolve(PROJECT_ROOT, edit.filePath);
  if (!isInsideProjectRoot(fullPath)) return { ok: false, error: "Edit rejected: path is outside project root." };
  const currentContent = await readProjectFile(edit.filePath);
  if (currentContent !== edit.currentContent) {
    pendingEdits.delete(editId);
    return { ok: false, error: "File has been modified since edit was proposed." };
  }
  await backupFile(edit.filePath);
  await fs.writeFile(fullPath, edit.newContent, "utf-8");
  pendingEdits.delete(editId);
  return { ok: true, filePath: edit.filePath, backup: fullPath + ".hermes-backup" };
}

function rejectEdit(editId) {
  pendingEdits.delete(editId);
  return { ok: true };
}

const CLI_MODULES = [
  {
    id: "claude",
    label: "Claude Code",
    command: "claude",
    category: "agent",
    envKeys: ["ANTHROPIC_API_KEY", "CLAUDE_CODE_PATH"],
    pathKeys: ["CLAUDE_CODE_PATH", "CLAUDE_CLI_PATH"],
    capabilities: ["chat", "code", "tools", "mcp"],
    installHint: "Install Claude Code from Anthropic, or configure CLAUDE_CODE_PATH.",
    docsUrl: "https://docs.anthropic.com/claude-code"
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    command: "openclaw",
    category: "agent",
    envKeys: ["OPENCLAW_CLI_PATH", "OPENCLAW_HOME"],
    pathKeys: ["OPENCLAW_CLI_PATH"],
    capabilities: ["automation", "browser", "tools"],
    installHint: "Install OpenClaw locally, or configure OPENCLAW_CLI_PATH and OPENCLAW_HOME.",
    docsUrl: "https://github.com/search?q=openclaw&type=repositories"
  },
  {
    id: "openclaude",
    label: "OpenClaude",
    command: "openclaude",
    category: "agent",
    envKeys: ["OPENCLAUDE_CLI_PATH", "OPENCLAUDE_API_KEY", "OPENROUTER_API_KEY", "OLLAMA_HOST"],
    pathKeys: ["OPENCLAUDE_CLI_PATH"],
    capabilities: ["chat", "routing", "local-models"],
    installHint: "No trusted OpenClaude package is bundled. Configure OPENCLAUDE_CLI_PATH for a real local OpenClaude-compatible CLI, or route Claude-style work through OpenRouter/Ollama.",
    docsUrl: "https://www.npmjs.com/package/openclaude"
  },
  {
    id: "gemini",
    label: "Gemini",
    command: "gemini",
    category: "agent",
    envKeys: ["GEMINI_API_KEY", "GEMINI_CLI_PATH"],
    pathKeys: ["GEMINI_CLI_PATH"],
    capabilities: ["chat", "code", "vision"],
    installHint: "Install Gemini CLI, or configure GEMINI_CLI_PATH and GEMINI_API_KEY.",
    docsUrl: "https://github.com/google-gemini/gemini-cli"
  },
  {
    id: "codex",
    label: "Codex",
    command: "codex",
    category: "agent",
    envKeys: ["OPENAI_API_KEY", "CODEX_CLI_PATH"],
    pathKeys: ["CODEX_CLI_PATH"],
    capabilities: ["code", "workspace", "review"],
    installHint: "Install Codex CLI, or configure CODEX_CLI_PATH and OPENAI_API_KEY.",
    docsUrl: "https://developers.openai.com/codex"
  },
  {
    id: "opencode",
    label: "OpenCode",
    command: "opencode",
    category: "agent",
    envKeys: ["OPENCODE_CLI_PATH"],
    pathKeys: ["OPENCODE_CLI_PATH"],
    capabilities: ["code", "workspace"],
    installHint: "Install OpenCode locally, or configure OPENCODE_CLI_PATH.",
    docsUrl: "https://opencode.ai"
  }
];

const INTERNAL_MODULES = [
  {
    id: "goals",
    label: "Goals",
    category: "self",
    capabilities: ["goals", "plans", "progress"],
    publicSummary: "Local goal loops, run state, and progress tracking."
  },
  {
    id: "seo",
    label: "SEO",
    category: "self",
    capabilities: ["keyword-research", "content-briefs", "site-audits"],
    publicSummary: "SEO workflow module ready for user-owned projects and APIs."
  },
  {
    id: "video",
    label: "Video",
    category: "self",
    capabilities: ["captioning", "scripts", "render-plans"],
    publicSummary: "Video workflow module for captions, scripts, and render handoff."
  },
  {
    id: "notebook",
    label: "Notebook",
    category: "self",
    capabilities: ["notes", "memory", "run-journal"],
    publicSummary: "Local notebook and run journal backed by the Agent OS store."
  },
  {
    id: "kanban",
    label: "Kanban",
    category: "self",
    capabilities: ["tasks", "queues", "handoffs"],
    publicSummary: "Local Kanban queues for agent work and human approvals."
  },
  {
    id: "usage-credits",
    label: "Usage Credits",
    category: "self",
    capabilities: ["usage", "quotas", "spend-estimates"],
    publicSummary: "Tracks local usage budgets and provider credit estimates."
  }
];

const PROVIDER_MODULES = [
  {
    id: "provider-anthropic",
    label: "Anthropic",
    envKeys: ["ANTHROPIC_API_KEY"],
    configuredFrom: ["provider-anthropic", "claude", "firecrawl-builder"],
    capabilities: ["llm", "claude", "agent-routing"],
    publicSummary: "Connect a user-owned Anthropic key for Claude models and Claude Code workflows.",
    docsUrl: "https://docs.anthropic.com"
  },
  {
    id: "provider-openai",
    label: "OpenAI",
    envKeys: ["OPENAI_API_KEY"],
    configuredFrom: ["provider-openai", "codex", "firecrawl-builder"],
    capabilities: ["llm", "codex", "agent-routing"],
    publicSummary: "Connect a user-owned OpenAI key for Codex and OpenAI model routing.",
    docsUrl: "https://platform.openai.com/docs"
  },
  {
    id: "provider-gemini",
    label: "Gemini API",
    envKeys: ["GEMINI_API_KEY"],
    configuredFrom: ["provider-gemini", "gemini"],
    capabilities: ["llm", "vision", "agent-routing"],
    publicSummary: "Connect a user-owned Gemini API key for Gemini model routing.",
    docsUrl: "https://github.com/google-gemini/gemini-cli"
  },
  {
    id: "provider-openrouter",
    label: "OpenRouter",
    envKeys: ["OPENROUTER_API_KEY"],
    configuredFrom: ["provider-openrouter", "free-claude-code", "openclaude"],
    capabilities: ["llm", "routing", "open-models"],
    publicSummary: "Connect a user-owned OpenRouter key for Claude-style/open-provider routing.",
    docsUrl: "https://openrouter.ai/docs"
  },
  {
    id: "provider-ollama",
    label: "Ollama",
    envKeys: ["OLLAMA_HOST"],
    configuredFrom: ["provider-ollama", "free-claude-code", "openclaude"],
    capabilities: ["local-models", "routing"],
    publicSummary: "Connect a local Ollama host for local model routing.",
    docsUrl: "https://ollama.com"
  },
  {
    id: "provider-minimax",
    label: "MiniMax",
    envKeys: ["MINIMAX_API_KEY"],
    configuredFrom: ["provider-minimax", "minimax", "free-claude-code"],
    capabilities: ["llm", "routing"],
    publicSummary: "Connect a user-owned MiniMax API key.",
    docsUrl: "https://www.minimax.io"
  },
  {
    id: "provider-nvidia",
    label: "NVIDIA NIM",
    envKeys: ["NVIDIA_API_KEY"],
    configuredFrom: ["provider-nvidia"],
    capabilities: ["llm", "inference", "agent-routing"],
    publicSummary: "Connect a user-owned NVIDIA NIM key for NVIDIA model routing.",
    docsUrl: "https://build.nvidia.com"
  },
  {
    id: "provider-firecrawl",
    label: "Firecrawl",
    envKeys: ["FIRECRAWL_API_KEY"],
    configuredFrom: ["provider-firecrawl", "firecrawl-builder"],
    capabilities: ["web-data", "scrape", "mcp"],
    publicSummary: "Connect Firecrawl for web/data execution in Open Agent Builder.",
    docsUrl: "https://docs.firecrawl.dev"
  },
  {
    id: "provider-convex",
    label: "Convex",
    envKeys: ["NEXT_PUBLIC_CONVEX_URL"],
    configuredFrom: ["provider-convex", "firecrawl-builder"],
    capabilities: ["database", "workflow-storage"],
    publicSummary: "Connect Convex so the upstream Open Agent Builder can persist workflows.",
    docsUrl: "https://docs.convex.dev"
  },
  {
    id: "provider-clerk",
    label: "Clerk",
    envKeys: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "CLERK_JWT_ISSUER_DOMAIN"],
    configuredFrom: ["provider-clerk", "firecrawl-builder"],
    capabilities: ["auth", "builder-login"],
    publicSummary: "Connect Clerk authentication required by the upstream Open Agent Builder.",
    docsUrl: "https://clerk.com/docs"
  }
];

function now() {
  return new Date().toISOString();
}

function standardModule(input) {
  const configured = Boolean(input.configured);
  const status = input.status || (configured ? "connected" : "ready_to_configure");
  return {
    id: input.id,
    label: input.label,
    category: input.category,
    type: input.type || input.category,
    status,
    capabilities: input.capabilities || [],
    configured,
    missing: input.missing || [],
    lastChecked: now(),
    actions: input.actions || ["configure", "test", "run", "logs"],
    publicSummary: input.publicSummary || input.connection || "",
    connection: input.connection || input.publicSummary || "",
    version: input.version || null,
    profile: input.profile || null,
    profileCount: input.profileCount,
    onlineProfiles: input.onlineProfiles,
    stats: input.stats || {},
    source: input.source || "hermes-agent-os-runtime",
    configKeys: input.configKeys || [],
    installHint: input.installHint || "",
    installCommand: input.installCommand || "",
    installMode: input.installMode || "",
    docsUrl: input.docsUrl || ""
  };
}

function recipeFields(id) {
  const recipe = getInstallRecipe(id);
  return recipe
    ? {
        installCommand: recipe.command || "",
        installMode: recipe.manager,
        docsUrl: recipe.docsUrl || ""
      }
    : {};
}

function cliDefinition(id) {
  return CLI_MODULES.find((definition) => definition.id === id) || null;
}

async function resolveCliCommand(definition, stored) {
  const configuredPath = (definition.pathKeys || [`${definition.id.toUpperCase().replaceAll("-", "_")}_CLI_PATH`])
    .map((key) => getConfiguredValue(stored, definition.id, key))
    .find(Boolean);
  if (configuredPath) {
    const expanded = expandHome(configuredPath);
    try {
      await fs.access(expanded);
      return { commandPath: expanded, configuredPath: true, configuredPathMissing: false };
    } catch {
      return { commandPath: "", configuredPath: true, configuredPathMissing: true };
    }
  }
  return { commandPath: await which(definition.command), configuredPath: false, configuredPathMissing: false };
}

async function cliModule(definition, stored) {
  const resolved = await resolveCliCommand(definition, stored);
  const commandPath = resolved.commandPath;
  const version = await commandVersion(commandPath);
  const hasProviderConfig = definition.envKeys.some((key) => Boolean(getConfiguredValue(stored, definition.id, key)));
  const connected = Boolean(commandPath);
  return standardModule({
    id: definition.id,
    label: definition.label,
    category: definition.category,
    type: "cli",
    status: connected ? "connected" : "missing_dependency",
    configured: connected || hasProviderConfig,
    missing: connected ? [] : [resolved.configuredPathMissing ? "configured CLI path not found" : definition.command],
    capabilities: definition.capabilities,
    configKeys: definition.envKeys,
    installHint: definition.installHint,
    docsUrl: definition.docsUrl,
    version,
    publicSummary: connected
      ? `${definition.label} CLI is installed and callable by the local runtime.`
      : `${definition.label} is ready; install ${definition.command} or configure a local path.`,
    actions: connected ? ["test", "run", "logs"] : ["install", "configure", "docs"],
    ...recipeFields(definition.id)
  });
}

const FALLBACK_CLI_IDS = new Set(["claude", "gemini", "codex", "opencode", "openclaude", "openclaw"]);

async function runNvidiaFallback(id, input, stored, reason, fallbackMessage) {
  const hasNvidiaKey = Boolean(
    process.env.NVIDIA_API_KEY || getConfiguredValue(stored, "provider-nvidia", "NVIDIA_API_KEY")
  );
  if (!hasNvidiaKey) {
    await appendModuleLog(id, {
      level: "warn",
      message: "NVIDIA fallback unavailable: no key configured",
      details: { reason }
    });
    return {
      ok: false,
      mode: "nvidia_fallback_unavailable",
      reply: `${fallbackMessage} NVIDIA NIM is not configured. Add NVIDIA_API_KEY to enable automatic fallback.`,
      module: null
    };
  }
  const result = await runNvidiaProvider(input, stored);
  await appendModuleLog(id, {
    level: result.ok ? "info" : "error",
    message: result.ok ? `NVIDIA fallback completed (${reason})` : `NVIDIA fallback failed (${reason})`,
    details: { mode: result.mode, reason, inputLength: (input.message || "").length }
  });
  return {
    ...result,
    mode: "nvidia_fallback",
    reply: `[NVIDIA Fallback for ${id}] ${result.reply || ""}`.trim(),
    fallback: {
      from: id,
      reason
    }
  };
}

async function hermesModule() {
  const hermesHome = expandHome(process.env.HERMES_HOME) || path.join(os.homedir(), ".hermes");
  let entries = [];
  try {
    entries = await fs.readdir(path.join(hermesHome, "profiles"), { withFileTypes: true });
  } catch {
    entries = [];
  }
  const profileCount = entries.filter((entry) => entry.isDirectory()).length;
  return standardModule({
    id: "hermes",
    label: "Hermes Agent",
    category: "agent",
    type: "local_runtime",
    status: profileCount ? "connected" : "ready_to_configure",
    configured: profileCount > 0,
    missing: profileCount ? [] : ["HERMES_HOME"],
    capabilities: ["memory", "skills", "gateway", "channels"],
    configKeys: ["HERMES_HOME"],
    installHint: "Install or point Hermes Agent at a local HERMES_HOME profile directory.",
    profileCount,
    publicSummary: profileCount
      ? "Hermes runtime structure detected locally. Profile details remain private."
      : "Set HERMES_HOME or install Hermes Agent to connect local runtime state.",
    actions: profileCount ? ["test", "run", "logs"] : ["install", "configure", "docs"],
    ...recipeFields("hermes")
  });
}

async function gatewayModule(hermes) {
  const connected = hermes.status === "connected";
  return standardModule({
    id: "gateway",
    label: "Hermes Gateway",
    category: "runtime",
    type: "gateway",
    status: connected ? "connected" : "ready_to_configure",
    configured: connected,
    missing: connected ? [] : ["Hermes profiles"],
    capabilities: ["telegram", "browser", "webhooks", "channels"],
    publicSummary: connected
      ? "Gateway can expose configured local channels without returning private channel data."
      : "Gateway is ready; connect Hermes profiles and channels locally."
  });
}

async function elizaRuntimeModule() {
  const status = await getElizaStatus();
  return standardModule({
    id: "elizaos-runtime",
    label: "elizaOS Runtime",
    category: "runtime",
    type: "agent_os_core",
    status: status.ok ? "connected" : "error",
    configured: status.ok,
    missing: status.missingExports,
    capabilities: ["agents", "plugins", "memory", "model-routing", "services"],
    version: status.version,
    publicSummary: status.ok
      ? `Real ${status.packageName} ${status.version} is installed and loadable.`
      : "elizaOS core is not loadable; install @elizaos/core.",
    actions: ["test", "logs"],
    source: status.source,
    stats: {
      runtimeClass: status.runtimeClass,
      exports: status.exports
    },
    installHint: "Installed through npm dependency @elizaos/core. This is the Agent OS runtime foundation Hermes wraps."
  });
}

async function minimaxModule(stored) {
  const configured = ["minimax", "provider-minimax", "free-claude-code"].some((id) =>
    Boolean(getConfiguredValue(stored, id, "MINIMAX_API_KEY"))
  );
  return standardModule({
    id: "minimax",
    label: "MiniMax M3",
    category: "provider",
    type: "provider",
    status: configured ? "connected" : "ready_to_configure",
    configured,
    missing: configured ? [] : ["MINIMAX_API_KEY"],
    capabilities: ["chat", "routing"],
    configKeys: ["MINIMAX_API_KEY"],
    installHint: "Add a user-owned MiniMax API key to enable MiniMax routing.",
    publicSummary: configured
      ? "MiniMax provider is configured locally."
      : "Add MINIMAX_API_KEY to enable MiniMax routing."
  });
}

function providerConfigured(stored, definition) {
  return definition.envKeys.every((key) =>
    publicEnvConfigured(key) ||
    definition.configuredFrom.some((id) => Boolean(stored?.[id]?.[key]))
  );
}

function providerModule(definition, stored) {
  const configured = providerConfigured(stored, definition);
  const missing = definition.envKeys.filter((key) =>
    !publicEnvConfigured(key) &&
    !definition.configuredFrom.some((id) => Boolean(stored?.[id]?.[key]))
  );
  return standardModule({
    id: definition.id,
    label: definition.label,
    category: "provider",
    type: "provider",
    status: configured ? "connected" : "ready_to_configure",
    configured,
    missing,
    capabilities: definition.capabilities,
    configKeys: definition.envKeys,
    publicSummary: configured
      ? `${definition.label} provider is configured locally.`
      : definition.publicSummary,
    actions: ["configure", "test", "logs"],
    docsUrl: definition.docsUrl,
    installHint: "No install required in Hermes. Add your own provider key or local endpoint."
  });
}

async function freeClaudeModule(stored) {
  const configured = ["OPENROUTER_API_KEY", "OLLAMA_HOST", "MINIMAX_API_KEY"].some((key) =>
    Boolean(getConfiguredValue(stored, "free-claude-code", key))
  );
  return standardModule({
    id: "free-claude-code",
    label: "Free Claude Code",
    category: "agent",
    type: "routing",
    status: configured ? "connected" : "ready_to_configure",
    configured,
    missing: configured ? [] : ["OPENROUTER_API_KEY or OLLAMA_HOST or MINIMAX_API_KEY"],
    capabilities: ["routing", "code", "local-models"],
    configKeys: ["OPENROUTER_API_KEY", "OLLAMA_HOST", "MINIMAX_API_KEY"],
    installHint: "Connect a user-owned OpenRouter, Ollama, or MiniMax provider. This does not include Anthropic access.",
    publicSummary: configured
      ? "Claude-style workflows route through user-owned local/open providers."
      : "Configure a user-owned provider; this does not provide free Anthropic access."
  });
}

async function firecrawlBuilderModule(stored) {
  const configuredFrom = ["firecrawl-builder", "provider-convex", "provider-clerk", "provider-firecrawl"];
  const requiredKeys = [
    "NEXT_PUBLIC_CONVEX_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "CLERK_JWT_ISSUER_DOMAIN",
    "FIRECRAWL_API_KEY"
  ];
  const missing = requiredKeys.filter((key) =>
    !publicEnvConfigured(key) &&
    !configuredFrom.some((id) => Boolean(stored?.[id]?.[key]))
  );
  const configured = missing.length === 0;
  return standardModule({
    id: "firecrawl-builder",
    label: "Firecrawl Agent Builder",
    category: "builder",
    type: "workflow_builder",
    status: configured ? "connected" : "ready_to_configure",
    configured,
    missing,
    capabilities: ["visual-workflows", "agent-nodes", "mcp-tools", "human-approval", "firecrawl"],
    configKeys: ["NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "CLERK_JWT_ISSUER_DOMAIN", "FIRECRAWL_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY", "ARCADE_API_KEY"],
    installHint: "Run npm run builder:install, configure Convex/Clerk keys, then npm run builder:start. Add Firecrawl and LLM keys for execution.",
    publicSummary: configured
      ? "Builder auth, storage, and Firecrawl execution are configured."
      : "Design workflows after the upstream builder is configured; add Convex, Clerk, and Firecrawl keys before claiming builder execution."
  });
}

async function voiceControlModule() {
  const configured = publicEnvConfigured("OPENAI_API_KEY");
  return standardModule({
    id: "voice-control",
    label: "Voice Control",
    category: "agent",
    type: "desktop_voice",
    status: "connected",
    configured: true,
    missing: [],
    capabilities: [
      "wake-word-transcripts",
      "codex-gpt-planning",
      "desktop-control",
      "desktop-context",
      "accessibility-diagnostics",
      "open-apps",
      "browse",
      "file-search",
      "file-create",
      "file-trash-selected",
      "click",
      "click-by-label",
      "type",
      "paste",
      "hotkeys",
      "window-control",
      "scroll",
      "screenshots",
      "workflow-runs",
      "module-handoffs",
      "codex-cli-task-handoff",
      "gated-shell"
    ],
    configKeys: ["OPENAI_API_KEY", "CODEX_GPT_MODEL", "HERMES_VOICE_MODEL", "HERMES_AGENT_OS_ENABLE_EXEC", "HERMES_VOICE_ALLOW_SHELL"],
    installHint: "Grant microphone permission to the browser and Accessibility/Screen Recording permission to the terminal runtime for full desktop control.",
    publicSummary: "Voice commands use deterministic local planning until OPENAI_API_KEY is configured for Codex GPT planning.",
    actions: ["configure", "test", "run", "logs"]
  });
}

async function memoryModule() {
  const paths = await ensureRuntimeStore();
  let memoryCount = 0;
  try {
    const files = await fs.readdir(path.join(paths.memory, "self-modules"), { withFileTypes: true });
    memoryCount = files.filter((f) => f.isFile() && f.name.endsWith(".json")).length;
  } catch {
    memoryCount = 0;
  }
  return standardModule({
    id: "memory",
    label: "Memory",
    category: "runtime",
    type: "agent_memory",
    status: "connected",
    configured: true,
    missing: [],
    capabilities: ["semantic-memory", "episodic-memory", "procedural-memory", "search", "privacy", "import-export"],
    configKeys: [],
    installHint: "No external database required. Hermes stores local memory under ~/.hermes-agent-os/memory and exports only redacted non-private memories by default.",
    publicSummary: `Local agent memory is active with ${memoryCount} active memories across agent scopes.`,
    actions: ["open", "create", "search", "export", "logs"],
    stats: { memoryCount, storePath: publicRuntimePath("memory") }
  });
}

async function schedulerModule() {
  return standardModule({
    id: "scheduler",
    label: "Scheduler",
    category: "runtime",
    type: "job_scheduler",
    status: "connected",
    configured: true,
    missing: [],
    capabilities: ["cron", "workflow-runs", "self-module-tasks", "goal-loop-action", "approval-gates", "kanban-approval-cards", "retry", "pause-resume", "history"],
    configKeys: [],
    installHint: "Create jobs in the Scheduler workspace. Jobs can run workflows, create local module tasks, and place approval gates in Kanban.",
    publicSummary: "Scheduler is active with job scheduling, workflow runs, and approval gates.",
    actions: ["configure", "run", "logs"]
  });
}

async function skillRegistryModule() {
  return standardModule({
    id: "skill-registry",
    label: "Skills",
    category: "runtime",
    type: "skill_registry",
    status: "connected",
    configured: true,
    missing: [],
    capabilities: ["skills", "install", "enable-disable", "required-keys", "signed-dependencies", "marketplace-updates", "publisher-policy", "tests", "logs", "sample-skills"],
    configKeys: [],
    installHint: "Install export-safe sample skills, configure their required user-owned keys, and enable only the skills this OS should expose.",
    publicSummary: "Skill Registry is active with install, enable/disable, and marketplace update support.",
    actions: ["open", "install", "configure", "update", "test", "logs"]
  });
}

async function providerRouterModule(stored) {
  const hasProvider = ["OPENROUTER_API_KEY", "OLLAMA_HOST", "MINIMAX_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"].some((key) =>
    publicEnvConfigured(key) ||
    ["provider-openrouter", "provider-ollama", "provider-minimax", "provider-openai", "provider-anthropic", "provider-gemini"].some((id) => Boolean(stored?.[id]?.[key]))
  );
  return standardModule({
    id: "provider-router",
    label: "Provider Router",
    category: "runtime",
    type: "model_router",
    status: hasProvider ? "connected" : "ready_to_configure",
    configured: hasProvider,
    missing: hasProvider ? [] : ["OPENROUTER_API_KEY", "OLLAMA_HOST", "MINIMAX_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"],
    capabilities: ["model-routing", "fallbacks", "dry-run-dispatch", "cost-hooks"],
    configKeys: ["OPENROUTER_API_KEY", "OLLAMA_HOST", "MINIMAX_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"],
    installHint: "Connect Ollama, OpenRouter, MiniMax, OpenAI, Anthropic, or Gemini. Execution stays dry-run unless explicitly enabled.",
    publicSummary: hasProvider
      ? "Provider Router is connected with available model routes."
      : "Configure at least one user-owned/local provider before router dispatch.",
    actions: ["configure", "test", "run", "sessions", "logs"]
  });
}

async function internalModule(definition) {
  if (isLocalSelfModule(definition.id)) {
    const local = await getLocalSelfModuleStatus(definition.id);
    return standardModule({
      ...definition,
      type: "local_app",
      status: "connected",
      configured: true,
      missing: [],
      actions: ["open", "create", "run", "logs"],
      stats: local.summary,
      publicSummary: `${definition.publicSummary} ${local.itemCount} local item${local.itemCount === 1 ? "" : "s"} stored.`,
      installHint: "No external install required. This module stores user-owned data in the local Hermes Agent OS store."
    });
  }

  return standardModule({
    ...definition,
    type: "local_app",
    status: "ready_to_configure",
    configured: false,
    missing: ["module implementation"],
    actions: ["configure", "docs", "logs"],
    installHint: `${definition.label} is registered in the Agent OS module catalog. Implementation/configuration is still required before it can run real work.`
  });
}

export async function getModules() {
  await ensureRuntimeStore();
  const stored = await getStoredConnectionConfig();
  const cliModules = await Promise.all(CLI_MODULES.map((definition) => cliModule(definition, stored)));
  const hermes = await hermesModule();
  const gateway = await gatewayModule(hermes);
  const eliza = await elizaRuntimeModule();
  const minimax = await minimaxModule(stored);
  const freeClaude = await freeClaudeModule(stored);
  const firecrawlBuilder = await firecrawlBuilderModule(stored);
  const voiceControl = await voiceControlModule();
  const memory = await memoryModule();
  const scheduler = await schedulerModule();
  const skillRegistry = await skillRegistryModule();
  const providerRouter = await providerRouterModule(stored);
  const internalModules = await Promise.all(INTERNAL_MODULES.map(internalModule));
  const providerModules = PROVIDER_MODULES.map((definition) => providerModule(definition, stored));
  return [
    cliModules.find((module) => module.id === "claude"),
    cliModules.find((module) => module.id === "openclaw"),
    cliModules.find((module) => module.id === "openclaude"),
    hermes,
    cliModules.find((module) => module.id === "gemini"),
    cliModules.find((module) => module.id === "codex"),
    cliModules.find((module) => module.id === "opencode"),
    freeClaude,
    minimax,
    gateway,
    eliza,
    voiceControl,
    memory,
    scheduler,
    skillRegistry,
    providerRouter,
    firecrawlBuilder,
    ...providerModules,
    ...internalModules
  ].filter(Boolean);
}

export async function getModule(id) {
  return (await getModules()).find((module) => module.id === id) || null;
}

export async function getOsStatus() {
  const modules = await getModules();
  const eliza = await getElizaStatus();
  const paths = runtimePaths();
  return {
    ok: true,
    service: "hermes-agent-os-runtime",
    version: RUNTIME_VERSION,
    mode: process.env.NODE_ENV || "development",
    runtimeFoundation: eliza.ok
      ? `elizaOS core ${eliza.version} loaded`
      : "elizaOS core not loaded",
    builderFoundation: "firecrawl-open-agent-builder-compatible workflow model",
    generatedAt: now(),
    host: os.hostname(),
    store: {
      root: publicRuntimePath(""),
      config: publicRuntimePath("config"),
      workflows: publicRuntimePath("workflows"),
      runs: publicRuntimePath("runs"),
      logs: publicRuntimePath("logs"),
      memory: publicRuntimePath("memory"),
      exports: publicRuntimePath("exports")
    },
    publicUrl: process.env.HERMES_AGENT_HUB_PUBLIC_URL || null,
    githubRepo: process.env.HERMES_AGENT_HUB_GITHUB_REPO || null,
    moduleCount: modules.length,
    connectedCount: modules.filter((module) => module.status === "connected").length,
    pathsReady: sanitizeObject(paths),
    elizaOS: eliza
  };
}

export async function getOsAudit() {
  const modules = await getModules();
  const items = modules.map((module) => {
    const connected = module.status === "connected";
    const severity = connected ? "ok" : module.status === "missing_dependency" || module.status === "error" ? "action_required" : "setup";
    const fix = connected
      ? "No action required."
      : module.installCommand
        ? `Install or configure ${module.label}. Suggested command: ${module.installCommand || "manual install"}.`
        : module.missing?.length
          ? `Configure ${module.missing.join(", ")}.`
          : module.configKeys?.length
            ? `Configure ${module.configKeys.join(", ")}.`
          : module.installHint || "Open this module and complete setup.";
    return {
      id: module.id,
      label: module.label,
      category: module.category,
      type: module.type,
      status: module.status,
      configured: module.configured,
      missing: module.missing,
      severity,
      fix,
      docsUrl: module.docsUrl || "",
      actions: module.actions
    };
  });
  return {
    generatedAt: now(),
    summary: {
      total: items.length,
      ok: items.filter((item) => item.severity === "ok").length,
      setup: items.filter((item) => item.severity === "setup").length,
      actionRequired: items.filter((item) => item.severity === "action_required").length
    },
    items
  };
}

export async function testModule(id) {
  const module = await getModule(id);
  if (!module) {
    return { ok: false, id, message: `No module registered for ${id}.`, details: null };
  }
  await appendModuleLog(id, {
    level: module.status === "connected" ? "info" : "warn",
    message: "Module health checked",
    details: {
      status: module.status,
      configured: module.configured,
      missing: module.missing
    }
  });
  return {
    ok: module.status === "connected",
    id,
    message: module.publicSummary,
    checkedAt: now(),
    details: module
  };
}

async function runNvidiaProvider(input, stored) {
  const apiKey = getConfiguredValue(stored, "provider-nvidia", "NVIDIA_API_KEY") || process.env.NVIDIA_API_KEY;
  const baseUrl = getConfiguredValue(stored, "provider-nvidia", "NVIDIA_BASE_URL") || process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
  const model = getConfiguredValue(stored, "provider-nvidia", "NVIDIA_MODEL") || process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";
  const message = String(input.message || input.prompt || "").slice(0, 4000);
  const sessionId = input.sessionId || null;
  const clear = input.clearHistory === true;
  if (clear && sessionId) {
    clearHistory(sessionId);
  }
  if (!message) {
    return { ok: false, mode: "no_input", reply: "No message provided.", module: null };
  }
  const projectContext = await buildProjectContext(message);
  const systemPrompt = projectContext
    ? `You are a helpful AI assistant with access to the following project files:\n\n${projectContext}\n\nUse this context to answer questions about the project. Reference specific files when relevant.`
    : "You are a helpful AI assistant.";
  const history = getHistory(sessionId);
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: message },
  ];
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, mode: "nvidia_error", reply: `NVIDIA NIM error ${res.status}: ${body}`, module: null };
  }
  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content?.trim() || "";
  if (sessionId && reply) {
    addToHistory(sessionId, "user", message);
    addToHistory(sessionId, "assistant", reply);
  }
  return { ok: true, mode: "nvidia", reply: reply || "Empty response from NVIDIA NIM.", module: null };
}

export async function runModule(id, input = {}) {
  const module = await getModule(id);
  if (!module) {
    return { ok: false, mode: "not_found", reply: `No module registered for ${id}.` };
  }
  const execEnabled = process.env.HERMES_AGENT_OS_ENABLE_EXEC === "1";
  if (module.type === "local_app") {
    await appendModuleLog(id, {
      message: "Local module run requested",
      details: {
        mode: "local_app",
        status: module.status,
        inputKeys: Object.keys(input || {})
      }
    });
    return {
      ok: module.status === "connected",
      mode: "local_app",
      reply: `${module.label} is backed by the local Agent OS store. Open the control room to create and review records.`,
      module
    };
  }
  if (module.id === "provider-nvidia") {
    const stored = await getStoredConnectionConfig();
    const hasKey = Boolean(
      process.env.NVIDIA_API_KEY || getConfiguredValue(stored, "provider-nvidia", "NVIDIA_API_KEY")
    );
    if (hasKey) {
      const result = await runNvidiaProvider(input, stored);
      await appendModuleLog(id, {
        level: result.ok ? "info" : "error",
        message: result.ok ? "NVIDIA NIM inference completed" : "NVIDIA NIM inference failed",
        details: { mode: result.mode, inputLength: (input.message || "").length }
      });
      return { ...result, module };
    }
  }
  if (module.type !== "cli" || !execEnabled) {
    if (module.type === "cli" && FALLBACK_CLI_IDS.has(module.id)) {
      return await runNvidiaFallback(
        id,
        input,
        await getStoredConnectionConfig(),
        execEnabled ? "dry_run_disabled" : "exec_disabled",
        `${module.label} CLI execution is disabled locally.`
      );
    }
    await appendModuleLog(id, {
      message: "Module dry run requested",
      details: {
        mode: "dry_run",
        status: module.status,
        execEnabled
      }
    });
    return {
      ok: true,
      mode: "dry_run",
      reply: `${module.label} is ${module.status}. Execution is dry-run until HERMES_AGENT_OS_ENABLE_EXEC=1 is set locally.`,
      module
    };
  }
  const stored = await getStoredConnectionConfig();
  const definition = cliDefinition(id);
  const resolved = definition ? await resolveCliCommand(definition, stored) : { commandPath: await which(id === "claude" ? "claude" : id) };
  const commandPath = resolved.commandPath;
  if (!commandPath) {
    if (definition && FALLBACK_CLI_IDS.has(definition.id)) {
      return await runNvidiaFallback(id, input, stored, "cli_not_installed", `${module.label} CLI is not installed. Falling back to NVIDIA NIM.`);
    }
    await appendModuleLog(id, {
      level: "error",
      message: "Module execution failed: missing CLI",
      details: { command: id === "claude" ? "claude" : id }
    });
    return {
      ok: false,
      mode: "missing_dependency",
      reply: `${module.label} CLI is not installed or not on PATH.`,
      module
    };
  }
  const message = String(input.message || input.prompt || "").slice(0, 4000);
  const result = await runCommand(commandPath, message ? [message] : [], 15000);
  await appendModuleLog(id, {
    level: result.ok ? "info" : "error",
    message: result.ok ? "Module command executed" : "Module command failed",
    details: {
      mode: "executed",
      code: result.code,
      signal: result.signal,
      inputLength: message.length
    }
  });
  return {
    ok: result.ok,
    mode: "executed",
    reply: result.stdout || result.stderr || "Command completed with no output.",
    module
  };
}

export async function getModuleLogs(id) {
  await ensureRuntimeStore();
  return readModuleLogs(id);
}

export { proposeEdit, applyEdit, rejectEdit };

export function modulesToLegacySnapshot(status, modules) {
  const integrations = modules.map((module) => ({
    ...module,
    connection: module.publicSummary,
    type: module.type || module.category
  }));
  return {
    generatedAt: status.generatedAt,
    host: status.host,
    mode: status.mode,
    publicUrl: status.publicUrl,
    githubRepo: status.githubRepo,
    integrations,
    directories: [
      { label: "config", path: publicRuntimePath("config"), exists: true },
      { label: "workflows", path: publicRuntimePath("workflows"), exists: true },
      { label: "runs", path: publicRuntimePath("runs"), exists: true }
    ],
    flow: ["Firecrawl Builder", "Module Registry", "Model Routing", "Workflows", "Local Store", "Export Audit"]
  };
}
