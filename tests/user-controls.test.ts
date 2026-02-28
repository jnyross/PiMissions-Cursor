import { describe, expect, mock, test } from "bun:test";
import { InterventionManager } from "../src/executor/index.js";
import { StatusDashboard } from "../src/tui/index.js";

describe("status dashboard controls", () => {
	test("Ctrl+P toggles pause/resume", async () => {
		const manager = new InterventionManager();
		const dashboard = new StatusDashboard(manager);

		await dashboard.handleInputAsync("\x10");
		expect(manager.isPaused()).toBeTrue();

		await dashboard.handleInputAsync("\x10");
		expect(manager.isPaused()).toBeFalse();
	});

	test("Ctrl+S enters steering mode and submits message", async () => {
		const steer = mock(async (_message: string) => undefined);
		const manager = new InterventionManager({ steeringHandler: steer });
		const dashboard = new StatusDashboard(manager);

		await dashboard.handleInputAsync("\x13");
		await dashboard.handleInputAsync("r");
		await dashboard.handleInputAsync("e");
		await dashboard.handleInputAsync("p");
		await dashboard.handleInputAsync("r");
		await dashboard.handleInputAsync("i");
		await dashboard.handleInputAsync("o");
		await dashboard.handleInputAsync("r");
		await dashboard.handleInputAsync("i");
		await dashboard.handleInputAsync("t");
		await dashboard.handleInputAsync("i");
		await dashboard.handleInputAsync("z");
		await dashboard.handleInputAsync("e");
		await dashboard.handleInputAsync("\n");

		expect(steer).toHaveBeenCalledTimes(1);
		expect(steer).toHaveBeenCalledWith("reprioritize");
		expect(dashboard.lastSteerMessage).toBe("reprioritize");
	});

	test("Ctrl+Q marks quit requested", async () => {
		const dashboard = new StatusDashboard(new InterventionManager());
		expect(dashboard.quitRequested).toBeFalse();
		await dashboard.handleInputAsync("\x11");
		expect(dashboard.quitRequested).toBeTrue();
	});
});
