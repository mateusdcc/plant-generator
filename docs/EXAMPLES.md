---
children:
    Preset gallery: examples/preset-gallery.md
    Seed determinism: examples/seed-determinism.md
    Growth stages: examples/growth-stages.md
    LOD comparison: examples/lod-comparison.md
    Phyllotaxis forms: examples/phyllotaxis-forms.md
    Inflorescence gallery: examples/inflorescence-gallery.md
---

# Examples

These examples turn the package's renderer-neutral results into focused,
repeatable scenes. Every snippet imports only the public
`@rbxts/a-plant-generator` entry point and is compiled by
`npm run examples:check`.

Each figure was captured in Roblox Studio from the same deterministic seeds,
stages, thresholds, and botanical parameters shown in its tracked snippet. The
capture harness adds only presentation scale, material, spacing, lighting, and
a fixed camera. Interface chrome and floating labels are intentionally omitted
so every image reads as a neutral specimen plate.

- [Preset gallery](examples/preset-gallery.md) compares curated plant forms.
- [Seed determinism](examples/seed-determinism.md) contrasts replayed and changed seeds.
- [Growth stages](examples/growth-stages.md) freezes one plant at five growth values.
- [LOD comparison](examples/lod-comparison.md) shows the standard visibility bands.
- [Phyllotaxis forms](examples/phyllotaxis-forms.md) places organs on planar and cylindrical spirals.
- [Inflorescence gallery](examples/inflorescence-gallery.md) compares six flowering arrangements.

Run both checks before copying an example into a game:

```sh
npm run examples:check
npm run docs:check
```
