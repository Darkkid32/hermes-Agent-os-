import { promises as fs } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const PROJECT_ROOT = path.resolve(process.cwd());
const IGNORED_DIRS = ["node_modules", ".git", "dist", "vendor", ".next", "__pycache__", ".cache"];
const SECRET_PATTERNS = [/\.env$/i, /\.env\.\w+$/i, /secrets/i, /credentials/i, /private.key/i];

function isInsideProjectRoot(filePath) {
  const resolved = path.resolve(PROJECT_ROOT, filePath);
  return resolved.startsWith(PROJECT_ROOT);
}

function isSecretFile(filePath) {
  const basename = path.basename(filePath).toLowerCase();
  return SECRET_PATTERNS.some(p => p.test(basename));
}

function shouldIgnoreDir(dirName) {
  return IGNORED_DIRS.includes(dirName);
}

function detectProjectType(files) {
  const indicators = {
    node: ["package.json", "yarn.lock", "pnpm-lock.yaml"],
    react: ["jsx", "tsx"],
    vue: ["vue"],
    angular: ["angular.json"],
    nextjs: ["next.config.js", "next.config.mjs", "next.config.ts"],
    vite: ["vite.config.js", "vite.config.mjs", "vite.config.ts"],
    express: ["express"],
    fastify: ["fastify"],
    nestjs: ["nest-cli.json"],
    python: ["requirements.txt", "setup.py", "pyproject.toml", "Pipfile"],
    django: ["manage.py", "settings.py"],
    flask: ["app.py", "wsgi.py"],
    go: ["go.mod", "go.sum"],
    rust: ["Cargo.toml"],
    java: ["pom.xml", "build.gradle"],
    docker: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"],
    ci: [".github", ".gitlab-ci.yml", ".travis.yml"]
  };
  const detected = [];
  const filenames = files.map(f => path.basename(f));
  const extensions = files.map(f => path.extname(f).slice(1));
  for (const [type, patterns] of Object.entries(indicators)) {
    for (const pattern of patterns) {
      if (filenames.includes(pattern) || extensions.includes(pattern)) {
        detected.push(type);
        break;
      }
    }
  }
  return detected;
}

