export interface GitStatus {
	isClean: boolean;
	staged: string[];
	modified: string[];
	untracked: string[];
	raw: string[];
}

function runGit(dir: string, args: string[]): { exitCode: number; stdout: string; stderr: string } {
	const result = Bun.spawnSync(["git", "-C", dir, ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});

	return {
		exitCode: result.exitCode,
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
	};
}

export function isGitRepo(dir: string): boolean {
	const result = runGit(dir, ["rev-parse", "--is-inside-work-tree"]);
	return result.exitCode === 0 && result.stdout.trim() === "true";
}

export function gitInit(dir: string): void {
	const result = runGit(dir, ["init"]);
	if (result.exitCode !== 0) {
		throw new Error(`git init failed: ${result.stderr.trim() || result.stdout.trim()}`);
	}
}

export function gitDiff(dir: string, args: string[] = []): string {
	const result = runGit(dir, ["diff", ...args]);
	if (result.exitCode !== 0) {
		throw new Error(`git diff failed: ${result.stderr.trim() || result.stdout.trim()}`);
	}
	return result.stdout;
}

export function gitStatus(dir: string): GitStatus {
	const result = runGit(dir, ["status", "--porcelain"]);
	if (result.exitCode !== 0) {
		throw new Error(`git status failed: ${result.stderr.trim() || result.stdout.trim()}`);
	}

	const lines = result.stdout.split("\n").filter(Boolean);
	const staged: string[] = [];
	const modified: string[] = [];
	const untracked: string[] = [];

	for (const line of lines) {
		const x = line[0] ?? " ";
		const y = line[1] ?? " ";
		const file = line.slice(3);

		if (x === "?" && y === "?") {
			untracked.push(file);
			continue;
		}
		if (x !== " " && x !== "?") {
			staged.push(file);
		}
		if (y !== " " && y !== "?") {
			modified.push(file);
		}
	}

	return {
		isClean: lines.length === 0,
		staged,
		modified,
		untracked,
		raw: lines,
	};
}

export function gitCommit(dir: string, message: string): string | null {
	const commitResult = runGit(dir, ["commit", "-m", message]);

	if (commitResult.exitCode !== 0) {
		const output = `${commitResult.stdout}\n${commitResult.stderr}`;
		if (output.includes("nothing to commit")) {
			return null;
		}
		throw new Error(`git commit failed: ${commitResult.stderr.trim() || commitResult.stdout.trim()}`);
	}

	const hashResult = runGit(dir, ["rev-parse", "HEAD"]);
	if (hashResult.exitCode !== 0) {
		throw new Error(`git rev-parse failed: ${hashResult.stderr.trim() || hashResult.stdout.trim()}`);
	}
	return hashResult.stdout.trim();
}
