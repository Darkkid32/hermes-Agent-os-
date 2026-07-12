import { listDirectories, readFileTool, searchFilenames, searchText, findSymbolReferences, detectProjectTypeTool, buildProjectMap } from "./developer-tools.js";

const HIGH_RISK_PATTERNS = [
  /delete\s+(the\s+)?server/i,
  /remove\s+(the\s+)?server/i,
  /drop\s+all/i,
  /drop\s+database/i,
  /reset\s+everything/i,
  /destroy/i,
  /format\s+disk/i,
  /wipe/i,
  /rm\s+-rf/i,
  /sudo/i,
  /chmod\s+777/i,
  /eval\(/i,
  /exec\(/i
];

const MEDIUM_RISK_PATTERNS = [
  /rename/i,
  /refactor/i,
  /upgrade/i,
  /update\s+(all|dependencies)/i,
  /change\s+(the\s+)?api/i,
  /migrate/i,
  /restructure/i,
  /reorganize/i,
  /replace/i
];

const LOW_RISK_PATTERNS = [
  /add\s+(a\s+)?comment/i,
  /add\s+dark\s+mode/i,
  /add\s+(a\s+)?feature/i,
  /create\s+(a\s+)?new/i,
  /fix\s+(a\s+)?bug/i,
  /improve/i,
  /optimize/i,
  /document/i,
  /readme/i
];

function analyzeRisk(goal) {
  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(goal)) return "HIGH";
  }
  for (const pattern of MEDIUM_RISK_PATTERNS) {
    if (pattern.test(goal)) return "MEDIUM";
  }
  for (const pattern of LOW_RISK_PATTERNS) {
    if (pattern.test(goal)) return "LOW";
  }
  return "MEDIUM";
}

function requiresApproval(riskLevel, goal) {
  if (riskLevel === "HIGH") return true;
  if (/delete/i.test(goal)) return true;
  if (/remove/i.test(goal)) return true;
  if (/replace/i.test(goal)) return true;
  if (/rename/i.test(goal)) return true;
  if (/upgrade/i.test(goal)) return true;
  if (/migrate/i.test(goal)) return true;
  if (/dark\s+mode/i.test(goal)) return false;
  if (/add\s+comment/i.test(goal)) return false;
  if (/readme/i.test(goal)) return false;
  return riskLevel === "MEDIUM";
}

function detectRequiredTools(goal) {
  const tools = ["detectProjectTypeTool", "buildProjectMap"];
  if (/rename/i.test(goal) || /refactor/i.test(goal)) {
    tools.push("findSymbolReferences", "readFileTool");
  }
  if (/add\s+dark\s+mode/i.test(goal)) {
    tools.push("searchFilenames", "searchText", "readFileTool");
  }
  if (/replace/i.test(goal)) {
    tools.push("searchText", "readFileTool");
  }
  if (/fix/i.test(goal)) {
    tools.push("searchText", "readFileTool");
  }
  if (/upgrade/i.test(goal)) {
    tools.push("readFileTool", "searchFilenames");
  }
  if (/delete/i.test(goal)) {
    tools.push("searchFilenames", "findSymbolReferences");
  }
  if (/api/i.test(goal)) {
    tools.push("searchText", "readFileTool");
  }
  if (/route/i.test(goal)) {
    tools.push("searchText", "readFileTool");
  }
  if (/component/i.test(goal)) {
    tools.push("searchFilenames", "searchText");
  }
  if (/test/i.test(goal)) {
    tools.push("searchFilenames", "readFileTool");
  }
  if (!tools.includes("searchText")) {
    tools.push("searchText");
  }
  if (!tools.includes("readFileTool")) {
    tools.push("readFileTool");
  }
  return [...new Set(tools)];
}

