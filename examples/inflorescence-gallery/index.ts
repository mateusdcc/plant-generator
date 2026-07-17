import { createInflorescence, type InflorescenceKind } from "@rbxts/a-plant-generator";

export const inflorescenceKinds: readonly InflorescenceKind[] = [
	"raceme",
	"spike",
	"panicle",
	"umbel",
	"cyme",
	"capitulum",
];

export const inflorescenceGallery = inflorescenceKinds.map((kind) => ({
	kind,
	attachments: createInflorescence({
		kind,
		count: 12,
		length: 2.6,
		radius: 0.72,
		birthInterval: 0.35,
		maturationDuration: 1.4,
		terminalFlower: true,
	}),
}));
