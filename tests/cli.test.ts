import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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

describe("cli commands", () => {
	test("help command prints usage", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "pi-missions-cli-"));
		tempDirs.push(cwd);
		const result = runCli(["--help"], cwd);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Usage:");
		expect(result.stdout).toContain("pi-missions new");
	});

	test("new creates mission artifacts, status summarizes, and list shows mission", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "pi-missions-cli-"));
		tempDirs.push(cwd);

		const created = runCli(["new", "Demo", "Mission"], cwd);
		expect(created.exitCode).toBe(0);
		expect(created.stdout).toContain('Created mission "Demo Mission"');

		const status = runCli(["status"], cwd);
		expect(status.exitCode).toBe(0);
		expect(status.stdout).toContain("Features: total=1");

		const list = runCli(["list"], cwd);
		expect(list.exitCode).toBe(0);
		expect(list.stdout).toContain("Missions:");
		expect(list.stdout).toContain(".pi-missions");
	});

	test("resume without mission returns clear error", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "pi-missions-cli-"));
		tempDirs.push(cwd);
		const result = runCli(["resume"], cwd);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("No mission found");
	});

	test("setup supports non-interactive flags", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "pi-missions-cli-"));
		const fakeHome = await mkdtemp(join(tmpdir(), "pi-missions-home-"));
		tempDirs.push(cwd, fakeHome);

		const result = runCli(
			["setup", "--provider", "minimax", "--api-key", "test-key-123456", "--skip-validation"],
			cwd,
			{ HOME: fakeHome },
		);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Setup complete for provider minimax.");

		const metadata = await readFile(join(cwd, ".pi-missions", "credentials.json"), "utf-8");
		expect(metadata).not.toContain("test-key-123456");
	});
});
