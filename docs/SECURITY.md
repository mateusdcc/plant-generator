# Security

Treat serialized models and descriptors as untrusted input. Validate schema,
alphabet size, production weights, bracket balance, all count/work budgets, mesh
indices, and every registry ID. Allow-list model and behavior IDs; a registered
callback is code with the consumer's authority.

PRNG output is deterministic and not cryptographic. Never use seeds for secrets,
loot integrity, anti-cheat, or authentication. Keep gameplay authority on the
server even when clients reconstruct visuals.

Roblox asset APIs have separate ownership, verification, and experience-security
requirements. The package never stores tokens and needs no HTTP access.
