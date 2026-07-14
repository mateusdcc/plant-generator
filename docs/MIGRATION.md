# Migration

`migrateModelSpecification` upgrades schema 0 (missing/zero schema version) to
schema 1. Unknown future versions are rejected instead of guessed. Package
release notes document public API migrations; model schema migrations are
separate from npm package versions.

Before upgrading, run generation hash tests for important models and inspect LOD
and budget diagnostics.
