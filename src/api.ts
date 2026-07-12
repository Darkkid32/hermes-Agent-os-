import type {
  BuilderStatus,
  ConnectionsResponse,
  Health,
  InstallResult,
  IntegrationSnapshot,
  OsAudit,
  OsStatus,
  RuntimeModule,
  SelfModuleState,
  WorkflowRun,
  WorkflowSummary
} from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function getHealth() {
  return request<Health>("/api/health");
}

export async function getRuntimeSnapshot(): Promise<IntegrationSnapshot> {
  const [osStatus, moduleData] = await Promise.all([
    request<OsStatus>("/api/os/status"),
    request<{ modules: RuntimeModule[] }>("/api/modules")
  ]);
  return {
    generatedAt: osStatus.generatedAt,
    host: osStatus.host,
    mode: osStatus.mode,
    publicUrl: osStatus.publicUrl,
    githubRepo: osStatus.githubRepo,
    integrations: moduleData.modules,
    directories: Object.entries(osStatus.store || {}).map(([label, path]) => ({ label, path, exists: true })),
    flow: ["Firecrawl Builder", "Module Registry", "Model Routing", "Workflows", "Local Store", "Export Audit"],
    osStatus
  };
}

export function getIntegrations() {
  return getRuntimeSnapshot();
}

export function getOsAudit() {
  return request<OsAudit>("/api/os/audit");
}

export function testIntegration(id: string) {
  return request<{ ok: boolean; message: string; details: unknown }>(`/api/modules/${id}/test`, {
    method: "POST",
    body: "{}"
  });
}

export function sendAgentMessage(id: string, message: string) {
  return request<{ ok: boolean; mode: string; reply: string; plannedCommand?: string }>(
    `/api/modules/${id}/run`,
    {
      method: "POST",
      body: JSON.stringify({ message })
    }
  );
}

export function getWorkflows() {
  return request<{ workflows: WorkflowSummary[] }>("/api/workflows");
}

export function runWorkflow(id: string) {
  return request<WorkflowRun>(`/api/workflows/${id}/run`, {
    method: "POST",
    body: JSON.stringify({ trigger: "dashboard" })
  });
}

export function getBuilderStatus() {
  return request<BuilderStatus>("/api/builder/status");
}

export function getConnections() {
  return request<ConnectionsResponse>("/api/connections");
}

export function configureConnection(id: string, fields: Record<string, string>) {
  return request<{ ok: boolean; id: string; configuredFields: string[]; details: unknown }>(
    `/api/connections/${id}/configure`,
    {
      method: "POST",
      body: JSON.stringify({ fields })
    }
  );
}

export function installModule(id: string, execute = false) {
  return request<InstallResult>(`/api/modules/${id}/install`, {
    method: "POST",
    body: JSON.stringify({ execute })
  });
}

export function getSelfModule(id: string) {
  return request<SelfModuleState>(`/api/self/${id}`);
}

export function createSelfModuleItem(id: string, payload: Record<string, string | number | string[]>) {
  return request<SelfModuleState>(`/api/self/${id}/items`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
