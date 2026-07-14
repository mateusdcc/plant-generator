# Tree modeling

`BranchGraph` stores nodes, segments, axes, buds, organ sockets, birth/death
times, radii, frames, order, depth, metadata, stable IDs, and bounds. Queries,
DFS/BFS, terminal detection, length, biomass, rescaling, pruning, validation,
and stable hashes do not require geometry.

`createTreeGraph` is an iterative Honda-style policy mechanism with length/radius
decay, inclination, azimuth, curvature, stochastic variation, spatial envelopes,
and environmental direction fields. Advanced plants should compose policies
rather than add a special-purpose tree class.
