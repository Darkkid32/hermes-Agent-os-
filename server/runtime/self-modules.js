import path from "node:path";
import { appendModuleLog } from "./module-logs.js";
import { ensureRuntimeStore, readJson, writeJson } from "./store.js";

const MODULES = {
  goals: {
    id: "goals",
    label: "Goals",
    itemName: "goal",
    emptySummary: "No goals created yet.",
    defaultStatus: "open"
  },
  notebook: {
    id: "notebook",
    label: "Notebook",
    itemName: "note",
    emptySummary: "No notes created yet."
  },
  seo: {
    id: "seo",
    label: "SEO",
    itemName: "brief",
    emptySummary: "No SEO briefs created yet.",
    defaultStatus: "planned"
  },
  video: {
    id: "video",
    label: "Video",
    itemName: "job",
    emptySummary: "No video jobs created yet.",
    defaultStatus: "queued"
  },
  kanban: {
    id: "kanban",
    label: "Kanban",
    itemName: "card",
    emptySummary: "No cards created yet.",
    defaultColumn: "todo"
  },
  "usage-credits": {
    id: "usage-credits",
    label: "Usage Credits",
    itemName: "entry",
    emptySummary: "No usage entries recorded yet."
  }
};

function now() {
  return new Date().toISOString();
}

function idFor(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isLocalSelfModule(id) {
  return Boolean(MODULES[id]);
}

export function localSelfModuleIds() {
  return Object.keys(MODULES);
}

async function fileFor(id) {
  if (!isLocalSelfModule(id)) {
    const error = new Error("self module not found");
    error.status = 404;
    throw error;
  }
  const paths = await ensureRuntimeStore();
  return path.join(paths.memory, "self-modules", `${id}.json`);
}

function initialState(id) {
  const definition = MODULES[id];
  return {
    id,
    label: definition.label,
    itemName: definition.itemName,
    items: [],
    summary: {
      total: 0,
      byStatus: {},
      byColumn: {},
      usage: {
        units: 0,
        estimatedCost: 0
      }
    },
    updatedAt: null
  };
}

function summarize(id, items) {
  const summary = {
    total: items.length,
    byStatus: {},
    byColumn: {},
    usage: {
      units: 0,
      estimatedCost: 0
    }
  };

  for (const item of items) {
    if (item.status) summary.byStatus[item.status] = (summary.byStatus[item.status] || 0) + 1;
    if (item.column) summary.byColumn[item.column] = (summary.byColumn[item.column] || 0) + 1;
    if (id === "usage-credits") {
      summary.usage.units += Number(item.units || 0);
      summary.usage.estimatedCost += Number(item.estimatedCost || 0);
    }
  }

  summary.usage.estimatedCost = Number(summary.usage.estimatedCost.toFixed(6));
  return summary;
}

function normalizeState(id, data) {
  const base = initialState(id);
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    ...base,
    items,
    summary: summarize(id, items),
    updatedAt: data?.updatedAt || null
  };
}

export async function getSelfModuleState(id) {
  const file = await fileFor(id);
  return normalizeState(id, await readJson(file, initialState(id)));
}

function cleanText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function buildItem(id, payload = {}) {
  const createdAt = now();
  const title = cleanText(payload.title, `Untitled ${MODULES[id].itemName}`);
  const common = {
    id: idFor(MODULES[id].itemName),
    title,
    createdAt,
    updatedAt: createdAt
  };

  if (id === "goals") {
    return {
      ...common,
      status: cleanText(payload.status, MODULES[id].defaultStatus),
      notes: cleanText(payload.notes || payload.body)
    };
  }

  if (id === "notebook") {
    return {
      ...common,
      body: cleanText(payload.body || payload.notes),
      tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean) : []
    };
  }

  if (id === "seo") {
    return {
      ...common,
      url: cleanText(payload.url),
      keyword: cleanText(payload.keyword),
      status: cleanText(payload.status, MODULES[id].defaultStatus),
      notes: cleanText(payload.notes || payload.body)
    };
  }

  if (id === "video") {
    return {
      ...common,
      sourcePath: cleanText(payload.sourcePath),
      workflow: cleanText(payload.workflow, "captioning"),
      status: cleanText(payload.status, MODULES[id].defaultStatus),
      notes: cleanText(payload.notes || payload.body)
    };
  }

  if (id === "kanban") {
    return {
      ...common,
      column: cleanText(payload.column, MODULES[id].defaultColumn),
      notes: cleanText(payload.notes || payload.body)
    };
  }

  if (id === "usage-credits") {
    return {
      ...common,
      provider: cleanText(payload.provider, "manual"),
      units: Number(payload.units || 0),
      estimatedCost: Number(payload.estimatedCost || payload.cost || 0),
      status: cleanText(payload.status, "recorded")
    };
  }

  return common;
}

export async function createSelfModuleItem(id, payload = {}) {
  const current = await getSelfModuleState(id);
  const item = buildItem(id, payload);
  const next = {
    ...current,
    items: [item, ...current.items],
    updatedAt: item.updatedAt
  };
  const file = await fileFor(id);
  await writeJson(file, next);
  await appendModuleLog(id, {
    message: `${MODULES[id].label} ${MODULES[id].itemName} saved`,
    details: {
      itemId: item.id,
      itemName: MODULES[id].itemName,
      summary: summarize(id, next.items)
    }
  });
  return normalizeState(id, next);
}

export async function getLocalSelfModuleStatus(id) {
  const state = await getSelfModuleState(id);
  return {
    itemCount: state.items.length,
    updatedAt: state.updatedAt,
    summary: state.summary
  };
}
