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
