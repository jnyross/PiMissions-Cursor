import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readFeatures, readServicesYaml } from "../state/index.js";
import { atomicWriteFile } from "../state/index.js";
import type { Feature } from "../types/index.js";

export interface ScrutinyCommandResult {
	command: string;
	exitCode: number;
	output: string;
}

export interface ScrutinyReviewFinding {
	featureId: string;
	severity: "info" | "low" | "medium" | "high" | "critical";
	description: string;
	filePath?: string;
	line?: number;
}

export interface ScrutinyValidationResult {
	status: "passed" | "failed";
	commandResults: ScrutinyCommandResult[];
	reviewFindings: ScrutinyReviewFinding[];
	reportPath: string;
}

export interface ScrutinyValidatorOptions {
	runCommand?: (command: string, cwd: string) => Promise<ScrutinyCommandResult>;
	reviewFeature?: (feature: Feature, missionDir: string) => Promise<ScrutinyReviewFinding[]>;
	reportRoot?: string;
	targetDir?: string;
}

async function defaultRunCommand(command: string, cwd: string): Promise<ScrutinyCommandResult> {
	const result = Bun.spawnSync(["bash", "-lc", command], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});
	return {
		command,
		exitCode: result.exitCode,
		output: `${result.stdout.toString()}${result.stderr.toString()}`.trim(),
	};
}

async function defaultReviewFeature(feature: Feature): Promise<ScrutinyReviewFinding[]> {
	return [
		{
			featureId: feature.id,
			severity: "info",
			description: `No additional review findings for ${feature.id}.`,
		},
	];
}

export class ScrutinyValidator {
	#runCommand: (command: string, cwd: string) => Promise<ScrutinyCommandResult>;
	#reviewFeature: (feature: Feature, missionDir: string) => Promise<ScrutinyReviewFinding[]>;
	#reportRoot?: string;
	#targetDir?: string;

	constructor(options: ScrutinyValidatorOptions = {}) {
		this.#runCommand = options.runCommand ?? defaultRunCommand;
		this.#reviewFeature = options.reviewFeature ?? defaultReviewFeature;
		this.#reportRoot = options.reportRoot;
		this.#targetDir = options.targetDir;
	}

	async validate(milestone: string, missionDir: string): Promise<ScrutinyValidationResult> {
		const services = await readServicesYaml(missionDir);
		const commands = [
			services.commands.test ?? "bun test --timeout 120000",
			services.commands.lint ?? "bun run lint",
			services.commands.typecheck ?? services.commands.check ?? "bun run check",
		];

		const targetDir = this.#targetDir ?? dirname(missionDir);
		const commandResults: ScrutinyCommandResult[] = [];
		for (const command of commands) {
			const result = await this.#runCommand(command, targetDir);
			commandResults.push(result);
		}

		const reportRoot = this.#reportRoot ?? join(missionDir, "validation");
		const reportDir = join(reportRoot, milestone, "scrutiny");
		await mkdir(reportDir, { recursive: true });
		const reportPath = join(reportDir, "synthesis.json");

		const hasCommandFailure = commandResults.some((result) => result.exitCode !== 0);
		if (hasCommandFailure) {
			const report: ScrutinyValidationResult = {
				status: "failed",
				commandResults,
				reviewFindings: [],
				reportPath,
			};
			await atomicWriteFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
			return report;
		}

		const features = await readFeatures(missionDir);
		const completedMilestoneFeatures = features.filter(
			(feature) => feature.milestone === milestone && feature.status === "completed",
		);

		const reviewFindings: ScrutinyReviewFinding[] = [];
		for (const feature of completedMilestoneFeatures) {
			const findings = await this.#reviewFeature(feature, missionDir);
			reviewFindings.push(...findings);
		}

		const hasBlockingReviewIssue = reviewFindings.some((finding) => ["high", "critical"].includes(finding.severity));
		const report: ScrutinyValidationResult = {
			status: hasBlockingReviewIssue ? "failed" : "passed",
			commandResults,
			reviewFindings,
			reportPath,
		};
		await atomicWriteFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
		return report;
	}
}
