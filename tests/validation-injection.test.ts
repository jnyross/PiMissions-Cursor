import { describe, expect, test } from "bun:test";
import type { Feature } from "../src/types/index.js";
import { injectValidationFeatures, setValidatorPending } from "../src/validators/index.js";

function feature(id: string, milestone: string, status: Feature["status"] = "pending"): Feature {
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

describe("validation injection", () => {
	test("injects scrutiny and user-testing features after milestone implementation work", () => {
		const features = [
			feature("foundation-a", "foundation", "completed"),
			feature("foundation-b", "foundation", "completed"),
			feature("planner-a", "planner", "pending"),
		];

		const injected = injectValidationFeatures(features, "foundation");
		expect(injected.map((item) => item.id)).toEqual([
			"foundation-a",
			"foundation-b",
			"scrutiny-foundation",
			"user-testing-foundation",
			"planner-a",
		]);
	});

	test("does not inject duplicates when validator features already exist", () => {
		const features = [
			feature("foundation-a", "foundation", "completed"),
			{
				...feature("scrutiny-foundation", "foundation", "pending"),
				skillName: "scrutiny-validator",
			},
			{
				...feature("user-testing-foundation", "foundation", "pending"),
				skillName: "user-testing-validator",
			},
		];

		const injected = injectValidationFeatures(features, "foundation");
		expect(injected).toEqual(features);
	});

	test("setValidatorPending resets validator status", () => {
		const features = [
			{
				...feature("scrutiny-foundation", "foundation", "failed"),
				skillName: "scrutiny-validator",
			},
			feature("foundation-a", "foundation", "completed"),
		];

		const updated = setValidatorPending(features, "scrutiny-foundation");
		expect(updated[0]?.status).toBe("pending");
		expect(updated[1]?.status).toBe("completed");
	});
});
