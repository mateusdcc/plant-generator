# Turtle interpretation

The 2D and 3D interpreters support draw/move, yaw, pitch, roll, turn-around,
push/pop, width, polygons, custom attributes/commands, unknown-symbol policies,
sinks, and tracing. Canonical symbols follow Appendix C, but `mappings` can
replace the entire alphabet.

The 3D frame stores heading, left, and up vectors. Rotations use Rodrigues'
formula and Gram-Schmidt correction, preventing uncontrolled drift. Tropism is
an injected `DirectionalField`; constant fields model gravity, light, or wind,
while consumer fields can depend on position and symbol state.

`attachmentMappings` turns non-drawing symbols into generic
`OrganAttachment` sockets and publishes them through `GeometrySink.onAttachment`.
The high-level generator supplies conventional `L`/`K` mappings from the model's
organ configuration; direct turtle consumers can map any symbol and organ kind.
