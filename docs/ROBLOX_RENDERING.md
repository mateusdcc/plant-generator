# Roblox rendering

Only `src/roblox` creates Instances. `PartPlantRenderer` requires an explicit
parent, uses pooled anchored cylinders, batches work, approximates taper with the
mean endpoint diameter, and returns a handle for growth, time, LOD, transforms,
materials, statistics, cancellation, and destruction. Generated organ sockets
become lightweight pooled leaf blocks or flower spheres. Supply a
`PartOrganFactory` to create specialized Parts; returning `undefined` selects the
pooled default for that organ.

EditableMesh conversion is behind `EditableMeshCapability`. Current Roblox APIs
use `AssetService:CreateEditableMesh()`, stable vertex IDs, `AddTriangle`,
`Content.fromObject`, and `CreateMeshPartAsync`. Published experiences may need
age/ID verification and the **Allow Mesh / Image APIs** security toggle; memory,
permission, client/server, and asset-ownership restrictions can change. Review
the current [Roblox EditableMesh reference](https://create.roblox.com/docs/reference/engine/classes/EditableMesh)
before enabling it. Unsupported capabilities fail before creating output.
Conversion validates indices before allocation and defaults to Roblox's current
60,000-vertex and 20,000-triangle limits. Pass narrower
`EditableMeshConversionLimits` when an experience needs stricter budgets.
