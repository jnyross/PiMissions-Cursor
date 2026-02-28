# Changelog

## 2026-02-28

### Project-wide build completion

Delivered the full Pi Missions implementation across all planned milestones:

- **Foundation core**
  - Added strict mission, handoff, and validation typing + schemas
  - Added atomic state persistence and mission state utilities
  - Added feature ordering helpers, config loading, AGENTS discovery, session factory, and git helpers

- **Planner**
  - Added infrastructure discovery and port suggestion
  - Added mission artifact generation (mission docs, features, validation files, services, init script, worker skills)
  - Added planning orchestrator tool set and plan-review utilities

- **Executor**
  - Added mission runner with lifecycle events, state transitions, and milestone boundary detection
  - Added worker spawning flow (skill loading, init execution, prompt composition, handoff extraction)
  - Added handoff persistence and automatic fix-feature creation
  - Added intervention manager (pause/resume/steer) and retry-based error recovery

- **Validators**
  - Added scrutiny validator (test/lint/typecheck command gate + synthesis report)
  - Added user-testing validator (validation-contract assertion mapping + state/report updates)
  - Added validator feature injection and reset helpers

- **TUI**
  - Added mission control, planning chat, worker stream, and status/controls modules

- **CLI and setup**
  - Added `new`, `resume`, `status`, `list`, `setup`, `--help`
  - Added setup wizard with provider support (including minimax/glm), masked input, optional validation, secure key storage metadata, and gitignore protection
  - Replaced placeholder README with full product and development documentation

### Test coverage additions

Added broad automated coverage for:

- types and schema behavior
- state management and ordering
- config and AGENTS discovery
- session factory and prompts
- git utility wrappers
- planner utilities and artifacts
- executor lifecycle/handoff/intervention/recovery
- validator behavior and injection
- TUI views and controls
- setup wizard and CLI flows
- end-to-end command lifecycle (with optional gated live-provider test)

### Validation results

- `bun test --timeout 120000` passing (live-provider test remains opt-in and skipped by default)
- `bun run lint` passing
- `bun run check` exits successfully while retaining known upstream filtered node_modules type noise behavior
