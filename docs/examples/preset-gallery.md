# Preset gallery

The built-in presets are ordinary model specifications. This gallery compiles
six contrasting forms and fixes the seed and iteration count for a stable
comparison.

![Six generated plant architectures arranged on a neutral specimen stage.](../assets/examples/preset-gallery.jpg)

_Left to right: flowering stem, branching herb, bush, conifer, broad-canopy
tree, and vine. All use seed 2026; morphology-specific iteration counts let
each architecture reach a readable mature silhouette._

{@includeCode ../../examples/preset-gallery/index.ts}

Pass each `result` to a renderer and space the returned handles with
`updateTransform`. Reuse compiled models when generating many copies of the
same preset, and keep an explicit Instance budget in runtime scenes.

The six showcase presets use separate architectural programs: persistent
leaders, sympodial forks, basal axes, tiered whorls, a clear bole with radial
crown division, and a curved climbing axis. Their productions are deterministic,
so changing only the seed does not alter topology. To introduce variation,
extend a preset with weighted productions as shown in
[Seed determinism](seed-determinism.md).
