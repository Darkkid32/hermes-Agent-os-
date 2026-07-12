# Business Agents

## Overview

Business Agents are pre-configured AI agents with specific capabilities, permissions, and execution engines.

## Default Agents

### Coding Assistant (Claude)
- **Engine**: Claude (llama-3.1-70b)
- **Capabilities**: code_generation, code_review, debugging, refactoring
- **Permissions**: memory, modify_notebook, create_kanban
- **Risk**: Low

### Research Analyst (Gemini)
- **Engine**: Gemini (gemma-2-2b)
- **Capabilities**: research, analysis, summarization, fact_checking
- **Permissions**: memory, modify_notebook, create_goals
- **Risk**: Low

### QA Engineer (Codex)
- **Engine**: Codex (llama-3.1-8b)
- **Capabilities**: testing, quality_assurance, bug_detection
- **Permissions**: memory, create_kanban
- **Risk**: Low

### Marketing Specialist (Claude)
- **Engine**: Claude (llama-3.1-70b)
- **Capabilities**: content_creation, copywriting, seo, marketing
- **Permissions**: memory, modify_notebook, create_goals
- **Risk**: Low

### Automation Engineer (Codex)
- **Engine**: Codex (llama-3.1-8b)
- **Capabilities**: automation, scripting, workflow, integration
- **Permissions**: memory, create_kanban, execute_code
- **Risk**: Medium

### Vision AI (OpenClaw)
- **Engine**: OpenClaw (nemotron-mini-4b)
- **Capabilities**: image_analysis, visual_reasoning, ui_testing
- **Permissions**: memory
- **Risk**: Low

## Execution Flow

1. **Plan Creation** - Brain creates execution plan
2. **Agent Selection** - CapabilityMatcher selects best agent
3. **Risk Classification** - ApprovalManager assesses risk
4. **Approval Gate** - High-risk tasks require approval
5. **Execution** - Agent executes via ExecutionAdapter
6. **State Update** - Results stored in IntegrationManager
7. **Module Sync** - Goals, Notebook, Kanban, Memory updated

## Custom Agents

Agents can be created via the Agent Builder page:

1. Navigate to Agent Builder
2. Configure name, description, engine
3. Set capabilities and permissions
4. Define risk level
5. Save to localStorage

## Permissions

| Permission | Description |
|------------|-------------|
| memory | Read/write project memory |
| modify_notebook | Update notebook entries |
| create_goals | Create new goals |
| create_kanban | Create kanban cards |
| execute_code | Execute code snippets |
| modify_files | Modify project files |
