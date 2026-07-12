import { promises as fs } from "node:fs";
import path from "node:path";
import { getConfiguredValue, getStoredConnectionConfig } from "./connections.js";
import { getModule } from "./modules.js";
import { ensureRuntimeStore, readJson, runtimePaths, writeJson } from "./store.js";

const DEFAULT_WORKFLOW_ID = "blank-open-agent-builder";
const OBSOLETE_GENERATED_WORKFLOWS = new Set(["sample-lead-intake"]);

export const NODE_TYPES = [
  "start",
  "agent",
  "mcp_tool",
  "transform",
  "if_else",
  "while_loop",
  "user_approval",
  "end"
];

function now() {
  return new Date().toISOString();
}

function workflowFile(id) {
  return path.join(runtimePaths().workflows, `${id}.json`);
}

function runFile(workflowId, runId) {
  return path.join(runtimePaths().runs, workflowId, `${runId}.json`);
}

export function defaultWorkflow() {
  return {
    id: DEFAULT_WORKFLOW_ID,
    name: "Blank Open Agent Builder Workflow",
    description: "Clean upstream-style starter workflow. Add agent, MCP, logic, approval, and data nodes in the real builder.",
    draft: true,
    source: "firecrawl-open-agent-builder-upstream",
    nodeTypes: NODE_TYPES,
    nodes: [
      { id: "start", type: "start", label: "Start" }
    ],
    edges: [],
    createdAt: now(),
    updatedAt: now()
  };
}

async function removeObsoleteGeneratedWorkflows() {
  for (const id of OBSOLETE_GENERATED_WORKFLOWS) {
    const filePath = workflowFile(id);
    const existing = await readJson(filePath, null);
    if (!existing) continue;
    const generatedByHermes =
      existing.name === "AI Lead Form Intake Automation" ||
      existing.description?.includes("lead scoring") ||
      existing.nodes?.some((node) => node.label === "CRM Duplicate Check");
    if (generatedByHermes) {
      await fs.rm(filePath, { force: true });
    }
  }
}

async function ensureDefaultWorkflow() {
  await ensureRuntimeStore();
  await removeObsoleteGeneratedWorkflows();
  const filePath = workflowFile(DEFAULT_WORKFLOW_ID);
  const existing = await readJson(filePath, null);
  if (existing) return existing;
  return writeJson(filePath, defaultWorkflow());
}

export async function listWorkflows() {
  await ensureDefaultWorkflow();
  const paths = runtimePaths();
  let entries = [];
  try {
    entries = await fs.readdir(paths.workflows, { withFileTypes: true });
  } catch {
    entries = [];
  }
  const workflows = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const workflow = await readJson(path.join(paths.workflows, entry.name), null);
    if (workflow) {
      workflows.push({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        draft: Boolean(workflow.draft),
        nodeCount: workflow.nodes?.length || 0,
        updatedAt: workflow.updatedAt || workflow.createdAt || null
      });
    }
  }
  return workflows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export async function getWorkflow(id) {
  await ensureDefaultWorkflow();
  return readJson(workflowFile(id), null);
}

export async function saveWorkflow(workflow) {
  await ensureRuntimeStore();
  const id = String(workflow.id || `workflow-${Date.now()}`).replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const invalid = nodes.find((node) => !NODE_TYPES.includes(node.type));
  if (invalid) {
    const error = new Error(`Unsupported node type: ${invalid.type}`);
    error.status = 400;
    throw error;
  }
  const current = await readJson(workflowFile(id), null);
  const next = {
    ...current,
    ...workflow,
    id,
    source: "firecrawl-open-agent-builder-compatible",
    nodeTypes: NODE_TYPES,
    createdAt: current?.createdAt || now(),
    updatedAt: now()
  };
  return writeJson(workflowFile(id), next);
}

export async function runWorkflow(id, input = {}) {
  const workflow = await getWorkflow(id);
  if (!workflow) {
    const error = new Error(`Workflow not found: ${id}`);
    error.status = 404;
    throw error;
  }
  const stored = await getStoredConnectionConfig();
  const firecrawlReady = Boolean(getConfiguredValue(stored, "firecrawl-builder", "FIRECRAWL_API_KEY"));
  const runId = `run-${Date.now()}`;
  const nodeRuns = [];
  let status = "completed";
  for (const node of workflow.nodes || []) {
    let nodeStatus = "completed";
    let message = `${node.label} completed.`;
    if (node.type === "mcp_tool" && node.moduleId === "firecrawl-builder" && !firecrawlReady) {
      nodeStatus = "ready_to_configure";
      message = "Firecrawl execution needs FIRECRAWL_API_KEY. Design mode remains available.";
      status = "ready_to_configure";
    }
    if (node.type === "agent" && node.moduleId) {
      const module = await getModule(node.moduleId);
      if (!module || module.status !== "connected") {
        nodeStatus = module?.status || "ready_to_configure";
        message = `${node.label} is waiting for ${node.moduleId} configuration.`;
        if (status === "completed") status = "ready_to_configure";
      }
    }
    if (node.type === "user_approval") {
      nodeStatus = "waiting_for_approval";
      message = "Workflow paused for human approval.";
      if (status === "completed") status = "waiting_for_approval";
    }
    nodeRuns.push({
      nodeId: node.id,
      label: node.label,
      type: node.type,
      status: nodeStatus,
      message,
      timestamp: now()
    });
  }
  const run = {
    id: runId,
    workflowId: workflow.id,
    status,
    input,
    nodeRuns,
    createdAt: now(),
    updatedAt: now()
  };
  await writeJson(runFile(workflow.id, runId), run);
  return run;
}

export async function getWorkflowRun(workflowId, runId) {
  return readJson(runFile(workflowId, runId), null);
}
