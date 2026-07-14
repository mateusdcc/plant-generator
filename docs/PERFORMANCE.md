# Performance

Run reproducible local baselines with:

```sh
npm run benchmark
```

The benchmark suite covers a small flowering plant, medium tree, bounded larger
tree, context rules, timed reevaluation, tubes, phyllotaxis, cellular subdivision,
Part-render preparation data, and incremental derivation. Results are machine-
specific and printed by Vitest; CI verifies that every scenario completes but
does not enforce unstable wall-clock thresholds.

## Verified baseline - 2026-07-14

Apple M4, Darwin 25.4 arm64, Node 25.6.1, npm 11.9.0, Vitest 4.1.10. Mean time per
operation from a completed `npm run benchmark` run:

| Scenario                     |       Mean |
| ---------------------------- | ---------: |
| Small flowering plant        |  0.0467 ms |
| Medium tree                  |  0.8294 ms |
| Large bounded tree           | 13.1611 ms |
| Context-sensitive grammar    |  0.4646 ms |
| Timed reevaluation           |  0.0031 ms |
| Tube mesh generation         |  0.0106 ms |
| Phyllotactic placement       |  0.0935 ms |
| Cellular subdivision         |  0.4648 ms |
| Part-render preparation data |  0.7701 ms |
| Incremental generation       |  3.7450 ms |

These figures are measurements, not guarantees. Count statistics are the
portable baseline: symbol, segment, vertex, triangle, and work-unit budgets must
never be exceeded.

Use compiled models repeatedly, enable the LRU cache only for immutable results,
cap exponential derivations, lower radial resolution with distance, reduce organ
density before branch skeleton density, and stream Part creation in batches.
