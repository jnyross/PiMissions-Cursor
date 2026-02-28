import { type Static, Type } from "@sinclair/typebox";

export const ValidationAssertionSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		title: Type.String({ minLength: 1 }),
		description: Type.String({ minLength: 1 }),
		evidence: Type.String({ minLength: 1 }),
		area: Type.Optional(Type.String({ minLength: 1 })),
	},
	{ $id: "ValidationAssertion" },
);
export type ValidationAssertion = Static<typeof ValidationAssertionSchema>;

export const ValidationContractSchema = Type.Object(
	{
		assertions: Type.Array(ValidationAssertionSchema),
	},
	{ $id: "ValidationContract" },
);
export type ValidationContract = Static<typeof ValidationContractSchema>;

export const AssertionStatusSchema = Type.Union([
	Type.Literal("pending"),
	Type.Literal("passed"),
	Type.Literal("failed"),
	Type.Literal("blocked"),
]);
export type AssertionStatus = Static<typeof AssertionStatusSchema>;

export const AssertionStateSchema = Type.Object({
	status: AssertionStatusSchema,
	evidence: Type.Optional(Type.String()),
	updatedAt: Type.Optional(Type.String()),
});
export type AssertionState = Static<typeof AssertionStateSchema>;

export const ValidationStateSchema = Type.Object(
	{
		assertions: Type.Record(Type.String({ minLength: 1 }), AssertionStateSchema),
	},
	{ $id: "ValidationState" },
);
export type ValidationState = Static<typeof ValidationStateSchema>;

export function setAssertionStatus(
	state: ValidationState,
	assertionId: string,
	status: AssertionStatus,
	evidence?: string,
): ValidationState {
	return {
		...state,
		assertions: {
			...state.assertions,
			[assertionId]: {
				status,
				evidence,
				updatedAt: new Date().toISOString(),
			},
		},
	};
}
