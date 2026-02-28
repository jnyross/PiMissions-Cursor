import { afterEach, describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { type MissionPlanInput, generateMissionArtifacts } from "../src/planner/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

function samplePlan(): MissionPlanInput {
	return {
		title: "Demo Mission",
		description: "Plan description",
		milestones: [
			{ name: "foundation", description: "Build core" },
			{ name: "planner", description: "Build planning flow" },
		],
		features: [
			{
				id: "f-1",
				description: "Build state module",
				skillName: "dev-worker",
				milestone: "foundation",
				preconditions: [],
				expectedBehavior: ["works"],
				verificationSteps: ["bun test"],
				fulfills: ["VAL-001"],
			},
		],
		validationAssertions: [
			{
				id: "VAL-001",
				title: "State module works",
				description: "State functions should persist data.",
				evidence: "Automated tests pass",
				area: "Foundation",
			},
		],
		workerSkills: {
			"dev-worker": "Use TDD and produce concise handoff.",
		},
	};
}

describe("artifact generation", () => {
	test("generateMissionArtifacts creates all mission files", async () => {
		const targetDir = await mkdtemp(join(tmpdir(), "pi-missions-target-"));
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-mission-"));
		tempDirs.push(targetDir, missionDir);

		await generateMissionArtifacts(samplePlan(), targetDir, missionDir);

		for (const relative of [
			"mission.md",
			"validation-contract.md",
			"validation-state.json",
			"features.json",
			"services.yaml",
			"AGENTS.md",
			"init.sh",
		]) {
			await access(join(missionDir, relative));
		}

		await access(join(targetDir, ".pi-missions/skills/dev-worker/SKILL.md"));

		const features = JSON.parse(await readFile(join(missionDir, "features.json"), "utf-8")) as {
			features: Array<{ status: string }>;
		};
		expect(features.features[0]?.status).toBe("pending");

		const validationState = JSON.parse(await readFile(join(missionDir, "validation-state.json"), "utf-8")) as {
			assertions: Record<string, { status: string }>;
		};
		expect(validationState.assertions["VAL-001"]?.status).toBe("pending");

		const servicesYaml = parse(await readFile(join(missionDir, "services.yaml"), "utf-8")) as {
			commands: Record<string, string>;
		};
		expect(typeof servicesYaml.commands.test).toBe("string");
	});
});
