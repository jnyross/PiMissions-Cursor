import { describe, expect, mock, test } from "bun:test";
import { PlanningChatView } from "../src/tui/index.js";

describe("planning chat view", () => {
	test("renders conversation and markdown-like formatting", () => {
		const chat = new PlanningChatView();
		chat.addMessage({ role: "user", content: "Build me a CLI" });
		chat.addMessage({ role: "orchestrator", content: "**Plan**\n- First step" });

		const output = chat.render(120).join("\n");
		expect(output).toContain("You: Build me a CLI");
		expect(output).toContain("Orchestrator:");
		expect(output).toContain("PLAN");
		expect(output).toContain("• First step");
	});

	test("submits input and appends user message", async () => {
		const chat = new PlanningChatView();
		const onSubmit = mock(async (_message: string) => undefined);
		chat.onSubmit = onSubmit;

		await chat.handleInputAsync("h");
		await chat.handleInputAsync("i");
		await chat.handleInputAsync("\n");

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith("hi");
		expect(chat.messages.at(-1)).toEqual({ role: "user", content: "hi" });
	});

	test("streams orchestrator deltas into last assistant message", () => {
		const chat = new PlanningChatView();
		chat.appendOrchestratorDelta("Hello");
		chat.appendOrchestratorDelta(" world");
		expect(chat.messages.at(-1)).toEqual({ role: "orchestrator", content: "Hello world" });
	});
});
