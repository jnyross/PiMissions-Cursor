import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AuthCredentialStore } from "@oh-my-pi/pi-ai";
import { ModelRegistry, SessionManager, createAgentSession, discoverAuthStorage } from "@oh-my-pi/pi-coding-agent";
import { atomicWriteFile } from "../state/index.js";

export interface SetupWizardResult {
	provider: string;
	credentialsMetadataPath: string;
	agentDbPath: string;
}

export interface SetupWizardOptions {
	cwd?: string;
	providerOverride?: string;
	apiKeyOverride?: string;
	skipValidation?: boolean;
	validateApiKey?: (provider: string, apiKey: string) => Promise<{ valid: boolean; error?: string }>;
}

const SUPPORTED_PROVIDERS = [
	"anthropic",
	"openai",
	"google",
	"groq",
	"minimax",
	"glm",
	"openrouter",
	"xai",
	"mistral",
	"ollama",
] as const;

type PromptFn = (question: string, options?: { mask?: boolean }) => Promise<string>;

async function promptWithReadline(question: string): Promise<string> {
	const { createInterface } = await import("node:readline/promises");
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	try {
		return await rl.question(question);
	} finally {
		rl.close();
	}
}

async function promptMasked(question: string): Promise<string> {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		return await promptWithReadline(question);
	}

	process.stdout.write(question);
	process.stdin.setRawMode?.(true);
	process.stdin.resume();

	return await new Promise<string>((resolve, reject) => {
		let value = "";

		const cleanup = () => {
			process.stdin.setRawMode?.(false);
			process.stdin.pause();
			process.stdin.off("data", onData);
			process.stdout.write("\n");
		};

		const onData = (buffer: Buffer) => {
			const chunk = buffer.toString("utf-8");
			if (chunk === "\u0003") {
				cleanup();
				reject(new Error("Setup cancelled by user."));
				return;
			}
			if (chunk === "\r" || chunk === "\n") {
				cleanup();
				resolve(value);
				return;
			}
			if (chunk === "\u007f") {
				if (value.length > 0) {
					value = value.slice(0, -1);
					process.stdout.write("\b \b");
				}
				return;
			}

			value += chunk;
			process.stdout.write("*");
		};

		process.stdin.on("data", onData);
	});
}

async function defaultPrompt(question: string, options?: { mask?: boolean }): Promise<string> {
	if (options?.mask) {
		return await promptMasked(question);
	}
	return await promptWithReadline(question);
}

async function ensureGitignoreEntry(cwd: string, entry: string): Promise<void> {
	const gitignorePath = join(cwd, ".gitignore");
	let existing = "";
	try {
		existing = await readFile(gitignorePath, "utf-8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error;
		}
	}

	if (existing.split("\n").includes(entry)) {
		return;
	}

	if (existing.length === 0) {
		await writeFile(gitignorePath, `${entry}\n`, "utf-8");
		return;
	}
	await appendFile(gitignorePath, `${existing.endsWith("\n") ? "" : "\n"}${entry}\n`, "utf-8");
}

async function defaultValidateApiKey(provider: string, apiKey: string): Promise<{ valid: boolean; error?: string }> {
	if (apiKey.trim().length < 8) {
		return { valid: false, error: "API key appears too short." };
	}

	try {
		const authStorage = await discoverAuthStorage();
		authStorage.setRuntimeApiKey(provider, apiKey);
		const modelRegistry = new ModelRegistry(authStorage);
		await modelRegistry.refresh();

		const model = modelRegistry.getAll().find((candidate) => candidate.provider === provider);
		if (!model) {
			return { valid: true };
		}

		const { session } = await createAgentSession({
			authStorage,
			modelRegistry,
			model,
			sessionManager: SessionManager.inMemory(),
			enableMCP: false,
			enableLsp: false,
			toolNames: [],
			systemPrompt: "You are a validator. Reply with exactly hello.",
		});

		try {
			const timeoutPromise = new Promise<never>((_resolve, reject) => {
				setTimeout(() => reject(new Error("Validation call timed out.")), 20_000);
			});
			await Promise.race([session.prompt("Reply with exactly: hello"), timeoutPromise]);
		} finally {
			await session.dispose();
		}

		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: `API key validation failed: ${(error as Error).message}`,
		};
	}
}

async function selectProvider(prompt: PromptFn): Promise<string> {
	process.stdout.write("Select provider:\n");
	SUPPORTED_PROVIDERS.forEach((provider, index) => {
		process.stdout.write(`  ${index + 1}. ${provider}\n`);
	});

	const response = (await prompt("Provider number: ")).trim();
	const index = Number.parseInt(response, 10);
	if (Number.isNaN(index) || index < 1 || index > SUPPORTED_PROVIDERS.length) {
		throw new Error(`Invalid provider selection "${response}".`);
	}
	return SUPPORTED_PROVIDERS[index - 1] ?? "openai";
}

export class SetupWizard {
	#prompt: PromptFn;
	#validateApiKey: (provider: string, apiKey: string) => Promise<{ valid: boolean; error?: string }>;
	#saveApiKey: (provider: string, apiKey: string) => Promise<void>;

	constructor(
		options: {
			prompt?: PromptFn;
			validateApiKey?: (provider: string, apiKey: string) => Promise<{ valid: boolean; error?: string }>;
			saveApiKey?: (provider: string, apiKey: string) => Promise<void>;
		} = {},
	) {
		this.#prompt = options.prompt ?? defaultPrompt;
		this.#validateApiKey = options.validateApiKey ?? defaultValidateApiKey;
		this.#saveApiKey =
			options.saveApiKey ??
			(async (provider, apiKey) => {
				const store = await AuthCredentialStore.open();
				try {
					store.saveApiKey(provider, apiKey);
				} finally {
					store.close();
				}
			});
	}

	async run(options: SetupWizardOptions = {}): Promise<SetupWizardResult> {
		const cwd = options.cwd ?? process.cwd();
		const provider = options.providerOverride ?? (await selectProvider(this.#prompt));
		if (!SUPPORTED_PROVIDERS.includes(provider as (typeof SUPPORTED_PROVIDERS)[number])) {
			throw new Error(`Unsupported provider "${provider}".`);
		}

		let apiKey = options.apiKeyOverride;
		if (!apiKey) {
			apiKey = await this.#prompt("Enter API key: ", { mask: true });
		}
		if (!apiKey) {
			throw new Error("No API key provided.");
		}

		const validate = options.validateApiKey ?? this.#validateApiKey;
		if (!options.skipValidation) {
			const validation = await validate(provider, apiKey);
			if (!validation.valid) {
				throw new Error(validation.error ?? "API key validation failed.");
			}
		}

		await this.#saveApiKey(provider, apiKey);

		await ensureGitignoreEntry(cwd, ".pi-missions/credentials.json");
		const credentialsDir = join(cwd, ".pi-missions");
		await mkdir(credentialsDir, { recursive: true });
		const credentialsMetadataPath = join(credentialsDir, "credentials.json");
		await atomicWriteFile(
			credentialsMetadataPath,
			`${JSON.stringify(
				{
					provider,
					savedAt: new Date().toISOString(),
					storage: "agent.db",
				},
				null,
				2,
			)}\n`,
		);

		const authStorage = await discoverAuthStorage();
		const agentDbPath = String((authStorage as unknown as { dbPath?: string }).dbPath ?? "agent.db");
		return {
			provider,
			credentialsMetadataPath,
			agentDbPath,
		};
	}
}
