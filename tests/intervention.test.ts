import { describe, expect, mock, test } from "bun:test";
import { InterventionManager } from "../src/executor/index.js";

describe("intervention manager", () => {
	test("pause and resume toggles state and unblocks waiters", async () => {
		const manager = new InterventionManager();
		manager.pause();
		expect(manager.isPaused()).toBeTrue();

		let released = false;
		const waiter = manager.waitIfPaused().then(() => {
			released = true;
		});

		await Bun.sleep(20);
		expect(released).toBeFalse();
		manager.resume();
		await waiter;
		expect(manager.isPaused()).toBeFalse();
		expect(released).toBeTrue();
	});

	test("steer delegates to explicit steering handler when provided", async () => {
		const steeringHandler = mock(async (_message: string) => undefined);
		const manager = new InterventionManager({ steeringHandler });
		await manager.steer("prioritize feature xyz");
		expect(steeringHandler).toHaveBeenCalledTimes(1);
		expect(steeringHandler).toHaveBeenCalledWith("prioritize feature xyz");
	});

	test("steer prompts orchestrator session when no handler is provided", async () => {
		const prompt = mock(async (_message: string) => undefined);
		const manager = new InterventionManager({
			orchestratorSession: {
				prompt,
			} as never,
		});
		await manager.steer("skip next feature");
		expect(prompt).toHaveBeenCalledTimes(1);
		expect(prompt).toHaveBeenCalledWith("skip next feature");
	});
});
