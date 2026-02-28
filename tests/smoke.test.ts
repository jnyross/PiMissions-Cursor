import { describe, expect, test } from "bun:test";

describe("pi-missions smoke test", () => {
	test("entry point module is importable", async () => {
		const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		expect(output.trim()).toBe("pi-missions v0.1.0");
	});
});
