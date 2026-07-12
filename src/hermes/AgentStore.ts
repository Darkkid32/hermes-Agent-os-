import type { BusinessAgent } from "./BusinessAgent";
import { getDefaultAgents, isDefaultAgent } from "./DefaultAgents";

const STORAGE_KEY = "hermes-business-agents";
const SEEDED_KEY = "hermes-agents-seeded";

type AgentListener = (agents: BusinessAgent[]) => void;

const listeners: Set<AgentListener> = new Set();

function emit(agents: BusinessAgent[]): void {
  for (const fn of listeners) {
    fn(agents);
  }
}

function seedDefaults(): BusinessAgent[] {
  const agents = getDefaultAgents();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  localStorage.setItem(SEEDED_KEY, "true");
  return agents;
}

export function loadAgents(): BusinessAgent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return seedDefaults();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return seedDefaults();
    }
    if (parsed.length === 0 && !localStorage.getItem(SEEDED_KEY)) {
      return seedDefaults();
    }
    return parsed;
  } catch {
    return seedDefaults();
  }
}

export function saveAgents(agents: BusinessAgent[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  emit(agents);
}

export function addAgent(agent: BusinessAgent): BusinessAgent[] {
  const agents = loadAgents();
  agents.push(agent);
  saveAgents(agents);
  return agents;
}

export function updateAgent(updated: BusinessAgent): BusinessAgent[] {
  const agents = loadAgents();
  const idx = agents.findIndex((a) => a.id === updated.id);
  if (idx !== -1) {
    agents[idx] = { ...updated, updatedAt: Date.now() };
  } else {
    agents.push(updated);
  }
  saveAgents(agents);
  return agents;
}

export function deleteAgent(id: string): BusinessAgent[] {
  const agents = loadAgents().filter((a) => a.id !== id);
  saveAgents(agents);
  return agents;
}

export function duplicateAgent(agent: BusinessAgent): BusinessAgent[] {
  const dup: BusinessAgent = {
    ...agent,
    id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `${agent.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  return addAgent(dup);
}

export function getAgent(id: string): BusinessAgent | null {
  return loadAgents().find((a) => a.id === id) || null;
}

export function exportAgents(): string {
  const agents = loadAgents();
  return JSON.stringify(agents, null, 2);
}

export function importAgents(json: string): { success: boolean; message: string; agents: BusinessAgent[] } {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return { success: false, message: "Invalid format: expected JSON array.", agents: loadAgents() };
    }

    const existing = loadAgents();
    const existingIds = new Set(existing.map((a) => a.id));
    const existingNames = new Set(existing.map((a) => a.name.toLowerCase()));

    let imported = 0;
    let skipped = 0;

    for (const item of parsed) {
      if (!item.id || !item.name) {
        skipped++;
        continue;
      }
      if (existingIds.has(item.id)) {
        skipped++;
        continue;
      }
      if (existingNames.has(item.name.toLowerCase())) {
        skipped++;
        continue;
      }
      existing.push({
        ...item,
        createdAt: item.createdAt || Date.now(),
        updatedAt: Date.now()
      });
      existingIds.add(item.id);
      existingNames.add(item.name.toLowerCase());
      imported++;
    }

    saveAgents(existing);
    return {
      success: true,
      message: `Imported ${imported} agent(s). ${skipped} skipped.`,
      agents: existing
    };
  } catch {
    return { success: false, message: "Invalid JSON.", agents: loadAgents() };
  }
}

export function resetAgents(): BusinessAgent[] {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SEEDED_KEY);
  return seedDefaults();
}

export function validateAgent(agent: BusinessAgent, existing: BusinessAgent[]): string | null {
  if (!agent.name.trim()) return "Agent name is required.";
  if (agent.name.length > 60) return "Agent name must be 60 characters or less.";

  const dupName = existing.find(
    (a) => a.id !== agent.id && a.name.toLowerCase() === agent.name.toLowerCase()
  );
  if (dupName) return `An agent named "${dupName.name}" already exists.`;

  const validEngines = ["claude", "gemini", "codex", "openclaw", "opencode", "free-claude-code"];
  if (!validEngines.includes(agent.executionEngine)) return "Invalid execution engine.";

  if (agent.capabilities.length === 0) return "At least one capability is required.";
  if (agent.enabledModules.length === 0) return "At least one enabled module is required.";
  if (agent.permissions.length === 0) return "At least one permission is required.";

  return null;
}

export function subscribeAgents(fn: AgentListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
