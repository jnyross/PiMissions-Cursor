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

function f(id: string, milestone: string, status: Feature["status"]): Feature {
	return {
		id,
		description: id,
		skillName: "dev-worker",
		milestone,
		preconditions: [],
		expectedBehavior: [],
		verificationSteps: [],
		fulfills: [],
		status,
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

describe("mission runner", () => {
	test("runs pending features sequentially and emits completion events", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-runner-"));
		tempDirs.push(missionDir);

		await writeFeatures(missionDir, [
			f("foundation-a", "foundation", "pending"),
			f("foundation-b", "foundation", "pending"),
		]);

		const spawnWorker = mock(async () => handoff());
		const processHandoff = mock(async () => ({ createdFixFeatureIds: [], issuesLogged: 0 }));
		const runner = new MissionRunner({ spawnWorker: spawnWorker as never, processHandoff: processHandoff as never });

		const events: string[] = [];
		runner.on("feature_start", (event) => events.push(`start:${event.feature.id}`));
		runner.on("feature_complete", (event) => events.push(`complete:${event.feature.id}`));
		runner.on("milestone_complete", (event) => events.push(`milestone:${event.milestone}`));
		runner.on("run_complete", () => events.push("done"));

		await runner.run(missionDir, { targetDir: missionDir });

		expect(spawnWorker).toHaveBeenCalledTimes(2);
		expect(events[0]).toBe("start:foundation-a");
		expect(events).toContain("milestone:foundation");
		expect(events.at(-1)).toBe("done");

		const finalFeatures = await readFeatures(missionDir);
		expect(finalFeatures.every((feature) => feature.status === "completed")).toBeTrue();
	});

	test("retries once on worker error and marks failed when retry also fails", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-runner-fail-"));
		tempDirs.push(missionDir);

		await writeFeatures(missionDir, [
			f("failing-feature", "executor", "pending"),
			f("next-feature", "executor", "pending"),
		]);

		const spawnWorker = mock(async ({ feature }: { feature: Feature }) => {
			if (feature.id === "failing-feature") {
				throw new Error("worker crashed");
			}
			return handoff();
		});
		const processHandoff = mock(async () => ({ createdFixFeatureIds: [], issuesLogged: 0 }));
		const runner = new MissionRunner({ spawnWorker: spawnWorker as never, processHandoff: processHandoff as never });

		const failedEvents: string[] = [];
		runner.on("feature_failed", (event) => failedEvents.push(event.feature.id));
		await runner.run(missionDir, { targetDir: missionDir });

		expect(failedEvents).toContain("failing-feature");
		expect(spawnWorker).toHaveBeenCalledTimes(3);

		const finalFeatures = await readFeatures(missionDir);
		const failing = finalFeatures.find((feature) => feature.id === "failing-feature");
		const next = finalFeatures.find((feature) => feature.id === "next-feature");
		expect(failing?.status).toBe("failed");
		expect(failing?.errorMessage).toContain("worker crashed");
		expect(next?.status).toBe("completed");
	});

	test("throws when attempting work in a sealed milestone", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-runner-sealed-"));
		tempDirs.push(missionDir);
		await writeFeatures(missionDir, [f("sealed-feature", "foundation", "pending")]);

		const runner = new MissionRunner({
			spawnWorker: (async () => handoff()) as never,
			processHandoff: (async () => ({ createdFixFeatureIds: [], issuesLogged: 0 })) as never,
		});

		await expect(runner.run(missionDir, { sealedMilestones: ["foundation"], targetDir: missionDir })).rejects.toThrow(
			'Milestone "foundation" is sealed',
		);
	});
});
