# Inflorescence gallery

Inflorescence builders describe attachment topology independently from flower
geometry. This example generates raceme, spike, panicle, umbel, cyme, and
capitulum arrangements with the same overall scale.

![Six generated inflorescence attachment architectures displayed as botanical specimens.](../assets/examples/inflorescence-gallery.jpg)

_Left to right: raceme, spike, panicle, umbel, cyme, and capitulum. Each sample
uses 12 lateral attachments plus its terminal flower._

{@includeCode ../../examples/inflorescence-gallery/index.ts}

Each attachment includes a transform, birth time, maturation duration, and
terminal flag. A consumer renderer can use simple balls for a diagnostic scene
or replace them with meshes from `createRadialFlower`.

Try varying `divergenceAngle` or `birthInterval` without changing the selected
inflorescence kind.
