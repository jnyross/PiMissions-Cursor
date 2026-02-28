import type { AgentSession } from "@oh-my-pi/pi-coding-agent";

export type SteeringHandler = (message: string) => Promise<void>;

export class InterventionManager {
	#paused = false;
	#waiters: Array<() => void> = [];
	#steeringHandler?: SteeringHandler;
	#orchestratorSession?: AgentSession;

	constructor(options: { steeringHandler?: SteeringHandler; orchestratorSession?: AgentSession } = {}) {
		this.#steeringHandler = options.steeringHandler;
		this.#orchestratorSession = options.orchestratorSession;
	}

	isPaused(): boolean {
		return this.#paused;
	}

	pause(): void {
		this.#paused = true;
	}

	resume(): void {
		this.#paused = false;
		const waiters = [...this.#waiters];
		this.#waiters = [];
		for (const waiter of waiters) {
			waiter();
		}
	}

	async waitIfPaused(): Promise<void> {
		if (!this.#paused) {
			return;
		}

		await new Promise<void>((resolve) => {
			this.#waiters.push(resolve);
		});
	}

	async steer(message: string): Promise<void> {
		if (this.#steeringHandler) {
			await this.#steeringHandler(message);
			return;
		}
		if (this.#orchestratorSession) {
			await this.#orchestratorSession.prompt(message);
		}
	}
}
