import { cellMapToMesh, createPlanarCellLayer, createSphericalCellLayer, divideCells } from "@rbxts/plant-generator";

const planar = divideCells(createPlanarCellLayer(4, 4), (face) => face.id % 2 === 0);
export const planarMesh = cellMapToMesh(planar);
export const spherical = createSphericalCellLayer(12, 6);
