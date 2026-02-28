import { describe, expect, test } from "bun:test";
import { MissionControlView } from "../src/tui/index.js";
import type { Feature } from "../src/types/index.js";

function feature(id: string, status: Feature["status"], milestone: string): Feature {
	return {
		id,
		description: `Description for ${id}`,
		skillName: "dev-worker",
		milestone,
		preconditions: [],
		expectedBehavior: [],
		verificationSteps: [],
		fulfills: [],
		status,
	};
}

describe("mission control view", () => {
	test("renders mission header, feature statuses, milestone progress, and worker output", () => {
		const view = new MissionControlView("Demo Mission");
		view.setMissionStatus("executing");
		view.setFeatures([
			feature("f1", "completed", "foundation"),
			feature("f2", "in_progress", "foundation"),
			feature("f3", "failed", "planner"),
			feature("f4", "pending", "planner"),
		]);
		view.setWorkerOutput("running tests\nall good");

		const lines = view.render(120);
		const output = lines.join("\n");
		expect(output).toContain("Mission:");
		expect(output).toContain("Demo Mission");
		expect(output).toContain("\x1b[32m✓\x1b[0m");
		expect(output).toContain("\x1b[33m⟳\x1b[0m");
		expect(output).toContain("\x1b[31m✗\x1b[0m");
		expect(output).toContain("foundation: 1/2 features complete");
		expect(output).toContain("planner: 0/2 features complete");
		expect(output).toContain("running tests");
	});
});
