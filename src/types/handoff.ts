import { type Static, Type } from "@sinclair/typebox";

export const IssueSeveritySchema = Type.Union([
	Type.Literal("critical"),
	Type.Literal("high"),
	Type.Literal("medium"),
	Type.Literal("low"),
	Type.Literal("non_blocking"),
	Type.Literal("blocking"),
]);
export type IssueSeverity = Static<typeof IssueSeveritySchema>;

export const CommandVerificationSchema = Type.Object({
	command: Type.String({ minLength: 1 }),
	exitCode: Type.Number(),
	observation: Type.String(),
});
export type CommandVerification = Static<typeof CommandVerificationSchema>;

export const VerificationResultSchema = Type.Object({
	commandsRun: Type.Array(CommandVerificationSchema),
	interactiveChecks: Type.Optional(Type.Array(Type.String())),
});
export type VerificationResult = Static<typeof VerificationResultSchema>;

export const TestCaseSchema = Type.Object({
	name: Type.String({ minLength: 1 }),
	verifies: Type.String({ minLength: 1 }),
});
export type TestCase = Static<typeof TestCaseSchema>;

export const AddedTestSchema = Type.Object({
	file: Type.String({ minLength: 1 }),
	cases: Type.Array(TestCaseSchema),
});
export type AddedTest = Static<typeof AddedTestSchema>;

export const TestResultSchema = Type.Object({
	added: Type.Array(AddedTestSchema),
	coverage: Type.String(),
});
export type TestResult = Static<typeof TestResultSchema>;

export const DiscoveredIssueSchema = Type.Object({
	severity: IssueSeveritySchema,
	description: Type.String({ minLength: 1 }),
	suggestedFix: Type.Optional(Type.String()),
});
export type DiscoveredIssue = Static<typeof DiscoveredIssueSchema>;

export const SkillFeedbackSchema = Type.Optional(
	Type.Object({
		followedProcedure: Type.Optional(Type.Boolean()),
		deviations: Type.Optional(Type.Array(Type.String())),
		suggestedChanges: Type.Optional(Type.Array(Type.String())),
	}),
);
export type SkillFeedback = Static<NonNullable<typeof SkillFeedbackSchema>>;

export const HandoffResultSchema = Type.Object(
	{
		salientSummary: Type.String({ minLength: 1 }),
		whatWasImplemented: Type.String({ minLength: 1 }),
		whatWasLeftUndone: Type.String(),
		verification: VerificationResultSchema,
		tests: TestResultSchema,
		discoveredIssues: Type.Array(DiscoveredIssueSchema),
		skillFeedback: SkillFeedbackSchema,
	},
	{ $id: "HandoffResult" },
);
export type HandoffResult = Static<typeof HandoffResultSchema>;

export function createEmptyHandoffResult(): HandoffResult {
	return {
		salientSummary: "No summary provided.",
		whatWasImplemented: "No implementation details were provided.",
		whatWasLeftUndone: "",
		verification: { commandsRun: [], interactiveChecks: [] },
		tests: { added: [], coverage: "No test coverage details were provided." },
		discoveredIssues: [],
		skillFeedback: {
			followedProcedure: true,
			deviations: [],
			suggestedChanges: [],
		},
	};
}