function identifyAffectedFiles(goal, projectMap) {
  const files = [];
  if (/server/i.test(goal) || /api/i.test(goal) || /route/i.test(goal)) {
    files.push("server/index.js", "server/runtime/modules.js");
  }
  if (/nvidia/i.test(goal) || /provider/i.test(goal) || /model/i.test(goal)) {
    files.push("server/runtime/modules.js", "server/runtime/connections.js", ".env");
  }
  if (/react/i.test(goal) || /component/i.test(goal) || /ui/i.test(goal) || /dashboard/i.test(goal)) {
    files.push("src/App.tsx", "src/components/*.tsx");
  }
  if (/dark\s+mode/i.test(goal)) {
    files.push("src/App.tsx", "src/index.css", "tailwind.config.js");
  }
  if (/minimax/i.test(goal)) {
    files.push("server/runtime/modules.js", "server/runtime/connections.js", ".env");
  }
  if (/glm/i.test(goal)) {
    files.push("server/runtime/modules.js", "server/runtime/connections.js", ".env");
  }
  if (/express/i.test(goal)) {
    files.push("server/index.js");
  }
  if (/database/i.test(goal) || /db/i.test(goal)) {
    files.push("server/runtime/database.js", "server/runtime/db.js");
  }
  if (/test/i.test(goal)) {
    files.push("test/**/*.js", "scripts/**/*.js");
  }
  if (/config/i.test(goal)) {
    files.push("package.json", "vite.config.ts", ".env");
  }
  if (/readme/i.test(goal)) {
    files.push("README.md");
  }
  if (/docker/i.test(goal)) {
    files.push("Dockerfile", "docker-compose.yml");
  }
  if (/ci/i.test(goal) || /deploy/i.test(goal)) {
    files.push(".github/workflows/*.yml", ".gitlab-ci.yml");
  }
  return [...new Set(files)];
}

function generateExecutionSteps(goal, riskLevel, affectedFiles) {
  const steps = [];
  if (/add\s+dark\s+mode/i.test(goal)) {
    steps.push(
      { step: 1, action: "Read current CSS/theme files", tool: "readFileTool", target: "src/index.css" },
      { step: 2, action: "Identify color variables and theme structure", tool: "searchText", target: "color" },
      { step: 3, action: "Create dark mode CSS variables", tool: "proposeEdit", target: "src/index.css" },
      { step: 4, action: "Add toggle component", tool: "proposeEdit", target: "src/App.tsx" },
      { step: 5, action: "Test dark mode toggle", tool: "manualVerification" }
    );
  } else if (/rename.*runNvidiaProvider/i.test(goal)) {
    steps.push(
      { step: 1, action: "Find all references to runNvidiaProvider", tool: "findSymbolReferences", target: "runNvidiaProvider" },
      { step: 2, action: "Read file containing function definition", tool: "readFileTool", target: "server/runtime/modules.js" },
      { step: 3, action: "Generate rename diff for each reference", tool: "proposeEdit", target: "affected files" },
      { step: 4, action: "Verify no broken imports or references", tool: "searchText", target: "runNvidiaProvider" },
      { step: 5, action: "Run build to verify no compilation errors", tool: "manualVerification" }
    );
  } else if (/upgrade.*react/i.test(goal)) {
    steps.push(
      { step: 1, action: "Check current React version", tool: "readFileTool", target: "package.json" },
      { step: 2, action: "Identify React dependencies", tool: "searchText", target: "react" },
      { step: 3, action: "Review React changelog for breaking changes", tool: "webSearch" },
      { step: 4, action: "Update package.json with new version", tool: "proposeEdit", target: "package.json" },
      { step: 5, action: "Run npm install", tool: "manualVerification" },
      { step: 6, action: "Fix any TypeScript errors", tool: "searchText", target: "error" },
      { step: 7, action: "Run full test suite", tool: "manualVerification" },
      { step: 8, action: "Verify dashboard loads correctly", tool: "manualVerification" }
    );
  } else if (/delete.*server/i.test(goal)) {
    steps.push(
      { step: 1, action: "ABORT: This action would destroy the entire backend", tool: "none" },
      { step: 2, action: "List all files that would be deleted", tool: "searchFilenames", target: "server/**" },
      { step: 3, action: "Identify all dependencies on server code", tool: "findSymbolReferences", target: "import.*server" },
      { step: 4, action: "WARN: This is irreversible and would break the entire application", tool: "none" }
    );
  } else if (/replace.*minimax/i.test(goal) || /replace.*nvidia/i.test(goal)) {
    steps.push(
      { step: 1, action: "Locate current provider configuration", tool: "searchText", target: "minimax|nvidia" },
      { step: 2, action: "Read provider implementation", tool: "readFileTool", target: "server/runtime/modules.js" },
      { step: 3, action: "Identify all references to old provider", tool: "findSymbolReferences", target: "minimax|nvidia" },
      { step: 4, action: "Create new provider configuration", tool: "proposeEdit", target: "server/runtime/modules.js" },
      { step: 5, action: "Update environment variables", tool: "proposeEdit", target: ".env" },
      { step: 6, action: "Test new provider connectivity", tool: "manualVerification" },
      { step: 7, action: "Verify chat routing works", tool: "manualVerification" }
    );
  } else {
    steps.push(
      { step: 1, action: "Analyze project structure", tool: "buildProjectMap" },
      { step: 2, action: "Search for relevant files", tool: "searchText", target: goal },
      { step: 3, action: "Read affected files", tool: "readFileTool", target: "affected files" },
      { step: 4, action: "Generate implementation plan", tool: "proposeEdit", target: "TBD" },
      { step: 5, action: "Verify changes", tool: "manualVerification" }
    );
  }
  return steps;
}

