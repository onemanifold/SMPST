# Theorem-Driven Test Suite

This directory contains tests that verify formal properties from MPST theory.

## Overview

Traditional tests verify behavior ("it works"). **Theorem-driven tests** verify formal properties ("it proves Theorem X").

Each test explicitly cites a theorem from academic papers and serves as a proof obligation for that theorem.

## Test Organization

### Well-Formedness (Honda 2016, Deniélou & Yoshida 2012)

- `well-formedness/connectedness.test.ts` - **Definition 2.5** (Honda 2016): All declared roles must participate
- `well-formedness/determinism.test.ts` - **Determinism Property** (Honda 2016): Choice branches have unique labels
- `well-formedness/no-races.test.ts` - **Theorem 4.5** (Deniélou & Yoshida 2012): Parallel branches use disjoint channels
- `well-formedness/progress.test.ts` - **Theorem 5.10** (Honda 2016): Well-formed protocols are deadlock-free

### Projection Correctness (Honda 2016, Deniélou & Yoshida 2012)

- `projection/completeness.test.ts` - **Theorem 4.7** (Honda 2016): All global actions appear in some projection
- `projection/soundness.test.ts` - **Theorem 3.1** (Deniélou & Yoshida 2012): Local steps correspond to global steps
- `projection/composability.test.ts` - **Theorem 5.3** (Honda 2016): Projections are mutually dual
- `projection/preservation.test.ts` - **Lemma 3.6** (Honda 2016): Well-formed global → well-formed local

### Equivalence (Deniélou & Yoshida 2012)

- `equivalence/cfg-lts.test.ts` - **Theorem 3.1** (Deniélou & Yoshida 2012): Node-labeled CFG equivalent to edge-labeled LTS

### Operational Semantics

- `operational-semantics/sub-protocols.test.ts` - Sub-protocol formal reduction rules
- `operational-semantics/fifo-buffers.test.ts` - **Theorems 4.8, 5.3** (Honda 2016): FIFO and causal delivery

## Theory Documentation

All theorems reference formal specifications in:

- `docs/theory/well-formedness-properties.md` - 4 well-formedness theorems with algorithms
- `docs/theory/projection-correctness.md` - 4 projection correctness properties
- `docs/theory/cfg-lts-equivalence.md` - Architectural justification (Theorem 3.1)
- `docs/theory/sub-protocol-formal-analysis.md` - Operational semantics for sub-protocols
- `docs/theory/fifo-verification.md` - FIFO buffer guarantees
- `docs/theory/THEOREM_DRIVEN_TESTING.md` - Complete testing framework

## Test Template

Every theorem test follows this structure:

```typescript
/**
 * THEOREM X.Y (Author Year): Theorem Name
 *
 * STATEMENT: [Formal statement from theory doc]
 *
 * SOURCE: docs/theory/[relevant-doc].md
 * CITATION: [Paper citation]
 */
describe('Theorem X.Y: Theorem Name (Author Year)', () => {
  it('proves: [property statement]', () => {
    // Arrange: Setup protocol/cfg
    const protocol = `...`;

    // Act: Apply implementation
    const result = implementationFunction(protocol);

    // Assert: Verify theorem holds
    expect(result).toSatisfy([theorem property]);
  });

  it('counterexample: [violation case]', () => {
    // Show theorem correctly rejects invalid cases
  });
});
```

## Running Tests

```bash
# Run all theorem tests
npm run test:theorems

# Run specific theorem category
npm run test src/__tests__/theorems/well-formedness
npm run test src/__tests__/theorems/projection

# Watch mode
npm run test:theorems:watch

# Coverage report
npm run test:coverage:theorems
```

## References

### Primary Papers

1. **Honda, Yoshida, Carbone (JACM 2016)** - "Multiparty Asynchronous Session Types"
   - Completeness (Theorem 4.7)
   - Progress (Theorem 5.10)
   - Composability (Theorem 5.3)
   - Well-Formedness Preservation (Lemma 3.6)
   - Connectedness (Definition 2.5)

2. **Deniélou, Yoshida (ESOP 2012)** - "Multiparty Session Types Meet Communicating Automata"
   - Soundness (Theorem 3.1)
   - No Races (Theorem 4.5)
   - CFG-LTS Equivalence (Theorem 3.1)

## Benefits

✅ **Clear Reasoning**: Know *why* each test exists
✅ **Precise Semantics**: Know *what* "correct" means
✅ **Formal Grounding**: Linked to academic theory
✅ **Better Debugging**: Failure indicates theorem violation
✅ **Documentation**: Tests explain formal properties

## Implementation Status

- [ ] Well-Formedness Tests (4 theorems)
- [ ] Projection Correctness Tests (4 theorems)
- [ ] CFG-LTS Equivalence Tests
- [ ] Operational Semantics Tests
- [ ] Helper Utilities
- [ ] CI Integration

## Next Steps

1. Implement well-formedness tests (connectedness, determinism, no-races, progress)
2. Implement projection correctness tests (completeness, soundness, composability, preservation)
3. Create helper utilities for theorem verification
4. Integrate with CI pipeline
5. Generate theorem verification reports

---

**Status**: Phase 0 - Theorem-Driven Testing Implementation
**Last Updated**: 2025-11-13
