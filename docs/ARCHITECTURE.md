# Architecture

## Overview

Hermes Agent OS is a multi-agent AI orchestration platform with a React frontend and Express backend.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │   Goals   │ │ Notebook │ │  Kanban  │ │  Memory  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                         │                                   │
│              IntegrationManager (Single Source)             │
│                         │                                   │
│              PersistenceService (localStorage)              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express Backend                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │llm-proxy │ │  store   │ │  modules │ │  safety  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                         │                                   │
│                    NVIDIA API Proxy                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    NVIDIA API                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Claude  │ │  Gemini  │ │  Codex   │ │ OpenClaw │      │
│  │ (llama)  │ │ (gemma)  │ │ (llama)  │ │(nemotron)│      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### IntegrationManager
- Single source of truth for all runtime state
- Auto-saves to localStorage via PersistenceService
- Pub/sub pattern for reactive updates

### BusinessAgentRuntime
- Task execution lifecycle
- Risk classification and approval gates
- Writes to IntegrationManager after execution

### ExecutionAdapter
- Backend LLM proxy integration
- Model mapping (Claude → llama, Gemini → gemini, etc.)
- Server-side API key management

### PersistenceService
- Auto-save/load HermesState to localStorage
- Handles serialization/deserialization

## Data Flow

1. User sends message via HermesHome
2. HermesBrain thinks and creates plan
3. IntegrationManager stores goal, notebook, kanban, memory
4. BusinessAgentRuntime executes via ExecutionAdapter
5. Backend proxies to NVIDIA API
6. Results stored in IntegrationManager + ExecutionResults
7. All module pages update via subscription
8. State persisted to localStorage
