import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitCommit, gitDiff, gitInit, gitStatus, isGitRepo } from "../src/utils/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

async function createTempDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "pi-missions-git-"));
	tempDirs.push(dir);
	return dir;
}

function runGit(dir: string, args: string[]): number {
	return Bun.spawnSync(["git", "-C", dir, ...args], { stdout: "pipe", stderr: "pipe" }).exitCode;
}

async function configureUser(dir: string): Promise<void> {
	expect(runGit(dir, ["config", "user.email", "test@example.com"])).toBe(0);
	expect(runGit(dir, ["config", "user.name", "Pi Missions Test"])).toBe(0);
}

describe("git utilities", () => {
	test("gitInit creates a git repository", async () => {
		const dir = await createTempDir();
		expect(isGitRepo(dir)).toBeFalse();
		gitInit(dir);
		expect(isGitRepo(dir)).toBeTrue();
	});

	test("gitStatus tracks staged, modified, and untracked files", async () => {
		const dir = await createTempDir();
		gitInit(dir);
		await configureUser(dir);

		await writeFile(join(dir, "tracked.txt"), "hello");
		expect(runGit(dir, ["add", "tracked.txt"])).toBe(0);
		expect(runGit(dir, ["commit", "-m", "initial"])).toBe(0);

		await writeFile(join(dir, "tracked.txt"), "updated");
		await writeFile(join(dir, "new.txt"), "new");
		expect(runGit(dir, ["add", "new.txt"])).toBe(0);

		const status = gitStatus(dir);
		expect(status.modified).toContain("tracked.txt");
		expect(status.staged).toContain("new.txt");
		expect(status.isClean).toBeFalse();
	});

	test("gitCommit commits staged changes and returns commit hash", async () => {
		const dir = await createTempDir();
		gitInit(dir);
		await configureUser(dir);
		await writeFile(join(dir, "a.txt"), "A");
		expect(runGit(dir, ["add", "a.txt"])).toBe(0);

		const hash = gitCommit(dir, "feat: add a");
		expect(hash?.length).toBeGreaterThan(6);
	});

	test("gitDiff returns non-empty content when file is modified", async () => {
		const dir = await createTempDir();
		gitInit(dir);
		await configureUser(dir);
		await writeFile(join(dir, "b.txt"), "one");
		expect(runGit(dir, ["add", "b.txt"])).toBe(0);
		expect(runGit(dir, ["commit", "-m", "add b"])).toBe(0);
		await writeFile(join(dir, "b.txt"), "two");

		const diff = gitDiff(dir);
		expect(diff).toContain("diff --git");
		expect(diff).toContain("-one");
		expect(diff).toContain("+two");
	});
});