function generateVerificationSteps(goal) {
  if (/add\s+dark\s+mode/i.test(goal)) {
    return [
      "Verify toggle switches between light and dark mode",
      "Check all components render correctly in dark mode",
      "Verify color contrast meets accessibility standards",
      "Test persistence across page reloads"
    ];
  }
  if (/rename/i.test(goal)) {
    return [
      "Run build to verify no compilation errors",
      "Search for old name to ensure no references remain",
      "Test all affected functionality"
    ];
  }
  if (/upgrade/i.test(goal)) {
    return [
      "Run full test suite",
      "Verify all imports resolve correctly",
      "Test critical user flows",
      "Check for deprecation warnings"
    ];
  }
  if (/delete/i.test(goal)) {
    return [
      "Verify no remaining imports of deleted code",
      "Run build to catch compilation errors",
      "Test all affected features"
    ];
  }
  if (/replace/i.test(goal)) {
    return [
      "Test new implementation",
      "Verify old implementation is fully removed",
      "Run integration tests",
      "Check for performance regressions"
    ];
  }
  return [
    "Run build to verify no compilation errors",
    "Test affected functionality",
    "Verify no regressions"
  ];
}

function generateRollbackStrategy(riskLevel, affectedFiles) {
  if (riskLevel === "HIGH") {
    return {
      strategy: "Git revert or restore from backup",
      steps: [
        "Create backup before any changes",
        "Use git stash or git checkout to revert",
        "Restore from .hermes-backup files if available",
        "Verify system returns to previous state"
      ],
      backupRequired: true
    };
  }
  if (riskLevel === "MEDIUM") {
    return {
      strategy: "Restore individual files from backup",
      steps: [
        "Use .hermes-backup files for each modified file",
        "Revert changes using proposeEdit with original content",
        "Verify affected functionality"
      ],
      backupRequired: true
    };
  }
  return {
    strategy: "Manual revert",
    steps: [
      "Undo changes manually",
      "Verify functionality"
    ],
    backupRequired: false
  };
}

async function createPlan(goal, options = {}) {
  const riskLevel = analyzeRisk(goal);
  const approvalRequired = requiresApproval(riskLevel, goal);
  const requiredTools = detectRequiredTools(goal);
  let projectMap = null;
  try {
    projectMap = await buildProjectMap();
  } catch {}
  const affectedFiles = identifyAffectedFiles(goal, projectMap);
  const executionSteps = generateExecutionSteps(goal, riskLevel, affectedFiles);
  const verificationSteps = generateVerificationSteps(goal);
  const rollbackStrategy = generateRollbackStrategy(riskLevel, affectedFiles);
  return {
    ok: true,
    plan: {
      goal,
      summary: `Plan to: ${goal}`,
      riskLevel,
      approvalRequired,
      estimatedSteps: executionSteps.length,
      requiredTools,
      filesLikelyAffected: affectedFiles,
      preconditions: [
        "Project builds successfully",
        "Server is running",
        "All existing tests pass"
      ],
      executionSteps,
      verificationSteps,
      rollbackStrategy,
      timestamp: new Date().toISOString()
    }
  };
}

export { createPlan, analyzeRisk, requiresApproval, detectRequiredTools, identifyAffectedFiles };
