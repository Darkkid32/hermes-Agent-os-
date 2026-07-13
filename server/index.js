process.on("unhandledRejection", (reason, promise) => {
  console.error("[server] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught Exception:", err);
});

import { config } from "dotenv";
config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getBuilderStatus, getBuilderUrl } from "./runtime/builder-service.js";
import { configureConnection, getConnections } from "./runtime/connections.js";
import { assertAdminToken, prepareExport } from "./runtime/exporter.js";
import { listInstallRecipes, prepareInstall } from "./runtime/installers.js";
import {
  getElizaStatus
} from "./runtime/eliza.js";
import {
  createSelfModuleItem,
  getSelfModuleState,
  isLocalSelfModule
} from "./runtime/self-modules.js";
import {
  getModule,
  getModuleLogs,
  getModules,
  getOsAudit,
  getOsStatus,
  modulesToLegacySnapshot,
  proposeEdit,
  applyEdit,
  rejectEdit,
  runModule,
  testModule
} from "./runtime/modules.js";
import {
  getWorkflow,
  getWorkflowRun,
  listWorkflows,
  runWorkflow,
  saveWorkflow
} from "./runtime/workflows.js";
import {
  listDirectories,
  readFileTool,
  searchFilenames,
  searchText,
  findSymbolReferences,
  gitStatus,
  gitDiff,
  detectProjectTypeTool,
  buildProjectMap
} from "./runtime/developer-tools.js";
import { createPlan } from "./runtime/planner.js";
import {
  createExecution,
  getExecution,
  listExecutions,
  startExecution,
  approveStep,
  skipStep,
  cancelExecution,
  generateReport
} from "./runtime/task-executor.js";
import { verifyExecution, formatVerificationReport } from "./runtime/verification.js";
import { executeAllowedCommand, isCommandAllowed, ALLOWED_COMMANDS } from "./runtime/terminal-executor.js";
import { orchestrate, getOrchestration, listOrchestrations, approveOrchestration, generateOrchestrationReport } from "./runtime/orchestrator.js";
import { createAuthMiddleware, createRateLimitMiddleware } from "./runtime/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const app = express();
const port = Number(process.env.PORT || 4173);
const originalBuilderUrl = getBuilderUrl();

const allowedOrigins = (process.env.HERMES_ALLOWED_ORIGINS || "http://127.0.0.1:4173,http://localhost:4173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("CORS not allowed for origin: " + origin));
  },
  credentials: false,
  maxAge: 3600
}));

app.use(express.json({ limit: "2mb" }));
app.use(createAuthMiddleware());

const llmRateLimit = createRateLimitMiddleware();

