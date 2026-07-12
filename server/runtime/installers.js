import { execFile } from "node:child_process";

const INSTALL_RECIPES = {
  claude: {
    id: "claude",
    label: "Claude Code",
    command: "npm install -g @anthropic-ai/claude-code",
    docsUrl: "https://docs.anthropic.com/claude-code",
    manager: "npm",
    executable: "claude",
    safeAutoRun: true
  },
  codex: {
    id: "codex",
    label: "Codex",
    command: "npm install -g @openai/codex",
    docsUrl: "https://developers.openai.com/codex",
    manager: "npm",
    executable: "codex",
    safeAutoRun: true
  },
  gemini: {
    id: "gemini",
    label: "Gemini CLI",
    command: "npm install -g @google/gemini-cli",
    docsUrl: "https://github.com/google-gemini/gemini-cli",
    manager: "npm",
    executable: "gemini",
    safeAutoRun: true
  },
  opencode: {
    id: "opencode",
    label: "OpenCode",
    command: "npm install -g opencode-ai",
    docsUrl: "https://opencode.ai",
    manager: "npm",
    executable: "opencode",
    safeAutoRun: true
  },
  "firecrawl-builder": {
    id: "firecrawl-builder",
    label: "Open Agent Builder",
    command: "npm run builder:install",
    docsUrl: "https://github.com/firecrawl/open-agent-builder",
    manager: "npm-script",
    executable: "next",
    safeAutoRun: false
  },
  "elizaos-runtime": {
    id: "elizaos-runtime",
    label: "elizaOS Core",
    command: "npm install",
    docsUrl: "https://github.com/elizaOS/eliza",
    manager: "npm",
    executable: null,
    safeAutoRun: false
  },
  openclaw: {
    id: "openclaw",
    label: "OpenClaw",
    command: "",
    docsUrl: "https://github.com/search?q=openclaw&type=repositories",
    manager: "manual",
    executable: "openclaw",
    safeAutoRun: false,
    note: "No trusted public install package is bundled. Install OpenClaw separately or configure OPENCLAW_CLI_PATH."
  },
  openclaude: {
    id: "openclaude",
    label: "OpenClaude",
    command: "",
    docsUrl: "https://www.npmjs.com/package/openclaude",
    manager: "manual",
    executable: "openclaude",
    safeAutoRun: false,
    note: "The npm package name is reserved and not a real CLI. Configure OPENCLAUDE_CLI_PATH for a real compatible local tool."
  },
  hermes: {
    id: "hermes",
    label: "Hermes Agent",
    command: "",
    docsUrl: "",
    manager: "manual",
    executable: null,
    safeAutoRun: false,
    note: "Point HERMES_HOME at an existing Hermes Agent profile directory."
  }
};

export function getInstallRecipe(id) {
  return INSTALL_RECIPES[id] || null;
}

export function listInstallRecipes() {
  return Object.values(INSTALL_RECIPES);
}

function runInstall(command) {
  const [bin, ...args] = command.split(" ");
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 120000 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: stdout?.trim() || "",
        stderr: stderr?.trim() || "",
        code: error?.code ?? 0,
        signal: error?.signal ?? null
      });
    });
  });
}

export async function prepareInstall(id, { execute = false } = {}) {
  const recipe = getInstallRecipe(id);
  if (!recipe) {
    return {
      ok: false,
      id,
      mode: "not_found",
      message: `No install recipe registered for ${id}.`
    };
  }
  if (!recipe.command) {
    return {
      ok: true,
      id,
      mode: "manual",
      recipe,
      message: recipe.note || `${recipe.label} requires manual installation or path configuration.`
    };
  }
  const allowInstall = process.env.HERMES_AGENT_OS_ENABLE_INSTALL === "1";
  if (!execute || !allowInstall || !recipe.safeAutoRun) {
    return {
      ok: true,
      id,
      mode: "dry_run",
      recipe,
      message: `Install prepared. Run locally: ${recipe.command}`
    };
  }
  const result = await runInstall(recipe.command);
  return {
    ok: result.ok,
    id,
    mode: "executed",
    recipe,
    result,
    message: result.ok ? `${recipe.label} install command completed.` : `${recipe.label} install command failed.`
  };
}
