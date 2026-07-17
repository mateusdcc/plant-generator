# Phyllotaxis forms

Phyllotaxis APIs return generic transforms rather than choosing geometry. The
same placement data can drive seeds, petals, fruit, lights, particles, or custom
Instances.

![Golden-angle phyllotaxis rendered as a planar seed head and a tapered cylindrical succulent.](../assets/examples/phyllotaxis-forms.jpg)

_The planar plate contains 280 organs; the cylindrical form contains 190. Both
advance by the same golden divergence angle._

{@includeCode ../../examples/phyllotaxis-forms/index.ts}

The planar head expands by square-root radius; the cylindrical form tapers as it
rises. `likelySpiralFamilies` reports low-error parastichy counts for the chosen
divergence angle.

Keep marker geometry lightweight in a Part-based preview. For dense final
geometry, batch the transforms in a consumer renderer rather than creating one
Instance per placement.
