# API stability

Version 0.x follows Semantic Versioning with honest pre-1.0 maturity. Unannotated
exports are the stable working surface and receive deprecation notices before
removal where practical. `@beta` APIs may refine signatures in a minor release.
`@experimental` cellular and EditableMesh APIs may change as field experience or
Roblox platform contracts evolve.

Deep imports are unsupported. Import only from `@rbxts/plant-generator`.
