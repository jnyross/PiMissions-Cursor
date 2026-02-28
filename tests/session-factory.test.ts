import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildValidatorPrompt,
	buildWorkerPrompt,
	createOrchestratorSession,
	createWorkerSession,
} from "../src/session/index.js";
import type { Feature } from "../src/types/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

function makeFeature(): Feature {
	return {
		id: "feature-1",
		description: "Implement a useful capability",
		skillName: "dev-worker",
		milestone: "foundation",
		preconditions: ["config ready"],
		expectedBehavior: ["works well"],
		verificationSteps: ["bun test"],
		fulfills: ["VAL-001"],
		status: "pending",
	};
}

describe("session prompts", () => {
	test("buildWorkerPrompt includes key sections", () => {
		const prompt = buildWorkerPrompt(makeFeature(), "Follow strict TDD.");
		expect(prompt).toContain("Feature");
		expect(prompt).toContain("Expected Behavior");
		expect(prompt).toContain("Skill Guidance");
		expect(prompt).toContain("Follow strict TDD.");
	});

	test("buildValidatorPrompt differs by validator type", () => {
		const scrutiny = buildValidatorPrompt("foundation", "scrutiny");
		const user = buildValidatorPrompt("foundation", "user-testing");
		expect(scrutiny).toContain("scrutiny validator");
		expect(user).toContain("user-testing validator");
	});
});

describe("session factory integration", () => {
	test("createWorkerSession creates disposable in-memory session", async () => {
		const session = await createWorkerSession({
			systemPrompt: "You are a worker.",
		});
		expect(typeof session.sessionId).toBe("string");
		await session.dispose();
	});

	test("createOrchestratorSession creates persistent session manager", async () => {
		const missionDir = await mkdtemp(join(tmpdir(), "pi-missions-orchestrator-"));
		tempDirs.push(missionDir);

		const session = await createOrchestratorSession({
			missionDir,
			systemPrompt: "You are an orchestrator.",
		});

		expect(typeof session.sessionId).toBe("string");
		await session.dispose();
	});
});
