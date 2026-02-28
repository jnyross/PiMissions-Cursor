import type { MissionPlanInput } from "./artifact-gen.js";

export type PlanReviewDecision = "approve" | "reject" | "revise";

export function formatMissionProposal(plan: MissionPlanInput): string {
	const lines: string[] = [
		"# Mission Proposal",
		"",
		"## Overview",
		`**Title:** ${plan.title}`,
		"",
		plan.description,
		"",
		"## Milestones",
	];

	for (const milestone of plan.milestones) {
		lines.push(`- **${milestone.name}** — ${milestone.description}`);
	}

	lines.push("", "## Features");
	for (const feature of plan.features) {
		lines.push(`- \`${feature.id}\` (${feature.milestone})`);
		lines.push(`  - ${feature.description}`);
	}

	if (plan.services?.commands) {
		lines.push("", "## Commands");
		for (const [name, command] of Object.entries(plan.services.commands)) {
			if (!command) {
				continue;
			}
			lines.push(`- \`${name}\`: \`${command}\``);
		}
	}

	if (plan.testingStrategy) {
		lines.push("", "## Testing Strategy", plan.testingStrategy);
	}

	lines.push("", "## Review Request", "Reply with one of: approve, reject, or revise (with feedback).", "");
	return lines.join("\n");
}

export function parsePlanReviewResponse(input: string): { decision: PlanReviewDecision; feedback?: string } {
	const normalized = input.trim().toLowerCase();

	if (normalized.startsWith("approve")) {
		return { decision: "approve", feedback: input.trim().slice("approve".length).trim() || undefined };
	}
	if (normalized.startsWith("reject")) {
		return { decision: "reject", feedback: input.trim().slice("reject".length).trim() || undefined };
	}
	return { decision: "revise", feedback: input.trim() || undefined };
}
