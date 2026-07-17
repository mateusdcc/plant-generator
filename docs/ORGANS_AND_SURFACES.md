# Organs and surfaces

`MeshData` contains vertices, indices, normals, UVs, optional colors/tangents/
tags, material groups, and bounds. Validate every consumer-supplied mesh.

Branch tubes use parallel-transport frames, tapered radii, UVs, caps, and either
cheap overlapping junctions or short collar blends. Surfaces include disks/
ellipses, blades, ribbons, tubes, petals, and user parametric grids. Fixed grid
sampling preserves topology across growth; changing sample counts necessarily
changes topology.

Compound leaves place blade meshes along a rachis. Leaf veins can be represented
as paths/topology without requiring photorealistic meshes.

At the high-level generator boundary, conventional `L` and `K` modules become
renderer-neutral leaf and flower attachments when the model configures
`terminalLeafKind` or `terminalFlowerKind`. Their transforms preserve the exact
turtle node and frame. Terminal branches without an explicit socket still
receive the configured fallback organ, while an explicit socket at a terminal
tip takes precedence there. Explicit and fallback organs share `maxOrgans`.