function detectLanguages(files) {
  const extMap = {
    ".js": "JavaScript",
    ".jsx": "JSX",
    ".ts": "TypeScript",
    ".tsx": "TSX",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".swift": "Swift",
    ".kt": "Kotlin",
    ".vue": "Vue",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".md": "Markdown",
    ".sql": "SQL",
    ".sh": "Shell",
    ".ps1": "PowerShell"
  };
  const counts = {};
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (extMap[ext]) {
      counts[extMap[ext]] = (counts[extMap[ext]] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => ({ language: lang, files: count }));
}

async function listDirectories(dirPath = ".") {
  if (!isInsideProjectRoot(path.resolve(PROJECT_ROOT, dirPath))) {
    return { ok: false, error: "Path is outside project root." };
  }
  const fullPath = path.resolve(PROJECT_ROOT, dirPath);
  try {
    const items = await fs.readdir(fullPath, { withFileTypes: true });
    const entries = items
      .filter(item => !shouldIgnoreDir(item.name))
      .map(item => ({
        name: item.name,
        type: item.isDirectory() ? "directory" : "file",
        path: path.join(dirPath, item.name)
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return { ok: true, path: dirPath, entries };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function readFileTool(filePath, options = {}) {
  if (!isInsideProjectRoot(path.resolve(PROJECT_ROOT, filePath))) {
    return { ok: false, error: "Path is outside project root." };
  }
  if (isSecretFile(filePath)) {
    return { ok: false, error: "File appears to contain secrets and is blocked." };
  }
  const fullPath = path.resolve(PROJECT_ROOT, filePath);
  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      return { ok: false, error: "Path is not a file." };
    }
    if (stat.size > 500000) {
      return { ok: false, error: "File is too large (>500KB)." };
    }
    const content = await fs.readFile(fullPath, "utf-8");
    const lines = content.split("\n");
    const start = Math.max(0, (options.startLine || 1) - 1);
    const end = Math.min(lines.length, options.endLine || lines.length);
    const sliced = lines.slice(start, end);
    return {
      ok: true,
      path: filePath,
      size: stat.size,
      totalLines: lines.length,
      startLine: start + 1,
      endLine: end,
      content: sliced.join("\n")
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function searchFilenames(pattern, dirPath = ".") {
  if (!isInsideProjectRoot(path.resolve(PROJECT_ROOT, dirPath))) {
    return { ok: false, error: "Path is outside project root." };
  }
  const regex = new RegExp(pattern, "i");
  const results = [];
  async function walk(currentDir, depth = 0) {
    if (depth > 5) return;
    const fullPath = path.resolve(PROJECT_ROOT, currentDir);
    try {
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      for (const item of items) {
        if (shouldIgnoreDir(item.name)) continue;
        const relative = path.join(currentDir, item.name);
        if (regex.test(item.name)) {
          results.push({
            name: item.name,
            type: item.isDirectory() ? "directory" : "file",
            path: relative
          });
        }
        if (item.isDirectory()) {
          await walk(relative, depth + 1);
        }
      }
    } catch {}
  }
  await walk(dirPath);
  return { ok: true, pattern, matches: results.slice(0, 50) };
}

async function searchText(pattern, options = {}) {
  const regex = new RegExp(pattern, options.caseSensitive ? "" : "i");
  const maxResults = options.maxResults || 50;
  const fileFilter = options.fileFilter ? new RegExp(options.fileFilter, "i") : null;
  const results = [];
  async function walk(currentDir, depth = 0) {
    if (depth > 5 || results.length >= maxResults) return;
    const fullPath = path.resolve(PROJECT_ROOT, currentDir);
    try {
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      for (const item of items) {
        if (shouldIgnoreDir(item.name)) continue;
        const relative = path.join(currentDir, item.name);
        if (item.isDirectory()) {
          await walk(relative, depth + 1);
        } else if (item.isFile()) {
          if (isSecretFile(item.name)) continue;
          if (fileFilter && !fileFilter.test(item.name)) continue;
          try {
            const stat = await fs.stat(path.resolve(PROJECT_ROOT, relative));
            if (stat.size > 500000) continue;
            const content = await fs.readFile(path.resolve(PROJECT_ROOT, relative), "utf-8");
            const lines = content.split("\n");
            const matches = [];
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                matches.push({ line: i + 1, text: lines[i].trim().slice(0, 200) });
                if (matches.length >= 5) break;
              }
            }
            if (matches.length > 0) {
              results.push({ file: relative, matches });
            }
          } catch {}
        }
      }
    } catch {}
  }
  await walk(".");
  return { ok: true, pattern, totalFiles: results.length, results: results.slice(0, maxResults) };
}

async function findSymbolReferences(symbol, options = {}) {
  const patterns = [
    new RegExp(`\\bfunction\\s+${symbol}\\b`, "g"),
    new RegExp(`\\bclass\\s+${symbol}\\b`, "g"),
    new RegExp(`\\bconst\\s+${symbol}\\b`, "g"),
    new RegExp(`\\blet\\s+${symbol}\\b`, "g"),
    new RegExp(`\\bvar\\s+${symbol}\\b", "g`),
    new RegExp(`\\bexport\\s+(default\\s+)?${symbol}\\b`, "g"),
    new RegExp(`\\bimport\\s+.*\\b${symbol}\\b`, "g"),
    new RegExp(`\\b${symbol}\\s*[=(]`, "g"),
    new RegExp(`\\b${symbol}\\.`, "g")
  ];
  const fileFilter = options.fileFilter ? new RegExp(options.fileFilter, "i") : null;
  const results = [];
  async function walk(currentDir, depth = 0) {
    if (depth > 5) return;
    const fullPath = path.resolve(PROJECT_ROOT, currentDir);
    try {
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      for (const item of items) {
        if (shouldIgnoreDir(item.name)) continue;
        const relative = path.join(currentDir, item.name);
        if (item.isDirectory()) {
          await walk(relative, depth + 1);
        } else if (item.isFile()) {
          if (isSecretFile(item.name)) continue;
          if (fileFilter && !fileFilter.test(item.name)) continue;
          try {
            const stat = await fs.stat(path.resolve(PROJECT_ROOT, relative));
            if (stat.size > 500000) continue;
            const content = await fs.readFile(path.resolve(PROJECT_ROOT, relative), "utf-8");
            const lines = content.split("\n");
            const matches = [];
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              for (const re of patterns) {
                re.lastIndex = 0;
                if (re.test(line)) {
                  matches.push({ line: i + 1, text: line.trim().slice(0, 200) });
                  break;
                }
              }
            }
            if (matches.length > 0) {
              results.push({ file: relative, matches });
            }
          } catch {}
        }
      }
    } catch {}
  }
  await walk(".");
  return { ok: true, symbol, totalFiles: results.length, results: results.slice(0, 30) };
}

function gitStatus() {
  try {
    const status = execSync("git status --porcelain", { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 5000 });
    const lines = status.trim().split("\n").filter(Boolean);
    const files = lines.map(line => {
      const status = line.slice(0, 2).trim();
      const file = line.slice(3);
      return { status, file };
    });
    return { ok: true, branch: gitBranch(), totalFiles: files.length, files };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function gitBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return "unknown";
  }
}

function gitDiff(options = {}) {
  try {
    const args = ["git diff"];
    if (options.staged) args.push("--cached");
    if (options.file) args.push("--", options.file);
    const diff = execSync(args.join(" "), { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 5000 });
    const files = [];
    const fileRegex = /^diff --git a\/(.+?) b\/(.+?)$/gm;
    let match;
    while ((match = fileRegex.exec(diff)) !== null) {
      files.push(match[2]);
    }
    return { ok: true, files, diff: diff.slice(0, 10000) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function detectProjectTypeTool() {
  const files = await collectAllFiles(".", 0, 4);
  const projectTypes = detectProjectType(files);
  const languages = detectLanguages(files);
  let packageJson = null;
  try {
    const content = await fs.readFile(path.resolve(PROJECT_ROOT, "package.json"), "utf-8");
    packageJson = JSON.parse(content);
  } catch {}
  return {
    ok: true,
    projectTypes,
    languages,
    name: packageJson?.name || "unknown",
    version: packageJson?.version || "unknown",
    description: packageJson?.description || "",
    scripts: packageJson?.scripts ? Object.keys(packageJson.scripts) : [],
    dependencies: packageJson?.dependencies ? Object.keys(packageJson.dependencies).slice(0, 20) : []
  };
}

async function collectAllFiles(dir, depth, maxDepth) {
  if (depth > maxDepth) return [];
  const results = [];
  const fullPath = path.resolve(PROJECT_ROOT, dir);
  try {
    const items = await fs.readdir(fullPath, { withFileTypes: true });
    for (const item of items) {
      if (shouldIgnoreDir(item.name)) continue;
      const relative = path.join(dir, item.name);
      if (item.isDirectory()) {
        const children = await collectAllFiles(relative, depth + 1, maxDepth);
        results.push(...children);
      } else if (item.isFile()) {
        results.push(relative);
      }
    }
  } catch {}
  return results;
}

async function buildProjectMap() {
  const files = await collectAllFiles(".", 0, 3);
  const projectTypes = detectProjectType(files);
  const languages = detectLanguages(files);
  const directories = {};
  for (const file of files) {
    const dir = path.dirname(file);
    if (!directories[dir]) directories[dir] = [];
    directories[dir].push(file);
  }
  const structure = {};
  for (const file of files) {
    const parts = file.split(path.sep);
    let current = structure;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = null;
  }
  const entryPoints = [];
  if (files.includes("server/index.js")) entryPoints.push("server/index.js");
  if (files.includes("src/App.tsx")) entryPoints.push("src/App.tsx");
  if (files.includes("src/main.tsx")) entryPoints.push("src/main.tsx");
  if (files.includes("src/index.ts")) entryPoints.push("src/index.ts");
  for (const file of files) {
    if (file.includes("index.") && !entryPoints.includes(file)) {
      entryPoints.push(file);
    }
  }
  return {
    ok: true,
    totalFiles: files.length,
    projectTypes,
    languages,
    entryPoints: entryPoints.slice(0, 10),
    structure,
    topLevelDirs: Object.keys(structure).filter(k => !k.includes("."))
  };
}

export {
  listDirectories,
  readFileTool,
  searchFilenames,
  searchText,
  findSymbolReferences,
  gitStatus,
  gitDiff,
  detectProjectTypeTool,
  buildProjectMap
};
