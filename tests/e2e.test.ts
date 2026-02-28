import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

function runCli(args: string[], cwd: string, env: Record<string, string> = {}) {
	const entry = join(process.cwd(), "src", "index.ts");
	const proc = Bun.spawnSync(["bun", "run", entry, ...args], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, ...env },
	});

	return {
		exitCode: proc.exitCode,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

describe("e2e mission lifecycle (optional live)", () => {
	test("plan -> status -> list lifecycle", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "pi-missions-e2e-"));
		tempDirs.push(cwd);

		const created = runCli(["new", "E2E mission"], cwd);
		expect(created.exitCode).toBe(0);

		const status = runCli(["status"], cwd);
		expect(status.exitCode).toBe(0);
		expect(status.stdout).toContain("Features: total=1");

		const list = runCli(["list"], cwd);
		expect(list.exitCode).toBe(0);
		expect(list.stdout).toContain("Missions:");
	});

	const runLive = Boolean(process.env.PI_MISSIONS_RUN_LIVE_E2E);
	if (runLive) {
		test("live provider setup smoke with supplied API key", async () => {
			const provider = process.env.PI_MISSIONS_TEST_PROVIDER;
			const apiKey = process.env.PI_MISSIONS_TEST_API_KEY;
			if (!provider || !apiKey) {
				throw new Error("PI_MISSIONS_TEST_PROVIDER and PI_MISSIONS_TEST_API_KEY are required.");
			}

			const cwd = await mkdtemp(join(tmpdir(), "pi-missions-live-e2e-"));
			const fakeHome = await mkdtemp(join(tmpdir(), "pi-missions-live-home-"));
			tempDirs.push(cwd, fakeHome);

			const setup = runCli(["setup", "--provider", provider, "--api-key", apiKey], cwd, { HOME: fakeHome });
			expect(setup.exitCode).toBe(0);
			expect(setup.stdout).toContain("Setup complete");
		});
	} else {
		test.skip("live provider setup smoke with supplied API key", () => {});
	}
});
