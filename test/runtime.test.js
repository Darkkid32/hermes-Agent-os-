import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getBuilderStatus } from "../server/runtime/builder-service.js";
import { configureConnection, getConnections } from "../server/runtime/connections.js";
import { auditExportDirectory } from "../server/runtime/exporter.js";
import { prepareInstall } from "../server/runtime/installers.js";
import { getModuleLogs, getModules, getOsAudit, getOsStatus, runModule, testModule } from "../server/runtime/modules.js";
import { createSelfModuleItem, getSelfModuleState } from "../server/runtime/self-modules.js";
import { getWorkflow, listWorkflows, runWorkflow } from "../server/runtime/workflows.js";

async function withTempRuntime(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hermes-agent-os-test-"));
  const previous = process.env.HERMES_AGENT_OS_HOME;
  process.env.HERMES_AGENT_OS_HOME = dir;
  try {
    await fn(dir);
  } finally {
    if (previous == null) delete process.env.HERMES_AGENT_OS_HOME;
    else process.env.HERMES_AGENT_OS_HOME = previous;
    await rm(dir, { recursive: true, force: true });
  }
}

test("module registry exposes every dashboard module with sanitized fields", async () => {
  await withTempRuntime(async () => {
    const modules = await getModules();
    const ids = modules.map((module) => module.id);
    for (const id of [
      "claude",
      "openclaw",
      "openclaude",
      "hermes",
      "gemini",
      "codex",
      "opencode",
      "free-claude-code",
      "firecrawl-builder",
      "elizaos-runtime",
      "provider-anthropic",
      "provider-openai",
      "provider-gemini",
      "provider-openrouter",
      "provider-ollama",
      "provider-minimax",
      "provider-firecrawl",
      "provider-convex",
      "provider-clerk",
      "goals",
      "seo",
      "video",
      "notebook",
      "kanban",
      "usage-credits"
    ]) {
      assert.ok(ids.includes(id), `missing module ${id}`);
    }
    for (const module of modules) {
      assert.ok(module.publicSummary);
      assert.equal(Object.hasOwn(module, "path"), false);
      assert.equal(Object.hasOwn(module, "env"), false);
      assert.ok(["connected", "ready_to_configure", "missing_dependency", "error", "disabled"].includes(module.status));
    }
  });
});

test("installer recipes are dry-run by default and expose real commands", async () => {
  const claude = await prepareInstall("claude");
  assert.equal(claude.ok, true);
  assert.equal(claude.mode, "dry_run");
  assert.equal(claude.recipe.command, "npm install -g @anthropic-ai/claude-code");

  const openclaude = await prepareInstall("openclaude");
  assert.equal(openclaude.ok, true);
  assert.equal(openclaude.mode, "manual");
  assert.equal(openclaude.recipe.command, "");
});

test("provider modules expose LLM connection fields without fake connected status", async () => {
  await withTempRuntime(async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const modules = await getModules();
    for (const id of ["provider-anthropic", "provider-openai", "provider-gemini", "provider-openrouter"]) {
      const module = modules.find((item) => item.id === id);
      assert.equal(module?.status, "ready_to_configure", `${id} should wait for user config`);
      assert.ok(module?.configKeys.length);
    }
  });
});

test("MiniMax M3 follows provider-minimax configuration", async () => {
  await withTempRuntime(async () => {
    await configureConnection("provider-minimax", { MINIMAX_API_KEY: "placeholder-minimax-key" });
    const modules = await getModules();
    assert.equal(modules.find((module) => module.id === "provider-minimax")?.status, "connected");
    assert.equal(modules.find((module) => module.id === "minimax")?.status, "connected");
  });
});

