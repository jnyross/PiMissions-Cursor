import { EventEmitter } from "node:events";
import type { ThinkingLevel } from "../session/index.js";
import {
	getNextPendingFeature,
	isMilestoneComplete,
	moveCompletedToBottom,
	readFeatures,
	updateFeatureStatus,
	writeFeatures,
} from "../state/index.js";
import type { Feature, HandoffResult } from "../types/index.js";
import { processHandoff } from "./handoff.js";
import { InterventionManager } from "./intervention.js";
import { spawnWorker } from "./worker-spawn.js";

export type MissionRunnerEvent =
	| { type: "feature_start"; feature: Feature }
	| { type: "feature_complete"; feature: Feature; handoff: HandoffResult }
	| { type: "feature_failed"; feature: Feature; error: string }
	| { type: "milestone_complete"; milestone: string }
	| { type: "run_complete" };

export interface MissionRunnerDependencies {
	spawnWorker?: typeof spawnWorker;
	processHandoff?: typeof processHandoff;
	interventionManager?: InterventionManager;
}

export interface MissionRunnerOptions {
	targetDir?: string;
	defaultModel?: string;
	thinkingLevel?: ThinkingLevel;
	sealedMilestones?: Iterable<string>;
}

export class MissionRunner extends EventEmitter {
	#spawnWorker: typeof spawnWorker;
	#processHandoff: typeof processHandoff;
	#interventionManager: InterventionManager;

	constructor(dependencies: MissionRunnerDependencies = {}) {
		super();
		this.#spawnWorker = dependencies.spawnWorker ?? spawnWorker;
		this.#processHandoff = dependencies.processHandoff ?? processHandoff;
		this.#interventionManager = dependencies.interventionManager ?? new InterventionManager();
	}

	emitEvent(event: MissionRunnerEvent): void {
		this.emit(event.type, event);
	}

	async run(missionDir: string, options: MissionRunnerOptions = {}): Promise<void> {
		const sealedMilestones = new Set(options.sealedMilestones ?? []);

		while (true) {
			const features = await readFeatures(missionDir);
			const nextFeature = getNextPendingFeature(features);
			if (!nextFeature) {
				this.emitEvent({ type: "run_complete" });
				return;
			}

			await this.#interventionManager.waitIfPaused();
			this.assertMilestoneNotSealed(nextFeature.milestone, sealedMilestones);
			this.emitEvent({ type: "feature_start", feature: nextFeature });

			await updateFeatureStatus(missionDir, nextFeature.id, "in_progress");

			let handoff: HandoffResult | null = null;
			let attempt = 0;
			let lastError: Error | null = null;

			while (attempt < 2 && !handoff) {
				attempt += 1;
				try {
					handoff = await this.#spawnWorker({
						feature: nextFeature,
						missionDir,
						targetDir: options.targetDir,
						defaultModel: options.defaultModel,
						thinkingLevel: options.thinkingLevel,
					});
				} catch (error) {
					lastError = error as Error;
				}
			}

			if (!handoff) {
				const message = lastError?.message ?? "Unknown worker failure";
				const failedFeatures = await updateFeatureStatus(missionDir, nextFeature.id, "failed", {
					errorMessage: message,
					errorAt: new Date().toISOString(),
				});
				const failedFeature = failedFeatures.find((feature) => feature.id === nextFeature.id) ?? nextFeature;
				this.emitEvent({ type: "feature_failed", feature: failedFeature, error: message });
				continue;
			}

			await this.#processHandoff(handoff, nextFeature, missionDir);

			const completedFeatures = await updateFeatureStatus(missionDir, nextFeature.id, "completed", { handoff });
			const reorderedFeatures = moveCompletedToBottom(completedFeatures);
			await writeFeatures(missionDir, reorderedFeatures);

			const completedFeature = reorderedFeatures.find((feature) => feature.id === nextFeature.id) ?? nextFeature;
			this.emitEvent({ type: "feature_complete", feature: completedFeature, handoff });

			if (isMilestoneComplete(reorderedFeatures, nextFeature.milestone)) {
				this.emitEvent({ type: "milestone_complete", milestone: nextFeature.milestone });
			}
		}
	}

	assertMilestoneNotSealed(milestone: string, sealedMilestones: Set<string>): void {
		if (sealedMilestones.has(milestone)) {
			throw new Error(`Milestone "${milestone}" is sealed and cannot accept new feature work.`);
		}
	}
}
