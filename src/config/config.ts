import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

const CONFIG_RELATIVE_PATH = ".pi-missions/config.json";
const THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh"]);

export interface PiMissionsConfig {
	defaultModel?: string;
	defaultThinkingLevel: string;
	missionDir: string;
}

interface RawPiMissionsConfig {
	defaultModel?: unknown;
	defaultThinkingLevel?: unknown;
	missionDir?: unknown;
}

function assertString(value: unknown, fieldName: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Invalid config value for "${fieldName}": expected a non-empty string.`);
	}
	return value;
}

function validateModelString(model: string): string {
	if (!/^[^:\s]+:[^:\s]+$/.test(model)) {
		throw new Error(`Invalid config value for "defaultModel": expected format "provider:model".`);
	}
	return model;
}

function validateThinkingLevel(level: string): string {
	if (!THINKING_LEVELS.has(level)) {
		throw new Error(
			`Invalid config value for "defaultThinkingLevel": expected one of ${Array.from(THINKING_LEVELS).join(", ")}.`,
		);
	}
	return level;
}

function resolveMissionDir(cwd: string, missionDir?: string): string {
	if (!missionDir) {
		return join(cwd, ".pi-missions");
	}
	return isAbsolute(missionDir) ? missionDir : join(cwd, missionDir);
}

function buildConfigFromRaw(cwd: string, raw: RawPiMissionsConfig): PiMissionsConfig {
	let defaultModel: string | undefined;
	if (raw.defaultModel !== undefined) {
		defaultModel = validateModelString(assertString(raw.defaultModel, "defaultModel"));
	}

	const defaultThinkingLevel =
		raw.defaultThinkingLevel === undefined
			? "low"
			: validateThinkingLevel(assertString(raw.defaultThinkingLevel, "defaultThinkingLevel"));

	const missionDir =
		raw.missionDir === undefined
			? resolveMissionDir(cwd)
			: resolveMissionDir(cwd, assertString(raw.missionDir, "missionDir"));

	return { defaultModel, defaultThinkingLevel, missionDir };
}

export async function loadConfig(cwd: string = process.cwd()): Promise<PiMissionsConfig> {
	const path = join(cwd, CONFIG_RELATIVE_PATH);

	try {
		const raw = await readFile(path, "utf-8");
		const parsed = JSON.parse(raw) as RawPiMissionsConfig;
		return buildConfigFromRaw(cwd, parsed);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return buildConfigFromRaw(cwd, {});
		}
		if (error instanceof SyntaxError) {
			throw new Error(`Invalid JSON in config file at ${path}: ${error.message}`);
		}
		throw error;
	}
}
