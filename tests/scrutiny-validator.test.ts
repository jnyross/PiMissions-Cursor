import { afterEach, describe, expect, mock, test } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFeatures, writeServicesYaml } from "../src/state/index.js";
import type { Feature } from "../src/types/index.js";
import { ScrutinyValidator } from "../src/validators/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

function feature(id: string, status: Feature["status"]): Feature {
	return {
		id,
		description: id,
		skillName: "dev-worker",
		milestone: "foundation",
		preconditions: [],
		expectedBehavior: [],
		verificationSteps: [],
		fulfills: [],
		status,
	};
}

describe("scrutiny validator", () => {
	test("fails fast when command checks fail", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-scrutiny-fail-"));
		tempDirs.push(missionDir);
		await writeFeatures(missionDir, [feature("f1", "completed")]);
		await writeServicesYaml(missionDir, {
			commands: { test: "cmd-test", lint: "cmd-lint", typecheck: "cmd-check" },
		});

		const reviewFeature = mock(async () => []);
		const validator = new ScrutinyValidator({
			runCommand: async (command) => ({
				command,
				exitCode: command === "cmd-lint" ? 1 : 0,
				output: command,
			}),
			reviewFeature,
		});

		const result = await validator.validate("foundation", missionDir);
		expect(result.status).toBe("failed");
		expect(result.reviewFindings.length).toBe(0);
		expect(reviewFeature).toHaveBeenCalledTimes(0);
		await access(result.reportPath);
	});

	test("runs reviews when checks pass and writes synthesis report", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-scrutiny-pass-"));
		tempDirs.push(missionDir);
		await writeFeatures(missionDir, [feature("f1", "completed"), feature("f2", "pending")]);
		await writeServicesYaml(missionDir, {
			commands: { test: "cmd-test", lint: "cmd-lint", typecheck: "cmd-check" },
		});

		const validator = new ScrutinyValidator({
			runCommand: async (command) => ({ command, exitCode: 0, output: `${command}:ok` }),
			reviewFeature: async (f) => [
				{
					featureId: f.id,
					severity: "info",
					description: `Reviewed ${f.id}`,
				},
			],
		});

		const result = await validator.validate("foundation", missionDir);
		expect(result.status).toBe("passed");
		expect(result.reviewFindings.length).toBe(1);
		expect(result.reviewFindings[0]?.featureId).toBe("f1");

		const synthesis = JSON.parse(await readFile(result.reportPath, "utf-8")) as { status: string };
		expect(synthesis.status).toBe("passed");
	});
});
