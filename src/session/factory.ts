import type { ThinkingLevel } from "@oh-my-pi/pi-agent-core";
import type { Model } from "@oh-my-pi/pi-ai";
import {
	type CustomTool,
	ModelRegistry,
	SessionManager,
	createAgentSession,
	discoverAuthStorage,
} from "@oh-my-pi/pi-coding-agent";
import { HandoffResultSchema } from "../types/index.js";

export type { ThinkingLevel };

export interface WorkerSessionConfig {
	cwd?: string;
	agentDir?: string;
	systemPrompt: string;
	toolNames?: string[];
	model?: Model;
	defaultModel?: string;
	thinkingLevel?: ThinkingLevel;
}

export interface OrchestratorSessionConfig {
	cwd?: string;
	missionDir: string;
	agentDir?: string;
	systemPrompt: string;
	toolNames?: string[];
	customTools?: CustomTool[];
	model?: Model;
	defaultModel?: string;
	thinkingLevel?: ThinkingLevel;
	resume?: boolean;
}

interface SharedSessionContext {
	authStorage: Awaited<ReturnType<typeof discoverAuthStorage>>;
	modelRegistry: ModelRegistry;
}

const sharedSessionContextMap = new Map<string, Promise<SharedSessionContext>>();

function getAgentDirKey(agentDir?: string): string {
	return agentDir ?? "__default__";
}

async function getSharedSessionContext(agentDir?: string): Promise<SharedSessionContext> {
	const key = getAgentDirKey(agentDir);
	let sharedSessionContext = sharedSessionContextMap.get(key);
	if (!sharedSessionContext) {
		const promise = (async () => {
			const authStorage = await discoverAuthStorage(agentDir);
			const modelRegistry = new ModelRegistry(authStorage);
			await modelRegistry.refresh();
			return { authStorage, modelRegistry };
		})();
		sharedSessionContextMap.set(key, promise);
		promise.catch(() => {
			if (sharedSessionContextMap.get(key) === promise) {
				sharedSessionContextMap.delete(key);
			}
		});
		sharedSessionContext = promise;
	}
	return sharedSessionContext;
}

function resolveModelFromConfig(modelRegistry: ModelRegistry, configuredModel?: string): Model | undefined {
	if (!configuredModel) {
		return undefined;
	}

	const [provider, ...idParts] = configuredModel.split(":");
	const id = idParts.join(":");
	if (!provider || !id) {
		throw new Error(`Invalid model format "${configuredModel}". Expected "provider:model".`);
	}

	const model = modelRegistry.find(provider, id);
	if (!model) {
		throw new Error(`Configured model "${configuredModel}" is not available in model registry.`);
	}
	return model;
}

function selectModel(modelRegistry: ModelRegistry, model?: Model, configuredModel?: string): Model {
	if (model) {
		return model;
	}

	const configured = resolveModelFromConfig(modelRegistry, configuredModel);
	if (configured) {
		return configured;
	}

	const available = modelRegistry.getAvailable()[0];
	if (available) {
		return available;
	}

	const fallback = modelRegistry.getAll()[0];
	if (fallback) {
		return fallback;
	}

	throw new Error("No models available. Configure an API key and provider before creating sessions.");
}

export async function createWorkerSession(config: WorkerSessionConfig) {
	const { authStorage, modelRegistry } = await getSharedSessionContext(config.agentDir);
	const model = selectModel(modelRegistry, config.model, config.defaultModel);
	const { session } = await createAgentSession({
		cwd: config.cwd ?? process.cwd(),
		authStorage,
		modelRegistry,
		model,
		thinkingLevel: config.thinkingLevel,
		sessionManager: SessionManager.inMemory(),
		systemPrompt: config.systemPrompt,
		toolNames: config.toolNames ?? ["read", "write", "edit", "bash", "grep", "find", "ls"],
		requireSubmitResultTool: true,
		outputSchema: HandoffResultSchema,
		enableMCP: false,
		enableLsp: false,
	});
	return session;
}

export async function createOrchestratorSession(config: OrchestratorSessionConfig) {
	const { authStorage, modelRegistry } = await getSharedSessionContext(config.agentDir);
	const model = selectModel(modelRegistry, config.model, config.defaultModel);

	const sessionManager = config.resume
		? await SessionManager.continueRecent(config.missionDir)
		: SessionManager.create(config.missionDir);

	const { session } = await createAgentSession({
		cwd: config.cwd ?? config.missionDir,
		authStorage,
		modelRegistry,
		model,
		thinkingLevel: config.thinkingLevel,
		sessionManager,
		systemPrompt: config.systemPrompt,
		toolNames: config.toolNames ?? ["read", "write", "edit", "bash", "grep", "find", "ls"],
		customTools: config.customTools,
		enableMCP: false,
		enableLsp: false,
	});
	return session;
}

export function resetSessionFactoryForTests(): void {
	sharedSessionContextMap.clear();
}
