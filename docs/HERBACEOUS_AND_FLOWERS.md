# Herbaceous plants and flowers

`herbaceousBranchingPolicy` distinguishes monopodial, sympodial, and polypodial
axis behavior. `createInflorescence` produces generic sockets for racemes,
spikes, panicles, umbels, cymes, and capitula with terminal flowering and
maturation times. `updateBud` models dormancy, activation, death, and conversion
to flowers using resource and apical-signal inputs.

`createRadialFlower` exposes petal geometry, while sepals, stamens, centers, and
custom organs remain structural groups/factory concerns rather than a fixed art
style.
