# Phyllotaxis

Planar placement uses a configurable divergence angle and radial growth
function; cylindrical placement adds radius and height functions. The exported
golden angle is a useful default, not a requirement. Both APIs support index
ranges, deterministic jitter, arbitrary organ radius, and generic transforms.

Optional spacing relaxation moves colliding planar organs outward in bounded
steps. It is a placement policy, not a physics simulation. `analyzeParastichies`
ranks low-angular-error spiral counts. Rendered geometry and collision volumes
remain consumer choices.
