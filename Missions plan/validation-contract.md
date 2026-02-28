# Validation Contract: Pi Missions

## Area: Setup & Configuration

### VAL-SETUP-001: CLI installation
Running `bun install` in the project directory installs all dependencies (including `@oh-my-pi/pi-coding-agent`) without errors, and the `pi-missions` binary is available via `bun run` or direct execution.
Evidence: terminal output of install command (exit code 0), `bun run pi-missions --help` returns usage info

### VAL-SETUP-002: Setup wizard - API key configuration
Running `pi-missions setup` presents an interactive wizard that prompts for an LLM provider selection, accepts an API key, validates the key by making a test LLM call, and persists the credentials to `.pi-missions/credentials.json` (or oh-my-pi's auth storage).
Evidence: terminal output showing wizard flow, credential file exists after completion, no API key printed to terminal

### VAL-SETUP-003: Configuration file loading
When `.pi-missions/config.json` exists with settings (e.g., default model, thinking level), the system loads and applies those settings. When the file is absent, sensible defaults are used.
Evidence: terminal output showing config values in use, different behavior with/without config file

### VAL-SETUP-004: Invalid API key handling
When the user provides an invalid API key during setup or when a configured key has expired, the system shows a clear error message indicating the key is invalid and does not crash or hang.
Evidence: terminal output showing descriptive error message, no stack trace or hang

---

## Area: Mission Planning

### VAL-PLAN-001: Start new mission
Running `pi-missions new` in a directory enters an interactive planning session. The orchestrator agent greets the user and asks about their goals and what they want to build.
Evidence: terminal output showing orchestrator's opening message and initial question

### VAL-PLAN-002: Clarifying questions
During planning, the orchestrator asks at least 2 clarifying questions about different aspects of the project (e.g., requirements vs. technology choices vs. constraints vs. scope) before proposing milestones. It waits for user input between questions.
Evidence: terminal output showing distinct questions asked, waiting for user input between them

### VAL-PLAN-003: Milestone identification and confirmation
The orchestrator proposes milestones (vertical slices of functionality), presents them with descriptions, and explicitly asks for user confirmation before proceeding. If the user objects, it revises.
Evidence: terminal output showing milestone list, confirmation prompt, user response handling

### VAL-PLAN-004: Infrastructure discovery
The planner scans for running services (listening ports), existing project files, and available tools before proposing infrastructure needs. It reports what it found and asks the user to confirm.
Evidence: terminal output showing detected services/ports and confirmation prompt. If no services are detected, it reports that no running services were found and proceeds.

### VAL-PLAN-005: Validation contract generation
After plan approval, a `validation-contract.md` file is generated containing behavioral assertions organized by area with stable IDs (e.g., `VAL-FEAT-001`), each with a behavioral description and evidence requirements.
Evidence: file exists at the correct path, contains assertion IDs with descriptions, organized by area

### VAL-PLAN-006: Feature decomposition
After plan approval, a `features.json` file is generated with an array of features, each having all required fields: `id`, `description`, `skillName`, `milestone`, `preconditions`, `expectedBehavior`, `verificationSteps`, `fulfills`, and `status` (initially "pending").
Evidence: file exists, valid JSON, all fields present on every feature

### VAL-PLAN-007: Worker skill generation
After plan approval, skill files are generated at `.pi-missions/skills/{worker-type}/SKILL.md` with YAML frontmatter (name, description), a work procedure, and an example handoff section.
Evidence: at least one skill file exists with correct structure

### VAL-PLAN-008: Services manifest generation
After plan approval, a `services.yaml` file is generated with a `commands` section (install, test, build, lint) and optionally a `services` section for long-running processes with start/stop/healthcheck/port fields.
Evidence: file exists, valid YAML, commands section present

### VAL-PLAN-009: Mission proposal review
The planner presents a structured mission proposal (plan overview, milestones, features, infrastructure, testing strategy) and the user can approve, reject, or request changes. On rejection, the planner revises and re-presents.
Evidence: terminal output showing proposal display, approval/rejection flow

### VAL-PLAN-010: All artifacts created on approval
When the user approves the plan, ALL mission artifacts are created: mission.md, features.json, validation-contract.md, validation-state.json, AGENTS.md, services.yaml, init.sh, and at least one skill file.
Evidence: all files exist in the correct locations (mission dir and project .pi-missions/)

---

## Area: Mission Execution

### VAL-EXEC-001: Sequential feature execution
The mission runner picks the first pending feature from features.json and spawns a worker session for it. When that worker completes, it picks the next pending feature.
Evidence: terminal output showing "Starting feature: {id}" messages in order, features.json status updates

### VAL-EXEC-002: Worker session configuration
Each worker session receives a system prompt that includes the feature description, expected behavior, and verification steps. The tool set includes at minimum read, write, edit, bash, grep, and find.
Evidence: terminal output / logs showing system prompt content and active tools for a worker

### VAL-EXEC-003: Worker handoff collection
When a worker completes, its structured handoff (containing whatWasImplemented, whatWasLeftUndone, verification.commandsRun, verification.interactiveChecks, tests.added, discoveredIssues) is collected, parsed, and stored.
Evidence: handoff data displayed in terminal, handoff file saved

### VAL-EXEC-004: Feature state transitions
Features transition from "pending" to "in_progress" when a worker starts, and to "completed" (on success) or "failed" (on failure). The features.json file reflects these changes persistently.
Evidence: features.json content at different stages shows correct status values

### VAL-EXEC-005: Fix feature creation
When a worker reports discoveredIssues or whatWasLeftUndone, the orchestrator creates new fix features at the top of the pending features array in features.json.
Evidence: features.json shows new features with IDs like "fix-{original-id}" added before other pending features

### VAL-EXEC-007: Mid-mission steering
While a mission is running, the user can send a message to the orchestrator to change direction (e.g., "skip feature X", "add a new feature for Y", "change the approach to Z"). The orchestrator updates the plan accordingly.
Evidence: terminal output showing user message, orchestrator response, and features.json changes

### VAL-EXEC-008: Milestone boundary detection
When all features in a milestone are completed, the system detects this boundary and automatically triggers the validation phase for that milestone before proceeding to the next milestone.
Evidence: terminal output showing "Milestone {name} complete, starting validation" or equivalent

### VAL-EXEC-010: Error recovery
If a worker session fails due to an LLM API error or crash, the system logs the error, marks the feature as failed, and continues to the next feature (or retries once before failing).
Evidence: terminal output showing error message, feature status "failed" in features.json, next feature starting

### VAL-EXEC-011: Worker skill injection
Worker sessions for features with a `skillName` include the corresponding `.pi-missions/skills/{skillName}/SKILL.md` content in their system prompt or context. The skill's work procedure guides the worker's execution.
Evidence: terminal output / logs showing skill content present in worker's prompt

### VAL-EXEC-012: Sealed milestone enforcement
Once a milestone's validation passes, no new features are added to that milestone. Any follow-up work discovered after validation is assigned to a later milestone.
Evidence: features.json showing new features assigned to non-sealed milestones

---

## Area: Validation

### VAL-VAL-001: Scrutiny validator runs tests
At milestone boundaries, the scrutiny validator runs the project's test command (from services.yaml `commands.test`) and reports pass/fail with output.
Evidence: terminal output showing test command execution and results

### VAL-VAL-002: Scrutiny validator runs lint/typecheck
The scrutiny validator runs lint and typecheck commands (from services.yaml) and reports results. Failures are blocking.
Evidence: terminal output showing lint/typecheck execution and results

### VAL-VAL-003: Scrutiny code review
The scrutiny validator spawns at least one review subagent that examines the code changes from completed features and reports findings with severity levels.
Evidence: review report file in `.pi-missions/validation/{milestone}/scrutiny/`, contains findings

### VAL-VAL-004: User testing validator
The user-testing validator reads validation-contract.md, identifies which assertions are testable for this milestone (based on features' `fulfills` field), and spawns subagents to test them.
Evidence: terminal output showing which assertions are being tested, subagent activity

### VAL-VAL-005: Validation state tracking
After user testing, validation-state.json is updated with pass/fail/blocked status for each tested assertion, with evidence pointers (e.g., screenshot path, command output reference).
Evidence: validation-state.json content shows updated statuses (not all "pending")

### VAL-VAL-006: Validation failure triggers fix cycle
When a validator fails (tests don't pass, or assertions fail), the orchestrator creates fix features, workers execute the fixes, and the validator re-runs. On re-run, it only re-checks what previously failed.
Evidence: features.json shows fix features, validator runs twice (initial fail, then re-run), second run checks fewer items

### VAL-VAL-007: Validation reports
Synthesis reports are written to `.pi-missions/validation/{milestone}/scrutiny/synthesis.json` and `.pi-missions/validation/{milestone}/user-testing/synthesis.json` with structured findings.
Evidence: report files exist with valid JSON content

---

## Area: Terminal UI

### VAL-TUI-001: Mission control layout
The terminal displays a mission control layout with a feature list panel (showing all features with statuses) and a main content area (for worker output), distinguishable by borders, headers, or spatial separation in terminal output.
Evidence: terminal screenshot/output showing the layout with visible sections

### VAL-TUI-002: Real-time worker streaming
During worker execution, LLM text deltas render incrementally in the TUI (character by character or chunk by chunk), and tool calls show the tool name and key arguments as they happen.
Evidence: terminal output during worker execution showing incremental text and tool indicators

### VAL-TUI-003: Planning conversation UI
The TUI supports a multi-turn chat interface for the planning phase: the user types messages, the orchestrator responds, and the conversation scrolls naturally. Markdown in responses is rendered with formatting.
Evidence: terminal output showing formatted back-and-forth conversation

### VAL-TUI-004: Status indicators
Each feature shows a visual status indicator (e.g., icon or color) for pending, in_progress, completed, and failed states. Milestones show aggregate progress (e.g., "3/7 features complete").
Evidence: terminal output containing ANSI escape codes for status differentiation, or output containing distinct status markers (e.g., checkmark, X, spinner characters) for different states

### VAL-TUI-005: User controls
The TUI provides a way to pause/resume the mission (e.g., keyboard shortcut like Ctrl+P) and an input field to send steering messages to the orchestrator during execution.
Evidence: terminal output showing pause/resume toggle and steering message submission

---

## Area: CLI Commands

### VAL-CLI-001: pi-missions new
Running `pi-missions new` in any directory starts the planning flow. If no git repo exists, it prompts to initialize one. The command enters the TUI planning interface.
Evidence: terminal output showing command execution and planning interface appearing

### VAL-CLI-002: pi-missions resume
Running `pi-missions resume` in a directory with an existing mission loads the mission state and continues execution from where it left off. If no mission exists, it shows an error.
Evidence: terminal output showing mission loading and execution resuming

### VAL-CLI-003: pi-missions status
Running `pi-missions status` outputs a summary of the current mission: total features, completed/pending/failed counts, current milestone, validation status, and last activity timestamp.
Evidence: terminal output showing structured status information

### VAL-CLI-004: pi-missions list
Running `pi-missions list` shows all missions associated with the current directory, with their creation date, status (planning/executing/completed), and feature count.
Evidence: terminal output showing mission list

### VAL-CLI-005: pi-missions setup
Running `pi-missions setup` is a valid command that launches the setup wizard (detailed behavior tested in VAL-SETUP-002).
Evidence: terminal output showing command is recognized and wizard starts

---

## Area: Security

### VAL-SEC-001: Credentials never in logs or git
API keys and credentials are never printed to the terminal output, never written to session log files, and never committed to git. The `.pi-missions/credentials.json` file (if used) is added to `.gitignore`.
Evidence: grep terminal output and log files for key patterns, check .gitignore contains credentials path

### VAL-SEC-002: Atomic state writes
Mission state files (features.json, validation-state.json) are written atomically (write to temp file, then rename) so that a crash mid-write does not corrupt state.
Evidence: code inspection or test that kills process during write and verifies file integrity on restart

---

## Cross-Area Flows

### VAL-CROSS-001: Full mission lifecycle
A user runs `pi-missions new`, has a planning conversation, approves the plan, watches workers execute features sequentially, sees milestone validation run, and the mission completes with all features "completed" and validation assertions "passed" in validation-state.json.
Evidence: terminal output through full lifecycle, features.json all completed, validation-state.json all passed

### VAL-CROSS-002: Resume interrupted mission
A user starts a mission, lets 2+ features complete, pauses/exits the tool, then runs `pi-missions resume`. The system loads saved state, skips completed features, and continues from the next pending feature.
Evidence: terminal output showing pause, then resume showing correct feature pickup, features.json unchanged for completed features

### VAL-CROSS-003: Validation failure to fix cycle
A milestone completes, validation runs and fails (e.g., test failures), the orchestrator creates fix features automatically, fix features execute, validation re-runs and passes.
Evidence: features.json showing fix features, validation-state.json transitioning from "failed" to "passed"

### VAL-CROSS-004: Planning to execution handoff
After approving the plan in the planning UI, the system transitions to the execution view. All mission artifacts exist (features.json, validation-contract.md, AGENTS.md, services.yaml). The first feature begins executing without additional user action.
Evidence: terminal output showing transition from planning to execution, all artifact files present, first worker starting

### VAL-CROSS-005: Multi-milestone progression
A mission with 2+ milestones executes milestone 1 features, runs milestone 1 validation, then proceeds to milestone 2 features and milestone 2 validation. Each milestone boundary is clearly indicated.
Evidence: terminal output showing milestone transitions, validation between milestones, features from different milestones executing in correct order

### VAL-CROSS-006: Init script runs before workers
The `init.sh` script (if present) runs at the start of each worker session before the worker begins its task. If init.sh fails, the worker reports the failure rather than proceeding with a broken environment.
Evidence: terminal output showing init.sh execution before worker task, error handling on init failure

### VAL-CROSS-007: Mission completion summary
When all features are completed and all validations pass, the system displays a summary showing total features completed, time elapsed, milestones passed, and any assertions that were validated.
Evidence: terminal output showing completion summary with statistics
