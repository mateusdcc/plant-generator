# Getting started

Install with `npm install @rbxts/plant-generator`, compile a preset once, and
generate many deterministic plants from it. `PlantCompiler.compile` is the
strict convenience boundary; tooling that must retain diagnostics can use
`compileWithDiagnostics`.

```ts
import { PLANT_PRESETS, PlantCompiler, PlantGenerator } from "@rbxts/plant-generator";

const model = PlantCompiler.compile(PLANT_PRESETS.conifer!);
const result = PlantGenerator.generate(model, {
	seed: 4401,
	iterations: 5,
	parameters: { age: 0.8 },
	limits: { maxSymbols: 25_000, maxSegments: 4_000 },
});
```

Inspect `branchGraph`, `organs`, `meshData`, `diagnostics`, and `statistics`.
Generation has no implicit service or Workspace access. Render only when needed.

For a frame budget, retain a session and call `step(workUnits)`. Work units are
deterministic symbol operations rather than wall-clock milliseconds, so behavior
is stable across machines.
