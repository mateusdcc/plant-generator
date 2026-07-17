# Deterministic networking recipe

The server validates a model ID/version, seed, time, parameter overrides, and
mutation values, then sends only `PlantDescriptor`. The client allow-lists the
model ID, verifies the model hash/version, regenerates with the same limits, and
renders locally.

Declarative model hashes do not serialize inline function bodies. If a model
uses runtime callbacks, both peers must resolve the same versioned implementation;
prefer allow-listed registry IDs for models reconstructed across the network.

Do not replicate meshes or every branch unless authoritative collision requires
it. Do not trust a client-provided descriptor for rewards, harvesting, or
collision. Determinism reconstructs visuals; it is not an authority system.
