# AGENTS.md - Pi Missions

## Mission Boundaries (NEVER VIOLATE)

**Port Range:** This project does not use ports directly. It is a CLI tool. Any projects it orchestrates will manage their own ports via services.yaml.

**External Services:**
- USE the user's existing LLM API keys (configured via setup wizard)
- DO NOT start any background services or databases for this project itself
- DO NOT access the user's Redis (6379), Postgres (5432), or other running services

**Off-Limits:**
- Ports 5173, 8080 (user's dev servers)
- Any system-level configuration files
- The user's home directory outside of the project dir and ~/.pi-missions/

## Project Structure

This is a TypeScript/Bun monorepo-style project:

```
/Users/johnross/Documents/Software_Projects/Pi Missions/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── types/                # Core type definitions
│   ├── state/                # State management (features.json, etc.)
│   ├── planner/              # Planning orchestrator
│   ├── executor/             # Mission execution engine
│   ├── validators/           # Scrutiny + user testing validators
│   ├── tui/                  # pi-tui terminal interface
│   ├── config/               # Configuration loading
│   ├── session/              # Session factory (createAgentSession wrapper)
│   └── utils/                # Shared utilities
├── tests/                    # Test files (*.test.ts)
├── package.json
├── tsconfig.json
├── biome.json                # Linting config
└── .pi-missions/             # Runtime artifacts for missions this tool manages
```

## Coding Conventions

- **Runtime**: Bun (use `bun:test` for testing, `bun run` for execution)
- **Language**: TypeScript with strict mode
- **Imports**: Use ES module imports (`import { } from "..."`)
- **Dependencies**: Primary dependency is `@oh-my-pi/pi-coding-agent` which includes pi-ai, pi-agent-core, pi-tui, pi-utils
- **Error handling**: Use typed errors with descriptive messages. Never swallow errors silently.
- **State files**: All mission state (features.json, validation-state.json, etc.) must be written atomically (write to temp file, then rename)
- **Naming**: camelCase for variables/functions, PascalCase for types/interfaces, kebab-case for file names
- **Tests**: Use `bun:test` with `describe`/`test`/`expect`. Test files are `*.test.ts` in the `tests/` directory.
- **No console.log in library code**: Use structured logging or the TUI for output.
- **Git commits**: Conventional commit format (feat:, fix:, chore:, etc.)
- **Barrel exports**: All modules in a directory must be re-exported from that directory's `index.ts`. When adding a new file to a directory, always add an export line to the barrel file.

## Key Technical Decisions

1. **oh-my-pi SDK**: Use `createAgentSession()` from `@oh-my-pi/pi-coding-agent` for all agent sessions (orchestrator, workers, validators)
2. **Ephemeral worker sessions**: Workers use `SessionManager.inMemory()` for isolation
3. **Structured handoffs**: Workers return results via `requireSubmitResultTool: true` with a defined output schema
4. **Sequential execution**: Features execute one at a time (no parallelism in v1)
5. **File-based state**: All mission state persists to JSON/YAML/MD files in the mission directory
6. **Single worker type**: One `dev-worker` skill handles all implementation features

## oh-my-pi SDK Patterns

When creating agent sessions:
```typescript
import { createAgentSession, SessionManager } from "@oh-my-pi/pi-coding-agent";

// Use modelRegistry to get available models - do NOT import getModel (it doesn't exist)
const { session } = await createAgentSession({
  authStorage,           // Shared across all sessions
  modelRegistry,         // Shared across all sessions
  model: modelRegistry.getAvailable()[0], // or select specific model from registry
  sessionManager: SessionManager.inMemory(),
  systemPrompt: "...",
  toolNames: ["read", "write", "edit", "bash", "grep", "find", "ls"],
  requireSubmitResultTool: true,
  outputSchema: handoffSchema,
  enableMCP: false,
  enableLsp: false,
});
```

## Known Pre-Existing Issues (Do Not Fix)

- **oh-my-pi tsc errors in node_modules**: The @oh-my-pi/pi-coding-agent package ships TypeScript source files that contain .md and .py imports tsc can't resolve. The `bun run check` command filters these out and only reports errors in src/ and tests/. This is expected and not a bug in our code.

## Testing & Validation Guidance

- Tests use real LLM calls (not mocked). Set appropriate timeouts (120s+).
- Test files must have `.test.ts` suffix for Bun to discover them.
- The user testing surface is the CLI itself -- run commands and verify terminal output.
- For TUI testing, verify component rendering by checking output strings.
