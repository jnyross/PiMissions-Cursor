import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SetupWizard } from "../src/config/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

describe("setup wizard", () => {
	test("stores API key via save callback and writes sanitized metadata", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "pi-missions-setup-"));
		tempDirs.push(cwd);
		const saveApiKey = mock(async (_provider: string, _apiKey: string) => undefined);
		const validateApiKey = mock(async () => ({ valid: true as const }));
		const wizard = new SetupWizard({
			validateApiKey,
			saveApiKey,
		});

		const result = await wizard.run({
			cwd,
			providerOverride: "minimax",
			apiKeyOverride: "test-key-123456",
		});

		expect(result.provider).toBe("minimax");
		expect(saveApiKey).toHaveBeenCalledWith("minimax", "test-key-123456");
		expect(validateApiKey).toHaveBeenCalledTimes(1);

		const metadata = await readFile(join(cwd, ".pi-missions", "credentials.json"), "utf-8");
		expect(metadata).toContain('"provider": "minimax"');
		expect(metadata).not.toContain("test-key-123456");

		const gitignore = await readFile(join(cwd, ".gitignore"), "utf-8");
		expect(gitignore).toContain(".pi-missions/credentials.json");
	});

	test("skipValidation bypasses validator callback", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "pi-missions-setup-"));
		tempDirs.push(cwd);
		const validateApiKey = mock(async () => ({ valid: false as const, error: "nope" }));
		const wizard = new SetupWizard({
			validateApiKey,
			saveApiKey: async () => undefined,
		});

		await expect(
			wizard.run({
				cwd,
				providerOverride: "glm",
				apiKeyOverride: "test-key-123456",
				skipValidation: true,
			}),
		).resolves.toBeDefined();
		expect(validateApiKey).toHaveBeenCalledTimes(0);
	});
});
