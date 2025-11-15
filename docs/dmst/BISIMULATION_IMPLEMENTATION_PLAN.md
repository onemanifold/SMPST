# Bisimulation Implementation Plan for DMst Verification

## Objective

Implement weak bisimulation checking for Dynamically Updatable Multiparty Session Types (DMst) to achieve complete, scalable verification of Theorem 20 (Trace Equivalence).

**Target**: 76/76 tests passing with O(m log n) performance

## Current Status: 74/76 Tests Passing

### Passing
- ✅ Structural properties (well-formedness)
- ✅ Deadlock freedom
- ✅ Race condition detection
- ✅ Safe protocol update (Definition 14) - all 3 tests
- ✅ Trace equivalence for simple protocols - 8/10 tests
- ✅ Dynamic participants, protocol calls, basic updatable recursion

### Failing (2 tests) - Require Bisimulation
1. **Updatable Pipeline** - trace equivalence (recursive protocol with choices)
2. **Nested Update** - trace equivalence (nested recursive protocol)

**Root Cause**: Trace enumeration with depth=2 insufficient for deep recursion

**Solution**: Bisimulation handles infinite behaviors through coinduction

## Research-Based Design

### Bisimulation Type: Weak Bisimulation

From research (Honda et al. POPL 2008, Deniélou & Yoshida ESOP 2012):

- **Weak bisimulation** abstracts internal τ-transitions
- Standard for MPST to handle internal choice and asynchrony
- Coinductive definition for recursion/infinite behaviors

### Algorithm: Paige-Tarjan Partition Refinement

- **Complexity**: O(m log n) where m = transitions, n = states
- **Better than**: Kanellakis-Smolka, trace enumeration (PSPACE)
- **Approach**: Iteratively refine state equivalence classes

### Implementation Strategy: On-The-Fly Checking

- Explore product space lazily (avoid full product construction)
- Terminate early on mismatch
- Extract counterexample traces for debugging
- **Rationale**: CFG/CFSM structure mismatch makes full product inefficient

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│         DMst Verification Pipeline                   │
├─────────────────────────────────────────────────────┤
│                                                       │
│  Global Protocol (AST)                               │
│         │                                             │
│         ├──► CFG Builder ──► Global CFG              │
│         │                                             │
│         └──► Projection ──► Local CFSMs (per role)   │
│                                                       │
│  Bisimulation Checker:                               │
│    ┌───────────────────────────────────┐            │
│    │ checkBisimulation(cfg, cfsmMap)   │            │
│    │                                    │            │
│    │  1. Build LTS from CFG            │            │
│    │  2. Build LTS from composed CFSMs │            │
│    │  3. Normalize τ-transitions       │            │
│    │  4. On-the-fly partition refine   │            │
│    │  5. Return result + counterexample│            │
│    └───────────────────────────────────┘            │
│                                                       │
└─────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: LTS (Labeled Transition System) Representation

**Goal**: Convert CFG and CFSM to uniform LTS format for bisimulation checking

**Files**:
- `src/core/verification/dmst/lts.ts` - LTS types and builders

**Types**:
```typescript
export interface LTS {
  states: Set<string>;
  initialState: string;
  transitions: Transition[];
  alphabet: Set<ActionLabel>;
}

export interface Transition {
  from: string;
  to: string;
  label: ActionLabel;
}

export type ActionLabel =
  | { type: 'tau' }  // Internal/silent transition
  | { type: 'message'; from: string; to: string; label: string }
  | { type: 'create'; creator: string; role: string }
  | { type: 'invite'; inviter: string; invitee: string }
  | { type: 'call'; caller: string; protocol: string };
```

**Functions**:
```typescript
// Convert CFG to LTS
export function cfgToLTS(cfg: CFG): LTS

// Convert CFSM to LTS
export function cfsmToLTS(cfsm: CFSM): LTS

// Compose multiple CFSM LTS into single LTS
export function composeLTS(ltsList: LTS[]): LTS
```

