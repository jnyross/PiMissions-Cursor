import type { Feature } from "../types/index.js";

function isValidatorFeature(feature: Feature): boolean {
	return (
		feature.id.startsWith("scrutiny-") ||
		feature.id.startsWith("user-testing-") ||
		feature.skillName.includes("validator")
	);
}

function createScrutinyFeature(milestone: string): Feature {
	return {
		id: `scrutiny-${milestone}`,
		description: `Scrutiny validation for milestone "${milestone}".`,
		skillName: "scrutiny-validator",
		milestone,
		preconditions: [`All implementation features for milestone "${milestone}" are complete.`],
		expectedBehavior: ["Test, lint, and typecheck pass.", "Review synthesis report generated."],
		verificationSteps: ["Run scrutiny validator."],
		fulfills: [],
		status: "pending",
	};
}

function createUserTestingFeature(milestone: string): Feature {
	return {
		id: `user-testing-${milestone}`,
		description: `User testing validation for milestone "${milestone}".`,
		skillName: "user-testing-validator",
		milestone,
		preconditions: [`All implementation features for milestone "${milestone}" are complete.`],
		expectedBehavior: ["Assertions mapped and evaluated.", "Validation state updated with evidence."],
		verificationSteps: ["Run user-testing validator."],
		fulfills: [],
		status: "pending",
	};
}

export function injectValidationFeatures(features: Feature[], milestone: string): Feature[] {
	const scrutinyId = `scrutiny-${milestone}`;
	const userTestingId = `user-testing-${milestone}`;
	if (features.some((feature) => feature.id === scrutinyId || feature.id === userTestingId)) {
		return features;
	}

	const lastImplementationIndex = features.reduce((lastIndex, feature, index) => {
		if (feature.milestone === milestone && !isValidatorFeature(feature)) {
			return index;
		}
		return lastIndex;
	}, -1);

	const fallbackMilestoneIndex = features.reduce((lastIndex, feature, index) => {
		if (feature.milestone === milestone) {
			return index;
		}
		return lastIndex;
	}, -1);

	const insertionIndex = (lastImplementationIndex >= 0 ? lastImplementationIndex : fallbackMilestoneIndex) + 1;
	const next = [...features];
	next.splice(insertionIndex, 0, createScrutinyFeature(milestone), createUserTestingFeature(milestone));
	return next;
}

export function setValidatorPending(features: Feature[], validatorFeatureId: string): Feature[] {
	return features.map((feature) => {
		if (feature.id !== validatorFeatureId) {
			return feature;
		}
		return {
			...feature,
			status: "pending",
		};
	});
}
