import type { BusinessAgent } from "./BusinessAgent";
import type { BrainPlan } from "./HermesBrain";
import type { HermesState } from "./IntegrationManager";
import { addEvent, type Timeline } from "./TimelineService";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "deferred";

export interface ApprovalRequest {
  id: string;
  taskId: string;
  risk: RiskLevel;
  status: ApprovalStatus;
  agent: BusinessAgent;
  plan: BrainPlan;
  state: HermesState;
  createdAt: number;
  resolvedAt: number | null;
  resolvedBy: string | null;
  reason: string | null;
  estimatedDuration: string;
  modulesAffected: string[];
  permissionsRequired: string[];
}

export interface AuditEntry {
  id: string;
  approvalId: string;
  action: "requested" | "approved" | "rejected" | "deferred" | "executed" | "completed" | "failed";
  timestamp: number;
  risk: RiskLevel;
  agentName: string;
  user: string;
  reason: string | null;
  workspaceId: string | null;
}

type ApprovalListener = (approvals: ApprovalRequest[]) => void;

let approvalCounter = 0;
let auditCounter = 0;
const approvalListeners: Set<ApprovalListener> = new Set();
const pendingApprovals: Map<string, ApprovalRequest> = new Map();
const resolvedApprovals: Map<string, ApprovalRequest> = new Map();
const auditLog: AuditEntry[] = [];

function nextApprovalId(): string {
  return `approval-${Date.now()}-${++approvalCounter}`;
}

function nextAuditId(): string {
  return `audit-${Date.now()}-${++auditCounter}`;
}

function emitApprovals(): void {
  const all = [...pendingApprovals.values(), ...resolvedApprovals.values()]
    .sort((a, b) => b.createdAt - a.createdAt);
  for (const fn of approvalListeners) {
    fn(all);
  }
}

export function onApprovalUpdate(fn: ApprovalListener): () => void {
  approvalListeners.add(fn);
  return () => { approvalListeners.delete(fn); };
}

export function getPendingApprovals(): ApprovalRequest[] {
  return [...pendingApprovals.values()].sort((a, b) => {
    const riskOrder: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return riskOrder[a.risk] - riskOrder[b.risk] || b.createdAt - a.createdAt;
  });
}

