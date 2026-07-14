# L-systems and rewriting

`compileGrammar` builds predecessor indexes and validates the alphabet, weights,
and bracket stack. `derive` supports deterministic OL/DOL rules, empty and
identity successors, weighted seeded choices, variable left/right contexts,
ignored symbols, axial branch skipping, guards, and parametric callbacks.

Context-sensitive rules outrank context-free rules; priority breaks equal
specificity, and declaration order resolves an unweighted ambiguity with a
diagnostic. `IncrementalDerivationSession` performs the same algorithm one source
symbol at a time and shares the same explicit limits.

`rewriteEdges` and `rewriteNodes` are graph operations with explicit entry/exit
ports. They are useful for fractal figures, architecture, and contact-preserving
subfigures without a turtle.
