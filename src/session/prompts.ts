import type { Feature } from "../types/index.js";

function renderBulletList(items: string[]): string {
	if (items.length === 0) {
		return "- (none provided)";
	}
	return items.map((item) => `- ${item}`).join("\n");
}

export function buildWorkerPrompt(feature: Feature, skillContent: string): string {
	return [
		"You are a focused implementation worker for Pi Missions.",
		"",
		"## Feature",
		`ID: ${feature.id}`,
		`Milestone: ${feature.milestone}`,
		`Skill: ${feature.skillName}`,
		"",
		"## Description",
		feature.description,
		"",
		"## Expected Behavior",
		renderBulletList(feature.expectedBehavior),
		"",
		"## Verification Steps",
		renderBulletList(feature.verificationSteps),
		"",
		"## Preconditions",
		renderBulletList(feature.preconditions),
		"",
		"## Worker Instructions",
		"- Prefer test-driven implementation where practical.",
		"- Run only relevant checks for changed code.",
		"- Do not leave TODO placeholders.",
		"- Return final structured output using submit_result.",
		"",
		"## Skill Guidance",
		skillContent.trim() || "(No skill file content found.)",
	].join("\n");
}

export function buildValidatorPrompt(milestone: string, type: "scrutiny" | "user-testing"): string {
	if (type === "scrutiny") {
		return [
			"You are a scrutiny validator for a Pi Missions milestone.",
			`Target milestone: ${milestone}`,
			"",
			"Validate code quality by running configured checks and performing focused review synthesis.",
			"Always produce structured pass/fail conclusions and actionable findings.",
		].join("\n");
	}

	return [
		"You are a user-testing validator for a Pi Missions milestone.",
		`Target milestone: ${milestone}`,
		"",
		"Validate behavioral assertions from the validation contract.",
		"Gather concrete evidence and mark each assertion as passed, failed, or blocked.",
	].join("\n");
}
