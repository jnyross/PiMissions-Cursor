import { type Component, truncateToWidth } from "@oh-my-pi/pi-tui";
import type { InterventionManager } from "../executor/index.js";

export class StatusDashboard implements Component {
	#interventionManager: InterventionManager;
	#runState: "Running" | "Paused" | "Completed" = "Running";
	#steeringMode = false;
	#steeringBuffer = "";
	#quitRequested = false;
	#lastSteerMessage: string | null = null;

	constructor(interventionManager: InterventionManager) {
		this.#interventionManager = interventionManager;
	}

	get quitRequested(): boolean {
		return this.#quitRequested;
	}

	get lastSteerMessage(): string | null {
		return this.#lastSteerMessage;
	}

	setRunState(state: "Running" | "Paused" | "Completed"): void {
		this.#runState = state;
	}

	invalidate(): void {}

	handleInput(data: string): void {
		void this.handleInputAsync(data);
	}

	async handleInputAsync(data: string): Promise<void> {
		if (data === "\x10") {
			if (this.#interventionManager.isPaused()) {
				this.#interventionManager.resume();
				this.#runState = "Running";
			} else {
				this.#interventionManager.pause();
				this.#runState = "Paused";
			}
			return;
		}

		if (data === "\x13") {
			this.#steeringMode = true;
			this.#steeringBuffer = "";
			return;
		}

		if (data === "\x11") {
			this.#quitRequested = true;
			return;
		}

		if (!this.#steeringMode) {
			return;
		}

		if (data === "\n" || data === "\r") {
			const message = this.#steeringBuffer.trim();
			this.#steeringMode = false;
			this.#steeringBuffer = "";
			if (!message) {
				return;
			}
			this.#lastSteerMessage = message;
			await this.#interventionManager.steer(message);
			return;
		}

		if (data === "\u007f") {
			this.#steeringBuffer = this.#steeringBuffer.slice(0, -1);
			return;
		}

		this.#steeringBuffer += data;
	}

	render(width: number): string[] {
		const safeWidth = Math.max(20, width);
		const lines: string[] = [
			truncateToWidth("Ctrl+P: Pause/Resume  Ctrl+S: Steer  Ctrl+Q: Quit", safeWidth),
			truncateToWidth(`State: ${this.#runState}`, safeWidth),
		];

		if (this.#steeringMode) {
			lines.push(truncateToWidth(`Steer> ${this.#steeringBuffer}`, safeWidth));
		} else if (this.#lastSteerMessage) {
			lines.push(truncateToWidth(`Last steer: ${this.#lastSteerMessage}`, safeWidth));
		}

		return lines;
	}
}
