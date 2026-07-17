# Presets

Built-ins are ordinary `ModelSpecification` values: flowering stem, branching
herb, bush, conifer, broad-canopy tree, vine, compound leaf, raceme, sympodial
flowering plant, phyllotactic head, root-like structure, botanical arch,
botanical hut, and timed tree.

Use `PresetRegistry.extend(parentId, childId, overrides)` to derive immutable
variants. Presets demonstrate mechanisms; they are not copied species models or
hardcoded generator exceptions.

The six gallery presets deliberately use different architectural programs:
`flowering-stem` keeps a monopodial leader, `branching-herb` replaces its apex
sympodially, `bush` starts from six basal axes, `conifer` emits tiered whorls,
`broad-canopy-tree` raises a clear bole before dividing its crown, and `vine`
alternates a curved leader with tendrils.
