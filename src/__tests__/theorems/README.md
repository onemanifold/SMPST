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

### DMst - Dynamically Updatable MPST (Castro-Perez & Yoshida 2023)

- `dmst/definition-14-safe-update.test.ts` - **Definition 14** (ECOOP 2023): Safe Protocol Update via 1-unfolding
- `dmst/theorem-20-trace-equivalence.test.ts` - **Theorem 20** (ECOOP 2023): Trace equivalence with dynamic participants
- `dmst/theorem-23-deadlock-freedom.test.ts` - **Theorem 23** (ECOOP 2023): Deadlock-freedom for DMst protocols
- `dmst/theorem-29-liveness.test.ts` - **Theorem 29** (ECOOP 2023): Orphan-freedom, no stuck participants, eventual delivery

## Theory Documentation

All theorems reference formal specifications in:

- `docs/theory/well-formedness-properties.md` - 4 well-formedness theorems with algorithms
- `docs/theory/projection-correctness.md` - 4 projection correctness properties
- `docs/theory/cfg-lts-equivalence.md` - Architectural justification (Theorem 3.1)
- `docs/theory/sub-protocol-formal-analysis.md` - Operational semantics for sub-protocols
- `docs/theory/fifo-verification.md` - FIFO buffer guarantees
- `docs/theory/THEOREM_DRIVEN_TESTING.md` - Complete testing framework
- `docs/theory/dmst-safe-protocol-update.md` (TODO) - Definition 14 algorithms
- `docs/theory/dmst-trace-equivalence.md` (TODO) - Theorem 20 proof
- `docs/theory/dmst-deadlock-freedom.md` (TODO) - Theorem 23 proof
- `docs/theory/dmst-liveness.md` (TODO) - Theorem 29 verification

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
npm run test src/__tests__/theorems/dmst

# Run specific theorem
npm test theorem-20-trace-equivalence
npm test definition-14-safe-update

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

3. **Castro-Perez, Yoshida (ECOOP 2023)** - "Dynamically Updatable Multiparty Session Protocols"
   - Safe Protocol Update (Definition 14)
   - Trace Equivalence (Theorem 20)
   - Deadlock-Freedom (Theorem 23)
   - Liveness (Theorem 29)

4. **Scalas, Yoshida (POPL 2019)** - "Less is More: Multiparty Session Types Revisited"
   - Parametric Safety Properties (Definition 4.1)
   - Subject Reduction (Theorem 4.6)
   - DMst implements as SafetyProperty extension

## Benefits

✅ **Clear Reasoning**: Know *why* each test exists
✅ **Precise Semantics**: Know *what* "correct" means
✅ **Formal Grounding**: Linked to academic theory
✅ **Better Debugging**: Failure indicates theorem violation
✅ **Documentation**: Tests explain formal properties

## Implementation Status

### Classic MPST (Honda 2016, Deniélou 2012)
- [x] Well-Formedness Tests (4 theorems) - Implemented
- [x] Projection Correctness Tests (4 theorems) - Implemented
- [x] CFG-LTS Equivalence Tests - Implemented
- [x] Operational Semantics Tests - Implemented
- [x] Helper Utilities - Implemented
- [ ] CI Integration

### DMst (Castro-Perez 2023) - TDD Phase
- [x] Test Suite Created (4 theorems) - Tests written, skipped
- [ ] Parser Extensions - Needed to enable tests
- [ ] CFG Extensions - Needed to enable tests
- [ ] Projection Extensions - Needed to enable tests
- [ ] Verification Algorithms - Needed to enable tests
- [ ] Runtime Implementation - Needed to enable tests

## Next Steps

### Classic MPST
1. ~~Implement well-formedness tests~~ ✅ Done
2. ~~Implement projection correctness tests~~ ✅ Done
3. ~~Create helper utilities for theorem verification~~ ✅ Done
4. Integrate with CI pipeline
5. Generate theorem verification reports

### DMst (Current Focus)
1. ✅ Create theorem-driven test suite (Definition 14, Theorems 20, 23, 29)
2. Implement parser extensions for DMst syntax (`new role`, `calls`, `continue with`)
3. Extend CFG with DMst action nodes (ProtocolCall, CreateParticipants, Invitation)
4. Implement projection algorithms (Definition 12, 13)
5. Implement verification algorithms (safe update, trace equivalence, liveness)
6. Enable DMst tests by removing `.skip` markers
7. Validate with paper examples (dynamic pipeline, map-reduce)

---

**Status**: Phase 3 - DMst Theorem Test Suite Created (TDD Red Phase)
**Last Updated**: 2025-11-14
