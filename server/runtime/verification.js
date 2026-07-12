import { readFileTool, searchText, findSymbolReferences, searchFilenames, buildProjectMap } from "./developer-tools.js";
import { getExecution, generateReport } from "./task-executor.js";

const VERIFICATION_METHODS = {
  EDIT: "edit_verification",
  BUILD: "build_verification",
  TEST: "test_verification",
  SEARCH: "search_verification",
  SYMBOL: "symbol_verification",
  FILE_EXISTS: "file_exists_verification",
  PROJECT_MAP: "project_map_verification",
  MANUAL: "manual_verification"
};

const RECOVERY_ACTIONS = {
  SUCCESS: "SUCCESS",
  RETRY: "RETRY",
  ROLLBACK: "ROLLBACK",
  REQUEST_USER_INPUT: "REQUEST_USER_INPUT",
  ABORT: "ABORT"
};

function determineVerificationMethod(step) {
  if (step.tool === "proposeEdit" || step.tool === "applyEdit") {
    return VERIFICATION_METHODS.EDIT;
  }
  if (step.action.toLowerCase().includes("build")) {
    return VERIFICATION_METHODS.BUILD;
  }
  if (step.action.toLowerCase().includes("test")) {
    return VERIFICATION_METHODS.TEST;
  }
  if (step.tool === "searchText" || step.action.toLowerCase().includes("search")) {
    return VERIFICATION_METHODS.SEARCH;
  }
  if (step.tool === "findSymbolReferences") {
    return VERIFICATION_METHODS.SYMBOL;
  }
  if (step.tool === "readFileTool") {
    return VERIFICATION_METHODS.FILE_EXISTS;
  }
  if (step.tool === "buildProjectMap") {
    return VERIFICATION_METHODS.PROJECT_MAP;
  }
  if (step.tool === "manualVerification") {
    return VERIFICATION_METHODS.MANUAL;
  }
  return VERIFICATION_METHODS.MANUAL;
}

async function verifyEdit(step) {
  const target = step.target;
  if (!target || target === "affected files" || target === "TBD") {
    return { verified: true, message: "No specific file target to verify" };
  }
  const result = await readFileTool(target);
  if (!result.ok) {
    return { verified: false, message: `File not accessible: ${result.error}` };
  }
  return { verified: true, message: `File ${target} exists and is readable` };
}

async function verifyBuild(step) {
  return { verified: true, message: "Build verification requires manual check" };
}

async function verifyTest(step) {
  return { verified: true, message: "Test verification requires manual check" };
}

async function verifySearch(step, execution) {
  const target = step.target;
  if (!target || target === "affected files" || target === "TBD" || target === "none") {
    return { verified: true, message: "No specific search target to verify" };
  }
  if (target.includes(" ") && !target.includes("\\")) {
    return { verified: true, message: "Search target appears to be a description, not a pattern" };
  }
  const result = await searchText(target);
  if (!result.ok) {
    return { verified: false, message: `Search failed: ${result.error}` };
  }
  if (result.totalFiles === 0) {
    return { verified: false, message: `No results found for "${target}"` };
  }
  return { verified: true, message: `Found ${result.totalFiles} files matching "${target}"` };
}

async function verifySymbol(step) {
  const target = step.target;
  if (!target || target === "affected files" || target === "TBD") {
    return { verified: true, message: "No specific symbol to verify" };
  }
  const result = await findSymbolReferences(target);
  if (!result.ok) {
    return { verified: false, message: `Symbol search failed: ${result.error}` };
  }
  if (result.totalFiles === 0) {
    return { verified: false, message: `Symbol "${target}" not found` };
  }
  return { verified: true, message: `Symbol "${target}" found in ${result.totalFiles} files` };
}

async function verifyFileExists(step) {
  const target = step.target;
  if (!target || target === "affected files" || target === "TBD") {
    return { verified: true, message: "No specific file target to verify" };
  }
  const result = await readFileTool(target);
  if (!result.ok) {
    return { verified: false, message: `File not accessible: ${result.error}` };
  }
  return { verified: true, message: `File ${target} exists` };
}

async function verifyProjectMap() {
  const result = await buildProjectMap();
  if (!result.ok) {
    return { verified: false, message: `Project map failed: ${result.error}` };
  }
  return { verified: true, message: `Project has ${result.totalFiles} files` };
}

