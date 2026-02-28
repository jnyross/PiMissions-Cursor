import { readdir } from "node:fs/promises";

export interface RunningService {
	name: string;
	pid?: number;
	port?: number;
}

export interface DiscoveryResult {
	runningServices: RunningService[];
	availablePorts: number[];
	projectFiles: string[];
	availableTools: Record<string, boolean>;
}

const COMMON_SERVICE_MATCHERS: Array<{ name: string; match: RegExp }> = [
	{ name: "postgres", match: /postgres/i },
	{ name: "redis", match: /redis/i },
	{ name: "docker", match: /docker/i },
	{ name: "node", match: /\bnode\b/i },
	{ name: "python", match: /python/i },
];

function runCommand(command: string, args: string[]): { exitCode: number; stdout: string; stderr: string } {
	const result = Bun.spawnSync([command, ...args], { stdout: "pipe", stderr: "pipe" });
	return {
		exitCode: result.exitCode,
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
	};
}

function parseListeningPorts(raw: string): Array<{ command: string; pid: number; port: number }> {
	const lines = raw.split("\n").filter(Boolean);
	const parsed: Array<{ command: string; pid: number; port: number }> = [];

	for (const line of lines) {
		if (line.startsWith("COMMAND")) {
			continue;
		}

		const columns = line.trim().split(/\s+/);
		if (columns.length < 9) {
			continue;
		}

		const command = columns[0] ?? "";
		const pid = Number.parseInt(columns[1] ?? "", 10);
		const nameColumn = columns.slice(8).join(" ");
		const portMatch = nameColumn.match(/:(\d+)\s*\(LISTEN\)/);
		const port = portMatch ? Number.parseInt(portMatch[1] ?? "", 10) : Number.NaN;

		if (!command || Number.isNaN(pid) || Number.isNaN(port)) {
			continue;
		}

		parsed.push({ command, pid, port });
	}

	return parsed;
}

async function listProjectFiles(targetDir: string): Promise<string[]> {
	try {
		const entries = await readdir(targetDir, { withFileTypes: true });
		return entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name)).sort();
	} catch {
		return [];
	}
}

function detectRunningServices(listeners: Array<{ command: string; pid: number; port: number }>): RunningService[] {
	const services = new Map<string, RunningService>();

	for (const listener of listeners) {
		for (const matcher of COMMON_SERVICE_MATCHERS) {
			if (!matcher.match.test(listener.command)) {
				continue;
			}
			const existing = services.get(matcher.name);
			if (!existing) {
				services.set(matcher.name, { name: matcher.name, pid: listener.pid, port: listener.port });
			}
		}
	}

	return Array.from(services.values());
}

function detectAvailableTools(toolNames: string[]): Record<string, boolean> {
	const result: Record<string, boolean> = {};
	for (const toolName of toolNames) {
		const lookup = runCommand("bash", ["-lc", `command -v ${toolName} >/dev/null 2>&1`]);
		result[toolName] = lookup.exitCode === 0;
	}
	return result;
}

export async function discoverInfrastructure(targetDir: string): Promise<DiscoveryResult> {
	const lsofResult = runCommand("bash", ["-lc", "lsof -i -P -n | grep LISTEN || true"]);
	const listeners = parseListeningPorts(lsofResult.stdout);
	const availablePorts = Array.from(new Set(listeners.map((listener) => listener.port))).sort((a, b) => a - b);

	return {
		runningServices: detectRunningServices(listeners),
		availablePorts,
		projectFiles: await listProjectFiles(targetDir),
		availableTools: detectAvailableTools(["git", "bun", "node", "npm", "docker", "python3"]),
	};
}

export function suggestPorts(
	usedPorts: number[],
	count: number,
	range: { start: number; end: number } = { start: 3000, end: 9000 },
): number[] {
	const used = new Set(usedPorts);
	const suggested: number[] = [];

	for (let port = range.start; port <= range.end; port += 1) {
		if (used.has(port)) {
			continue;
		}
		suggested.push(port);
		if (suggested.length >= count) {
			break;
		}
	}

	return suggested;
}
