import type { AgentSession, CustomTool } from "@oh-my-pi/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { createOrchestratorSession } from "../session/index.js";
import type { PlannedMilestone } from "./artifact-gen.js";
import type { DiscoveryResult } from "./discovery.js";

export interface PlanningToolHandlers {
	askUserQuestion(question: string): Promise<string>;
	proposeMilestones(milestones: PlannedMilestone[]): Promise<{ approved: boolean; feedback?: string }>;
	confirmPlan(summary: string): Promise<{ approved: boolean; feedback?: string }>;
	reviewPlan(proposalMarkdown: string): Promise<{ decision: "approve" | "reject" | "revise"; feedback?: string }>;
}

export interface PlanningOrchestratorOptions {
	missionDir: string;
	model?: Parameters<typeof createOrchestratorSession>[0]["model"];
	defaultModel?: string;
	discovery?: DiscoveryResult;
	handlers: PlanningToolHandlers;
}

const askUserQuestionSchema = Type.Object({
	question: Type.String({ minLength: 1 }),
});

const proposeMilestonesSchema = Type.Object({
	milestones: Type.Array(
		Type.Object({
			name: Type.String({ minLength: 1 }),
			description: Type.String({ minLength: 1 }),
		}),
	),
});

const confirmPlanSchema = Type.Object({
	summary: Type.String({ minLength: 1 }),
});

const reviewPlanSchema = Type.Object({
	proposalMarkdown: Type.String({ minLength: 1 }),
});

function textResult(text: string) {
	return {
		content: [{ type: "text" as const, text }],
		details: {},
	};
}

function readStringParam(params: unknown, key: string): string {
	if (typeof params !== "object" || params === null) {
		throw new Error(`Invalid tool parameters: expected object with "${key}".`);
	}
	const value = (params as Record<string, unknown>)[key];
	if (typeof value !== "string") {
		throw new Error(`Invalid tool parameter "${key}": expected string.`);
	}
	return value;
}

function readMilestonesParam(params: unknown): PlannedMilestone[] {
	if (typeof params !== "object" || params === null) {
		throw new Error('Invalid tool parameters: expected object with "milestones".');
	}
	const value = (params as Record<string, unknown>).milestones;
	if (!Array.isArray(value)) {
		throw new Error('Invalid tool parameter "milestones": expected array.');
	}

	return value.map((item, index) => {
		if (typeof item !== "object" || item === null) {
			throw new Error(`Invalid milestone at index ${index}.`);
		}
		const name = (item as Record<string, unknown>).name;
		const description = (item as Record<string, unknown>).description;
		if (typeof name !== "string" || typeof description !== "string") {
			throw new Error(`Invalid milestone at index ${index}: expected name/description strings.`);
		}
		return { name, description };
	});
}

function buildPlannerSystemPrompt(discovery?: DiscoveryResult): string {
	const discoverySummary = discovery
		? [
				"## Discovery Snapshot",
				`- Running services: ${discovery.runningServices.map((service) => service.name).join(", ") || "none"}`,
				`- Used ports: ${discovery.usedPorts.join(", ") || "none"}`,
				`- Top-level files: ${discovery.projectFiles.join(", ") || "none"}`,
			].join("\n")
		: "## Discovery Snapshot\n- Not yet collected.";

	return [
		"You are the planning orchestrator for Pi Missions.",
		"",
		"Conversation workflow:",
		"1) Greet the user and ask what they want to build.",
		"2) Ask at least two clarifying questions across different dimensions (requirements, constraints, stack, scope).",
		"3) Propose milestone slices and wait for confirmation.",
		"4) Present a structured mission proposal for final review.",
		"5) On approval, proceed to artifact generation.",
		"",
		"When you need explicit user interaction for these stages, call available planning tools.",
		"",
		discoverySummary,
	].join("\n");
}

export function createPlanningTools(handlers: PlanningToolHandlers): CustomTool[] {
	const askUserQuestionTool: CustomTool = {
		name: "askUserQuestion",
		label: "Ask user question",
		description: "Ask the user a clarifying question and get their answer.",
		parameters: askUserQuestionSchema,
		async execute(_toolCallId, params: unknown) {
			const answer = await handlers.askUserQuestion(readStringParam(params, "question"));
			return textResult(answer);
		},
	};

	const proposeMilestonesTool: CustomTool = {
		name: "proposeMilestones",
		label: "Propose milestones",
		description: "Present milestones and get approval/feedback from the user.",
		parameters: proposeMilestonesSchema,
		async execute(_toolCallId, params: unknown) {
			const response = await handlers.proposeMilestones(readMilestonesParam(params));
			return textResult(JSON.stringify(response));
		},
	};

	const confirmPlanTool: CustomTool = {
		name: "confirmPlan",
		label: "Confirm plan",
		description: "Ask the user for final plan approval before artifact generation.",
		parameters: confirmPlanSchema,
		async execute(_toolCallId, params: unknown) {
			const response = await handlers.confirmPlan(readStringParam(params, "summary"));
			return textResult(JSON.stringify(response));
		},
	};

	const reviewPlanTool: CustomTool = {
		name: "reviewPlan",
		label: "Review plan",
		description: "Present the mission proposal and collect approve/reject/revise feedback.",
		parameters: reviewPlanSchema,
		async execute(_toolCallId, params: unknown) {
			const response = await handlers.reviewPlan(readStringParam(params, "proposalMarkdown"));
			return textResult(JSON.stringify(response));
		},
	};

	return [askUserQuestionTool, proposeMilestonesTool, confirmPlanTool, reviewPlanTool];
}

export async function createPlanningOrchestratorSession(options: PlanningOrchestratorOptions): Promise<AgentSession> {
	const customTools = createPlanningTools(options.handlers);
	return await createOrchestratorSession({
		missionDir: options.missionDir,
		systemPrompt: buildPlannerSystemPrompt(options.discovery),
		customTools,
		model: options.model,
		defaultModel: options.defaultModel,
		resume: true,
	});
}