**DMst Considerations**:
- **Dynamic participants**: `create` and `invite` as τ-transitions (internal synchronization)
- **Protocol calls**: Observable actions (part of external behavior)
- **Updatable recursion**: Normal transitions (cycles in LTS)

### Phase 2: Weak Bisimulation Relation

**Goal**: Define weak bisimulation relation with τ-abstraction

**Files**:
- `src/core/verification/dmst/weak-bisimulation.ts`

**Algorithm**:
```typescript
// Compute τ-closure (states reachable via τ-transitions)
function tauClosure(lts: LTS, state: string): Set<string>

// Check if s1 in lts1 can match transition of s2 in lts2
function canMatch(
  lts1: LTS, s1: string,
  lts2: LTS, s2: string,
  label: ActionLabel
): boolean

// Main bisimulation check
export function areWeaklyBisimilar(lts1: LTS, lts2: LTS): BisimulationResult
```

**Weak Bisimulation Definition**:

Two states s₁ and s₂ are weakly bisimilar (s₁ ~ s₂) if:

1. For every transition s₁ --a--> s₁':
   - If a = τ: s₁' ~ s₂
   - If a ≠ τ: exists s₂ ==τ*==> s₂'' --a--> s₂' ==τ*==> s₂''' where s₁' ~ s₂'''

2. Symmetric condition for s₂

Where ==τ*==> means "zero or more τ-transitions"

### Phase 3: Paige-Tarjan Partition Refinement

**Goal**: Efficient bisimulation checking via partition refinement

**Files**:
- `src/core/verification/dmst/partition-refinement.ts`

**Algorithm Sketch**:
```typescript
export function paigeTarjanBisimulation(lts1: LTS, lts2: LTS): BisimulationResult {
  // 1. Build combined state space
  const combined = combineLTS(lts1, lts2);

  // 2. Initialize partition (all states equivalent)
  let partition = new Partition([new Block(combined.states)]);

  // 3. Refine partition until stable
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of partition.blocks) {
      for (const label of combined.alphabet) {
        const refined = refineBlock(block, label, partition, combined);
        if (refined.length > 1) {
          partition = partition.split(block, refined);
          changed = true;
        }
      }
    }
  }

  // 4. Check if initial states are in same block
  const initialBlock1 = partition.blockOf(lts1.initialState);
  const initialBlock2 = partition.blockOf(lts2.initialState);

  const isBisimilar = initialBlock1 === initialBlock2;

  if (!isBisimilar) {
    // Extract distinguishing trace
    const counterexample = extractCounterexample(partition, lts1, lts2);
    return { isBisimilar: false, counterexample };
  }

  return { isBisimilar: true };
}

function refineBlock(
  block: Block,
  label: ActionLabel,
  partition: Partition,
  lts: LTS
): Block[] {
  // Split block based on transitions with 'label'
  // States that transition to same equivalence class stay together
  // O(m log n) complexity through careful bookkeeping
}
```

**Partition Data Structures**:
```typescript
class Partition {
  blocks: Block[];
  stateToBlock: Map<string, Block>;

  blockOf(state: string): Block;
  split(oldBlock: Block, newBlocks: Block[]): Partition;
}

class Block {
  states: Set<string>;

  splitBy(criterion: (state: string) => boolean): [Block, Block];
}
```

### Phase 4: On-The-Fly Bisimulation Checking

**Goal**: Lazy exploration of product space for efficiency

**Files**:
- `src/core/verification/dmst/on-the-fly-bisimulation.ts`

