import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { atomicWriteFile } from "../state/index.js";
import { readFeatures, readValidationState, setMissionAssertionStatus } from "../state/index.js";
import type { AssertionStatus, ValidationAssertion, ValidationState } from "../types/index.js";

export interface UserTestingAssertionResult {
	assertionId: string;
	status: AssertionStatus;
	evidence?: string;
	reason?: string;
}

export interface UserTestingValidationResult {
	status: "passed" | "failed";
	testedAssertionIds: string[];
	results: UserTestingAssertionResult[];
	reportPath: string;
}

export interface UserTestingValidatorOptions {
	reportRoot?: string;
	rerun?: boolean;
	testAssertion?: (
		assertion: ValidationAssertion,
		context: { missionDir: string; milestone: string },
	) => Promise<UserTestingAssertionResult>;
}

function parseValidationContractMarkdown(content: string): ValidationAssertion[] {
	const lines = content.split("\n");
	const assertions: ValidationAssertion[] = [];
	let currentArea = "General";
	let currentAssertion: ValidationAssertion | null = null;

	for (const line of lines) {
		const areaMatch = line.match(/^##\s+Area:\s+(.+)$/);
		if (areaMatch?.[1]) {
			currentArea = areaMatch[1].trim();
			currentAssertion = null;
			continue;
		}

		const assertionMatch = line.match(/^###\s+([A-Z0-9-]+):\s+(.+)$/);
		if (assertionMatch?.[1] && assertionMatch[2]) {
			currentAssertion = {
				id: assertionMatch[1],
				title: assertionMatch[2],
				description: "",
				evidence: "",
				area: currentArea,
			};
			assertions.push(currentAssertion);
			continue;
		}

		if (currentAssertion) {
			const evidenceMatch = line.match(/^Evidence:\s*(.*)$/);
			if (evidenceMatch) {
				currentAssertion.evidence = evidenceMatch[1] ?? "";
			} else if (line.trim() && !currentAssertion.description) {
				currentAssertion.description = line.trim();
			}
		}
	}

	return assertions;
}

async function defaultTestAssertion(assertion: ValidationAssertion): Promise<UserTestingAssertionResult> {
	return {
		assertionId: assertion.id,
		status: "blocked",
		reason: "No custom user-testing assertion executor was provided.",
	};
}

function shouldRetestAssertion(
	assertionId: string,
	validationState: ValidationState,
	options: { rerun: boolean },
): boolean {
	const existingStatus = validationState.assertions[assertionId]?.status;
	if (!options.rerun) {
		return true;
	}
	return (
		existingStatus === "failed" ||
		existingStatus === "blocked" ||
		existingStatus === "pending" ||
		existingStatus === undefined
	);
}

export class UserTestingValidator {
	#reportRoot?: string;
	#rerun: boolean;
	#testAssertion: (
		assertion: ValidationAssertion,
		context: { missionDir: string; milestone: string },
	) => Promise<UserTestingAssertionResult>;

	constructor(options: UserTestingValidatorOptions = {}) {
		this.#reportRoot = options.reportRoot;
		this.#rerun = options.rerun ?? false;
		this.#testAssertion = options.testAssertion ?? defaultTestAssertion;
	}

	async validate(milestone: string, missionDir: string): Promise<UserTestingValidationResult> {
		const contractPath = join(missionDir, "validation-contract.md");
		const contractRaw = await readFile(contractPath, "utf-8");
		const contractAssertions = parseValidationContractMarkdown(contractRaw);
		const validationState = await readValidationState(missionDir);
		const features = await readFeatures(missionDir);

		const milestoneAssertionIds = new Set<string>();
		for (const feature of features) {
			if (feature.milestone !== milestone) {
				continue;
			}
			for (const assertionId of feature.fulfills) {
				milestoneAssertionIds.add(assertionId);
			}
		}

		const candidateAssertions = contractAssertions.filter((assertion) => milestoneAssertionIds.has(assertion.id));
		const assertionsToTest = candidateAssertions.filter((assertion) =>
			shouldRetestAssertion(assertion.id, validationState, { rerun: this.#rerun }),
		);

		const results: UserTestingAssertionResult[] = [];
		for (const assertion of assertionsToTest) {
			const result = await this.#testAssertion(assertion, { missionDir, milestone });
			results.push(result);
			await setMissionAssertionStatus(missionDir, assertion.id, result.status, result.evidence ?? result.reason);
		}

		const hasFailure = results.some((result) => result.status === "failed");
		const reportRoot = this.#reportRoot ?? join(missionDir, "validation");
		const reportDir = join(reportRoot, milestone, "user-testing");
		await mkdir(reportDir, { recursive: true });
		const reportPath = join(reportDir, "synthesis.json");

		const report: UserTestingValidationResult = {
			status: hasFailure ? "failed" : "passed",
			testedAssertionIds: assertionsToTest.map((assertion) => assertion.id),
			results,
			reportPath,
		};
		await atomicWriteFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
		return report;
	}
}
