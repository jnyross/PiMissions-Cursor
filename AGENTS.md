# AGENTS.md - Pi Missions

## Cursor Cloud specific instructions

### Project overview

Pi Missions is a standalone CLI tool (`pi-missions`) — an autonomous code development orchestrator built on the oh-my-pi SDK. TypeScript/Bun project with no backend services.

The full mission plan (features, milestones, validation contract) is in the `Missions plan/` directory.

### Runtime and dependencies

- **Runtime**: Bun (installed at `~/.bun/bin/bun`; ensure PATH includes `~/.bun/bin`)
- **Package manager**: Bun (`bun install`)
- **Puppeteer quirk**: Must use `PUPPETEER_SKIP_DOWNLOAD=true` before `bun install` to avoid Chrome download failures (transitive dep from oh-my-pi)
- **Biome postinstall**: After `bun install`, run `bun pm trust @biomejs/biome protobufjs` to enable the biome binary and protobufjs codegen

### Key commands

| Command | Description |
|---------|-------------|
| `bun run src/index.ts` | Run the CLI entry point |
| `bun run check` | TypeScript type checking (filters out node_modules errors) |
| `bun run lint` | Biome linting for `src/` and `tests/` |
| `bun run lint:fix` | Biome lint with auto-fix |
| `bun run build` | Bundle to `dist/` |
| `bun test` | Run all tests (120s timeout default) |
| `bun test --timeout 120000` | Run tests with explicit long timeout (for LLM-calling tests) |

### Gotchas

- The `@oh-my-pi/pi-coding-agent` package ships TypeScript source files that contain `.md` and `.py` imports — tsc can't resolve these. The `check` script filters `node_modules/` errors. This is expected and not a bug.
- The `biome check` binary requires its postinstall to have run. If `bun run lint` fails with "binary not found", run `bun pm trust @biomejs/biome`.
- Tests that call real LLMs need API keys and long timeouts (120s+). Without API keys, those tests will be skipped or fail.
- Barrel exports: every `src/` subdirectory has an `index.ts` re-exporting its modules. When adding a new file, always add an export to the barrel.

### Project structure

See `Missions plan/AGENTS.md` for the full project AGENTS.md including coding conventions, oh-my-pi SDK patterns, and key technical decisions. The source layout:

```
src/
├── index.ts          # CLI entry point
├── types/            # Core type definitions
├── state/            # State management (features.json, etc.)
├── config/           # Configuration loading
├── session/          # Session factory (createAgentSession wrapper)
├── planner/          # Planning orchestrator
├── executor/         # Mission execution engine
├── validators/       # Scrutiny + user testing validators
├── tui/              # pi-tui terminal interface
└── utils/            # Shared utilities (git, etc.)
tests/                # Test files (*.test.ts)
Missions plan/        # Mission plan docs (features.json, mission.md, etc.)
```
