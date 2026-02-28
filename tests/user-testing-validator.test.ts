import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFeatures, writeValidationState } from "../src/state/index.js";
import type { Feature } from "../src/types/index.js";
import { UserTestingValidator } from "../src/validators/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

function feature(id: string, milestone: string, fulfills: string[]): Feature {
	return {
		id,
		description: id,
		skillName: "dev-worker",
		milestone,
		preconditions: [],
		expectedBehavior: [],
		verificationSteps: [],
		fulfills,
		status: "completed",
	};
}

const contractMarkdown = `
# Validation Contract

## Area: Planning

### VAL-PLAN-001: Start mission
The planner starts.
Evidence: output contains greeting.

### VAL-PLAN-002: Ask questions
Planner asks clarifying questions.
Evidence: output shows questions.
`.trim();

describe("user-testing validator", () => {
	test("evaluates milestone assertions and updates validation-state", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-user-testing-"));
		tempDirs.push(missionDir);
		await writeFile(join(missionDir, "validation-contract.md"), `${contractMarkdown}\n`);
		await writeFeatures(missionDir, [feature("plan-feature", "planner", ["VAL-PLAN-001", "VAL-PLAN-002"])]);
		await writeValidationState(missionDir, {
			assertions: {
				"VAL-PLAN-001": { status: "pending" },
				"VAL-PLAN-002": { status: "pending" },
			},
		});

		const validator = new UserTestingValidator({
			testAssertion: async (assertion) => ({
				assertionId: assertion.id,
				status: assertion.id === "VAL-PLAN-001" ? "passed" : "failed",
				evidence: `evidence:${assertion.id}`,
			}),
		});

		const result = await validator.validate("planner", missionDir);
		expect(result.status).toBe("failed");
		expect(result.testedAssertionIds).toEqual(["VAL-PLAN-001", "VAL-PLAN-002"]);

		const updatedState = JSON.parse(await readFile(join(missionDir, "validation-state.json"), "utf-8")) as {
			assertions: Record<string, { status: string }>;
		};
		expect(updatedState.assertions["VAL-PLAN-001"]?.status).toBe("passed");
		expect(updatedState.assertions["VAL-PLAN-002"]?.status).toBe("failed");
	});

	test("rerun mode only retests failed or blocked assertions", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-user-testing-rerun-"));
		tempDirs.push(missionDir);
		await writeFile(join(missionDir, "validation-contract.md"), `${contractMarkdown}\n`);
		await writeFeatures(missionDir, [feature("plan-feature", "planner", ["VAL-PLAN-001", "VAL-PLAN-002"])]);
		await writeValidationState(missionDir, {
			assertions: {
				"VAL-PLAN-001": { status: "passed" },
				"VAL-PLAN-002": { status: "failed" },
			},
		});

		const tested: string[] = [];
		const validator = new UserTestingValidator({
			rerun: true,
			testAssertion: async (assertion) => {
				tested.push(assertion.id);
				return {
					assertionId: assertion.id,
					status: "passed",
					evidence: "retested",
				};
			},
		});

		const result = await validator.validate("planner", missionDir);
		expect(result.status).toBe("passed");
		expect(tested).toEqual(["VAL-PLAN-002"]);
	});
});
