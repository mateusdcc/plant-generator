import {
	PartPlantRenderer,
	PLANT_PRESETS,
	PlantCompiler,
	PlantGenerator,
	type PlantRenderHandle,
} from "@rbxts/a-plant-generator";

export const growthTimes = [0.15, 0.35, 0.55, 0.75, 1] as const;
export const growthSamples = growthTimes.map((time) => ({
	time,
	growth: time,
}));
export const growthPlant = PlantGenerator.generate(PlantCompiler.compile(PLANT_PRESETS["timed-tree"]!), {
	seed: 31415,
	iterations: 4,
	limits: { maxSymbols: 20_000, maxSegments: 2_000 },
});

export function renderGrowthStages(parent: Instance): () => void {
	const renderers = new Array<PartPlantRenderer>();
	const handles = new Array<PlantRenderHandle>();

	for (let index = 0; index < growthSamples.size(); index++) {
		const sample = growthSamples[index];
		if (sample === undefined) continue;
		const renderer = new PartPlantRenderer({
			parent,
			name: `Growth_${math.floor(sample.time * 100)}`,
			maxInstances: 2_000,
		});
		const handle = renderer.render(growthPlant);
		handle.updateTransform(new CFrame((index - 2) * 16, 0, 0));
		handle.setGrowth(sample.growth);
		renderers.push(renderer);
		handles.push(handle);
	}

	return () => {
		for (const handle of handles) handle.destroy();
		for (const renderer of renderers) renderer.destroy();
	};
}
