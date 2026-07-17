# Examples

Every directory contains a focused public-API-only TypeScript example. Run
`npm run examples:check` from the repository root to compile all examples.

The [Examples guide](../docs/EXAMPLES.md) collects the visual, deterministic
scenes intended for Studio screenshots.

## Visual galleries

| Example                                         | Focus                                           |
| ----------------------------------------------- | ----------------------------------------------- |
| [Preset gallery](preset-gallery/)               | Eight curated plant forms with fixed inputs     |
| [Seed determinism](seed-determinism/)           | Weighted grammar replay versus one changed seed |
| [Growth stages](growth-stages/)                 | One timed tree at four normalized growth values |
| [LOD comparison](lod-comparison/)               | Pre-stream full, medium, low, and impostor LOD  |
| [Phyllotaxis forms](phyllotaxis-forms/)         | Planar and cylindrical organ placement          |
| [Inflorescence gallery](inflorescence-gallery/) | Six flowering attachment arrangements           |

## Generation and botany

| Example                                           | Focus                                           |
| ------------------------------------------------- | ----------------------------------------------- |
| [Basic tree](basic-tree/)                         | Compile and generate a deterministic preset     |
| [Custom L-system](custom-lsystem/)                | Define a complete model specification           |
| [Stochastic garden](stochastic-garden/)           | Seeded weighted productions                     |
| [Context signaling](context-signaling/)           | Left-context developmental signaling            |
| [Botanical architecture](botanical-architecture/) | Transform renderer-neutral geometry             |
| [Compound leaf](compound-leaf/)                   | Leaflet transforms and merged mesh data         |
| [Cellular layer](cellular-layer/)                 | Deterministic cell division and mesh conversion |
| [Phyllotaxis](phyllotaxis/)                       | Minimal planar golden-angle placement           |

## Runtime and rendering

| Example                                               | Focus                                     |
| ----------------------------------------------------- | ----------------------------------------- |
| [Animated growth](animated-growth/)                   | Absolute-time symbols and growth channels |
| [Incremental budget](incremental-budget/)             | Deterministic work per frame              |
| [Deterministic networking](deterministic-networking/) | Compact descriptor replay                 |
| [LOD forest](lod-forest/)                             | Distance policy selection                 |
| [Part renderer](part-renderer/)                       | Explicit parent and bounded Instance pool |
| [EditableMesh renderer](editable-mesh-renderer/)      | Injected platform capability boundary     |
| [Custom renderer](custom-renderer/)                   | Renderer and handle lifecycle             |
| [Rojo showcase](showcase/)                            | Attribute-controlled Studio scene         |