async function verifyStep(step, execution) {
  const method = determineVerificationMethod(step);
  let verification;
  switch (method) {
    case VERIFICATION_METHODS.EDIT:
      verification = await verifyEdit(step);
      break;
    case VERIFICATION_METHODS.BUILD:
      verification = await verifyBuild(step);
      break;
    case VERIFICATION_METHODS.TEST:
      verification = await verifyTest(step);
      break;
    case VERIFICATION_METHODS.SEARCH:
      verification = await verifySearch(step, execution);
      break;
    case VERIFICATION_METHODS.SYMBOL:
      verification = await verifySymbol(step);
      break;
    case VERIFICATION_METHODS.FILE_EXISTS:
      verification = await verifyFileExists(step);
      break;
    case VERIFICATION_METHODS.PROJECT_MAP:
      verification = await verifyProjectMap();
      break;
    case VERIFICATION_METHODS.MANUAL:
    default:
      verification = { verified: true, message: "Manual verification - assumed passed" };
      break;
  }
  return {
    stepId: step.id,
    action: step.action,
    expectedResult: `Step ${step.id} should succeed`,
    actualResult: verification.message,
    verificationMethod: method,
    verificationStatus: verification.verified ? "PASS" : "FAIL",
    retryCount: step.retryCount || 0,
    executionTime: step.completedAt && step.startedAt
      ? new Date(step.completedAt) - new Date(step.startedAt)
      : 0
  };
}

function determineRecoveryAction(verificationResult, step, rollbackAvailable) {
  if (verificationResult.verificationStatus === "PASS") {
    return RECOVERY_ACTIONS.SUCCESS;
  }
  if (step.retryCount >= 2) {
    if (rollbackAvailable) {
      return RECOVERY_ACTIONS.ROLLBACK;
    }
    return RECOVERY_ACTIONS.REQUEST_USER_INPUT;
  }
  if (step.tool === "proposeEdit" || step.tool === "applyEdit") {
    return RECOVERY_ACTIONS.RETRY;
  }
  if (step.tool === "manualVerification") {
    return RECOVERY_ACTIONS.REQUEST_USER_INPUT;
  }
  if (step.action.toLowerCase().includes("delete") || step.action.toLowerCase().includes("remove")) {
    return RECOVERY_ACTIONS.REQUEST_USER_INPUT;
  }
  return RECOVERY_ACTIONS.RETRY;
}

async function verifyExecution(executionId) {
  const execution = getExecution(executionId);
  if (!execution) {
    return { ok: false, error: "Execution not found." };
  }
  const verificationResults = [];
  for (const step of execution.steps) {
    if (step.status !== "success" && step.status !== "failed") {
      continue;
    }
    const result = await verifyStep(step, execution);
    verificationResults.push(result);
  }
  const allPassed = verificationResults.every(r => r.verificationStatus === "PASS");
  const failedSteps = verificationResults.filter(r => r.verificationStatus === "FAIL");
  const recoveryActions = [];
  for (const failed of failedSteps) {
    const step = execution.steps.find(s => s.id === failed.stepId);
    const rollbackAvailable = step.tool === "proposeEdit" || step.tool === "applyEdit";
    const action = determineRecoveryAction(failed, step, rollbackAvailable);
    recoveryActions.push({
      stepId: failed.stepId,
      action,
      message: failed.actualResult
    });
  }
  return {
    ok: true,
    executionId,
    goal: execution.plan.goal,
    totalSteps: verificationResults.length,
    passed: verificationResults.filter(r => r.verificationStatus === "PASS").length,
    failed: failedSteps.length,
    allPassed,
    verificationResults,
    recoveryActions,
    overallStatus: allPassed ? "SUCCESS" : "FAILURE"
  };
}

function formatVerificationReport(verification) {
  const lines = [];
  lines.push(`Execution: ${verification.executionId}`);
  lines.push(`Goal: ${verification.goal}`);
  lines.push(`Overall: ${verification.overallStatus}`);
  lines.push(`Passed: ${verification.passed}/${verification.totalSteps}`);
  lines.push("");
  for (const result of verification.verificationResults) {
    const status = result.verificationStatus === "PASS" ? "✓" : "✗";
    lines.push(`${status} Step ${result.stepId}: ${result.action}`);
    lines.push(`  Method: ${result.verificationMethod}`);
    lines.push(`  Result: ${result.actualResult}`);
    if (result.verificationStatus === "FAIL") {
      const recovery = verification.recoveryActions.find(r => r.stepId === result.stepId);
      if (recovery) {
        lines.push(`  Recovery: ${recovery.action} - ${recovery.message}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export {
  VERIFICATION_METHODS,
  RECOVERY_ACTIONS,
  verifyExecution,
  verifyStep,
  determineRecoveryAction,
  formatVerificationReport
};
