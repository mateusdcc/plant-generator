import {
	PartPlantRenderer,
	PlantCompiler,
	PlantGenerator,
	PLANT_PRESETS,
	type LodLevel,
	type PlantRenderHandle,
} from "@rbxts/plant-generator";

const workspace = game.GetService("Workspace");
const controls = new Instance("Folder");
controls.Name = "PlantGeneratorControls";
controls.SetAttribute("Seed", 12345);
controls.SetAttribute("Growth", 1);
controls.SetAttribute("LOD", "full");
controls.SetAttribute("Regenerate", false);
controls.Parent = workspace;

const output = new Instance("Folder");
output.Name = "GeneratedPlants";
output.Parent = workspace;

let handle: PlantRenderHandle | undefined;
let renderer: PartPlantRenderer | undefined;

function regenerate(): void {
	handle?.destroy();
	renderer?.destroy();
	const seed = controls.GetAttribute("Seed");
	const model = PlantCompiler.compile(PLANT_PRESETS["broad-canopy-tree"]!);
	const result = PlantGenerator.generate(model, { seed: typeIs(seed, "number") ? seed : 12345, iterations: 4 });
	renderer = new PartPlantRenderer({ parent: output, maxInstances: 3_000 });
	handle = renderer.render(result);
	handle.setGrowth(
		typeIs(controls.GetAttribute("Growth"), "number") ? (controls.GetAttribute("Growth") as number) : 1,
	);
	handle.setLod((controls.GetAttribute("LOD") as LodLevel | undefined) ?? "full");
	controls.SetAttribute("Segments", result.statistics.segments);
	controls.SetAttribute("Vertices", result.statistics.vertices);
	controls.SetAttribute("Symbols", result.statistics.symbols);
}

controls.GetAttributeChangedSignal("Growth").Connect(() => {
	const value = controls.GetAttribute("Growth");
	if (typeIs(value, "number")) handle?.setGrowth(value);
});
controls
	.GetAttributeChangedSignal("LOD")
	.Connect(() => handle?.setLod((controls.GetAttribute("LOD") as LodLevel | undefined) ?? "full"));
controls.GetAttributeChangedSignal("Regenerate").Connect(regenerate);
regenerate();
