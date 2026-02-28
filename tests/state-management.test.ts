import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type MissionRuntimeState,
	addFixFeature,
	atomicWriteFile,
	getNextPendingFeature,
	moveCompletedToBottom,
	readFeatures,
	readMissionState,
	readServicesYaml,
	readValidationState,
	setMissionAssertionStatus,
	updateFeatureStatus,
	writeFeatures,
	writeMissionState,
	writeServicesYaml,
	writeValidationState,
} from "../src/state/index.js";
import type { Feature } from "../src/types/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		await rm(dir, { recursive: true, force: true });
	}
});

async function createMissionDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "pi-missions-state-"));
	tempDirs.push(dir);
	return dir;
}

function feature(id: string, status: Feature["status"]): Feature {
	return {
		id,
		description: `Feature ${id}`,
		skillName: "dev-worker",
		milestone: "foundation",
		preconditions: [],
		expectedBehavior: [],
		verificationSteps: [],
		fulfills: [],
		status,
	};
}

describe("state management", () => {
	test("atomicWriteFile writes content and leaves no temp files", async () => {
		const missionDir = await createMissionDir();
		const target = join(missionDir, "state.json");
		await atomicWriteFile(target, '{"ok":true}');

		const raw = await readFile(target, "utf-8");
		expect(raw).toBe('{"ok":true}');

		const files = await readdir(missionDir);
		expect(files.some((fileName) => fileName.endsWith(".tmp"))).toBeFalse();
	});

	test("features round-trip read/write and status transitions", async () => {
		const missionDir = await createMissionDir();
		await writeFeatures(missionDir, [feature("f-1", "pending"), feature("f-2", "completed")]);

		const loaded = await readFeatures(missionDir);
		expect(loaded.length).toBe(2);
		expect(getNextPendingFeature(loaded)?.id).toBe("f-1");

		await updateFeatureStatus(missionDir, "f-1", "in_progress");
		const updated = await readFeatures(missionDir);
		expect(updated.find((item) => item.id === "f-1")?.status).toBe("in_progress");
	});

	test("moveCompletedToBottom places completed features last", () => {
		const ordered = moveCompletedToBottom([
			feature("a", "completed"),
			feature("b", "pending"),
			feature("c", "completed"),
			feature("d", "in_progress"),
		]);
		expect(ordered.map((item) => item.id)).toEqual(["b", "d", "a", "c"]);
	});

	test("addFixFeature inserts at top of feature list", async () => {
		const missionDir = await createMissionDir();
		await writeFeatures(missionDir, [feature("base", "pending")]);
		await addFixFeature(missionDir, feature("fix-base", "pending"));

		const loaded = await readFeatures(missionDir);
		expect(loaded[0]?.id).toBe("fix-base");
		expect(loaded[1]?.id).toBe("base");
	});

	test("mission-state read/write works", async () => {
		const missionDir = await createMissionDir();
		const state: MissionRuntimeState = {
			missionId: "mis_123",
			state: "running",
			workingDirectory: missionDir,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		await writeMissionState(missionDir, state);
		const loaded = await readMissionState(missionDir);
		expect(loaded?.missionId).toBe("mis_123");
	});

	test("validation-state read/write and assertion status update works", async () => {
		const missionDir = await createMissionDir();
		await writeValidationState(missionDir, { assertions: { "VAL-1": { status: "pending" } } });

		await setMissionAssertionStatus(missionDir, "VAL-1", "passed", "proof");
		const loaded = await readValidationState(missionDir);
		expect(loaded.assertions["VAL-1"]?.status).toBe("passed");
		expect(loaded.assertions["VAL-1"]?.evidence).toBe("proof");
	});

	test("services yaml read/write works", async () => {
		const missionDir = await createMissionDir();
		await writeServicesYaml(missionDir, {
			commands: {
				test: "bun test",
				lint: "bun run lint",
			},
			services: {
				web: {
					command: "bun run dev",
					port: 3000,
				},
			},
		});

		const loaded = await readServicesYaml(missionDir);
		expect(loaded.commands.test).toBe("bun test");
		expect(loaded.services?.web?.port).toBe(3000);
	});

	test("readers return sensible defaults when files are absent", async () => {
		const missionDir = await createMissionDir();
		expect(await readMissionState(missionDir)).toBeNull();
		expect(await readFeatures(missionDir)).toEqual([]);
		expect(await readValidationState(missionDir)).toEqual({ assertions: {} });
		expect(await readServicesYaml(missionDir)).toEqual({ commands: {} });
	});

	test("atomic writes replace previous file content", async () => {
		const missionDir = await createMissionDir();
		const path = join(missionDir, "replace.json");
		await writeFile(path, '{"before":1}');
		await atomicWriteFile(path, '{"after":2}');
		const raw = await readFile(path, "utf-8");
		expect(raw).toBe('{"after":2}');
	});
});
