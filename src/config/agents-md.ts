import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface AgentsFile {
	path: string;
	content: string;
	source: "project" | "mission" | "home";
}

export interface DiscoverAgentsOptions {
	cwd?: string;
	missionDir?: string;
	homeDir?: string;
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function discoverAgentsMd(options: DiscoverAgentsOptions = {}): Promise<AgentsFile[]> {
	const cwd = options.cwd ?? process.cwd();
	const missionDir = options.missionDir ?? join(cwd, ".pi-missions");
	const homeDir = options.homeDir ?? process.env.HOME ?? "";

	const candidates: Array<{ path: string; source: AgentsFile["source"] }> = [
		{ path: join(cwd, "AGENTS.md"), source: "project" },
		{ path: join(missionDir, "AGENTS.md"), source: "mission" },
	];

	if (homeDir) {
		candidates.push({ path: join(homeDir, "AGENTS.md"), source: "home" });
	}

	const discovered: AgentsFile[] = [];
	for (const candidate of candidates) {
		if (!(await fileExists(candidate.path))) {
			continue;
		}

		try {
			const content = await readFile(candidate.path, "utf-8");
			discovered.push({
				path: candidate.path,
				content,
				source: candidate.source,
			});
		} catch {
			// Ignore unreadable candidate files and continue discovery.
		}
	}

	return discovered;
}

export async function loadMergedAgentsInstructions(options: DiscoverAgentsOptions = {}): Promise<string> {
	const files = await discoverAgentsMd(options);
	if (files.length === 0) {
		return "";
	}

	return files.map((file) => `# Source (${file.source}): ${file.path}\n\n${file.content.trim()}`).join("\n\n---\n\n");
}
