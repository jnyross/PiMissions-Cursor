import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildWorkerPrompt, createWorkerSession } from "../session/index.js";
import { type Feature, type HandoffResult, createEmptyHandoffResult } from "../types/index.js";

export interface WorkerSpawnOptions {
	feature: Feature;
	missionDir: string;
	targetDir?: string;
	defaultModel?: string;
	model?: Parameters<typeof createWorkerSession>[0]["model"];
	toolNames?: string[];
	createSession?: typeof createWorkerSession;
	executeWorkerTask?: (session: Awaited<ReturnType<typeof createWorkerSession>>) => Promise<unknown>;
}

export class WorkerSpawnError extends Error {}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function loadSkillContent(targetDir: string, skillName: string): Promise<string> {
	const skillPath = join(targetDir, ".pi-missions", "skills", skillName, "SKILL.md");
	if (!(await fileExists(skillPath))) {
		return "";
	}
	return await readFile(skillPath, "utf-8");
}

async function runInitScriptIfPresent(missionDir: string, targetDir: string): Promise<void> {
	const initPath = join(missionDir, "init.sh");
	if (!(await fileExists(initPath))) {
		return;
	}

	const result = Bun.spawnSync(["bash", initPath], {
		cwd: targetDir,
		stdout: "pipe",
		stderr: "pipe",
	});

	if (result.exitCode !== 0) {
		throw new WorkerSpawnError(`init.sh failed: ${result.stderr.toString() || result.stdout.toString()}`);
	}
}

function maybeParseHandoff(value: unknown): HandoffResult | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const candidate = value as Record<string, unknown>;
	if (
		typeof candidate.salientSummary === "string" &&
		typeof candidate.whatWasImplemented === "string" &&
		typeof candidate.whatWasLeftUndone === "string" &&
		typeof candidate.verification === "object" &&
		typeof candidate.tests === "object" &&
		Array.isArray(candidate.discoveredIssues)
	) {
		return candidate as unknown as HandoffResult;
	}
	return null;
}

function extractLastAssistantText(messages: unknown): string | null {
	if (!Array.isArray(messages)) {
		return null;
	}

	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (!message || typeof message !== "object") {
			continue;
		}
		const record = message as Record<string, unknown>;
		if (record.role !== "assistant") {
			continue;
		}
		const content = record.content;
		if (!Array.isArray(content)) {
			continue;
		}
		for (const part of content) {
			if (part && typeof part === "object" && (part as Record<string, unknown>).type === "text") {
				const text = (part as Record<string, unknown>).text;
				if (typeof text === "string" && text.trim().length > 0) {
					return text;
				}
			}
		}
	}

	return null;
}

async function defaultExecuteWorkerTask(session: Awaited<ReturnType<typeof createWorkerSession>>): Promise<unknown> {
	await session.prompt("Implement the assigned feature and return a submit_result payload.");
	const assistantText = extractLastAssistantText(session.state.messages);
	if (!assistantText) {
		return null;
	}
	try {
		return JSON.parse(assistantText);
	} catch {
		return null;
	}
}

export async function spawnWorker(options: WorkerSpawnOptions): Promise<HandoffResult> {
	const targetDir = options.targetDir ?? process.cwd();
	const skillContent = await loadSkillContent(targetDir, options.feature.skillName);
	const workerPrompt = buildWorkerPrompt(options.feature, skillContent);

	await runInitScriptIfPresent(options.missionDir, targetDir);

	const createSession = options.createSession ?? createWorkerSession;
	const session = await createSession({
		cwd: targetDir,
		systemPrompt: workerPrompt,
		toolNames: options.toolNames ?? ["read", "write", "edit", "bash", "grep", "find", "ls"],
		model: options.model,
		defaultModel: options.defaultModel,
	});

	try {
		const output = await (options.executeWorkerTask
			? options.executeWorkerTask(session)
			: defaultExecuteWorkerTask(session));

		if (typeof output === "string") {
			try {
				const parsed = JSON.parse(output);
				return maybeParseHandoff(parsed) ?? createEmptyHandoffResult();
			} catch {
				return createEmptyHandoffResult();
			}
		}

		return maybeParseHandoff(output) ?? createEmptyHandoffResult();
	} finally {
		await session.dispose();
	}
}
