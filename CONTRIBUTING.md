# Contributing

## Setup and verification

Use Node 20.19 or newer and npm. Run `npm ci`, then `npm run verify`. Individual
commands are `npm run build`, `npm test`, `npm run lint`, `npm run format:check`,
`npm run examples:check`, `npm run docs:check`, `npm run benchmark`, and
`npm run consumer:check`.

## Architecture boundaries

Core, math, turtle, topology, geometry, botanical, animation, and runtime modules
must not create Instances or access Roblox services. Only `src/roblox` may do so,
and adapters must take explicit parents/capabilities. Derivation, interpretation,
geometry, and rendering remain separate.

## Changes

- **Production type:** add a general mechanism to `core`, validation, deterministic
  unit/failure tests, public TSDoc, and an L-systems guide example.
- **Preset:** register an ordinary immutable `ModelSpecification`; do not branch
  generator code by preset ID.
- **Renderer:** implement `PlantRenderer`, explicit resource ownership, bounded
  work, cancellation, cleanup, and data-conversion tests.
- **Experimental module:** mark public TSDoc `@experimental`, implement working
  behavior and tests, document why the API is not stable, and update book coverage.

Update `CHANGELOG.md` under **Unreleased** for user-visible changes. Pull requests
should be narrowly scoped, explain behavior and performance impact, include tests
and documentation, pass `npm run verify`, and contain no generated `out`, docs
site, tarballs, secrets, or copyrighted book assets. Maintainers use release-please
to turn changelog/release metadata into tagged releases.
