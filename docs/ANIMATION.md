# Animation

Timed words use birth time and optional lifespan. `PlantTimeline.evaluate(time)`
reconstructs state directly at absolute time, so playback and backward scrubbing
do not simulate intermediate frames. Events enumerate births and deaths.

Built-ins include constant, linear, inverse-linear, smoothstep, smootherstep,
exponential, ease-in/out/in-out, and normalized logistic curves. Keyframes,
piecewise curves, and registered custom functions cover specialized growth.
`GrowthHandle` outputs length, radius, curvature, leaf/flower opening, organ
scale, visibility, tropism, and metadata channels.