app.get("/api/health", async (_req, res, next) => {
  try {
    const status = await getOsStatus();
    res.json({
      ok: status.ok,
      service: status.service,
      version: status.version,
      mode: status.mode,
      timestamp: status.generatedAt
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/os/status", async (_req, res, next) => {
  try {
    res.json(await getOsStatus());
  } catch (error) {
    next(error);
  }
});

app.get("/api/os/foundation", async (_req, res, next) => {
  try {
    res.json({
      elizaOS: await getElizaStatus(),
      builder: await getBuilderStatus()
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/os/audit", async (_req, res, next) => {
  try {
    res.json(await getOsAudit());
  } catch (error) {
    next(error);
  }
});

app.get("/api/modules", async (_req, res, next) => {
  try {
    res.json({ modules: await getModules() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/modules/:id", async (req, res, next) => {
  try {
    const module = await getModule(req.params.id);
    if (!module) {
      res.status(404).json({ ok: false, error: "module not found" });
      return;
    }
    res.json(module);
  } catch (error) {
    next(error);
  }
});

app.post("/api/modules/:id/test", async (req, res, next) => {
  try {
    res.json(await testModule(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/modules/:id/run", async (req, res, next) => {
  try {
    res.json(await runModule(req.params.id, req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.get("/api/modules/:id/logs", async (req, res, next) => {
  try {
    res.json(await getModuleLogs(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/edit/propose", async (req, res, next) => {
  try {
    const { filePath, originalContent, newContent, sessionId } = req.body || {};
    if (!filePath || newContent === undefined) {
      res.status(400).json({ ok: false, error: "filePath and newContent are required." });
      return;
    }
    res.json(await proposeEdit(filePath, originalContent || null, newContent, sessionId || null));
  } catch (error) {
    next(error);
  }
});

app.post("/api/edit/apply", async (req, res, next) => {
  try {
    const { editId } = req.body || {};
    if (!editId) {
      res.status(400).json({ ok: false, error: "editId is required." });
      return;
    }
    res.json(await applyEdit(editId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/edit/reject", async (req, res, next) => {
  try {
    const { editId } = req.body || {};
    if (!editId) {
      res.status(400).json({ ok: false, error: "editId is required." });
      return;
    }
    res.json(rejectEdit(editId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/dev/list", async (req, res, next) => {
  try {
    const dirPath = req.query.path || ".";
    res.json(await listDirectories(dirPath));
  } catch (error) {
    next(error);
  }
});

app.get("/api/dev/read", async (req, res, next) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      res.status(400).json({ ok: false, error: "path is required." });
      return;
    }
    const options = {};
    if (req.query.startLine) options.startLine = parseInt(req.query.startLine, 10);
    if (req.query.endLine) options.endLine = parseInt(req.query.endLine, 10);
    res.json(await readFileTool(filePath, options));
  } catch (error) {
    next(error);
  }
});

app.get("/api/dev/search-filenames", async (req, res, next) => {
  try {
    const pattern = req.query.pattern;
    if (!pattern) {
      res.status(400).json({ ok: false, error: "pattern is required." });
      return;
    }
    const dirPath = req.query.path || ".";
    res.json(await searchFilenames(pattern, dirPath));
  } catch (error) {
    next(error);
  }
});

app.post("/api/dev/search-text", async (req, res, next) => {
  try {
    const { pattern, fileFilter, caseSensitive, maxResults } = req.body || {};
    if (!pattern) {
      res.status(400).json({ ok: false, error: "pattern is required." });
      return;
    }
    res.json(await searchText(pattern, { fileFilter, caseSensitive, maxResults }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/dev/find-symbol", async (req, res, next) => {
  try {
    const { symbol, fileFilter } = req.body || {};
    if (!symbol) {
      res.status(400).json({ ok: false, error: "symbol is required." });
      return;
    }
    res.json(await findSymbolReferences(symbol, { fileFilter }));
  } catch (error) {
    next(error);
  }
});

app.get("/api/dev/git-status", (_req, res) => {
  res.json(gitStatus());
});

app.get("/api/dev/git-diff", (req, res) => {
  const options = {};
  if (req.query.staged === "true") options.staged = true;
  if (req.query.file) options.file = req.query.file;
  res.json(gitDiff(options));
});

app.get("/api/dev/detect-project", async (_req, res, next) => {
  try {
    res.json(await detectProjectTypeTool());
  } catch (error) {
    next(error);
  }
});

app.get("/api/dev/project-map", async (_req, res, next) => {
  try {
    res.json(await buildProjectMap());
  } catch (error) {
    next(error);
  }
});

app.get("/api/installers", (_req, res) => {
  res.json({ installers: listInstallRecipes() });
});

app.post("/api/plan", async (req, res, next) => {
  try {
    const { goal } = req.body || {};
    if (!goal) {
      res.status(400).json({ ok: false, error: "goal is required." });
      return;
    }
    res.json(await createPlan(goal));
  } catch (error) {
    next(error);
  }
});

app.post("/api/execute/create", async (req, res, next) => {
  try {
    const { plan } = req.body || {};
    if (!plan) {
      res.status(400).json({ ok: false, error: "plan is required." });
      return;
    }
    const execution = createExecution(plan);
    res.json({ ok: true, executionId: execution.id, execution });
  } catch (error) {
    next(error);
  }
});

app.post("/api/execute/start", async (req, res, next) => {
  try {
    const { executionId } = req.body || {};
    if (!executionId) {
      res.status(400).json({ ok: false, error: "executionId is required." });
      return;
    }
    res.json(await startExecution(executionId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/execute/list", (_req, res) => {
  res.json({ ok: true, executions: listExecutions() });
});

app.get("/api/execute/:id", (req, res) => {
  const execution = getExecution(req.params.id);
  if (!execution) {
    res.status(404).json({ ok: false, error: "Execution not found." });
    return;
  }
  res.json({ ok: true, execution });
});

app.get("/api/execute/:id/report", (req, res) => {
  const execution = getExecution(req.params.id);
  if (!execution) {
    res.status(404).json({ ok: false, error: "Execution not found." });
    return;
  }
  res.json({ ok: true, report: generateReport(execution) });
});

app.post("/api/execute/approve", async (req, res, next) => {
  try {
    const { executionId, stepId } = req.body || {};
    if (!executionId || !stepId) {
      res.status(400).json({ ok: false, error: "executionId and stepId are required." });
      return;
    }
    res.json(approveStep(executionId, stepId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/execute/skip", async (req, res, next) => {
  try {
    const { executionId, stepId } = req.body || {};
    if (!executionId || !stepId) {
      res.status(400).json({ ok: false, error: "executionId and stepId are required." });
      return;
    }
    res.json(skipStep(executionId, stepId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/execute/cancel", async (req, res, next) => {
  try {
    const { executionId } = req.body || {};
    if (!executionId) {
      res.status(400).json({ ok: false, error: "executionId is required." });
      return;
    }
    res.json(cancelExecution(executionId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/verify", async (req, res, next) => {
  try {
    const { executionId } = req.body || {};
    if (!executionId) {
      res.status(400).json({ ok: false, error: "executionId is required." });
      return;
    }
    res.json(await verifyExecution(executionId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/verify/report", async (req, res, next) => {
  try {
    const { executionId } = req.body || {};
    if (!executionId) {
      res.status(400).json({ ok: false, error: "executionId is required." });
      return;
    }
    const verification = await verifyExecution(executionId);
    res.json({ ok: true, report: formatVerificationReport(verification) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/terminal/allowed", (_req, res) => {
  res.json({ ok: true, commands: ALLOWED_COMMANDS });
});

app.post("/api/terminal/validate", (req, res) => {
  const { command } = req.body || {};
  if (!command) {
    res.status(400).json({ ok: false, error: "command is required." });
    return;
  }
  res.json(isCommandAllowed(command));
});

app.post("/api/terminal/execute", (req, res) => {
  const { command } = req.body || {};
  if (!command) {
    res.status(400).json({ ok: false, error: "command is required." });
    return;
  }
  res.json(executeAllowedCommand(command));
});

app.post("/api/orchestrate", async (req, res, next) => {
  try {
    const { goal } = req.body || {};
    if (!goal) {
      res.status(400).json({ ok: false, error: "goal is required." });
      return;
    }
    res.json(await orchestrate(goal));
  } catch (error) {
    next(error);
  }
});

app.get("/api/orchestrate/list", (_req, res) => {
  res.json({ ok: true, orchestrations: listOrchestrations() });
});

app.get("/api/orchestrate/:id", (req, res) => {
  const orchestration = getOrchestration(req.params.id);
  if (!orchestration) {
    res.status(404).json({ ok: false, error: "Orchestration not found." });
    return;
  }
  res.json({ ok: true, orchestration });
});

app.get("/api/orchestrate/:id/report", (req, res) => {
  const orchestration = getOrchestration(req.params.id);
  if (!orchestration) {
    res.status(404).json({ ok: false, error: "Orchestration not found." });
    return;
  }
  res.json({ ok: true, report: generateOrchestrationReport(orchestration) });
});

app.post("/api/orchestrate/approve", async (req, res, next) => {
  try {
    const { orchestrationId } = req.body || {};
    if (!orchestrationId) {
      res.status(400).json({ ok: false, error: "orchestrationId is required." });
      return;
    }
    res.json(await approveOrchestration(orchestrationId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/modules/:id/install", async (req, res, next) => {
  try {
    res.json(await prepareInstall(req.params.id, { execute: Boolean(req.body?.execute) }));
  } catch (error) {
    next(error);
  }
});

app.get("/api/self/:id", async (req, res, next) => {
  try {
    if (!isLocalSelfModule(req.params.id)) {
      res.status(404).json({ ok: false, error: "self module not found" });
      return;
    }
    res.json(await getSelfModuleState(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/self/:id/items", async (req, res, next) => {
  try {
    if (!isLocalSelfModule(req.params.id)) {
      res.status(404).json({ ok: false, error: "self module not found" });
      return;
    }
    res.status(201).json(await createSelfModuleItem(req.params.id, req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.get("/api/connections", async (_req, res, next) => {
  try {
    res.json(await getConnections());
  } catch (error) {
    next(error);
  }
});

app.post("/api/connections/:id/configure", async (req, res, next) => {
  try {
    res.json(await configureConnection(req.params.id, req.body?.fields || {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/connections/:id/test", async (req, res, next) => {
  try {
    res.json(await testModule(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.get("/api/workflows", async (_req, res, next) => {
  try {
    res.json({ workflows: await listWorkflows() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/workflows", async (req, res, next) => {
  try {
    res.status(201).json(await saveWorkflow(req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.get("/api/workflows/:id", async (req, res, next) => {
  try {
    const workflow = await getWorkflow(req.params.id);
    if (!workflow) {
      res.status(404).json({ ok: false, error: "workflow not found" });
      return;
    }
    res.json(workflow);
  } catch (error) {
    next(error);
  }
});

app.put("/api/workflows/:id", async (req, res, next) => {
  try {
    res.json(await saveWorkflow({ ...(req.body || {}), id: req.params.id }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/workflows/:id/run", async (req, res, next) => {
  try {
    res.json(await runWorkflow(req.params.id, req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.get("/api/workflows/:id/runs/:runId", async (req, res, next) => {
  try {
    const run = await getWorkflowRun(req.params.id, req.params.runId);
    if (!run) {
      res.status(404).json({ ok: false, error: "run not found" });
      return;
    }
    res.json(run);
  } catch (error) {
    next(error);
  }
});

app.post("/api/llm/execute", llmRateLimit, async (req, res, next) => {
  try {
    const { handleLlmExecute } = await import("./runtime/llm-proxy.js");
    await handleLlmExecute(req, res, next);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/export/prepare", async (req, res, next) => {
  try {
    assertAdminToken(req);
    res.json(await prepareExport({ sourceRoot: root, requestedBy: "api" }));
  } catch (error) {
    next(error);
  }
});

app.get("/api/builder/status", async (_req, res, next) => {
  try {
    res.json(await getBuilderStatus());
  } catch (error) {
    next(error);
  }
});

async function proxyOriginalBuilder(req, res, next) {
  try {
    const incomingPath = req.originalUrl.startsWith("/agent-builder-source")
      ? req.originalUrl.replace(/^\/agent-builder-source\/?/, "/")
      : req.originalUrl;
    const target = new URL(incomingPath || "/", originalBuilderUrl);
    console.log(`[PROXY] ${req.method} ${req.originalUrl} → ${target.href}`);
    const upstream = await fetch(target, {
      method: req.method,
      redirect: "manual",
      headers: {
        accept: req.get("accept") || "*/*",
        "accept-language": req.get("accept-language") || "en-US,en;q=0.9",
        "user-agent": req.get("user-agent") || "HermesAgentOSProxy/1.0"
      },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req,
      duplex: ["GET", "HEAD"].includes(req.method) ? undefined : "half"
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (["content-encoding", "content-length", "transfer-encoding", "connection"].includes(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      let html = await upstream.text();
      html = html
        .replaceAll('href="/_next/', 'href="/_next/')
        .replaceAll('src="/_next/', 'src="/_next/')
        .replaceAll(originalBuilderUrl, "")
        .replaceAll("http://127.0.0.1:3000", "")
        .replaceAll("http://127.0.0.1:3100", "")
        .replaceAll("http://localhost:3000", "");
      res.send(html);
      return;
    }

    if (!upstream.body) {
      res.end();
      return;
    }
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error(`[PROXY ERROR] ${req.method} ${req.originalUrl}:`, error.message, error.code);
    next(error);
  }
}

app.all("/agent-builder-source", proxyOriginalBuilder);
app.all("/agent-builder-source/*", proxyOriginalBuilder);
app.all("/_next/*", proxyOriginalBuilder);

// Compatibility aliases for the previous dashboard build.
app.get("/api/integrations", async (_req, res, next) => {
  try {
    const [status, modules] = await Promise.all([getOsStatus(), getModules()]);
    res.json(modulesToLegacySnapshot(status, modules));
  } catch (error) {
    next(error);
  }
});

app.get("/api/connections/templates", async (_req, res, next) => {
  try {
    res.json(await getConnections());
  } catch (error) {
    next(error);
  }
});

app.post("/api/integrations/:id/test", async (req, res, next) => {
  try {
    res.json(await testModule(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/agents/:id/message", async (req, res, next) => {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) {
      res.status(400).json({ ok: false, error: "message is required" });
      return;
    }
    res.json(await runModule(req.params.id, { message }));
  } catch (error) {
    next(error);
  }
});

app.use(express.static(dist));

app.get("*", (_req, res) => {
  res.sendFile(path.join(dist, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error?.status || 500).json({
    ok: false,
    error: error?.message || "Internal server error",
    audit: error?.audit
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Hermes Agent OS listening on http://localhost:${port}`);
});
