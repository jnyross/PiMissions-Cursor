import { describe, expect, test } from "bun:test";
import { WorkerStreamView } from "../src/tui/index.js";

describe("worker stream view", () => {
	test("appends text deltas and tool execution lines", () => {
		const view = new WorkerStreamView();
		view.handleSessionEvent({
			type: "message_update",
			assistantMessageEvent: { type: "text_delta", delta: "Hello" },
		});
		view.handleSessionEvent({
			type: "message_update",
			assistantMessageEvent: { type: "text_delta", delta: " world" },
		});
		view.handleSessionEvent({
			type: "tool_execution_start",
			toolName: "bash",
			args: { command: "bun test" },
		});
		view.handleSessionEvent({
			type: "tool_execution_end",
			toolName: "bash",
			isError: false,
		});

		const output = view.render(120).join("\n");
		expect(output).toContain("Hello world");
		expect(output).toContain("[tool:start] bash");
		expect(output).toContain("[tool:end] bash OK");
	});

	test("clearForNewWorker resets buffered content", () => {
		const view = new WorkerStreamView();
		view.handleSessionEvent({
			type: "message_update",
			assistantMessageEvent: { type: "text_delta", delta: "stale output" },
		});
		view.clearForNewWorker();
		const output = view.render(120).join("\n");
		expect(output).not.toContain("stale output");
		expect(output).toContain("(no streamed text yet)");
	});
});
