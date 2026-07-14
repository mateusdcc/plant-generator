# Cellular systems

The experimental `CellMap` explicitly stores vertices, edges, faces, adjacency,
and attributes. `divideCells` performs deterministic contact-preserving centroid
division. Maps validate and triangulate to mesh data.

`createPlanarCellLayer`, `createSphericalCellLayer`, and `createCellVolume` are
functional planar, spherical, and 3D baselines. They demonstrate the general
Chapter 7 mechanisms; they do not claim species-calibrated tissue simulation.
