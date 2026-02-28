import { type Static, Type } from "@sinclair/typebox";
import type { HandoffResult } from "./handoff.js";

export const FeatureStatusSchema = Type.Union(
	[
		Type.Literal("pending"),
		Type.Literal("in_progress"),
		Type.Literal("completed"),
		Type.Literal("failed"),
		Type.Literal("cancelled"),
	],
	{ $id: "FeatureStatus" },
);
export type FeatureStatus = Static<typeof FeatureStatusSchema>;

export const MissionStatusSchema = Type.Union(
	[Type.Literal("planning"), Type.Literal("executing"), Type.Literal("completed"), Type.Literal("paused")],
	{ $id: "MissionStatus" },
);
export type MissionStatus = Static<typeof MissionStatusSchema>;

export const MilestoneSchema = Type.Object(
	{
		name: Type.String({ minLength: 1 }),
		description: Type.String({ minLength: 1 }),
		features: Type.Array(Type.String({ minLength: 1 })),
		sealed: Type.Boolean({ default: false }),
	},
	{ $id: "Milestone" },
);
export type Milestone = Static<typeof MilestoneSchema>;

export const FeatureSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		description: Type.String({ minLength: 1 }),
		skillName: Type.String({ minLength: 1 }),
		milestone: Type.String({ minLength: 1 }),
		preconditions: Type.Array(Type.String()),
		expectedBehavior: Type.Array(Type.String()),
		verificationSteps: Type.Array(Type.String()),
		fulfills: Type.Array(Type.String()),
		status: FeatureStatusSchema,
		workerSessionIds: Type.Optional(Type.Array(Type.String())),
		currentWorkerSessionId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
		completedWorkerSessionId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
		errorMessage: Type.Optional(Type.String()),
		errorAt: Type.Optional(Type.String()),
	},
	{ $id: "Feature" },
);

type FeatureBase = Static<typeof FeatureSchema>;

export interface Feature extends FeatureBase {
	handoff?: HandoffResult | null;
}

export const MissionSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		title: Type.String({ minLength: 1 }),
		description: Type.String(),
		status: MissionStatusSchema,
		milestones: Type.Array(MilestoneSchema),
		createdAt: Type.String(),
		updatedAt: Type.String(),
	},
	{ $id: "Mission" },
);
export type Mission = Static<typeof MissionSchema>;
