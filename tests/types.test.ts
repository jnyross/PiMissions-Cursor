import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
	FeatureSchema,
	HandoffResultSchema,
	MissionSchema,
	type ValidationState,
	ValidationStateSchema,
	createEmptyHandoffResult,
	setAssertionStatus,
} from "../src/types/index.js";

describe("types and schemas", () => {
	test("mission and feature schemas validate representative data", () => {
		const missionValue = {
			id: "mis_1",
			title: "Demo Mission",
			description: "desc",
			status: "planning",
			milestones: [{ name: "foundation", description: "core", features: ["f-1"], sealed: false }],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		const featureValue = {
			id: "f-1",
			description: "Implement feature",
			skillName: "dev-worker",
			milestone: "foundation",
			preconditions: [],
			expectedBehavior: ["works"],
			verificationSteps: ["run tests"],
			fulfills: ["VAL-001"],
			status: "pending",
		};

		expect(Value.Check(MissionSchema, missionValue)).toBeTrue();
		expect(Value.Check(FeatureSchema, featureValue)).toBeTrue();
	});

	test("createEmptyHandoffResult returns schema-valid payload", () => {
		const handoff = createEmptyHandoffResult();
		expect(Value.Check(HandoffResultSchema, handoff)).toBeTrue();
	});

	test("setAssertionStatus updates validation state immutably", () => {
		const initial: ValidationState = {
			assertions: {
				"VAL-1": { status: "pending" },
			},
		};

		const next = setAssertionStatus(initial, "VAL-1", "passed", "evidence");
		expect(next).not.toBe(initial);
		expect(next.assertions["VAL-1"]?.status).toBe("passed");
		expect(next.assertions["VAL-1"]?.evidence).toBe("evidence");
		expect(Value.Check(ValidationStateSchema, next)).toBeTrue();
	});
});
