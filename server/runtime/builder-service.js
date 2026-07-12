import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfiguredValue, getStoredConnectionConfig } from "./connections.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");
const builderRoot = path.join(root, "vendor", "open-agent-builder");
const builderPort = Number(process.env.HERMES_BUILDER_PORT || 3100);
const builderUrl = process.env.HERMES_ORIGINAL_BUILDER_URL || `http://127.0.0.1:${builderPort}`;
const REQUIRED_BUILDER_ENV = [
  "NEXT_PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_JWT_ISSUER_DOMAIN"
];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPackage() {
  const packagePath = path.join(builderRoot, "package.json");
  const raw = await fs.readFile(packagePath, "utf8");
  return JSON.parse(raw);
}

async function isLive() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`${builderUrl}/?view=builder`, {
      method: "HEAD",
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function getBuilderUrl() {
  return builderUrl;
}

export async function getBuilderStatus() {
  const stored = await getStoredConnectionConfig();
  const [sourcePresent, dependenciesInstalled, upstreamFilePresent, live] = await Promise.all([
    exists(path.join(builderRoot, "package.json")),
    exists(path.join(builderRoot, "node_modules", "next", "package.json")),
    exists(path.join(builderRoot, "UPSTREAM.md")),
    isLive()
  ]);

  let packageName = "open-agent-builder";
  let packageVersion = null;
  if (sourcePresent) {
    const manifest = await readPackage();
    packageName = manifest.name || packageName;
    packageVersion = manifest.version || null;
  }
  const missingConfig = REQUIRED_BUILDER_ENV.filter((key) => !getConfiguredValue(stored, "firecrawl-builder", key));
  const readyToBoot = sourcePresent && dependenciesInstalled && missingConfig.length === 0;

  return {
    id: "firecrawl-open-agent-builder",
    label: "Open Agent Builder",
    source: "vendor/open-agent-builder",
    upstream: "https://github.com/firecrawl/open-agent-builder",
    upstreamCommit: "be856e57f8126e90915c898f473dc94fbaefc945",
    packageName,
    packageVersion,
    url: builderUrl,
    proxiedUrl: "/agent-builder-source/?view=builder",
    sourcePresent,
    dependenciesInstalled,
    upstreamFilePresent,
    live,
    requiredConfig: REQUIRED_BUILDER_ENV,
    missingConfig,
    readyToBoot,
    status: !sourcePresent
      ? "missing_source"
      : !dependenciesInstalled
        ? "needs_install"
        : missingConfig.length
          ? "ready_to_configure"
          : live
            ? "running"
            : "stopped",
    installCommand: "npm run builder:install",
    startCommand: "npm run builder:start",
    theme: "Hermes purple CSS override only",
    resetPolicy: "upstream source plus isolated purple theme; no Hermes demo workflow modifications"
  };
}
