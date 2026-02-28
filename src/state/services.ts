import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { atomicWriteFile } from "./atomic-write.js";

const SERVICES_FILE = "services.yaml";

export interface ServiceDefinition {
	command: string;
	port?: number;
	healthcheck?: string;
	stop?: string;
}

export interface ServicesManifest {
	commands: {
		install?: string;
		test?: string;
		lint?: string;
		typecheck?: string;
		build?: string;
		[key: string]: string | undefined;
	};
	services?: Record<string, ServiceDefinition>;
}

function servicesPath(missionDir: string): string {
	return join(missionDir, SERVICES_FILE);
}

export async function readServicesYaml(missionDir: string): Promise<ServicesManifest> {
	try {
		const raw = await readFile(servicesPath(missionDir), "utf-8");
		const parsed = parse(raw) as ServicesManifest | null;
		if (!parsed) {
			return { commands: {} };
		}
		return parsed;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { commands: {} };
		}
		throw error;
	}
}

export async function writeServicesYaml(missionDir: string, services: ServicesManifest): Promise<void> {
	const content = stringify(services, { sortMapEntries: false });
	await atomicWriteFile(servicesPath(missionDir), content);
}