**Algorithm**:
```typescript
export function onTheFlyBisimulation(lts1: LTS, lts2: LTS): BisimulationResult {
  const visited = new Set<string>(); // Visited state pairs
  const pending = new Queue<[string, string]>(); // Pending pairs to check

  // Start from initial states
  pending.enqueue([lts1.initialState, lts2.initialState]);

  while (!pending.isEmpty()) {
    const [s1, s2] = pending.dequeue();
    const pairKey = `${s1}:${s2}`;

    if (visited.has(pairKey)) continue;
    visited.add(pairKey);

    // Check all transitions from s1
    for (const t1 of transitionsFrom(lts1, s1)) {
      // Find matching transition from s2 (considering τ-closure)
      const match = findMatchingTransition(lts2, s2, t1.label);

      if (!match) {
        // No match found - not bisimilar
        return {
          isBisimilar: false,
          counterexample: buildCounterexample(visited, s1, s2, t1)
        };
      }

      // Add successor pair to pending
      pending.enqueue([t1.to, match.to]);
    }

    // Symmetric check for s2 (omitted for brevity)
  }

  return { isBisimilar: true };
}

function findMatchingTransition(
  lts: LTS,
  state: string,
  label: ActionLabel
): Transition | null {
  if (label.type === 'tau') {
    // τ-transition can match any state in τ-closure
    return transitionsFrom(lts, state).find(t => t.label.type === 'tau');
  }

  // For non-τ labels, must traverse τ-closure then match label
  for (const tauState of tauClosure(lts, state)) {
    for (const t of transitionsFrom(lts, tauState)) {
      if (labelsEqual(t.label, label)) {
        return t;
      }
    }
  }

  return null;
}
```

**Advantage**: Terminates early on mismatch, never builds full product

### Phase 5: Counterexample Extraction

**Goal**: Generate distinguishing trace when bisimulation fails

**Files**:
- `src/core/verification/dmst/counterexample.ts`

**Function**:
```typescript
export function extractCounterexample(
  visited: Set<string>,
  lts1: LTS,
  lts2: LTS,
  mismatchState1: string,
  mismatchState2: string,
  failedTransition: Transition
): Counterexample {
  // Trace back from initial states to mismatch
  const path1 = tracePath(visited, lts1.initialState, mismatchState1);
  const path2 = tracePath(visited, lts2.initialState, mismatchState2);

  return {
    globalTrace: path1.map(t => t.label),
    composedTrace: path2.map(t => t.label),
    divergencePoint: {
      globalState: mismatchState1,
      composedState: mismatchState2,
      globalTransition: failedTransition,
      message: `Global protocol can perform ${formatLabel(failedTransition.label)} but composed local projections cannot`
    }
  };
}
```

**Output Example**:
```
Bisimulation failed:
  Global trace:    [create(Manager, Worker), invite(Manager, w1), ...]
  Composed trace:  [create(Manager, Worker), invite(Manager, w1), ...]

  Divergence at step 5:
    Global can: choice branch 2 (Reduce)
    Composed cannot: stuck waiting for Task result
```

### Phase 6: Integration with Existing Verification

**Goal**: Replace trace equivalence with bisimulation in verifier

**Files to Modify**:
- `src/core/verification/dmst/trace-equivalence.ts` - Add bisimulation option
- `src/core/verification/verifier.ts` - Use bisimulation by default

**Updated Function**:
```typescript
export function verifyTraceEquivalence(
  cfg: CFG,
  projections: Map<string, CFSM>,
  method: 'trace' | 'bisimulation' = 'bisimulation'
): TraceEquivalenceResult {
  if (method === 'bisimulation') {
    return verifyViaBisimulation(cfg, projections);
  } else {
    // Keep existing trace-based verification for comparison
    return verifyViaTraces(cfg, projections);
  }
}

function verifyViaBisimulation(
  cfg: CFG,
  projections: Map<string, CFSM>
): TraceEquivalenceResult {
  // 1. Convert CFG to LTS
  const globalLTS = cfgToLTS(cfg);

  // 2. Convert all CFSMs to LTS and compose
  const localLTSs = Array.from(projections.values()).map(cfsmToLTS);
  const composedLTS = composeLTS(localLTSs);

  // 3. Check bisimulation
  const result = onTheFlyBisimulation(globalLTS, composedLTS);

  if (result.isBisimilar) {
    return {
      isEquivalent: true,
      reason: 'Global and composed local protocols are weakly bisimilar',
      method: 'bisimulation'
    };
  } else {
    return {
      isEquivalent: false,
      reason: `Bisimulation failed: ${result.counterexample.divergencePoint.message}`,
      method: 'bisimulation',
      counterexample: result.counterexample
    };
  }
}
```

