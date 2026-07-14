import type { LodLevel, PlantGenerationResult, PlantRenderHandle, PlantRenderer } from "@rbxts/plant-generator";

class DataHandle implements PlantRenderHandle {
	public constructor(private readonly result: PlantGenerationResult) {}
	public setGrowth(_growth: number): void {}
	public setTime(_time: number): void {}
	public setLod(_level: LodLevel): void {}
	public updateTransform(_transform: CFrame): void {}
	public updateMaterialTag(_tag: string, _material: Enum.Material, _color?: Color3): void {}
	public getStatistics(): Readonly<Record<string, number>> {
		return { segments: this.result.branchGraph.segments.size() };
	}
	public cancel(): void {}
	public destroy(): void {}
}

export class DataOnlyRenderer implements PlantRenderer<DataHandle> {
	public render(result: PlantGenerationResult): DataHandle {
		return new DataHandle(result);
	}
}
