import { execSync } from "node:child_process";
import path from "node:path";

const PROJECT_ROOT = path.resolve(process.cwd());

const ALLOWED_COMMANDS = [
  "npm test",
  "npm run build",
  "npm run lint",
  "git status",
  "git diff",
  "git rev-parse --is-inside-work-tree",
  "git branch",
  "git log --oneline -10"
];

const BLOCKED_PATTERNS = [
  /\brm\b/i,
  /\bdel\b/i,
  /\bformat\b/i,
  /\bshutdown\b/i,
  /\bpowershell\b/i,
  /\bcmd\.exe\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bInvoke-WebRequest\b/i,
  /\bStart-Process\b/i,
  /\bpython\b/i,
  /\bnode\b/i,
  /\bnpx\b/i,
  /\bnpm\s+install\b/i,
  /\bnpm\s+uninstall\b/i,
  /\bnpm\s+update\b/i,
  /\bgit\s+push\b/i,
  /\bgit\s+pull\b/i,
  /\bgit\s+reset\b/i,
  /\bgit\s+clean\b/i,
  /\bgit\s+checkout\b/i,
  /\bgit\s+commit\b/i
];

const MAX_RUNTIME_MS = 120000;

function isCommandAllowed(command) {
  const normalized = command.trim().toLowerCase();
  for (const blocked of BLOCKED_PATTERNS) {
    if (blocked.test(normalized)) {
      return { allowed: false, reason: `Command matches blocked pattern: ${blocked}` };
    }
  }
  for (const allowed of ALLOWED_COMMANDS) {
    if (normalized === allowed.toLowerCase()) {
      return { allowed: true, reason: "Command is in allowlist" };
    }
  }
  return { allowed: false, reason: "Command is not in the allowlist" };
}

function executeAllowedCommand(command) {
  const validation = isCommandAllowed(command);
  if (!validation.allowed) {
    return {
      ok: false,
      command,
      stdout: "",
      stderr: validation.reason,
      exitCode: -1,
      executionTime: 0,
      status: "REJECTED",
      reason: validation.reason
    };
  }
  const startTime = Date.now();
  try {
    const stdout = execSync(command, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: MAX_RUNTIME_MS,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    const executionTime = Date.now() - startTime;
    return {
      ok: true,
      command,
      stdout: stdout.trim(),
      stderr: "",
      exitCode: 0,
      executionTime,
      status: "SUCCESS"
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    if (error.killed) {
      return {
        ok: false,
        command,
        stdout: "",
        stderr: "Command timed out after 120 seconds",
        exitCode: -1,
        executionTime,
        status: "TIMEOUT"
      };
    }
    return {
      ok: false,
      command,
      stdout: error.stdout ? error.stdout.trim() : "",
      stderr: error.stderr ? error.stderr.trim() : error.message,
      exitCode: error.status || 1,
      executionTime,
      status: error.status === 0 ? "SUCCESS" : "FAILED"
    };
  }
}

export { executeAllowedCommand, isCommandAllowed, ALLOWED_COMMANDS };
