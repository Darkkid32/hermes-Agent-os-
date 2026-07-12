import { createPlan } from "./planner.js";
import { createExecution, getExecution, startExecution, approveStep, skipStep, cancelExecution, generateReport } from "./task-executor.js";
import { verifyExecution, formatVerificationReport } from "./verification.js";
import { executeAllowedCommand } from "./terminal-executor.js";

const orchestrations = new Map();

const LIMITS = {
  MAX_STEPS: 25,
  MAX_RETRIES: 2,
  MAX_RUNTIME_MS: 15 * 60 * 1000
};

const APPROVAL_TRIGGERS = [
  /delete/i,
  /remove/i,
  /install/i,
  /uninstall/i,
  /push/i,
  /commit/i,
  /checkout/i,
  /reset/i,
  /clean/i,
  /format/i,
  /drop/i,
  /destroy/i,
  /wipe/i
];

function createOrchestrationId() {
  return `orch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function requiresOrchestrationApproval(goal, plan) {
  if (plan.riskLevel === "HIGH") return true;
  for (const pattern of APPROVAL_TRIGGERS) {
    if (pattern.test(goal)) return true;
  }
  if (plan.executionSteps && plan.executionSteps.length > 5) return true;
  return false;
}

async function orchestrate(goal, options = {}) {
  const orchestrationId = createOrchestrationId();
  const startTime = Date.now();
  const state = {
    id: orchestrationId,
    goal,
    status: "planning",
    plan: null,
    executionId: null,
    verificationResults: [],
    retries: 0,
    rollbacks: 0,
    userApprovals: 0,
    failures: [],
    stepsExecuted: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
    log: []
  };
  orchestrations.set(orchestrationId, state);
  function addLog(message, level = "info") {
    state.log.push({ timestamp: new Date().toISOString(), level, message });
  }
  try {
    addLog(`Starting orchestration for: ${goal}`);
    const planResult = await createPlan(goal);
    if (!planResult.ok) {
      state.status = "failed";
      state.failures.push({ stage: "planning", error: "Failed to create plan" });
      addLog("Failed to create plan", "error");
      return { ok: false, orchestrationId, error: "Failed to create plan" };
    }
    state.plan = planResult.plan;
    addLog(`Plan created: ${planResult.plan.estimatedSteps} steps, risk: ${planResult.plan.riskLevel}`);
    if (planResult.plan.executionSteps.length > LIMITS.MAX_STEPS) {
      state.status = "aborted";
      state.failures.push({ stage: "validation", error: `Plan exceeds maximum steps (${LIMITS.MAX_STEPS})` });
      addLog(`Plan exceeds maximum steps`, "error");
      return { ok: false, orchestrationId, error: "Plan exceeds maximum steps" };
    }
    const approvalRequired = requiresOrchestrationApproval(goal, planResult.plan);
    if (approvalRequired) {
      state.status = "awaiting_approval";
      addLog("Orchestration requires approval", "warn");
      return {
        ok: true,
        orchestrationId,
        status: "awaiting_approval",
        plan: planResult.plan,
        message: "This orchestration requires approval before proceeding."
      };
    }
    state.status = "executing";
    const execResult = createExecution(planResult.plan);
    state.executionId = execResult.id;
    addLog(`Execution created: ${execResult.id}`);
    let continues = true;
    while (continues) {
      if (Date.now() - startTime > LIMITS.MAX_RUNTIME_MS) {
        state.status = "aborted";
        state.failures.push({ stage: "execution", error: "Maximum runtime exceeded" });
        addLog("Maximum runtime exceeded", "error");
        break;
      }
      if (state.stepsExecuted >= LIMITS.MAX_STEPS) {
        state.status = "aborted";
        state.failures.push({ stage: "execution", error: "Maximum steps exceeded" });
        addLog("Maximum steps exceeded", "error");
        break;
      }
      if (state.retries > LIMITS.MAX_RETRIES * planResult.plan.executionSteps.length) {
        state.status = "aborted";
        state.failures.push({ stage: "execution", error: "Maximum retries exceeded" });
        addLog("Maximum retries exceeded", "error");
        break;
      }
      const startResult = await startExecution(state.executionId);
      if (!startResult.ok) {
        state.status = "failed";
        state.failures.push({ stage: "execution", error: startResult.error });
        addLog(`Execution failed: ${startResult.error}`, "error");
        break;
      }
      if (startResult.completed) {
        state.stepsExecuted = planResult.plan.executionSteps.length;
        addLog("Execution completed");
        break;
      }
      if (startResult.paused) {
        if (startResult.failed) {
          state.status = "failed";
          state.failures.push({ stage: "execution", error: `Step ${startResult.stepId} failed` });
          addLog(`Step ${startResult.stepId} failed`, "error");
          break;
        }
        state.status = "awaiting_approval";
        state.userApprovals++;
        addLog(`Paused for approval at step ${startResult.stepId}`, "warn");
        return {
          ok: true,
          orchestrationId,
          status: "awaiting_approval",
          executionId: state.executionId,
          stepId: startResult.stepId,
          message: startResult.message,
          plan: state.plan
        };
      }
      state.stepsExecuted++;
    }
    if (state.status === "executing") {
      addLog("Running verification");
      const verification = await verifyExecution(state.executionId);
      state.verificationResults.push(verification);
      if (verification.overallStatus === "SUCCESS") {
        state.status = "completed";
        addLog("Verification passed");
      } else {
        const recoveryAction = verification.recoveryActions && verification.recoveryActions.length > 0
          ? verification.recoveryActions[0].action
          : "REQUEST_USER_INPUT";
        if (recoveryAction === "RETRY" && state.retries < LIMITS.MAX_RETRIES) {
          state.retries++;
          addLog(`Retrying (attempt ${state.retries})`, "warn");
          continues = true;
        } else if (recoveryAction === "ROLLBACK") {
          state.rollbacks++;
          state.status = "rolled_back";
          addLog("Rollback triggered", "warn");
        } else {
          state.status = "failed";
          state.failures.push({ stage: "verification", error: verification.overallStatus });
          addLog("Verification failed", "error");
        }
      }
    }
  } catch (error) {
    state.status = "failed";
    state.failures.push({ stage: "orchestration", error: error.message });
    addLog(`Orchestration error: ${error.message}`, "error");
  }
  state.completedAt = new Date().toISOString();
  return {
    ok: true,
    orchestrationId,
    status: state.status,
    plan: state.plan,
    executionId: state.executionId,
    stepsExecuted: state.stepsExecuted,
    retries: state.retries,
    rollbacks: state.rollbacks,
    userApprovals: state.userApprovals,
    failures: state.failures,
    verificationResults: state.verificationResults,
    log: state.log,
    executionTime: Date.now() - startTime
  };
}

function getOrchestration(orchestrationId) {
  return orchestrations.get(orchestrationId) || null;
}

function listOrchestrations() {
  return Array.from(orchestrations.values()).map(o => ({
    id: o.id,
    goal: o.goal,
    status: o.status,
    stepsExecuted: o.stepsExecuted,
    createdAt: o.createdAt,
    completedAt: o.completedAt
  }));
}

async function approveOrchestration(orchestrationId) {
  const state = orchestrations.get(orchestrationId);
  if (!state) {
    return { ok: false, error: "Orchestration not found." };
  }
  if (state.status !== "awaiting_approval") {
    return { ok: false, error: "Orchestration is not awaiting approval." };
  }
  state.status = "executing";
  state.log.push({ timestamp: new Date().toISOString(), level: "info", message: "Approved by user" });
  const startTime = Date.now();
  try {
    if (state.executionId) {
      const startResult = await startExecution(state.executionId);
      if (!startResult.ok) {
        state.status = "failed";
        state.failures.push({ stage: "execution", error: startResult.error });
        return generateOrchestrationReport(state);
      }
      if (startResult.completed) {
        state.stepsExecuted = state.plan.executionSteps.length;
        const verification = await verifyExecution(state.executionId);
        state.verificationResults.push(verification);
        state.status = verification.overallStatus === "SUCCESS" ? "completed" : "failed";
      } else if (startResult.paused) {
        state.status = "awaiting_approval";
        state.userApprovals++;
      } else {
        state.stepsExecuted++;
      }
    }
  } catch (error) {
    state.status = "failed";
    state.failures.push({ stage: "orchestration", error: error.message });
  }
  state.completedAt = new Date().toISOString();
  return generateOrchestrationReport(state);
}

function generateOrchestrationReport(state) {
  return {
    orchestrationId: state.id,
    goal: state.goal,
    status: state.status,
    planSummary: state.plan ? {
      riskLevel: state.plan.riskLevel,
      estimatedSteps: state.plan.estimatedSteps,
      requiredTools: state.plan.requiredTools
    } : null,
    stepsExecuted: state.stepsExecuted,
    retries: state.retries,
    rollbacks: state.rollbacks,
    userApprovals: state.userApprovals,
    failures: state.failures,
    verificationResults: state.verificationResults,
    log: state.log,
    createdAt: state.createdAt,
    completedAt: state.completedAt,
    executionTime: state.completedAt
      ? new Date(state.completedAt) - new Date(state.createdAt)
      : 0
  };
}

export {
  orchestrate,
  getOrchestration,
  listOrchestrations,
  approveOrchestration,
  generateOrchestrationReport,
  LIMITS
};
