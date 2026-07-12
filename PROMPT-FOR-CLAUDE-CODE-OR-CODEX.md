# Prompt For Claude Code Or Codex

Use this prompt with Claude Code, Codex, or another coding agent after placing the Hermes Agent OS zip on the same machine.

```text
You are helping me install and verify Hermes Agent OS Runtime from a local zip package.

Zip file:
Hermes-Agent-OS-polished-dashboard-local-install-tutorial-2026-07-06.zip

Goal:
Install this locally, configure the safe first-run environment, verify the backend/dashboard, and leave me with exact URLs and commands.

Important rules:
- Do not upload or expose any API keys.
- Do not invent connected status. Verify with the app APIs.
- Keep execution disabled by default:
  HERMES_AGENT_OS_ENABLE_EXEC=0
  HERMES_AGENT_OS_ENABLE_INSTALL=0
- If API keys are missing, leave fields blank and explain where I should add them.
- Do not run destructive commands.
- Do not overwrite an existing `.env` without backing it up.
- Do not expose Ollama publicly.
- Do not claim the real Agent Builder is fully running unless Convex and Clerk are configured and `/api/builder/status` proves it.

Tasks:

1. Locate the zip file.
   If it is on Desktop, use:
   ~/Desktop/Hermes-Agent-OS-polished-dashboard-local-install-tutorial-2026-07-06.zip

2. Create an install folder:
   ~/Desktop/Hermes-Agent-OS

3. Unzip the package there.

4. Find the folder containing `package.json`.
   Use that folder as the app root.

5. Inspect:
   - package.json
   - .env.example
   - README.md
   - SETUP-GUIDE.md or HERMES-AGENT-OS-TUTORIAL.md if present

6. Install dependencies:
   npm install

7. Create `.env` from `.env.example` if `.env` does not exist.
   If `.env` exists, copy it to `.env.backup-YYYYMMDD-HHMMSS` first.

8. Configure safe local defaults in `.env`:
   PORT=4173
   HERMES_AGENT_OS_HOME=~/.hermes-agent-os
   HERMES_AGENT_OS_ENABLE_EXEC=0
   HERMES_AGENT_OS_ENABLE_INSTALL=0
   HERMES_AGENT_OS_ADMIN_TOKEN=local-dev-change-this-token
   HERMES_BUILDER_PORT=3100
   OLLAMA_HOST=http://127.0.0.1:11434

9. Leave these blank unless I provide keys:
   OPENROUTER_API_KEY=
   MINIMAX_API_KEY=
   ANTHROPIC_API_KEY=
   OPENAI_API_KEY=
   GEMINI_API_KEY=
   FIRECRAWL_API_KEY=
   NEXT_PUBLIC_CONVEX_URL=
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
   CLERK_SECRET_KEY=
   CLERK_JWT_ISSUER_DOMAIN=

10. Run verification:
    npm test
    npm run build

11. Start the app:
    npm start

12. Verify endpoints:
    curl http://localhost:4173/api/health
    curl http://localhost:4173/api/modules
    curl http://localhost:4173/api/builder/status

13. Confirm dashboard URL:
    http://localhost:4173

14. Confirm module behavior:
    - Self modules should be connected: Goals, SEO, Video, Notebook, Kanban, Usage Credits.
    - Provider modules should be connected only if keys/endpoints are configured.
    - CLI modules should be connected only if their CLIs are installed or paths configured.
    - OpenClaude/OpenClaw should remain missing/manual unless a real local tool path is configured.

15. If Ollama is installed, verify:
    curl http://127.0.0.1:11434/api/tags
    Then configure provider-ollama if needed.

16. If OpenRouter key is provided, configure it:
    POST /api/connections/provider-openrouter/configure
    field: OPENROUTER_API_KEY
    Also configure `free-claude-code` with OPENROUTER_API_KEY.

17. If MiniMax key is provided, configure it:
    POST /api/connections/provider-minimax/configure
    field: MINIMAX_API_KEY
    Also configure `free-claude-code` with MINIMAX_API_KEY.

18. If the user wants the real Agent Builder:
    npm run builder:install
    npm run builder:start
    But only call it fully working after Convex and Clerk values are configured and `/api/builder/status` confirms live.

19. Final response must include:
    - App root path.
    - Dashboard URL.
    - Health endpoint result.
    - Test/build result.
    - Which modules are connected.
    - Which modules need configuration.
    - Where `.env` is located.
    - Next steps for OpenRouter, MiniMax, Ollama, and Agent Builder.
```
