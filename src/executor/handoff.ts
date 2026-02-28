import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { addFixFeature } from "../state/index.js";
import { atomicWriteFile } from "../state/index.js";
import type { Feature, HandoffResult } from "../types/index.js";

export interface HandoffProcessSummary {
	createdFixFeatureIds: string[];
	issuesLogged: number;
}

function handoffPath(missionDir: string, featureId: string): string {
	return join(missionDir, "handoffs", `${featureId}.json`);
}

export async function saveHandoff(missionDir: string, featureId: string, handoff: HandoffResult): Promise<void> {
	const path = handoffPath(missionDir, featureId);
	await mkdir(join(missionDir, "handoffs"), { recursive: true });
	await atomicWriteFile(path, `${JSON.stringify(handoff, null, 2)}\n`);
}

export async function loadHandoff(missionDir: string, featureId: string): Promise<HandoffResult | null> {
	try {
		const raw = await readFile(handoffPath(missionDir, featureId), "utf-8");
		return JSON.parse(raw) as HandoffResult;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw error;
	}
}

function createFixFeature(original: Feature, reason: string, index: number): Feature {
	return {
		id: `fix-${original.id}-${index}`,
		description: `Fix follow-up for ${original.id}: ${reason}`,
		skillName: original.skillName,
		milestone: original.milestone,
		preconditions: [],
		expectedBehavior: [`Resolves follow-up issue from ${original.id}.`],
		verificationSteps: original.verificationSteps,
		fulfills: original.fulfills,
		status: "pending",
	};
}

export async function processHandoff(
	handoff: HandoffResult,
	feature: Feature,
	missionDir: string,
): Promise<HandoffProcessSummary> {
	await saveHandoff(missionDir, feature.id, handoff);

	const fixReasons: string[] = [];
	if (handoff.whatWasLeftUndone.trim().length > 0) {
		fixReasons.push("Complete unfinished work.");
	}

	const severeIssues = handoff.discoveredIssues.filter((issue) =>
		["critical", "high", "blocking"].includes(issue.severity),
	);
	for (const issue of severeIssues) {
		fixReasons.push(issue.description);
	}

	const createdFixFeatureIds: string[] = [];
	let fixIndex = 1;
	for (const reason of fixReasons) {
		const fixFeature = createFixFeature(feature, reason, fixIndex);
		fixIndex += 1;
		await addFixFeature(missionDir, fixFeature);
		createdFixFeatureIds.push(fixFeature.id);
	}

	return {
		createdFixFeatureIds,
		issuesLogged: handoff.discoveredIssues.length,
	};
}
