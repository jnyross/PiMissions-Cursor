import { describe, expect, mock, test } from "bun:test";
import { createPlanningTools } from "../src/planner/index.js";

describe("planning orchestrator tools", () => {
	test("tool callbacks are wired to handlers", async () => {
		const askUserQuestion = mock(async (question: string) => `answer:${question}`);
		const proposeMilestones = mock(async () => ({ approved: true as const }));
		const confirmPlan = mock(async () => ({ approved: false as const, feedback: "needs edits" }));
		const reviewPlan = mock(async () => ({ decision: "revise" as const, feedback: "change scope" }));

		const tools = createPlanningTools({
			askUserQuestion,
			proposeMilestones,
			confirmPlan,
			reviewPlan,
		});

		const askTool = tools.find((tool) => tool.name === "askUserQuestion");
		const proposeTool = tools.find((tool) => tool.name === "proposeMilestones");
		const confirmTool = tools.find((tool) => tool.name === "confirmPlan");
		const reviewTool = tools.find((tool) => tool.name === "reviewPlan");

		if (!askTool || !proposeTool || !confirmTool || !reviewTool) {
			throw new Error("Expected planner tools to exist.");
		}

		const askResult = await askTool.execute("1", { question: "What stack?" }, undefined, {} as never);
		expect(askResult.content[0]?.type).toBe("text");
		if (askResult.content[0]?.type !== "text") {
			throw new Error("Expected text content result.");
		}
		expect(askResult.content[0].text).toContain("answer:What stack?");
		expect(askUserQuestion).toHaveBeenCalledTimes(1);

		await proposeTool.execute(
			"2",
			{ milestones: [{ name: "foundation", description: "Core" }] },
			undefined,
			{} as never,
		);
		expect(proposeMilestones).toHaveBeenCalledTimes(1);

		await confirmTool.execute("3", { summary: "summary" }, undefined, {} as never);
		expect(confirmPlan).toHaveBeenCalledTimes(1);

		await reviewTool.execute("4", { proposalMarkdown: "# Proposal" }, undefined, {} as never);
		expect(reviewPlan).toHaveBeenCalledTimes(1);
	});
});
