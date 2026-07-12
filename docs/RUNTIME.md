# Runtime

## Server Setup

The Express backend runs on port 4173 and serves the built React frontend.

### Starting the Server

```bash
node server/index.js
```

### API Endpoints

#### Health
- `GET /api/health` - Server health check

#### LLM Execution
- `POST /api/llm/execute` - Execute LLM request via NVIDIA proxy
  - Body: `{ engine: string, messages: Array<{role, content}> }`
  - Returns: `{ ok: boolean, content: string, tokens: number }`

#### OS Status
- `GET /api/os/status` - System status and configuration

#### Self Modules
- `GET /api/self/goals` - Get goals
- `GET /api/self/notebook` - Get notebook entries
- `GET /api/self/kanban` - Get kanban board
- `GET /api/self/memory` - Get project memory

## Execution Engines

| Engine | Model | Provider |
|--------|-------|----------|
| claude | meta/llama-3.1-70b-instruct | NVIDIA |
| gemini | google/gemma-2-2b-it | NVIDIA |
| codex | meta/llama-3.1-8b-instruct | NVIDIA |
| openclaw | nvidia/nemotron-mini-4b-instruct | NVIDIA |
| opencode | nvidia/nemotron-mini-4b-instruct | NVIDIA |
| free-claude-code | meta/llama-3.1-8b-instruct | NVIDIA |

## Configuration

Environment variables (see `.env.example`):

- `PORT` - Server port (default: 4173)
- `NVIDIA_API_KEY` - Required for LLM execution
- `HERMES_HOME` - Hermes home directory

## State Management

### PersistenceService
- Auto-saves to localStorage on every state change
- Auto-restores on server startup

### IntegrationManager
- Single source of truth for all runtime state
- Pub/sub pattern for reactive updates
- Functions: `executePlan()`, `updateGoalStatus()`, `moveKanbanCard()`, `updateMemoryStage()`
