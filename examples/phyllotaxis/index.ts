import { GOLDEN_ANGLE, placePlanarPhyllotaxis } from "@rbxts/plant-generator";

export const seeds = placePlanarPhyllotaxis({
	count: 500,
	divergenceAngle: GOLDEN_ANGLE,
	radius: (index) => math.sqrt(index) * 0.08,
	organRadius: () => 0.035,
});
