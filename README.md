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

Required:
- `NVIDIA_API_KEY` - Your NVIDIA API key for LLM execution

Optional:
- `PORT` - Server port (default: 4173)
- `HERMES_HOME` - Hermes home directory

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
