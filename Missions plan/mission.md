# Pi Missions: Autonomous Code Development Harness

# Pi Missions: Autonomous Code Development Harness

## Plan Overview

Build a standalone CLI tool (`pi-missions`) that replicates the full functionality of Droid Missions on top of the oh-my-pi SDK. This is an autonomous code development orchestrator that:

1. **Plans** collaboratively with the user to define features, milestones, and success criteria
2. **Executes** the plan by spawning sequential worker sessions (one per feature) using oh-my-pi's `createAgentSession()` SDK
3. **Validates** each milestone with automated scrutiny (tests/typecheck/lint + code review) and user-testing (behavioral assertion verification)
4. **Tracks** progress through a structured state system (features.json, validation-contract.md, validation-state.json)
5. **Allows human intervention** -- pause, redirect, steer the orchestrator at any time

The harness is language/framework agnostic -- it can orchestrate missions for any technology stack. It supports all LLM providers that oh-my-pi supports (15+).

## Expected Functionality

### Milestone 1: foundation
Core project structure and shared types:
- TypeScript project with Bun runtime, oh-my-pi as primary dependency
- Core type definitions: Mission, Feature, Milestone, Worker, ValidationContract, ValidationState
- State management: read/write features.json, mission.md, validation-contract.md, validation-state.json, services.yaml
- Shared session factory: wrapper around `createAgentSession()` with shared authStorage/modelRegistry
- Feature ordering logic (array-order execution, completed moves to bottom)
- Configuration loading (.pi-missions config, AGENTS.md discovery)
- Git integration helpers (init, status, commit, diff)

### Milestone 2: planner
Interactive collaborative planning:
- Orchestrator agent session that converses with user to understand requirements
- Milestone identification and confirmation loop
- Infrastructure discovery (port scanning, service detection)
- Validation contract generation (behavioral assertions with stable IDs)
- Feature decomposition into features.json with full schema (id, description, skillName, milestone, preconditions, expectedBehavior, verificationSteps, fulfills, status)
- Worker skill generation (.pi-missions/skills/{worker-type}/SKILL.md)
- Services manifest generation (services.yaml with commands and service definitions)
- Init script generation (init.sh, idempotent environment setup)
- Mission proposal presentation and user confirmation
- Produces all mission artifacts ready for execution

### Milestone 3: executor
Mission execution engine:
- Mission runner loop: pick next pending feature -> spawn worker -> collect handoff -> update state -> repeat
- Worker session spawning with per-feature system prompts, tool scoping, and skill injection
- Worker handoff system: structured results (whatWasImplemented, whatWasLeftUndone, discoveredIssues, verification, tests)
- Handoff processing: create fix features, update feature descriptions, track tech debt
- Feature state management (pending -> in_progress -> completed/failed)
- Mid-mission user intervention: pause, resume, redirect, add/remove features
- Milestone boundary detection (all features in milestone complete -> trigger validators)
- Sealed milestone enforcement (never add to completed milestones)
- Error recovery: retry on connection failures, handle worker crashes gracefully

### Milestone 4: validators
Automated validation at milestone boundaries:
- **Scrutiny validator**: runs test/typecheck/lint, spawns review subagents per completed feature, synthesizes findings into pass/fail with actionable report
- **User-testing validator**: reads validation-contract.md, determines testable assertions from features' `fulfills`, sets up environment (start services), spawns flow-testing subagents, updates validation-state.json with pass/fail/blocked per assertion
- Auto-injection of validator features when milestone completes
- Re-run logic: on failure, validators go back to pending, orchestrator creates fix features, validator re-runs and only re-checks what failed
- Synthesis reports written to .pi-missions/validation/{milestone}/
- Override mechanism for well-justified cases

### Milestone 5: tui
Full pi-tui terminal interface:
- Mission Control view: real-time progress across features/milestones
- Streaming worker output display (text deltas, tool calls, tool results)
- Planning conversation UI (user <-> orchestrator chat)
- Status dashboard: feature list with status indicators, milestone progress bars
- User interaction: pause/resume buttons, steering input, feature management
- Markdown rendering for mission plans and reports
- Worker activity indicators (spinners, tool call display)

### Milestone 6: cli
Standalone CLI packaging and integration:
- CLI entry point: `pi-missions` command with subcommands
- `pi-missions new` -- start a new mission (enters planning)
- `pi-missions resume` -- resume an existing mission
- `pi-missions status` -- show mission progress
- `pi-missions list` -- list all missions
- `pi-missions setup` -- API key and provider configuration wizard
- Configuration file support (.pi-missions/config.json)
- Git integration: auto-init repo if needed, commit mission artifacts
- End-to-end smoke test: plan and execute a small real mission
- README generation

## Environment Setup

- **Runtime**: Bun 1.3.5 (already installed)
- **Fallback**: Node.js 22.20.0 (already installed)
- **Primary dependency**: `@oh-my-pi/pi-coding-agent` (pulls in pi-ai, pi-agent-core, pi-tui, pi-utils, pi-natives)
- **Test runner**: `bun test` with real LLM calls (longer timeouts)
- **TypeScript**: Bun's built-in TS support (no separate tsc step needed for execution)

## Infrastructure

**Services:** None required. This is a standalone CLI tool.

**Ports:** None used by the tool itself. The projects it orchestrates may use ports, managed by services.yaml in each mission.

**External dependencies:**
- LLM API keys (Anthropic, OpenAI, Google, etc.) -- configured via setup wizard
- oh-my-pi SDK packages from npm
- Git (for mission state tracking)

**Off-limits:**
- Ports 5173, 8080 (user's dev servers)
- Redis 6379, Postgres 5432 (user's existing services)
- Any system-level configuration

## Testing Strategy

**Unit tests**: Core logic (state management, feature ordering, validation contract parsing, config loading) tested with `bun test` using real LLM calls where applicable.

**Integration tests**: Worker spawning, handoff processing, milestone boundary detection tested with real agent sessions against real LLMs.

**E2E test**: One full smoke test that plans a small mission (e.g., "create a hello world Express app") and executes it through to validation.

**User testing surface**: The CLI itself, tested by running commands and verifying TUI output and mission state files.

**Validation readiness**: Confirmed -- Bun works, oh-my-pi installs cleanly, bun test runner works, TypeScript execution works. API keys will be configured during development.

## Non-functional Requirements

- **Language/framework agnostic**: Must work with any project type
- **All oh-my-pi providers supported**: Anthropic, OpenAI, Google, xAI, Groq, Mistral, OpenRouter, Ollama, etc.
- **Graceful degradation**: If LLM call fails, retry with backoff; if worker crashes, report and continue
- **Auditability**: All mission state persisted to disk (features.json, validation-state.json, session logs)
- **Idempotent operations**: Resume from any point without data loss
