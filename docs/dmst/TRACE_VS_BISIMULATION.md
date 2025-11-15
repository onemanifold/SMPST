# Trace Enumeration vs Bisimulation for DMst Verification

## Summary

This document captures our findings from implementing trace-based verification for Dynamically Updatable Multiparty Session Types (DMst) and why bisimulation is necessary for complete verification.

## Background: Theorem 20 (Trace Equivalence)

From Castro-Perez & Yoshida (ECOOP 2023), Theorem 20 states:

```
traces(G) ≈ compose(traces([[G]]_r) for all r)
```

This means the global protocol traces should be equivalent to the composed local projection traces.

## Trace Enumeration Approach

### Initial Implementation (Single-Trace)

Our first implementation extracted a single trace by:
1. Following the first branch at each choice point
2. Unfolding recursion to a bounded depth
3. Comparing one global trace to one composed local trace

**Result**: 8/10 trace equivalence tests passed

**Limitations**:
- Missed alternative branches in choice protocols
- Branch selection heuristics were fragile
- Not formally complete for protocols with multiple execution paths

### All-Branches Implementation

Implemented `extractAllGlobalTraces()` and `extractAllLocalTraces()` to explore all possible execution paths.

**Result**: Exponential trace explosion

**Example**: MapReduce protocol with recursion depth 10:
```
rec ProcessingLoop {
  Master calls MapTask(w1, Master);
  choice at Master {
    continue ProcessingLoop with { ... };  // Branch 1
  } or {
    Master -> w1: Reduce();                 // Branch 2
  }
}
```

Number of traces: 2^depth = 2^10 = 1024 traces

With depth=10:
- Tests timeout after 60+ seconds
- Memory consumption grows exponentially
- Completely impractical for real protocols

**Mitigation**: Reduced depth to 2
- Tests complete in <1 second
- 73/76 tests passing
- 2 trace equivalence tests fail (insufficient depth for full recursion)

## Research Findings on Practical Tools

From deep research query on MPST verification:

### Single-Trace Checking IS Sound (For Determinate Processes)

> "Single-trace checking is sound for determinate processes (which session types enforce syntactically)"

Session types guarantee determinism, so a single well-chosen trace CAN be sufficient.

### But Practical Tools Use FSM-Based Verification

Tools like Scribble, OCaml-MPST, and GoScr:
- Use FSM representation (CFG/CFSM)
- Perform **structural checks** on the automaton
- Use **bisimulation** for equivalence
- Do NOT enumerate all traces

### Why Bisimulation?

**Complexity**:
- Trace equivalence: PSPACE-complete
- Bisimulation (Paige-Tarjan): O(m log n)

**Scalability**:
- Trace enumeration: exponential in recursion depth
- Bisimulation: polynomial in state space size

**Completeness**:
- Trace enumeration requires unbounded depth for infinite behaviors
- Bisimulation handles infinite behaviors through coinduction

## Bisimulation for DMst

Based on research response, bisimulation for DMst requires:

### 1. Weak Bisimulation

- Abstract internal τ-transitions (silent steps)
- Standard for MPST (Honda et al. POPL 2008)
- Handles internal vs external choice properly

### 2. DMst-Specific Considerations

- **Dynamic participant creation**: Treated as τ-transitions or observable actions
- **Safe protocol update (Definition 14)**: Must preserve bisimulation under updates
- **Updatable recursion**: Requires coinductive bisimulation definition

### 3. Algorithm: Paige-Tarjan Partition Refinement

- O(m log n) complexity
- Efficient for finite-state LTS bisimulation
- Standard algorithm used in model checkers

### 4. Implementation Approach

**Option 1: Product Automaton Construction**
- Build explicit product of CFG and composed CFSMs
- Apply partition refinement
- **Problem**: Can be large for complex protocols

**Option 2: On-The-Fly Bisimulation**
- Explore product space lazily
- Terminate early on mismatch
- **Recommended**: More scalable, better for CFG/CFSM mismatch

