# Hermes Agent OS

A professional AI Operating System built with React, Express, and NVIDIA API integration. Orchestrate multiple AI agents through a unified dashboard with business-grade execution, approval workflows, and persistent state management.

## Features

- **Multi-Agent Orchestration** - Claude, Gemini, Codex, OpenClaw, OpenCode, Free Claude
- **Business Agent Runtime** - Task execution with risk classification and approval gates
- **Brain Integration** - Natural language task planning and decomposition
- **Persistent State** - Auto-save/restore via localStorage
- **Module System** - Goals, Notebook, Kanban, Memory, Timeline
- **Execution Results** - Full execution history with artifacts and output
- **Backend LLM Proxy** - Secure API key management (server-side only)

## Architecture

```
src/
  hermes/           # Core engine
    BrainServices/  # Planning, context, routing
    ExecutionServices/  # Runtime, adapters, approval
    PersistenceService.ts  # Auto-save to localStorage
    IntegrationManager.ts  # Single source of truth
  pages/            # React UI
  components/       # Shared components
server/
  runtime/          # Backend services
    llm-proxy.js    # NVIDIA API proxy
    self-modules.js # JSON file store
```

## Screenshots

> Screenshots coming soon

## Installation

```bash
git clone https://github.com/Darkkid32/hermes-Agent-os-.git
cd hermes-Agent-os-
npm install
```

## Running Locally

```bash
# Start backend server (port 4173)
node server/index.js

# Or start Vite dev server (port 5173)
npm run dev
```

Dashboard: `http://127.0.0.1:4173`

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Required

| Variable           | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `NVIDIA_API_KEY`   | NVIDIA NIM / `integrate.api.nvidia.com` API key for LLM execution |
| `HERMES_API_TOKEN` | Bearer token required for state-changing API calls (LLM, modules, edit, terminal). Minimum 16 chars. Empty disables auth (only valid for local development on 127.0.0.1). |

### Optional

| Variable                  | Default                        | Purpose                                                  |
| ------------------------- | ------------------------------ | -------------------------------------------------------- |
| `PORT`                    | `4173`                         | Server port                                              |
| `HERMES_ALLOWED_ORIGINS`  | `http://127.0.0.1:4173,http://localhost:4173` | Comma-separated CORS allowlist          |
| `HERMES_LLM_RATE_LIMIT`   | `60`                           | LLM proxy requests per window                            |
| `HERMES_LLM_RATE_WINDOW`  | `1`                            | Rate limit window in minutes                             |
| `HERMES_HOME`             | `~/.hermes`                    | Hermes home directory                                    |

### Security Notes (v1.0.1+)

- The previous hardcoded NVIDIA API key in `server/runtime/llm-proxy.js` has been **removed**. Provisioning now happens exclusively through environment variables.
- `helmet`, `express-rate-limit`, and a shared bearer-token middleware (`server/runtime/auth.js`) gate state-changing endpoints: `/api/llm/*`, `/api/edit/*`, `/api/modules/*`, `/api/terminal/*`, `/api/execute/*`, `/api/orchestrate/*`, `/api/verify/*`, `/api/installers/*`, `/api/admin/*`.
- CORS is restricted to the `HERMES_ALLOWED_ORIGINS` allowlist. Anything else is rejected.
- Get rotated keys from <https://build.nvidia.com>. Treat any key that has ever been committed to a public repository as **revoked**.

## Build

```bash
npm run build
```

Output: `dist/` (300 kB, 84 kB gzip)

## Roadmap

- [ ] Git repository initialization
- [ ] Persistent database backend
- [ ] WebSocket real-time updates
- [ ] Agent marketplace
- [ ] Multi-user support
- [ ] Plugin system

## License

MIT License - see [LICENSE](LICENSE) for details
