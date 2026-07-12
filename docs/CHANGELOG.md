# Changelog

All notable changes to Hermes Agent OS will be documented in this file.

## [1.0.0] - 2026-07-12

### Added
- Core engine architecture
- Multi-agent orchestration (Claude, Gemini, Codex, OpenClaw, OpenCode)
- Brain integration for natural language task planning
- Execution adapters for all AI engines
- Backend LLM proxy with server-side API key management
- Module system (Goals, Notebook, Kanban, Memory, Timeline)
- Persistent state management via localStorage
- Agent Builder UI for custom agent creation
- Execution Results page with full history
- Risk classification and approval gates
- Business Agent Runtime with task lifecycle
- Capability matching for agent selection
- Default agents (Coding, Research, QA, Marketing, Automation, Vision)

### Changed
- Unified state management via IntegrationManager
- Module pages now subscribe to IntegrationManager (removed dual state)
- ExecutionAdapter now calls backend proxy instead of direct NVIDIA API

### Fixed
- 3 broken NVIDIA models (404 errors)
- Server crash on long requests (switched to native https module)
- nemotron-mini token limit (max_tokens ≤ 512)
- Unhandled promise rejections

### Removed
- Dead code (ExecutionEngine.ts)
- Duplicate WorkspaceContext store
