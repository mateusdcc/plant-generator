import { GrowthHandle, PlantTimeline, createGrowthFunction, symbol } from "@rbxts/plant-generator";

export const timeline = new PlantTimeline([
	{ symbol: symbol("stem"), birthTime: 0, lifespan: 10 },
	{ symbol: symbol("flower"), birthTime: 6, lifespan: 8 },
]);
export const growth = new GrowthHandle(0, 10, { length: createGrowthFunction("smootherstep") });
export const scrubbed = { modules: timeline.evaluate(7.5), channels: growth.evaluate(7.5) };
