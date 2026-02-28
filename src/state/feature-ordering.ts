import type { Feature } from "../types/index.js";

export function getFeaturesByMilestone(features: Feature[], milestone: string): Feature[] {
	return features.filter((feature) => feature.milestone === milestone);
}

export function getMilestoneOrder(features: Feature[]): string[] {
	const order: string[] = [];
	for (const feature of features) {
		if (!order.includes(feature.milestone)) {
			order.push(feature.milestone);
		}
	}
	return order;
}

export function isMilestoneComplete(features: Feature[], milestone: string): boolean {
	const milestoneFeatures = getFeaturesByMilestone(features, milestone);
	if (milestoneFeatures.length === 0) {
		return false;
	}

	return milestoneFeatures.every((feature) => feature.status === "completed" || feature.status === "cancelled");
}

export function getNextMilestone(features: Feature[]): string | undefined {
	for (const milestone of getMilestoneOrder(features)) {
		const milestoneFeatures = getFeaturesByMilestone(features, milestone);
		if (milestoneFeatures.some((feature) => feature.status === "pending" || feature.status === "in_progress")) {
			return milestone;
		}
	}
	return undefined;
}

export function getSealedMilestones(features: Feature[], validatedMilestones: Iterable<string> = []): string[] {
	const validated = new Set(validatedMilestones);
	return getMilestoneOrder(features).filter(
		(milestone) => validated.has(milestone) && isMilestoneComplete(features, milestone),
	);
}
