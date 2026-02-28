import { afterEach, describe, expect, test } from "bun:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { processHandoff } from "../src/executor/index.js";
import { readFeatures, writeFeatures } from "../src/state/index.js";
import type { Feature, HandoffResult } from "../src/types/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

function makeFeature(id: string): Feature {
	return {
		id,
		description: id,
		skillName: "dev-worker",
		milestone: "foundation",
		preconditions: [],
		expectedBehavior: [],
		verificationSteps: [],
		fulfills: [],
		status: "pending",
	};
}

function makeHandoff(): HandoffResult {
	return {
		salientSummary: "summary",
		whatWasImplemented: "implemented",
		whatWasLeftUndone: "need cleanup",
		verification: { commandsRun: [] },
		tests: { added: [], coverage: "none" },
		discoveredIssues: [
			{ severity: "high", description: "security issue", suggestedFix: "patch it" },
			{ severity: "low", description: "minor issue" },
		],
		skillFeedback: { followedProcedure: true },
	};
}

describe("handoff processing", () => {
	test("processHandoff saves handoff and creates fix features", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-handoff-"));
		tempDirs.push(missionDir);
		await writeFeatures(missionDir, [makeFeature("feature-1")]);

		const summary = await processHandoff(makeHandoff(), makeFeature("feature-1"), missionDir);
		expect(summary.createdFixFeatureIds.length).toBe(2);
		expect(summary.issuesLogged).toBe(2);

		const features = await readFeatures(missionDir);
		expect(features[0]?.id.startsWith("fix-feature-1")).toBeTrue();
		expect(features[1]?.id.startsWith("fix-feature-1")).toBeTrue();

		await access(join(missionDir, "handoffs", "feature-1.json"));
	});
});