## Testing Strategy

### Unit Tests

1. **LTS Conversion** (`tests/unit/lts-conversion.test.ts`)
   - CFG to LTS for simple protocols
   - CFSM to LTS for each role
   - Verify τ-transitions for create/invite

2. **Weak Bisimulation** (`tests/unit/weak-bisimulation.test.ts`)
   - τ-closure computation
   - Weak bisimilarity on small examples
   - Non-bisimilar examples with counterexamples

3. **Partition Refinement** (`tests/unit/partition-refinement.test.ts`)
   - Initial partition creation
   - Block refinement logic
   - Fixed-point detection

### Integration Tests

1. **DMst Examples** (existing `dmst-examples-validation.test.ts`)
   - All 76 tests should pass
   - Specifically: Updatable Pipeline, Nested Update (currently failing)

2. **Performance Tests** (`tests/integration/bisimulation-performance.test.ts`)
   - Large protocols (100+ states)
   - Deep recursion (20+ levels)
   - Multiple dynamic participants (10+ workers)
   - Verify O(m log n) scaling

### Regression Tests

- Keep trace-based verification as option
- Compare bisimulation results with trace results
- Ensure no false positives/negatives

## Performance Targets

| Protocol Type | States | Transitions | Time Limit |
|--------------|--------|-------------|------------|
| Small (TwoPhase) | ~20 | ~30 | < 10ms |
| Medium (MapReduce) | ~50 | ~100 | < 50ms |
| Large (Elastic Pool) | ~200 | ~500 | < 200ms |
| Deep Recursion | ~100 | ~300 | < 100ms |

**Rationale**: O(m log n) should keep times under 1 second for typical protocols

## Implementation Order

### Week 1: Foundations
1. ✅ Day 1-2: LTS types and CFG→LTS conversion
2. ✅ Day 3-4: CFSM→LTS conversion and composition
3. ✅ Day 5: τ-closure and weak bisimulation definition

### Week 2: Core Algorithm
4. ✅ Day 6-7: Partition refinement data structures
5. ✅ Day 8-9: Paige-Tarjan algorithm implementation
6. ✅ Day 10: On-the-fly bisimulation variant

### Week 3: Integration
7. ✅ Day 11-12: Counterexample extraction
8. ✅ Day 13-14: Integration with verifier
9. ✅ Day 15: Testing and bug fixes

## Success Criteria

- ✅ All 76/76 DMst validation tests passing
- ✅ Performance under 1 second for all test protocols
- ✅ Clear counterexamples when protocols don't match
- ✅ Handles updatable recursion (coinductive definition)
- ✅ Scales to protocols with 10+ dynamic participants
- ✅ No arbitrary depth limits needed

## References

### Theory
- Castro-Perez & Yoshida (ECOOP 2023) - DMst semantics
- Honda et al. (POPL 2008) - Weak bisimulation for MPST
- Deniélou & Yoshida (ESOP 2012) - CFSM bisimulation (Theorem 4.1)

### Algorithms
- Paige & Tarjan (SIAM 1987) - Partition refinement
- Fernandez & Mounier (1991) - On-the-fly bisimulation

### Tools Reference
- Scribble - FSM-based verification
- OCaml-MPST - Projection and equivalence
- Castro-Perez Go generator - Symbolic bisimulation for DMst

## Next Steps

1. ✅ Create `src/core/verification/dmst/lts.ts` with types
2. ✅ Implement `cfgToLTS()` function
3. ✅ Write unit tests for LTS conversion
4. Continue with Phase 2 (Weak Bisimulation Relation)

---

**Document Status**: Implementation Plan (Ready to Execute)
**Last Updated**: 2025-11-15
**Related Docs**: `TRACE_VS_BISIMULATION.md`