### 5. Counterexamples

When bisimulation fails:
- Extract **distinguishing trace**
- Shows execution sequence leading to mismatch
- Helps debug protocol errors

## Current Status (73/76 tests passing)

### Passing Tests

All core DMst features verified:
- ✅ Structural properties (well-formedness)
- ✅ Deadlock freedom
- ✅ Race condition detection
- ✅ Safe protocol update (Definition 14) - 2/3 passing
- ✅ Trace equivalence for simple protocols - 8/10 passing
- ✅ Dynamic participant creation
- ✅ Protocol calls
- ✅ Updatable recursion (basic cases)

### Failing Tests (3 failures)

1. **Updatable Pipeline - trace equivalence**
   - Cause: Depth=2 insufficient for full recursion exploration
   - Fix: Bisimulation (handles infinite behaviors)

2. **Nested Update - trace equivalence**
   - Cause: Same as above
   - Fix: Bisimulation

3. **Map-Reduce - safe protocol update**
   - Cause: Test bug (checks MapTask helper instead of MapReduce main protocol)
   - Fix: Update test to check correct protocol

## Recommendation: Implement Bisimulation

### Why Bisimulation is The Right Approach

1. **Theoretical foundation**: Standard for MPST verification (Honda et al., Deniélou & Yoshida)
2. **Practical efficiency**: O(m log n) vs PSPACE for trace equivalence
3. **Handles recursion**: Coinductive definition for infinite behaviors
4. **Scalable**: Polynomial in state space, not exponential in depth
5. **Complete**: No arbitrary depth limits needed
6. **Tool support**: Used by Scribble, OCaml-MPST, GoScr
7. **DMst support**: Castro-Perez & Yoshida define bisimulation for dynamic participants

### Implementation Plan

1. **Define bisimulation relation**
   - Weak bisimulation (abstract τ-transitions)
   - Handle CFG nodes and CFSM states
   - Coinductive definition for recursion

2. **Implement Paige-Tarjan partition refinement**
   - Initialize with coarse partition (all states equivalent)
   - Refine based on transition labels
   - Terminate when fixed-point reached

3. **On-the-fly exploration**
   - Build product space lazily
   - Terminate early on mismatch
   - Extract counterexample traces

4. **Handle DMst features**
   - Dynamic participants as τ-transitions
   - Update actions in bisimulation relation
   - Verify safe update (Definition 14) preserves bisimulation

5. **Integrate with existing verification**
   - Replace `verifyTraceEquivalence()` with `verifyBisimulation()`
   - Keep trace extraction for debugging/counterexamples
   - Maintain backward compatibility

### Expected Outcome

- ✅ All 76/76 tests passing
- ✅ Scalable to large protocols
- ✅ No arbitrary depth limits
- ✅ Formally complete verification
- ✅ Fast verification (<1s for typical protocols)
- ✅ Clear counterexamples when protocols don't match

## References

- Castro-Perez & Yoshida. *Dynamically Updatable Multiparty Session Protocols*, ECOOP 2023
- Honda, Yoshida, Carbone. *Multiparty Asynchronous Session Types*, POPL 2008
- Deniélou & Yoshida. *Multiparty Session Types Meet Communicating Automata*, ESOP 2012
- Paige & Tarjan. *Three Partition Refinement Algorithms*, SIAM J. Computing 1987

## Appendix: Trace Enumeration Code

The all-branches trace enumeration implementation remains in the codebase at:
- `src/core/verification/dmst/trace-equivalence.ts`

Functions:
- `extractAllGlobalTraces(cfg, maxDepth)` - Enumerate all global traces
- `extractAllLocalTraces(cfsm, maxDepth)` - Enumerate all local traces
- `verifyTraceEquivalence(cfg, projections)` - Uses depth=2 for bounded checking

This code is useful for:
- Understanding trace semantics
- Debugging with concrete execution examples
- Teaching/documentation
- Counterexample generation (after bisimulation identifies mismatch)

But for complete verification, bisimulation is required.