export function getAllApprovals(): ApprovalRequest[] {
  return [...pendingApprovals.values(), ...resolvedApprovals.values()]
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getApproval(id: string): ApprovalRequest | undefined {
  return pendingApprovals.get(id) || resolvedApprovals.get(id);
}

export function getAuditLog(): AuditEntry[] {
  return [...auditLog].sort((a, b) => b.timestamp - a.timestamp);
}

export function getApprovalStats(): {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  avgApprovalTime: number;
  total: number;
} {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const all = [...pendingApprovals.values(), ...resolvedApprovals.values()];
  const pending = pendingApprovals.size;

  const approvedToday = all.filter((a) =>
    a.status === "approved" && a.resolvedAt && a.resolvedAt >= todayMs
  ).length;

  const rejectedToday = all.filter((a) =>
    a.status === "rejected" && a.resolvedAt && a.resolvedAt >= todayMs
  ).length;

  const resolved = all.filter((a) => a.resolvedAt && a.createdAt);
  const avgApprovalTime = resolved.length > 0
    ? resolved.reduce((sum, a) => sum + ((a.resolvedAt || 0) - a.createdAt), 0) / resolved.length
    : 0;

  return {
    pending,
    approvedToday,
    rejectedToday,
    avgApprovalTime: Math.round(avgApprovalTime),
    total: all.length
  };
}

function addAuditEntry(
  approvalId: string,
  action: AuditEntry["action"],
  risk: RiskLevel,
  agentName: string,
  reason: string | null,
  workspaceId: string | null
): void {
  const entry: AuditEntry = {
    id: nextAuditId(),
    approvalId,
    action,
    timestamp: Date.now(),
    risk,
    agentName,
    user: "user",
    reason,
    workspaceId
  };
  auditLog.push(entry);
}

function estimateDuration(plan: BrainPlan): string {
  if (plan.complexityScore < 30) return "< 30s";
  if (plan.complexityScore < 60) return "1-2 min";
  if (plan.complexityScore < 80) return "3-5 min";
  return "5-10 min";
}

function getModulesAffected(plan: BrainPlan): string[] {
  return plan.modules.map((m) => m.module);
}

function getPermissionsRequired(agent: BusinessAgent): string[] {
  return [...agent.permissions];
}

export function classifyRisk(plan: BrainPlan, agent: BusinessAgent): RiskLevel {
  const intent = plan.intent;
  const complexity = plan.complexityScore;
  const prompt = plan.goal.toLowerCase();

  if (
    prompt.includes("deploy") ||
    prompt.includes("production") ||
    prompt.includes("database migration") ||
    prompt.includes("financial") ||
    prompt.includes("payment") ||
    prompt.includes("delete") ||
    prompt.includes("remove") ||
    (intent === "automation" && complexity > 70)
  ) {
    return "critical";
  }

  if (
    prompt.includes("execute") ||
    prompt.includes("run command") ||
    prompt.includes("cli") ||
    prompt.includes("shell") ||
    prompt.includes("automation") ||
    prompt.includes("write code") ||
    prompt.includes("modify") ||
    prompt.includes("generate") ||
    intent === "software_project" ||
    intent === "automation" ||
    complexity > 50
  ) {
    return "high";
  }

  if (
    prompt.includes("write") ||
    prompt.includes("create") ||
    prompt.includes("update") ||
    prompt.includes("summarize") ||
    prompt.includes("workflow") ||
    intent === "content_creation" ||
    intent === "research" ||
    complexity > 25
  ) {
    return "medium";
  }

  return "low";
}

export function shouldAutoExecute(risk: RiskLevel): boolean {
  return risk === "low";
}

export function requiresConfirmation(risk: RiskLevel): boolean {
  return risk === "critical";
}

export function createApprovalRequest(
  taskId: string,
  plan: BrainPlan,
  agent: BusinessAgent,
  state: HermesState
): ApprovalRequest {
  const risk = classifyRisk(plan, agent);
  const id = nextApprovalId();

  const request: ApprovalRequest = {
    id,
    taskId,
    risk,
    status: "pending",
    agent,
    plan,
    state,
    createdAt: Date.now(),
    resolvedAt: null,
    resolvedBy: null,
    reason: null,
    estimatedDuration: estimateDuration(plan),
    modulesAffected: getModulesAffected(plan),
    permissionsRequired: getPermissionsRequired(agent)
  };

  pendingApprovals.set(id, request);
  addAuditEntry(id, "requested", risk, agent.name, null, state.workspace?.id || null);
  emitApprovals();

  return request;
}

export function approveTask(approvalId: string, reason?: string): boolean {
  const request = pendingApprovals.get(approvalId);
  if (!request) return false;

  request.status = "approved";
  request.resolvedAt = Date.now();
  request.resolvedBy = "user";
  request.reason = reason || "Approved by user";

  resolvedApprovals.set(approvalId, request);
  pendingApprovals.delete(approvalId);

  addAuditEntry(approvalId, "approved", request.risk, request.agent.name, request.reason, request.state.workspace?.id || null);
  emitApprovals();

  return true;
}

export function rejectTask(approvalId: string, reason?: string): boolean {
  const request = pendingApprovals.get(approvalId);
  if (!request) return false;

  request.status = "rejected";
  request.resolvedAt = Date.now();
  request.resolvedBy = "user";
  request.reason = reason || "Rejected by user";

  resolvedApprovals.set(approvalId, request);
  pendingApprovals.delete(approvalId);

  addAuditEntry(approvalId, "rejected", request.risk, request.agent.name, request.reason, request.state.workspace?.id || null);
  emitApprovals();

  return true;
}

export function deferTask(approvalId: string, reason?: string): boolean {
  const request = pendingApprovals.get(approvalId);
  if (!request) return false;

  request.status = "deferred";
  request.resolvedAt = Date.now();
  request.resolvedBy = "user";
  request.reason = reason || "Deferred by user";

  resolvedApprovals.set(approvalId, request);
  pendingApprovals.delete(approvalId);

  addAuditEntry(approvalId, "deferred", request.risk, request.agent.name, request.reason, request.state.workspace?.id || null);
  emitApprovals();

  return true;
}

export function cancelApproval(approvalId: string): boolean {
  const request = pendingApprovals.get(approvalId);
  if (!request) return false;

  pendingApprovals.delete(approvalId);
  resolvedApprovals.set(approvalId, { ...request, status: "rejected", resolvedAt: Date.now(), reason: "Cancelled" });
  emitApprovals();

  return true;
}

export function markExecuted(approvalId: string): void {
  const request = resolvedApprovals.get(approvalId) || pendingApprovals.get(approvalId);
  if (!request) return;
  addAuditEntry(approvalId, "executed", request.risk, request.agent.name, null, request.state.workspace?.id || null);
}

export function markCompleted(approvalId: string): void {
  const request = resolvedApprovals.get(approvalId) || pendingApprovals.get(approvalId);
  if (!request) return;
  addAuditEntry(approvalId, "completed", request.risk, request.agent.name, null, request.state.workspace?.id || null);
}

export function markFailed(approvalId: string, reason: string): void {
  const request = resolvedApprovals.get(approvalId) || pendingApprovals.get(approvalId);
  if (!request) return;
  addAuditEntry(approvalId, "failed", request.risk, request.agent.name, reason, request.state.workspace?.id || null);
}

export function resetApprovals(): void {
  pendingApprovals.clear();
  resolvedApprovals.clear();
  auditLog.length = 0;
  approvalCounter = 0;
  auditCounter = 0;
  emitApprovals();
}
