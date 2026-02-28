import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Feature, FeatureStatus } from "../types/index.js";
import { atomicWriteFile } from "./atomic-write.js";

const FEATURES_FILE = "features.json";

export function getFeaturesPath(missionDir: string): string {
	return join(missionDir, FEATURES_FILE);
}

export async function readFeatures(missionDir: string): Promise<Feature[]> {
	const path = getFeaturesPath(missionDir);
	try {
		const raw = await readFile(path, "utf-8");
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed.features)) {
			return [];
		}
		return parsed.features as Feature[];
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

export async function writeFeatures(missionDir: string, features: Feature[]): Promise<void> {
	const path = getFeaturesPath(missionDir);
	await atomicWriteFile(path, `${JSON.stringify({ features }, null, 2)}\n`);
}

export async function updateFeatureStatus(
	missionDir: string,
	featureId: string,
	status: FeatureStatus,
	fields?: Partial<Feature>,
): Promise<Feature[]> {
	const features = await readFeatures(missionDir);
	const updated = features.map((feature) =>
		feature.id === featureId
			? {
					...feature,
					...fields,
					status,
				}
			: feature,
	);
	await writeFeatures(missionDir, updated);
	return updated;
}

export function getNextPendingFeature(features: Feature[]): Feature | undefined {
	return features.find((feature) => feature.status === "pending");
}

export function moveCompletedToBottom(features: Feature[]): Feature[] {
	const incomplete = features.filter((feature) => feature.status !== "completed");
	const completed = features.filter((feature) => feature.status === "completed");
	return [...incomplete, ...completed];
}

export async function addFixFeature(missionDir: string, fixFeature: Feature): Promise<Feature[]> {
	const features = await readFeatures(missionDir);
	const updated = [fixFeature, ...features];
	await writeFeatures(missionDir, updated);
	return updated;
}
