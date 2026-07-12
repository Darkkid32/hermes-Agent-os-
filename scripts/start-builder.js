import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStoredConnectionConfig } from "../server/runtime/connections.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const builderRoot = path.join(root, "vendor", "open-agent-builder");
const port = process.env.HERMES_BUILDER_PORT || "3100";

const stored = await getStoredConnectionConfig();
const builderConfig = stored["firecrawl-builder"] || {};
const mergedEnv = {
  ...process.env,
  ...builderConfig,
  ANTHROPIC_API_KEY: builderConfig.ANTHROPIC_API_KEY || stored.claude?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: builderConfig.OPENAI_API_KEY || stored.codex?.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: builderConfig.GEMINI_API_KEY || stored.gemini?.GEMINI_API_KEY || process.env.GEMINI_API_KEY
};

const isWindows = process.platform === "win32";

const child = spawn("npx", ["next", "dev", "-p", port], {
  cwd: builderRoot,
  env: mergedEnv,
  stdio: "inherit",
  shell: isWindows,
  windowsVerbatimArguments: false
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
