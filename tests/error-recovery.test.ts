import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MissionRunner } from "../src/executor/index.js";
import { readFeatures, writeFeatures } from "../src/state/index.js";
import type { Feature, HandoffResult } from "../src/types/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

function feature(id: string): Feature {
	return {
		id,
		description: id,
		skillName: "dev-worker",
		milestone: "executor",
		preconditions: [],
		expectedBehavior: [],
		verificationSteps: [],
		fulfills: [],
		status: "pending",
	};
}

function handoff(): HandoffResult {
	return {
		salientSummary: "ok",
		whatWasImplemented: "done",
		whatWasLeftUndone: "",
		verification: { commandsRun: [] },
		tests: { added: [], coverage: "none" },
		discoveredIssues: [],
		skillFeedback: { followedProcedure: true },
	};
}

describe("error recovery", () => {
	test("retries a feature once and succeeds on second attempt", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-recovery-"));
		tempDirs.push(missionDir);
		await writeFeatures(missionDir, [feature("recoverable")]);

		let attempts = 0;
		const spawnWorker = mock(async () => {
			attempts += 1;
			if (attempts === 1) {
				throw new Error("transient provider error");
			}
			return handoff();
		});

		const runner = new MissionRunner({
			spawnWorker: spawnWorker as never,
			processHandoff: (async () => ({ createdFixFeatureIds: [], issuesLogged: 0 })) as never,
		});

		await runner.run(missionDir, { targetDir: missionDir });

		expect(spawnWorker).toHaveBeenCalledTimes(2);
		const features = await readFeatures(missionDir);
		expect(features[0]?.status).toBe("completed");
	});
});
