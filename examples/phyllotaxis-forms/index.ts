import {
	GOLDEN_ANGLE,
	analyzeParastichies,
	placeCylindricalPhyllotaxis,
	placePlanarPhyllotaxis,
} from "@rbxts/a-plant-generator";

export const planarHead = placePlanarPhyllotaxis({
	count: 280,
	divergenceAngle: GOLDEN_ANGLE,
	radius: (index) => math.sqrt(index) * 0.42,
	organRadius: () => 0.22,
});

export const cylindricalStem = placeCylindricalPhyllotaxis({
	count: 190,
	divergenceAngle: GOLDEN_ANGLE,
	cylinderRadius: (index) => 3.9 - (index / 190) * 1.8,
	height: (index) => index * 0.076,
	organRadius: () => 0.25,
});

export const likelySpiralFamilies = analyzeParastichies(GOLDEN_ANGLE);
