export type ModuleStatus =
  | "connected"
  | "ready_to_configure"
  | "missing_dependency"
  | "error"
  | "disabled"
  | string;

export interface RuntimeModule {
  id: string;
  label: string;
  category: string;
  type: string;
  status: ModuleStatus;
  capabilities: string[];
  configured: boolean;
  missing: string[];
  lastChecked: string;
  actions: string[];
  publicSummary: string;
  connection: string;
  version?: string | null;
  profile?: string | null;
  profileCount?: number;
  onlineProfiles?: number;
  stats?: Record<string, unknown>;
  configKeys?: string[];
  installHint?: string;
  installCommand?: string;
  installMode?: string;
  docsUrl?: string;
  [key: string]: unknown;
}

export type Integration = RuntimeModule;

export interface OsStatus {
  ok: boolean;
  service: string;
  version: string;
  mode: string;
  runtimeFoundation: string;
  builderFoundation: string;
  generatedAt: string;
  host: string;
  store: Record<string, string>;
  publicUrl: string | null;
  githubRepo: string | null;
  moduleCount: number;
  connectedCount: number;
  elizaOS?: {
    ok: boolean;
    packageName: string;
    version: string | null;
    exports: string[];
    missingExports: string[];
    runtimeClass: string | null;
    source: string;
  };
}

export interface IntegrationSnapshot {
  generatedAt: string;
  host: string;
  mode: string;
  publicUrl: string | null;
  githubRepo: string | null;
  integrations: RuntimeModule[];
  directories: Array<{ label: string; path: string; exists: boolean }>;
  flow: string[];
  osStatus?: OsStatus;
}

export interface OsAuditItem {
  id: string;
  label: string;
  category: string;
  type: string;
  status: string;
  configured: boolean;
  missing: string[];
  severity: "ok" | "setup" | "action_required" | string;
  fix: string;
  docsUrl: string;
  actions: string[];
}

export interface OsAudit {
  generatedAt: string;
  summary: {
    total: number;
    ok: number;
    setup: number;
    actionRequired: number;
  };
  items: OsAuditItem[];
}

export interface Health {
  ok: boolean;
  service: string;
  version: string;
  mode: string;
  timestamp: string;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  draft: boolean;
  nodeCount: number;
  updatedAt: string | null;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: string;
  nodeRuns: Array<{
    nodeId: string;
    label: string;
    type: string;
    status: string;
    message: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface BuilderStatus {
  id: string;
  label: string;
  source: string;
  upstream: string;
  upstreamCommit: string;
  packageName: string;
  packageVersion: string | null;
  url: string;
  proxiedUrl: string;
  sourcePresent: boolean;
  dependenciesInstalled: boolean;
  upstreamFilePresent: boolean;
  live: boolean;
  status: "missing_source" | "needs_install" | "stopped" | "running" | string;
  installCommand: string;
  startCommand: string;
  theme: string;
  resetPolicy: string;
}

export interface ConnectionTemplate {
  id: string;
  label: string;
  fields: string[];
  notes: string;
  configuredFields: string[];
}

export interface ConnectionsResponse {
  templates: ConnectionTemplate[];
}

export interface InstallResult {
  ok: boolean;
  id: string;
  mode: "dry_run" | "manual" | "executed" | "not_found" | string;
  message: string;
  recipe?: {
    id: string;
    label: string;
    command: string;
    docsUrl: string;
    manager: string;
    executable?: string | null;
    safeAutoRun: boolean;
    note?: string;
  };
}

export interface SelfModuleItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status?: string;
  notes?: string;
  body?: string;
  tags?: string[];
  column?: string;
  provider?: string;
  units?: number;
  estimatedCost?: number;
  url?: string;
  keyword?: string;
  sourcePath?: string;
  workflow?: string;
}

export interface SelfModuleState {
  id: string;
  label: string;
  itemName: string;
  items: SelfModuleItem[];
  summary: {
    total: number;
    byStatus: Record<string, number>;
    byColumn: Record<string, number>;
    usage: {
      units: number;
      estimatedCost: number;
    };
  };
  updatedAt: string | null;
}
