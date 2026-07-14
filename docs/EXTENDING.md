# Extending

Implement `RandomSource`, `TurtleCommand`, `DirectionalField`, `SpatialConstraint`,
`GeometryFactory`, `OrganFactory`, `GrowthFunction`, `LodPolicy`, `GeometrySink`,
or `PlantRenderer` without modifying the engine.

Register serializable behaviors by stable ID in caller-owned
`BehaviorRegistries`, then reference that ID in a model. Version IDs when their
semantics change. Custom renderers consume `PlantGenerationResult`, return a
handle with explicit ownership, and must clean partially created resources after
cancellation.
