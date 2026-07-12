import { readFileTool, searchText, findSymbolReferences, searchFilenames, buildProjectMap } from "./developer-tools.js";
import { proposeEdit, applyEdit } from "./modules.js";

const executions = new Map();

function createExecutionId() {
  return `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createExecution(plan) {
  const id = createExecutionId();
  const steps = plan.executionSteps.map((step, index) => ({
    id: index + 1,
    action: step.action,
    tool: step.tool,
    target: step.target || "",
    status: "pending",
    result: null,
    startedAt: null,
    completedAt: null,
    error: null
  }));
  const execution = {
    id,
    plan: {
      goal: plan.goal,
      riskLevel: plan.riskLevel,
      approvalRequired: plan.approvalRequired,
      filesLikelyAffected: plan.filesLikelyAffected || []
    },
    steps,
    currentStep: 0,
    status: "pending",
    approvalPending: false,
    approvalStepId: null,
    log: [],
    createdAt: new Date().toISOString(),
    completedAt: null
  };
  executions.set(id, execution);
  return execution;
}

function getExecution(executionId) {
  return executions.get(executionId) || null;
}

function listExecutions() {
  return Array.from(executions.values()).map(e => ({
    id: e.id,
    goal: e.plan.goal,
    status: e.status,
    currentStep: e.currentStep,
    totalSteps: e.steps.length,
    createdAt: e.createdAt,
    completedAt: e.completedAt
  }));
}

function addLog(execution, message, level = "info") {
  execution.log.push({
    timestamp: new Date().toISOString(),
    level,
    message
  });
}

async function executeStep(execution, step) {
  step.status = "running";
  step.startedAt = new Date().toISOString();
  execution.currentStep = step.id;
  addLog(execution, `Executing step ${step.id}: ${step.action}`);
  try {
    let result = null;
    switch (step.tool) {
      case "readFileTool":
        if (step.target === "affected files" || step.target === "TBD" || step.target === "none") {
          result = { ok: true, message: `Skipped: ${step.target} is a placeholder` };
        } else {
          result = await readFileTool(step.target);
        }
        break;
      case "searchText":
        if (step.target === "affected files" || step.target === "TBD" || step.target === "none") {
          result = { ok: true, message: `Skipped: ${step.target} is a placeholder` };
        } else {
          result = await searchText(step.target);
        }
        break;
      case "findSymbolReferences":
        result = await findSymbolReferences(step.target);
        break;
      case "searchFilenames":
        if (step.target.includes("**") || step.target.includes("*")) {
          const searchTerm = step.target.replace(/\*\*/g, "").replace(/\*/g, "").replace(/\//g, "");
          result = await searchFilenames(searchTerm);
        } else {
          result = await searchFilenames(step.target);
        }
        break;
      case "buildProjectMap":
        result = await buildProjectMap();
        break;
      case "proposeEdit":
        result = { ok: true, message: `Propose edit to ${step.target}`, requiresApproval: true };
        break;
      case "applyEdit":
        result = { ok: true, message: `Apply edit to ${step.target}` };
        break;
      case "manualVerification":
        result = { ok: true, message: "Manual verification required", requiresApproval: true };
        break;
      case "none":
        result = { ok: true, message: "Step skipped (no action required)" };
        break;
      default:
        result = { ok: false, error: `Unknown tool: ${step.tool}` };
    }
    step.result = result;
    step.status = result.ok ? "success" : "failed";
    step.completedAt = new Date().toISOString();
    if (!result.ok) {
      step.error = result.error;
      addLog(execution, `Step ${step.id} failed: ${result.error}`, "error");
      execution.status = "failed";
      return false;
    }
    if (result.requiresApproval) {
      step.status = "awaiting_approval";
      execution.approvalPending = true;
      execution.approvalStepId = step.id;
      addLog(execution, `Step ${step.id} requires approval`, "warn");
      execution.status = "awaiting_approval";
      return false;
    }
    addLog(execution, `Step ${step.id} completed: ${result.message || "OK"}`);
    return true;
  } catch (error) {
    step.status = "failed";
    step.error = error.message;
    step.completedAt = new Date().toISOString();
    addLog(execution, `Step ${step.id} error: ${error.message}`, "error");
    execution.status = "failed";
    return false;
  }
}

async function startExecution(executionId) {
  const execution = executions.get(executionId);
  if (!execution) {
    return { ok: false, error: "Execution not found." };
  }
  if (execution.status === "completed" || execution.status === "failed") {
    return { ok: false, error: "Execution already finished." };
  }
  if (execution.approvalPending) {
    return { ok: false, error: "Execution is awaiting approval." };
  }
  execution.status = "running";
  addLog(execution, "Execution started");
  for (let i = 0; i < execution.steps.length; i++) {
    const step = execution.steps[i];
    if (step.status === "success" || step.status === "skipped") {
      continue;
    }
    if (execution.plan.approvalRequired && step.tool === "proposeEdit") {
      step.status = "awaiting_approval";
      execution.approvalPending = true;
      execution.approvalStepId = step.id;
      execution.currentStep = step.id;
      addLog(execution, `Pausing for approval at step ${step.id}: ${step.action}`, "warn");
      execution.status = "awaiting_approval";
      return { ok: true, paused: true, stepId: step.id, message: `Step ${step.id} requires approval.` };
    }
    if (step.tool === "manualVerification") {
      step.status = "awaiting_approval";
      execution.approvalPending = true;
      execution.approvalStepId = step.id;
      execution.currentStep = step.id;
      addLog(execution, `Pausing for manual verification at step ${step.id}`, "warn");
      execution.status = "awaiting_approval";
      return { ok: true, paused: true, stepId: step.id, message: `Step ${step.id} requires manual verification.` };
    }
    const success = await executeStep(execution, step);
    if (!success) {
      return { ok: true, paused: execution.approvalPending, failed: execution.status === "failed", stepId: step.id };
    }
  }
  execution.status = "completed";
  execution.completedAt = new Date().toISOString();
  addLog(execution, "Execution completed successfully");
  return { ok: true, completed: true };
}

function approveStep(executionId, stepId) {
  const execution = executions.get(executionId);
  if (!execution) {
    return { ok: false, error: "Execution not found." };
  }
  if (!execution.approvalPending) {
    return { ok: false, error: "No approval pending." };
  }
  if (execution.approvalStepId !== stepId) {
    return { ok: false, error: `Step ${stepId} is not awaiting approval.` };
  }
  const step = execution.steps.find(s => s.id === stepId);
  if (!step) {
    return { ok: false, error: "Step not found." };
  }
  step.status = "success";
  step.completedAt = new Date().toISOString();
  step.result = { ok: true, message: "Approved by user" };
  execution.approvalPending = false;
  execution.approvalStepId = null;
  execution.status = "running";
  addLog(execution, `Step ${stepId} approved by user`);
  return { ok: true };
}

function skipStep(executionId, stepId) {
  const execution = executions.get(executionId);
  if (!execution) {
    return { ok: false, error: "Execution not found." };
  }
  const step = execution.steps.find(s => s.id === stepId);
  if (!step) {
    return { ok: false, error: "Step not found." };
  }
  step.status = "skipped";
  step.completedAt = new Date().toISOString();
  step.result = { ok: true, message: "Skipped by user" };
  execution.approvalPending = false;
  execution.approvalStepId = null;
  execution.status = "running";
  addLog(execution, `Step ${stepId} skipped by user`);
  return { ok: true };
}

function cancelExecution(executionId) {
  const execution = executions.get(executionId);
  if (!execution) {
    return { ok: false, error: "Execution not found." };
  }
  execution.status = "cancelled";
  execution.completedAt = new Date().toISOString();
  addLog(execution, "Execution cancelled by user");
  return { ok: true };
}

function generateReport(execution) {
  const succeeded = execution.steps.filter(s => s.status === "success").length;
  const failed = execution.steps.filter(s => s.status === "failed").length;
  const skipped = execution.steps.filter(s => s.status === "skipped").length;
  const pending = execution.steps.filter(s => s.status === "pending").length;
  const awaiting = execution.steps.filter(s => s.status === "awaiting_approval").length;
  return {
    executionId: execution.id,
    goal: execution.plan.goal,
    status: execution.status,
    riskLevel: execution.plan.riskLevel,
    totalSteps: execution.steps.length,
    succeeded,
    failed,
    skipped,
    pending,
    awaitingApproval: awaiting,
    steps: execution.steps.map(s => ({
      id: s.id,
      action: s.action,
      tool: s.tool,
      target: s.target,
      status: s.status,
      error: s.error,
      startedAt: s.startedAt,
      completedAt: s.completedAt
    })),
    log: execution.log,
    createdAt: execution.createdAt,
    completedAt: execution.completedAt
  };
}

export {
  createExecution,
  getExecution,
  listExecutions,
  startExecution,
  approveStep,
  skipStep,
  cancelExecution,
  generateReport
};
