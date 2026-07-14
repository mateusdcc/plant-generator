# Concepts

A **model specification** is versioned plain data. Compilation validates the
alphabet, brackets, weights, callback IDs, and production index. A **word** is a
sequence of immutable parameterized symbols. A derivation rewrites all symbols
in parallel; an identity production is implicit when nothing matches.

A **turtle** interprets the final word but is not part of rewriting. It emits a
branch graph and polygon paths. Geometry builders may turn that topology into
meshes, and optional renderers may turn results into Instances.

Determinism includes the model, seed, global parameters, absolute time, and
limits. Changing a limit may intentionally change the deterministic partial
result. The seed is not a secret.
