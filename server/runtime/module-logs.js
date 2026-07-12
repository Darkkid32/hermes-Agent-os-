import path from "node:path";
import { sanitizeObject } from "./safety.js";
import { ensureRuntimeStore, readJson, runtimePaths, writeJson } from "./store.js";

const MAX_LOGS = 120;

function now() {
  return new Date().toISOString();
}

function safeId(id) {
  return String(id || "unknown").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
}

async function logPath(id) {
  await ensureRuntimeStore();
  return path.join(runtimePaths().logs, "modules", `${safeId(id)}.json`);
}

export async function appendModuleLog(id, { level = "info", message, details = {} } = {}) {
  const file = await logPath(id);
  const current = await readJson(file, { id, logs: [] });
  const entry = {
    timestamp: now(),
    level,
    message: String(message || "Module event"),
    details: sanitizeObject(details)
  };
  const logs = [entry, ...(Array.isArray(current.logs) ? current.logs : [])].slice(0, MAX_LOGS);
  await writeJson(file, { id, logs });
  return entry;
}

export async function readModuleLogs(id) {
  const file = await logPath(id);
  const current = await readJson(file, { id, logs: [] });
  return {
    id,
    logs: Array.isArray(current.logs) ? current.logs : []
  };
}
