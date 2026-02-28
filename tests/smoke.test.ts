import { describe, expect, test } from "bun:test";

describe("pi-missions smoke test", () => {
	test("CLI help renders usage", async () => {
		const proc = Bun.spawn(["bun", "run", "src/index.ts", "--help"], {
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		expect(output).toContain("pi-missions - autonomous development mission orchestrator");
		expect(output).toContain("pi-missions new");
	});
});
