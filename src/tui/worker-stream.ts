import { type Component, truncateToWidth } from "@oh-my-pi/pi-tui";

export interface WorkerStreamEvent {
	type: string;
	assistantMessageEvent?: {
		type?: string;
		delta?: string;
	};
	toolName?: string;
	args?: Record<string, unknown>;
	isError?: boolean;
}

function formatToolArgs(args: Record<string, unknown> | undefined): string {
	if (!args) {
		return "";
	}
	const entries = Object.entries(args).slice(0, 3);
	if (entries.length === 0) {
		return "";
	}
	return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ");
}

export class WorkerStreamView implements Component {
	#textBuffer = "";
	#eventLines: string[] = [];

	clearForNewWorker(): void {
		this.#textBuffer = "";
		this.#eventLines = [];
	}

	handleSessionEvent(event: WorkerStreamEvent): void {
		if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
			this.#textBuffer += event.assistantMessageEvent.delta ?? "";
			return;
		}

		if (event.type === "tool_execution_start") {
			const argsText = formatToolArgs(event.args);
			this.#eventLines.push(`\x1b[90m[tool:start] ${event.toolName ?? "unknown"} ${argsText}\x1b[0m`);
			return;
		}

		if (event.type === "tool_execution_end") {
			const status = event.isError ? "ERROR" : "OK";
			this.#eventLines.push(`\x1b[90m[tool:end] ${event.toolName ?? "unknown"} ${status}\x1b[0m`);
		}
	}

	invalidate(): void {}

	render(width: number): string[] {
		const safeWidth = Math.max(20, width);
		const lines: string[] = [truncateToWidth("Worker Stream", safeWidth), truncateToWidth("─".repeat(80), safeWidth)];
		for (const eventLine of this.#eventLines) {
			lines.push(truncateToWidth(eventLine, safeWidth));
		}

		const textLines = this.#textBuffer.split("\n").filter((line) => line.length > 0);
		if (textLines.length === 0) {
			lines.push(truncateToWidth("\x1b[90m(no streamed text yet)\x1b[0m", safeWidth));
		} else {
			for (const textLine of textLines) {
				lines.push(truncateToWidth(textLine, safeWidth));
			}
		}
		return lines;
	}
}
