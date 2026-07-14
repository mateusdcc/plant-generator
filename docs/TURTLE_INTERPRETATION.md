# Turtle interpretation

The 2D and 3D interpreters support draw/move, yaw, pitch, roll, turn-around,
push/pop, width, polygons, custom attributes/commands, unknown-symbol policies,
sinks, and tracing. Canonical symbols follow Appendix C, but `mappings` can
replace the entire alphabet.

The 3D frame stores heading, left, and up vectors. Rotations use Rodrigues'
formula and Gram-Schmidt correction, preventing uncontrolled drift. Tropism is
an injected `DirectionalField`; constant fields model gravity, light, or wind,
while consumer fields can depend on position and symbol state.
