import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { atomicWriteFile, writeFeatures, writeServicesYaml, writeValidationState } from "../state/index.js";
import type { Feature, ValidationAssertion } from "../types/index.js";

export interface PlannedMilestone {
	name: string;
	description: string;
}

export interface PlannedFeature extends Omit<Feature, "status"> {
	status?: Feature["status"];
}

export interface MissionPlanInput {
	title: string;
	description: string;
	milestones: PlannedMilestone[];
	features: PlannedFeature[];
	validationAssertions?: ValidationAssertion[];
	services?: {
		commands?: {
			install?: string;
			test?: string;
			lint?: string;
			typecheck?: string;
			build?: string;
		};
		services?: Record<string, { command: string; port?: number; stop?: string; healthcheck?: string }>;
	};
	workerSkills?: Record<string, string>;
	testingStrategy?: string;
}

function ensureFeature(feature: PlannedFeature): Feature {
	return {
		...feature,
		status: feature.status ?? "pending",
	};
}

function normalizeAssertions(plan: MissionPlanInput): ValidationAssertion[] {
	if (plan.validationAssertions && plan.validationAssertions.length > 0) {
		return plan.validationAssertions;
	}

	const assertionIds = new Set<string>();
	const generated: ValidationAssertion[] = [];
	for (const feature of plan.features) {
		for (const assertionId of feature.fulfills) {
			if (assertionIds.has(assertionId)) {
				continue;
			}
			assertionIds.add(assertionId);
			generated.push({
				id: assertionId,
				title: `Assertion ${assertionId}`,
				description: `Behavior linked to feature ${feature.id}.`,
				evidence: `Evidence should confirm expected behavior for ${feature.id}.`,
				area: "Generated",
			});
		}
	}
	return generated;
}

function toValidationContractMarkdown(assertions: ValidationAssertion[]): string {
	const byArea = new Map<string, ValidationAssertion[]>();
	for (const assertion of assertions) {
		const area = assertion.area ?? "General";
		const areaAssertions = byArea.get(area) ?? [];
		areaAssertions.push(assertion);
		byArea.set(area, areaAssertions);
	}

	const lines: string[] = ["# Validation Contract", ""];
	for (const [area, areaAssertions] of byArea.entries()) {
		lines.push(`## Area: ${area}`);
		lines.push("");
		for (const assertion of areaAssertions) {
			lines.push(`### ${assertion.id}: ${assertion.title}`);
			lines.push(assertion.description);
			lines.push(`Evidence: ${assertion.evidence}`);
			lines.push("");
		}
	}

	return `${lines.join("\n").trim()}\n`;
}

function toMissionMarkdown(plan: MissionPlanInput): string {
	const lines: string[] = [`# ${plan.title}`, "", plan.description, "", "## Milestones", ""];

	for (const milestone of plan.milestones) {
		lines.push(`- **${milestone.name}**: ${milestone.description}`);
	}

	lines.push("", "## Features", "");
	for (const feature of plan.features) {
		lines.push(`- \`${feature.id}\` (${feature.milestone}) - ${feature.description}`);
	}

	if (plan.testingStrategy) {
		lines.push("", "## Testing Strategy", "", plan.testingStrategy);
	}

	return `${lines.join("\n").trim()}\n`;
}

function toMissionAgentsMarkdown(plan: MissionPlanInput): string {
	return [
		`# AGENTS.md - ${plan.title}`,
		"",
		"## Mission Boundaries",
		"- This mission is orchestrated by Pi Missions.",
		"- Do not access files outside the mission target directory unless explicitly required.",
		"- Follow validation contract assertions before marking completion.",
		"",
		"## Milestones",
		...plan.milestones.map((milestone) => `- ${milestone.name}: ${milestone.description}`),
		"",
	].join("\n");
}

function buildInitScript(): string {
	return [
		"#!/usr/bin/env bash",
		"set -euo pipefail",
		"",
		"# idempotent mission setup",
		'if [ -f "package.json" ]; then',
		"  if command -v bun >/dev/null 2>&1; then",
		"    PUPPETEER_SKIP_DOWNLOAD=true bun install || true",
		"  fi",
		"fi",
		"",
	].join("\n");
}

function skillDocument(skillName: string, body: string): string {
	return [
		"---",
		`name: ${skillName}`,
		"description: Mission worker guidance",
		"---",
		"",
		"# Work Procedure",
		body.trim() || "Follow the feature requirements, verify changes, and return submit_result.",
		"",
		"# Example Handoff",
		"- Summary",
		"- Implementation details",
		"- Verification evidence",
		"- Remaining issues",
		"",
	].join("\n");
}

export async function generateMissionArtifacts(
	plan: MissionPlanInput,
	targetDir: string,
	missionDir: string,
): Promise<void> {
	await mkdir(missionDir, { recursive: true });
	await mkdir(join(targetDir, ".pi-missions"), { recursive: true });

	const assertions = normalizeAssertions(plan);
	const features = plan.features.map(ensureFeature);

	await writeFeatures(missionDir, features);
	await writeValidationState(missionDir, {
		assertions: Object.fromEntries(assertions.map((assertion) => [assertion.id, { status: "pending" as const }])),
	});

	const services = plan.services ?? {
		commands: {
			install: "bun install",
			test: "bun test --timeout 120000",
			lint: "bun run lint",
			typecheck: "bun run check",
			build: "bun run build",
		},
	};
	await writeServicesYaml(missionDir, {
		commands: services.commands ?? {},
		services: services.services,
	});

	await atomicWriteFile(join(missionDir, "mission.md"), toMissionMarkdown(plan));
	await atomicWriteFile(join(missionDir, "validation-contract.md"), toValidationContractMarkdown(assertions));
	await atomicWriteFile(join(missionDir, "AGENTS.md"), toMissionAgentsMarkdown(plan));

	const initPath = join(missionDir, "init.sh");
	await atomicWriteFile(initPath, buildInitScript());
	await chmod(initPath, 0o755);

	const skillsRoot = join(targetDir, ".pi-missions", "skills");
	await mkdir(skillsRoot, { recursive: true });
	const workerSkills = plan.workerSkills ?? {
		"dev-worker": "Implement the feature carefully, run focused tests, and report via submit_result.",
	};

	for (const [skillName, skillBody] of Object.entries(workerSkills)) {
		const skillDir = join(skillsRoot, skillName);
		await mkdir(skillDir, { recursive: true });
		await atomicWriteFile(join(skillDir, "SKILL.md"), skillDocument(skillName, skillBody));
	}
}
