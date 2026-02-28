# Pi Missions

Pi Missions is an autonomous code-development mission orchestrator built on the oh-my-pi SDK.

It provides a CLI that can:

- create a mission scaffold (`new`)
- resume autonomous execution (`resume`)
- report mission state (`status`)
- list known missions (`list`)
- configure LLM credentials (`setup`)

## Installation

```bash
PUPPETEER_SKIP_DOWNLOAD=true bun install
bun pm trust @biomejs/biome protobufjs
```

## Quick Start

```bash
# configure your provider key
bun run src/index.ts setup

# create a mission
bun run src/index.ts new "Build feature X"

# view status
bun run src/index.ts status

# run execution
bun run src/index.ts resume
```

## CLI Reference

```bash
pi-missions new [title]
pi-missions resume
pi-missions status
pi-missions list
pi-missions setup [--provider <name>] [--api-key <key>] [--skip-validation]
pi-missions --help
```

## Architecture Overview

- **Planner (`src/planner`)**
  - infrastructure discovery
  - plan review helpers
  - mission artifact generation
  - planning orchestrator session tools
- **Executor (`src/executor`)**
  - mission runner loop
  - worker spawn/session orchestration
  - handoff persistence and fix-feature generation
  - pause/resume/steer intervention support
- **Validators (`src/validators`)**
  - scrutiny validation (test/lint/typecheck + synthesis)
  - user-testing validation against validation-contract assertions
  - validator feature injection helpers
- **TUI (`src/tui`)**
  - mission control rendering
  - planning chat rendering
  - worker stream rendering
  - status/keyboard controls
- **State (`src/state`)**
  - atomic mission file writes
  - features/validation/services state management

## Configuration

Project config file: `.pi-missions/config.json`

Supported fields:

```json
{
  "defaultModel": "provider:model",
  "defaultThinkingLevel": "low",
  "missionDir": ".pi-missions"
}
```

## Security Notes

- Credentials are persisted via oh-my-pi credential storage.
- `.pi-missions/credentials.json` stores metadata only, not plaintext keys.
- `.pi-missions/credentials.json` is automatically added to `.gitignore` during setup.

## Development

```bash
bun test --timeout 120000
bun run check
bun run lint
```

## Inspiration

Pi Missions follows the Droid Missions-style autonomous workflow while using oh-my-pi primitives directly for session orchestration, tools, and model/provider abstraction.