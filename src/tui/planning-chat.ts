import { type Component, truncateToWidth } from "@oh-my-pi/pi-tui";

export interface PlanningMessage {
	role: "user" | "orchestrator";
	content: string;
}

function renderMarkdownLike(text: string): string[] {
	return text.split("\n").map((line) => {
		const boldNormalized = line.replace(/\*\*(.+?)\*\*/g, (_, inner: string) => inner.toUpperCase());
		if (boldNormalized.startsWith("- ")) {
			return `• ${boldNormalized.slice(2)}`;
		}
		return boldNormalized;
	});
}

export class PlanningChatView implements Component {
	#messages: PlanningMessage[] = [];
	#inputBuffer = "";
	onSubmit?: (message: string) => Promise<void> | void;

	get messages(): PlanningMessage[] {
		return this.#messages;
	}

	addMessage(message: PlanningMessage): void {
		this.#messages.push(message);
	}

	appendOrchestratorDelta(delta: string): void {
		const last = this.#messages.at(-1);
		if (!last || last.role !== "orchestrator") {
			this.#messages.push({ role: "orchestrator", content: delta });
			return;
		}
		last.content += delta;
	}

	clearInput(): void {
		this.#inputBuffer = "";
	}

	invalidate(): void {}

	handleInput(data: string): void {
		void this.handleInputAsync(data);
	}

	async handleInputAsync(data: string): Promise<void> {
		if (data === "\n" || data === "\r") {
			const message = this.#inputBuffer.trim();
			this.#inputBuffer = "";
			if (!message) {
				return;
			}
			this.#messages.push({ role: "user", content: message });
			await this.onSubmit?.(message);
			return;
		}

		if (data === "\u007f") {
			this.#inputBuffer = this.#inputBuffer.slice(0, -1);
			return;
		}

		this.#inputBuffer += data;
	}

	render(width: number): string[] {
		const safeWidth = Math.max(20, width);
		const lines: string[] = [truncateToWidth("Planning Chat", safeWidth), truncateToWidth("─".repeat(80), safeWidth)];

		for (const message of this.#messages) {
			if (message.role === "user") {
				lines.push(truncateToWidth(`You: ${message.content}`, safeWidth));
				continue;
			}

			lines.push(truncateToWidth("Orchestrator:", safeWidth));
			for (const renderedLine of renderMarkdownLike(message.content)) {
				lines.push(truncateToWidth(`  ${renderedLine}`, safeWidth));
			}
		}

		lines.push(truncateToWidth("─".repeat(80), safeWidth));
		lines.push(truncateToWidth(`Input> ${this.#inputBuffer}`, safeWidth));
		return lines;
	}
}
