import { type Component, truncateToWidth } from "@oh-my-pi/pi-tui";
import type { Feature } from "../types/index.js";

const ANSI = {
	reset: "\x1b[0m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	gray: "\x1b[90m",
	cyan: "\x1b[36m",
};

function statusIndicator(status: Feature["status"]): string {
	switch (status) {
		case "completed":
			return `${ANSI.green}✓${ANSI.reset}`;
		case "failed":
			return `${ANSI.red}✗${ANSI.reset}`;
		case "in_progress":
			return `${ANSI.yellow}⟳${ANSI.reset}`;
		case "cancelled":
			return `${ANSI.gray}·${ANSI.reset}`;
		default:
			return `${ANSI.gray}–${ANSI.reset}`;
	}
}

export class MissionControlView implements Component {
	#missionName: string;
	#status: "planning" | "executing" | "paused" | "completed";
	#features: Feature[];
	#workerOutput: string;

	constructor(missionName: string) {
		this.#missionName = missionName;
		this.#status = "planning";
		this.#features = [];
		this.#workerOutput = "";
	}

	setMissionStatus(status: "planning" | "executing" | "paused" | "completed"): void {
		this.#status = status;
	}

	setFeatures(features: Feature[]): void {
		this.#features = features;
	}

	setWorkerOutput(output: string): void {
		this.#workerOutput = output;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const lines: string[] = [];
		const safeWidth = Math.max(20, width);
		lines.push(truncateToWidth(`${ANSI.cyan}Mission:${ANSI.reset} ${this.#missionName}  [${this.#status}]`, safeWidth));
		lines.push(truncateToWidth("─".repeat(Math.min(safeWidth, 80)), safeWidth));
		lines.push(truncateToWidth("Features:", safeWidth));

		for (const feature of this.#features) {
			lines.push(
				truncateToWidth(
					`${statusIndicator(feature.status)} ${feature.id} (${feature.milestone}) ${feature.description}`,
					safeWidth,
				),
			);
		}

		lines.push(truncateToWidth("Milestones:", safeWidth));
		const milestones = new Map<string, { done: number; total: number }>();
		for (const feature of this.#features) {
			const progress = milestones.get(feature.milestone) ?? { done: 0, total: 0 };
			progress.total += 1;
			if (feature.status === "completed") {
				progress.done += 1;
			}
			milestones.set(feature.milestone, progress);
		}
		for (const [milestone, progress] of milestones.entries()) {
			lines.push(truncateToWidth(`- ${milestone}: ${progress.done}/${progress.total} features complete`, safeWidth));
		}

		lines.push(truncateToWidth("Worker Output:", safeWidth));
		const outputLines = this.#workerOutput.split("\n").filter((line) => line.length > 0);
		if (outputLines.length === 0) {
			lines.push(truncateToWidth(`${ANSI.gray}(no worker output yet)${ANSI.reset}`, safeWidth));
		} else {
			for (const line of outputLines) {
				lines.push(truncateToWidth(line, safeWidth));
			}
		}

		return lines;
	}
}