test("Firecrawl builder requires Convex, Clerk, and Firecrawl keys", async () => {
  await withTempRuntime(async () => {
    await configureConnection("firecrawl-builder", { FIRECRAWL_API_KEY: "placeholder-firecrawl-key" });
    let modules = await getModules();
    let builder = modules.find((module) => module.id === "firecrawl-builder");
    assert.equal(builder?.status, "ready_to_configure");
    assert.ok(builder?.missing.includes("NEXT_PUBLIC_CONVEX_URL"));
    assert.ok(builder?.missing.includes("CLERK_SECRET_KEY"));

    await configureConnection("provider-convex", { NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud" });
    await configureConnection("provider-clerk", {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_placeholder",
      CLERK_SECRET_KEY: "placeholder-clerk-secret",
      CLERK_JWT_ISSUER_DOMAIN: "https://example.clerk.accounts.dev"
    });
    modules = await getModules();
    builder = modules.find((module) => module.id === "firecrawl-builder");
    assert.equal(builder?.status, "connected");
    assert.deepEqual(builder?.missing, []);
  });
});

test("elizaOS core is a real loadable runtime foundation", async () => {
  await withTempRuntime(async () => {
    const status = await getOsStatus();
    assert.match(status.runtimeFoundation, /elizaOS core/);
    assert.equal(status.elizaOS.ok, true);
    assert.equal(status.elizaOS.packageName, "@elizaos/core");
    assert.ok(status.elizaOS.exports.includes("AgentRuntime"));
  });
});

test("local self modules are backed by the Agent OS store", async () => {
  await withTempRuntime(async () => {
    const modules = await getModules();
    for (const id of ["goals", "seo", "video", "notebook", "kanban", "usage-credits"]) {
      const module = modules.find((item) => item.id === id);
      assert.equal(module?.status, "connected", `${id} should be a real local app`);
      assert.equal(module?.configured, true);
      assert.deepEqual(module?.missing, []);
    }

    let goals = await getSelfModuleState("goals");
    assert.equal(goals.items.length, 0);
    goals = await createSelfModuleItem("goals", { title: "Ship real modules", notes: "Local store test" });
    assert.equal(goals.items.length, 1);
    assert.equal(goals.summary.byStatus.open, 1);

    const notebook = await createSelfModuleItem("notebook", { title: "Runtime note", body: "Private local note" });
    assert.equal(notebook.items[0].body, "Private local note");

    const seo = await createSelfModuleItem("seo", {
      title: "Homepage audit",
      url: "https://example.com",
      keyword: "agent os"
    });
    assert.equal(seo.items[0].keyword, "agent os");
    assert.equal(seo.summary.byStatus.planned, 1);

    const video = await createSelfModuleItem("video", {
      title: "Caption short",
      sourcePath: "/tmp/source.mp4",
      workflow: "native captions"
    });
    assert.equal(video.items[0].workflow, "native captions");
    assert.equal(video.summary.byStatus.queued, 1);

    const kanban = await createSelfModuleItem("kanban", { title: "Wire UI", column: "doing" });
    assert.equal(kanban.summary.byColumn.doing, 1);

    const usage = await createSelfModuleItem("usage-credits", {
      title: "OpenAI run",
      provider: "openai",
      units: 1200,
      estimatedCost: 0.012
    });
    assert.equal(usage.summary.usage.units, 1200);
    assert.equal(usage.summary.usage.estimatedCost, 0.012);
  });
});

test("module logs are real local events, not placeholder text", async () => {
  await withTempRuntime(async () => {
    await testModule("goals");
    const run = await runModule("goals", { trigger: "test" });
    assert.equal(run.mode, "local_app");
    await createSelfModuleItem("goals", { title: "Logged goal" });

    const logs = await getModuleLogs("goals");
    assert.ok(logs.logs.length >= 3);
    assert.ok(logs.logs.some((entry) => entry.message === "Module health checked"));
    assert.ok(logs.logs.some((entry) => entry.message === "Local module run requested"));
    assert.equal(JSON.stringify(logs).includes("Module logs are stored locally"), false);

    await configureConnection("provider-openai", { OPENAI_API_KEY: "placeholder-secret-value" });
    const providerLogs = await getModuleLogs("provider-openai");
    assert.ok(providerLogs.logs.some((entry) => entry.message === "Connection configuration saved"));
    assert.equal(JSON.stringify(providerLogs).includes("placeholder-secret-value"), false);
  });
});

test("OpenClaude does not claim connected status without a real local CLI", async () => {
  await withTempRuntime(async () => {
    const modules = await getModules();
    assert.equal(modules.find((module) => module.id === "openclaude")?.status, "missing_dependency");
  });
});

test("OS status uses public runtime paths and no local home path", async () => {
  await withTempRuntime(async () => {
    const status = await getOsStatus();
    assert.equal(status.service, "hermes-agent-os-runtime");
    assert.equal(status.store.config, "~/.hermes-agent-os/config");
    assert.equal(JSON.stringify(status).includes(os.homedir()), false);
  });
});

test("module run endpoint dry-runs by default", async () => {
  await withTempRuntime(async () => {
    delete process.env.HERMES_AGENT_OS_ENABLE_EXEC;
    const result = await runModule("claude", { message: "hello" });
    assert.equal(result.ok, true);
    assert.equal(result.mode, "dry_run");
  });
});

test("module run uses configured CLI path when execution is enabled", async () => {
  await withTempRuntime(async (dir) => {
    const script = path.join(dir, "codex-test-cli.sh");
    await writeFile(script, "#!/bin/sh\necho configured-codex-path:$1\n");
    await chmod(script, 0o755);
    await configureConnection("codex", { CODEX_CLI_PATH: script });
    const previous = process.env.HERMES_AGENT_OS_ENABLE_EXEC;
    process.env.HERMES_AGENT_OS_ENABLE_EXEC = "1";
    try {
      const result = await runModule("codex", { message: "hello" });
      assert.equal(result.ok, true);
      assert.equal(result.mode, "executed");
      assert.match(result.reply, /configured-codex-path:hello/);
    } finally {
      if (previous == null) delete process.env.HERMES_AGENT_OS_ENABLE_EXEC;
      else process.env.HERMES_AGENT_OS_ENABLE_EXEC = previous;
    }
  });
});

test("OS audit lists module fixes without leaking local paths", async () => {
  await withTempRuntime(async () => {
    const audit = await getOsAudit();
    assert.equal(audit.summary.total > 0, true);
    assert.ok(audit.items.find((item) => item.id === "firecrawl-builder"));
    assert.ok(audit.items.every((item) => ["ok", "setup", "action_required"].includes(item.severity)));
    const builderFix = audit.items.find((item) => item.id === "firecrawl-builder")?.fix || "";
    assert.match(builderFix, /NEXT_PUBLIC_CONVEX_URL/);
    assert.doesNotMatch(builderFix, /ANTHROPIC_API_KEY/);
    assert.equal(JSON.stringify(audit).includes(os.homedir()), false);
  });
});

test("Open Agent Builder workflow default is blank and upstream-clean", async () => {
  await withTempRuntime(async () => {
    delete process.env.FIRECRAWL_API_KEY;
    const workflows = await listWorkflows();
    assert.ok(workflows.find((workflow) => workflow.id === "blank-open-agent-builder"));
    assert.equal(workflows.find((workflow) => workflow.id === "sample-lead-intake"), undefined);
    const workflow = await getWorkflow("blank-open-agent-builder");
    assert.equal(workflow.name, "Blank Open Agent Builder Workflow");
    assert.deepEqual(workflow.nodes.map((node) => node.label), ["Start"]);
    const run = await runWorkflow("blank-open-agent-builder", { trigger: "test" });
    assert.equal(run.status, "completed");
  });
});

test("builder status points at vendored upstream source without local secrets", async () => {
  const status = await getBuilderStatus();
  assert.equal(status.source, "vendor/open-agent-builder");
  assert.equal(status.upstream, "https://github.com/firecrawl/open-agent-builder");
  assert.equal(status.upstreamFilePresent, true);
  assert.equal(JSON.stringify(status).includes(os.homedir()), false);
});

test("connections return templates without secret values", async () => {
  await withTempRuntime(async () => {
    const connections = await getConnections();
    assert.ok(connections.templates.find((template) => template.id === "firecrawl-builder"));
    assert.ok(connections.templates.find((template) => template.id === "provider-anthropic"));
    assert.ok(connections.templates.find((template) => template.id === "provider-clerk"));
    assert.equal(JSON.stringify(connections).includes("sk-"), false);
  });
});

test("export audit catches secrets and local paths", async () => {
  await withTempRuntime(async (dir) => {
    const file = path.join(dir, "bad.txt");
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(file, `OPENAI_API_KEY=${"sk"}-testbadbadbadbad\n${os.homedir()}\n`)
    );
    const audit = await auditExportDirectory(dir);
    assert.equal(audit.ok, false);
    assert.ok(audit.findings.length >= 2);
  });
});
