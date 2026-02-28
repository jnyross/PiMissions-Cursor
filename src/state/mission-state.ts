import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AssertionStatus, ValidationState } from "../types/index.js";
import { atomicWriteFile } from "./atomic-write.js";

const MISSION_STATE_FILE = "state.json";
const VALIDATION_STATE_FILE = "validation-state.json";

export interface MissionRuntimeState {
	missionId: string;
	baseSessionId?: string;
	state: "running" | "paused" | "completed" | "failed";
	workingDirectory: string;
	currentFeatureId?: string | null;
	currentWorkerSessionId?: string | null;
	updatedAt: string;
	createdAt: string;
	[key: string]: unknown;
}

function missionStatePath(missionDir: string): string {
	return join(missionDir, MISSION_STATE_FILE);
}

function validationStatePath(missionDir: string): string {
	return join(missionDir, VALIDATION_STATE_FILE);
}

export async function readMissionState(missionDir: string): Promise<MissionRuntimeState | null> {
	try {
		const raw = await readFile(missionStatePath(missionDir), "utf-8");
		return JSON.parse(raw) as MissionRuntimeState;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw error;
	}
}

export async function writeMissionState(missionDir: string, state: MissionRuntimeState): Promise<void> {
	await atomicWriteFile(missionStatePath(missionDir), `${JSON.stringify(state, null, 2)}\n`);
}

export async function readValidationState(missionDir: string): Promise<ValidationState> {
	try {
		const raw = await readFile(validationStatePath(missionDir), "utf-8");
		return JSON.parse(raw) as ValidationState;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { assertions: {} };
		}
		throw error;
	}
}

export async function writeValidationState(missionDir: string, state: ValidationState): Promise<void> {
	await atomicWriteFile(validationStatePath(missionDir), `${JSON.stringify(state, null, 2)}\n`);
}

export async function setMissionAssertionStatus(
	missionDir: string,
	assertionId: string,
	status: AssertionStatus,
	evidence?: string,
): Promise<ValidationState> {
	const current = await readValidationState(missionDir);
	const next: ValidationState = {
		...current,
		assertions: {
			...current.assertions,
			[assertionId]: {
				status,
				evidence,
				updatedAt: new Date().toISOString(),
			},
		},
	};
	await writeValidationState(missionDir, next);
	return next;
}
