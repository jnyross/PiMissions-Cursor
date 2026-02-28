import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

function createTempPath(targetPath: string): string {
	const random = Math.random().toString(36).slice(2, 8);
	return `${targetPath}.${process.pid}.${Date.now()}.${random}.tmp`;
}

export async function atomicWriteFile(path: string, content: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const tempPath = createTempPath(path);

	try {
		await writeFile(tempPath, content, "utf-8");
		await rename(tempPath, path);
	} catch (error) {
		await unlink(tempPath).catch(() => undefined);
		throw error;
	}
}

export function resolveMissionFilePath(missionDir: string, fileName: string): string {
	return join(missionDir, fileName);
}
