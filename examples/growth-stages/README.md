# Growth stages

Renders one deterministic timed tree at five normalized developmental times.
The renderer advances a path-distance growth front from the base, smooths each
segment locally, and opens organs only after their host branch matures. The
example returns explicit cleanup that destroys render handles before their Part
pools.

See the [growth stages guide](../../docs/examples/growth-stages.md).
