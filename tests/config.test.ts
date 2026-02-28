import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

async function tempProjectDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "pi-missions-config-"));
	tempDirs.push(dir);
	return dir;
}

describe("config loading", () => {
	test("returns defaults when config file is absent", async () => {
		const project = await tempProjectDir();
		const config = await loadConfig(project);
		expect(config.defaultModel).toBeUndefined();
		expect(config.defaultThinkingLevel).toBe("low");
		expect(config.missionDir).toBe(join(project, ".pi-missions"));
	});

	test("loads values from .pi-missions/config.json", async () => {
		const project = await tempProjectDir();
		await mkdir(join(project, ".pi-missions"), { recursive: true });
		await writeFile(
			join(project, ".pi-missions/config.json"),
			JSON.stringify({
				defaultModel: "openai:gpt-4.1",
				defaultThinkingLevel: "high",
				missionDir: ".pi-missions/custom",
			}),
		);

		const config = await loadConfig(project);
		expect(config.defaultModel).toBe("openai:gpt-4.1");
		expect(config.defaultThinkingLevel).toBe("high");
		expect(config.missionDir).toBe(join(project, ".pi-missions/custom"));
	});

	test("throws on malformed model string", async () => {
		const project = await tempProjectDir();
		await mkdir(join(project, ".pi-missions"), { recursive: true });
		await writeFile(join(project, ".pi-missions/config.json"), JSON.stringify({ defaultModel: "bad-model" }));

		await expect(loadConfig(project)).rejects.toThrow(`Invalid config value for "defaultModel"`);
	});

	test("throws on unsupported thinking level", async () => {
		const project = await tempProjectDir();
		await mkdir(join(project, ".pi-missions"), { recursive: true });
		await writeFile(join(project, ".pi-missions/config.json"), JSON.stringify({ defaultThinkingLevel: "turbo" }));

		await expect(loadConfig(project)).rejects.toThrow(`Invalid config value for "defaultThinkingLevel"`);
	});

	test("throws clear error for invalid JSON", async () => {
		const project = await tempProjectDir();
		await mkdir(join(project, ".pi-missions"), { recursive: true });
		await writeFile(join(project, ".pi-missions/config.json"), "{ not json");

		await expect(loadConfig(project)).rejects.toThrow("Invalid JSON in config file");
	});
});
