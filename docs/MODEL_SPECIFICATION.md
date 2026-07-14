# Model specification

`ModelSpecification` contains `schemaVersion`, `id`, metadata, grammar, turtle,
geometry, organs, animation, LOD, and extension data. Static successors remain
plain data. Dynamic production logic is referenced by `operationId` and resolved
from caller-owned registries.

```ts
const spec: ModelSpecification = {
	schemaVersion: 1,
	id: "my-stem",
	grammar: {
		alphabet: [{ id: "A" }, { id: "F" }],
		axiom: [symbol("A")],
		productions: [{ id: "grow", predecessor: "A", successor: [symbol("F"), symbol("A")] }],
	},
};
```

Use `extendModelSpecification` for immutable group-level deep overrides and
`migrateModelSpecification` for schema 0 inputs. Never execute registry IDs from
untrusted data without an allow-list.
