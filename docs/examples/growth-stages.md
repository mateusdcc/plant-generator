# Growth stages

One generated timed tree can be rendered repeatedly and frozen at several raw
normalized times. The renderer advances a path-distance growth front from the
base, applies smootherstep locally to each developing segment, and delays organs
until their supporting branch has matured.

![Five deterministic growth stages of one generated tree progressing from sparse segments to the complete plant.](../assets/examples/growth-stages.jpg)

_Left to right: raw normalized developmental times 0.15, 0.35, 0.55, 0.75,
and 1.00. Local segment growth is smoothed within each topological span._

{@includeCode ../../examples/growth-stages/index.ts}

`setGrowth` clamps values to the `0..1` range. Parent segments complete before
their children emerge, partial cylinders remain anchored at their base, and
organs follow the timing of their host segment. The returned cleanup function
destroys handles before their renderer pools.

For interactive animation, advance a normalized value from `RunService` and
retain the same handles instead of regenerating on every frame.
