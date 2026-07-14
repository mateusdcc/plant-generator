import type { Bud } from "../topology/branch-graph";

/** Inputs controlling a developmental bud transition. @public */
export interface BudControl {
	readonly time: number;
	readonly activationThreshold: number;
	readonly deathThreshold: number;
	readonly apicalSignal: number;
	readonly resourceDelta: number;
	readonly convertToFlower?: boolean;
}

/**
 * Pure bud-state transition supporting dormancy, activation, death, and flower conversion.
 *
 * @public
 */
export function updateBud(bud: Bud, control: BudControl): Bud {
	if (bud.state === "dead" || bud.state === "converted") return bud;
	const resource = math.max(0, bud.resource + control.resourceDelta - control.apicalSignal);
	if (resource <= control.deathThreshold) return { ...bud, resource, state: "dead", deathTime: control.time };
	if (control.convertToFlower === true && resource >= control.activationThreshold) {
		return {
			...bud,
			resource,
			kind: "flower",
			state: "converted",
			activationTime: bud.activationTime ?? control.time,
		};
	}
	if (bud.state === "dormant" && resource >= control.activationThreshold) {
		return { ...bud, resource, state: "active", activationTime: control.time };
	}
	return { ...bud, resource };
}

/** Propagates a decaying apical-dominance signal over module distance. @public */
export function apicalDominanceSignal(initial: number, decay: number, moduleDistance: number): number {
	return math.max(0, initial) * math.pow(math.clamp(decay, 0, 1), math.max(0, moduleDistance));
}
