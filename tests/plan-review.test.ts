import { describe, expect, test } from "bun:test";
import { type MissionPlanInput, formatMissionProposal, parsePlanReviewResponse } from "../src/planner/index.js";

const plan: MissionPlanInput = {
	title: "Sample",
	description: "A sample mission",
	milestones: [{ name: "foundation", description: "Core setup" }],
	features: [
		{
			id: "f1",
			description: "Do thing",
			skillName: "dev-worker",
			milestone: "foundation",
			preconditions: [],
			expectedBehavior: ["works"],
			verificationSteps: ["bun test"],
			fulfills: ["VAL-1"],
		},
	],
};

describe("plan review helpers", () => {
	test("formatMissionProposal includes major sections", () => {
		const proposal = formatMissionProposal(plan);
		expect(proposal).toContain("# Mission Proposal");
		expect(proposal).toContain("## Milestones");
		expect(proposal).toContain("## Features");
		expect(proposal).toContain("Reply with one of: approve, reject, or revise");
	});

	test("parsePlanReviewResponse parses approve/reject/revise", () => {
		expect(parsePlanReviewResponse("approve looks good")).toEqual({
			decision: "approve",
			feedback: "looks good",
		});
		expect(parsePlanReviewResponse("reject too broad")).toEqual({
			decision: "reject",
			feedback: "too broad",
		});
		expect(parsePlanReviewResponse("please revise milestone order")).toEqual({
			decision: "revise",
			feedback: "please revise milestone order",
		});
	});
});
