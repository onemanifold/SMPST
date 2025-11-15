# feat: Implement DMst (Dynamically Updatable MPST) support

## Summary

Implements support for Dynamically Updatable Multiparty Session Types (DMst) according to Castro-Perez & Yoshida (ECOOP 2023). This adds formal verification for protocols with:
- Dynamic participant creation (`new role`, `creates`, `invites`)
- Updatable recursion (`continue X with { ... }`)
- Protocol composition (combining operator ♢)

## Test Results

**Overall**: 96/102 tests passing (94% pass rate)
**DMst Validation**: 71/76 tests passing (93% pass rate)

### Passing (71/76)
✅ All 10 examples parse and build CFG
✅ All 10 examples pass core verification
✅ All 10 examples project correctly
✅ 8/10 trace equivalence tests (Theorem 20)
✅ 1/4 safe protocol update tests (Definition 14)

### Failing (5/76)
❌ 2 trace equivalence tests (Updatable Pipeline, Nested Update)
❌ 3 safe protocol update tests (Updatable Pipeline, Nested Update, Map-Reduce)

## Implementation Details

### 1. Core DMst Constructs
- **Dynamic role declarations** (`new role Worker`) - `src/core/ast/types.ts`
- **Participant creation** (`Manager creates Worker`) - `src/core/cfg/builder.ts`
- **Invitation synchronization** (`Manager invites Worker`) - `src/core/projection/projector.ts`
- **Updatable recursion** (`continue Loop with { ... }`) - `src/core/cfg/builder.ts`

### 2. Verification Fixes

**Connectedness** (`src/core/verification/connectedness.ts`):
- Recognize `creates` and `invites` actions as connections
- Allow dynamic roles that aren't in initial signature

**Choice Mergeability** (`src/core/verification/choice-mergeability.ts`):
- Allow non-converging branches when dynamic participants involved
- Recognize updatable recursion as valid merge point

**Self-Communication** (`src/core/verification/self-communication.ts`):
- Allow self-messages for DMst local actions (Definition 11)

**Merge Reachability** (`src/core/verification/merge-reachability.ts`):
- Allow non-converging branches in updatable recursion
- Recognize continue edges as valid merge paths

### 3. Trace Equivalence (Theorem 20)

**Implemented** (`src/core/verification/dmst/trace-equivalence.ts`):
- Global trace extraction from CFG with depth-aware recursion
- Local trace extraction from CFSMs with branch prioritization heuristics
- Trace composition and comparison (filters DMst synchronization primitives)
- Added `initialNode` property to CFG type for proper graph structure

**Formal correctness**:
- Implements `traces(G) ≈ compose(traces([[G]]_r) for all r)`
- Handles DMst synchronization primitives (creates/invites) correctly
- Branch selection heuristics prioritize recursion over termination

**Results**: 8/10 tests passing

**Known limitations**:
- 2 recursive protocols fail due to branch selection differences
- May need protocol-specific heuristics or explicit branch annotations

### 4. Safe Protocol Update (Definition 14)

**Implemented** (`src/core/verification/dmst/safe-update.ts`):
- Detection of updatable recursion points
- 1-unfolding computation framework
- Well-formedness checking via combining operator ♢

**Formal requirement**:
```
An updatable recursion rec X { G; continue X with { G_update } } is safe if:
  1-unfolding = G ♢ G_update is well-formed
```

**Current limitation** (lines 190-206):
- `extractBodies()` returns full CFG for both recursion body and update body
- This is marked as TODO and causes false positives (channel conflicts)
- **Correct implementation requires**: Proper subgraph extraction by traversing CFG to isolate:
  - Recursion body G: from recursive node to updatable-recursion node
  - Update body G_update: from updatable-recursion node back to recursive node

**Results**: 1/4 tests passing

**Why formally correct implementation is needed**:
The combining operator ♢ requires channel disjointness. Currently combining CFG ♢ CFG creates duplicate channels causing failures. Need to extract actual subgraphs G and G_update per Definition 14.

## Files Changed

### Core Infrastructure
- `src/core/ast/types.ts` - DMst AST types
- `src/core/cfg/types.ts` - Added `initialNode` to CFG, DMst actions
- `src/core/cfg/builder.ts` - Build DMst constructs, set initialNode
- `src/core/projection/projector.ts` - Project DMst constructs to CFSMs

### Verification
- `src/core/verification/connectedness.ts` - Recognize DMst connections
- `src/core/verification/choice-mergeability.ts` - Allow conditional dynamic participants
- `src/core/verification/self-communication.ts` - Allow DMst local actions
- `src/core/verification/merge-reachability.ts` - Allow updatable recursion patterns
- `src/core/verification/dmst/trace-equivalence.ts` - **Complete rewrite** for Theorem 20
- `src/core/verification/dmst/safe-update.ts` - Framework for Definition 14 (needs subgraph extraction)

### Tests
- `tests/integration/dmst-examples-validation.test.ts` - Comprehensive DMst validation suite

## Remaining Work

### High Priority
1. **Implement proper subgraph extraction** for Definition 14:
   - Extract recursion body G from CFG
   - Extract update body G_update from CFG
   - Ensure `G ♢ G_update` uses disjoint channels

2. **Fix recursive protocol trace extraction**:
   - Investigate branch selection for Updatable Pipeline and Nested Update
   - May need protocol-specific heuristics or user annotations

### Future Enhancements
- Dynamic participant trace extraction (currently TODO)
- Runtime execution semantics for DMst
- Code generation for DMst protocols

## References

Castro-Perez, D., & Yoshida, N. (2023). "Dynamically Updatable Multiparty Session Protocols: Generating Concurrent Go Code from Unbounded Protocols." ECOOP 2023.

**Key Definitions**:
- Definition 11: DMst local actions (self-communication)
- Definition 13: Projection of updatable recursion
- Definition 14: Safe protocol update (1-unfolding)
- Theorem 20: Trace equivalence
- Theorem 23: Deadlock-freedom

## Testing

```bash
# Run DMst validation tests
npm test -- tests/integration/dmst-examples-validation.test.ts

# Run all tests
npm test
```

## Commit History

- `8a8f79f` - feat: Implement complete trace equivalence verification (Theorem 20)
- `272b407` - test: Update self-communication and golden snapshots for DMst changes
- `7ee4364` - feat: Allow non-converging branches in updatable recursion
- `25df382` - feat: Allow self-communication for DMst local actions
- `809c0af` - feat: Update choice mergeability to allow conditional dynamic participants
