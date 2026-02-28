import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverAgentsMd, loadMergedAgentsInstructions } from "../src/config/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

async function createTempDir(prefix: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

describe("AGENTS.md discovery", () => {
	test("discovers files in project -> mission -> home order", async () => {
		const project = await createTempDir("pi-missions-project-");
		const missionDir = join(project, ".pi-missions");
		const home = await createTempDir("pi-missions-home-");
		await mkdir(missionDir, { recursive: true });

		await writeFile(join(project, "AGENTS.md"), "project rules");
		await writeFile(join(missionDir, "AGENTS.md"), "mission rules");
		await writeFile(join(home, "AGENTS.md"), "home rules");

		const files = await discoverAgentsMd({ cwd: project, missionDir, homeDir: home });
		expect(files.map((file) => file.source)).toEqual(["project", "mission", "home"]);
	});

	test("ignores missing files", async () => {
		const project = await createTempDir("pi-missions-project-");
		const files = await discoverAgentsMd({ cwd: project, missionDir: join(project, ".pi-missions"), homeDir: "" });
		expect(files).toEqual([]);
	});

	test("merged instructions include source headers", async () => {
		const project = await createTempDir("pi-missions-project-");
		const missionDir = join(project, ".pi-missions");
		await mkdir(missionDir, { recursive: true });
		await writeFile(join(project, "AGENTS.md"), "# Project\nRules");
		await writeFile(join(missionDir, "AGENTS.md"), "# Mission\nRules");

		const merged = await loadMergedAgentsInstructions({ cwd: project, missionDir, homeDir: "" });
		expect(merged).toContain("Source (project)");
		expect(merged).toContain("Source (mission)");
		expect(merged).toContain("# Project");
		expect(merged).toContain("# Mission");
	});
});
