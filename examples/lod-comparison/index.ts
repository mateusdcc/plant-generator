import {
	DistanceLodPolicy,
	PartPlantRenderer,
	PLANT_PRESETS,
	PlantCompiler,
	PlantGenerator,
	type StreamingPlantRenderHandle,
} from "@rbxts/a-plant-generator";

export const sampleDistances = [25, 90, 200, 500] as const;
export const lodPlant = PlantGenerator.generate(PlantCompiler.compile(PLANT_PRESETS["branching-herb"]!), {
	seed: 8080,
	iterations: 6,
	limits: { maxSymbols: 20_000, maxSegments: 2_000 },
});

const policy = new DistanceLodPolicy(70, 150, 320);
export const lodSamples = sampleDistances.map((distance) => ({
	distance,
	settings: policy.select(distance, lodPlant),
}));

export function renderLodComparison(parent: Instance): () => void {
	const renderers = new Array<PartPlantRenderer>();
	const handles = new Array<StreamingPlantRenderHandle>();

	for (let index = 0; index < lodSamples.size(); index++) {
		const sample = lodSamples[index];
		if (sample === undefined) continue;
		const renderer = new PartPlantRenderer({
			parent,
			name: `LOD_${sample.settings.level}`,
			maxInstances: sample.settings.maxInstances,
		});
		const handle = renderer.beginRender(lodPlant);
		handle.setLod(sample.settings.level);
		while (!handle.isComplete()) handle.step(128);
		handle.updateTransform(new CFrame((index - 1.5) * 18, 0, 0));
		renderers.push(renderer);
		handles.push(handle);
	}

	return () => {
		for (const handle of handles) handle.destroy();
		for (const renderer of renderers) renderer.destroy();
	};
}
