import { describe, expect, test } from "bun:test";
import {
	getFeaturesByMilestone,
	getMilestoneOrder,
	getNextMilestone,
	getSealedMilestones,
	isMilestoneComplete,
} from "../src/state/index.js";
import type { Feature } from "../src/types/index.js";

function makeFeature(id: string, milestone: string, status: Feature["status"]): Feature {
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

describe("feature ordering helpers", () => {
	const features: Feature[] = [
		makeFeature("f1", "foundation", "completed"),
		makeFeature("f2", "foundation", "cancelled"),
		makeFeature("f3", "planner", "pending"),
		makeFeature("f4", "planner", "in_progress"),
		makeFeature("f5", "executor", "pending"),
	];

	test("getFeaturesByMilestone filters correctly", () => {
		expect(getFeaturesByMilestone(features, "planner").map((item) => item.id)).toEqual(["f3", "f4"]);
	});

	test("getMilestoneOrder returns milestones in first-seen order", () => {
		expect(getMilestoneOrder(features)).toEqual(["foundation", "planner", "executor"]);
	});

	test("isMilestoneComplete only passes when all features are terminal", () => {
		expect(isMilestoneComplete(features, "foundation")).toBeTrue();
		expect(isMilestoneComplete(features, "planner")).toBeFalse();
		expect(isMilestoneComplete(features, "unknown")).toBeFalse();
	});

	test("getNextMilestone returns first milestone with pending/in_progress work", () => {
		expect(getNextMilestone(features)).toBe("planner");
	});

	test("getSealedMilestones requires both completion and validation marker", () => {
		const sealed = getSealedMilestones(features, ["foundation", "planner"]);
		expect(sealed).toEqual(["foundation"]);
	});

	test("handles empty features list", () => {
		expect(getMilestoneOrder([])).toEqual([]);
		expect(getNextMilestone([])).toBeUndefined();
		expect(getSealedMilestones([], ["x"])).toEqual([]);
	});

	test("single feature milestone behavior", () => {
		const one = [makeFeature("one", "solo", "completed")];
		expect(isMilestoneComplete(one, "solo")).toBeTrue();
		expect(getNextMilestone(one)).toBeUndefined();
	});
});
