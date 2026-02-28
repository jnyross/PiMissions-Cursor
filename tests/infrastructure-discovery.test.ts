import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverInfrastructure, suggestPorts } from "../src/planner/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

describe("infrastructure discovery", () => {
	test("discovers project files and tool availability", async () => {
		const project = await mkdtemp(join(tmpdir(), "pi-missions-discovery-"));
		tempDirs.push(project);
		await writeFile(join(project, "README.md"), "# demo");

		const result = await discoverInfrastructure(project);
		expect(result.projectFiles).toContain("README.md");
		expect(typeof result.availableTools.git).toBe("boolean");
		expect(Array.isArray(result.usedPorts)).toBeTrue();
		expect(Array.isArray(result.runningServices)).toBeTrue();
	});

	test("suggestPorts avoids used ports", () => {
		const suggestions = suggestPorts([3000, 3001, 3002], 3, { start: 3000, end: 3005 });
		expect(suggestions).toEqual([3003, 3004, 3005]);
	});
});
