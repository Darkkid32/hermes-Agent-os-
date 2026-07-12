import { execFile } from "node:child_process";
import os from "node:os";

const SECRET_KEY_PATTERN = /KEY|TOKEN|SECRET|PASSWORD|AUTH|CREDENTIAL|COOKIE/i;
const SECRET_VALUE_PATTERNS = [
  /sk-[A-Za-z0-9_-]{12,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /AIza[0-9A-Za-z_-]{20,}/
];

export function runCommand(command, args = [], timeout = 5000) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout }, (error, stdout, stderr) => {
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

export async function which(command) {
  const result = await runCommand("/usr/bin/which", [command], 3000);
  return result.ok && result.stdout ? result.stdout.split("\n")[0] : "";
}

export async function commandVersion(commandPath, args = ["--version"]) {
  if (!commandPath) return null;
  const result = await runCommand(commandPath, args, 5000);
  return result.stdout || result.stderr || null;
}

export function redactValue(key, value) {
  if (value == null || value === "") return value;
  const text = String(value);
  if (SECRET_KEY_PATTERN.test(String(key))) return "configured";
  if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(text))) return "configured";
  return text.replaceAll(os.homedir(), "~");
}

export function sanitizeObject(input) {
  if (Array.isArray(input)) return input.map((item) => sanitizeObject(item));
  if (!input || typeof input !== "object") return input;
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (value && typeof value === "object") {
      output[key] = sanitizeObject(value);
    } else {
      output[key] = redactValue(key, value);
    }
  }
  return output;
}

export function publicEnvConfigured(...keys) {
  return keys.some((key) => Boolean(process.env[key]));
}

export function forbiddenExportPatterns() {
  const home = os.homedir().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [
    { name: "local home path", pattern: new RegExp(home) },
    { name: "repo runtime data", pattern: /(^|[/\\])\.data([/\\]|$)/ },
    { name: "Hermes profile path", pattern: /\.hermes[/\\]profiles/ },
    { name: "token-like secret", pattern: /^[A-Z0-9_]*(API_KEY|TOKEN|SECRET|PASSWORD|AUTH)[A-Z0-9_]*[ \t]*=[ \t]*(?!(your[-_a-z0-9]*|example[-_a-z0-9]*|placeholder[-_a-z0-9]*|[a-z0-9_-]+[._-]\.\.\.|sk-\.\.\.|sk-ant-\.\.\.|\.\.\.)($|[\s#]))[^"'\s#][^\s#]+/im },
    { name: "OpenAI style key", pattern: /sk-[A-Za-z0-9_-]{12,}/ },
    { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
    { name: "local profile name", pattern: /\bagent(?:1|2|3|4|5|6|7|8|9|10|11|12|13)\b/ }
  ];
}
