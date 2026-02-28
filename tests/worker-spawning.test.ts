import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkerSpawnError, spawnWorker } from "../src/executor/index.js";
import type { Feature, HandoffResult } from "../src/types/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

function makeFeature(): Feature {
	return {
		id: "feature-1",
		description: "Implement capability",
		skillName: "dev-worker",
		milestone: "executor",
		preconditions: ["setup complete"],
		expectedBehavior: ["works"],
		verificationSteps: ["bun test"],
		fulfills: ["VAL-EXEC-001"],
		status: "pending",
	};
}

function makeHandoff(): HandoffResult {
	return {
		salientSummary: "done",
		whatWasImplemented: "implemented",
		whatWasLeftUndone: "",
		verification: { commandsRun: [] },
		tests: { added: [], coverage: "none" },
		discoveredIssues: [],
		skillFeedback: { followedProcedure: true },
	};
}

describe("worker spawning", () => {
	test("reads skill file and includes content in worker system prompt", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-worker-mission-"));
		const targetDir = await mkdtemp(join(tmpdir(), "pi-missions-worker-target-"));
		tempDirs.push(missionDir, targetDir);

		const skillDir = join(targetDir, ".pi-missions", "skills", "dev-worker");
		await mkdir(skillDir, { recursive: true });
		await writeFile(join(skillDir, "SKILL.md"), "Use strict test-first workflow.");

		let capturedPrompt = "";
		let capturedTools: string[] = [];
		const fakeSession = {
			dispose: async () => undefined,
		};

		const handoff = await spawnWorker({
			feature: makeFeature(),
			missionDir,
			targetDir,
			createSession: async (config) => {
				capturedPrompt = config.systemPrompt;
				capturedTools = config.toolNames ?? [];
				return fakeSession as never;
			},
			executeWorkerTask: async () => makeHandoff(),
		});

		expect(capturedPrompt).toContain("Use strict test-first workflow.");
		expect(capturedPrompt).toContain("Implement capability");
		expect(capturedTools).toEqual(["read", "write", "edit", "bash", "grep", "find", "ls"]);
		expect(handoff.salientSummary).toBe("done");
	});

	test("runs init.sh before worker execution", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-worker-init-"));
		const targetDir = await mkdtemp(join(tmpdir(), "pi-missions-worker-target-"));
		tempDirs.push(missionDir, targetDir);
		const marker = join(missionDir, "init-ran.txt");

		await writeFile(
			join(missionDir, "init.sh"),
			["#!/usr/bin/env bash", "set -euo pipefail", `echo init > "${marker}"`, ""].join("\n"),
		);

		await spawnWorker({
			feature: makeFeature(),
			missionDir,
			targetDir,
			createSession: async () =>
				({
					dispose: async () => undefined,
				}) as never,
			executeWorkerTask: async () => makeHandoff(),
		});

		const markerExists = await Bun.file(marker).exists();
		expect(markerExists).toBeTrue();
	});

	test("init.sh failure throws WorkerSpawnError", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-worker-init-fail-"));
		const targetDir = await mkdtemp(join(tmpdir(), "pi-missions-worker-target-"));
		tempDirs.push(missionDir, targetDir);

		await writeFile(join(missionDir, "init.sh"), "#!/usr/bin/env bash\nexit 1\n");

		await expect(
			spawnWorker({
				feature: makeFeature(),
				missionDir,
				targetDir,
				createSession: async () =>
					({
						dispose: async () => undefined,
					}) as never,
				executeWorkerTask: async () => makeHandoff(),
			}),
		).rejects.toBeInstanceOf(WorkerSpawnError);
	});

	test("missing skill file falls back to default prompt content", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-worker-no-skill-mission-"));
		const targetDir = await mkdtemp(join(tmpdir(), "pi-missions-worker-no-skill-target-"));
		tempDirs.push(missionDir, targetDir);

		let capturedPrompt = "";
		await spawnWorker({
			feature: makeFeature(),
			missionDir,
			targetDir,
			createSession: async (config) => {
				capturedPrompt = config.systemPrompt;
				return {
					dispose: async () => undefined,
				} as never;
			},
			executeWorkerTask: async () => makeHandoff(),
		});

		expect(capturedPrompt).toContain("(No skill file content found.)");
	});
});
