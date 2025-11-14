# Understanding Safety in "Less is More" MPST

This directory contains a comprehensive explanation of the **safety invariant** from Scalas & Yoshida (2019), contextualized for the SMPST project.

## Start Here

If you're new to the safety concept, read in this order:

### 1. Visual Overview (10 minutes)
**File**: [`safety-vs-consistency-visual.md`](./safety-vs-consistency-visual.md)

Quick visual diagrams showing:
- Why OAuth fails in classic MPST
- How safety fixes it
- The core difference between syntax vs semantics

### 2. Deep Dive (30 minutes)
**File**: [`safety-invariant-deep-dive.md`](./safety-invariant-deep-dive.md)

Complete theoretical explanation:
- Definition 4.1 explained in detail
- How it maps to SMPST's CFSM architecture
- Comparison with classic MPST consistency
- Implementation strategy

### 3. Worked Example (20 minutes)
**File**: [`safety-check-oauth-walkthrough.md`](./safety-check-oauth-walkthrough.md)

Step-by-step execution of safety algorithm on OAuth:
- CFSM construction
- State-by-state verification
- Why it succeeds where classic MPST fails

## Quick Summary

### The Problem

Classic MPST uses **consistency** (inherited from binary session duality):

```
Consistent ⊂ Safe
```

This means consistency is **too restrictive** - it rejects many safe protocols like OAuth!

### The Solution

**Safety** (Definition 4.1) is a weaker property that only checks:

```
Rule [S-⊕&]: If p can send m to q, then q can receive m from p
Rule [S-μ]:  Handles recursion by unfolding
Rule [S-→]:  Safety is preserved as protocol executes
```

### Why It Matters

- ✅ Accepts OAuth (and all Fig. 4 protocols from paper)
- ✅ Still guarantees type safety (Theorem 4.6)
- ✅ Decidable (finite state CFSMs)
- ✅ Compositional (can check roles separately)
- ✅ Parametric (can extend to deadlock-freedom, liveness, etc.)

## How This Fits SMPST

### Current Architecture

```
Scribble → Parser → AST → CFG → Verification
                                    ↓
                               Projector
                                    ↓
                               CFSMs (per role)
                                    ↓
                               Simulator
```

### With Safety

```
Scribble → Parser → AST → CFG → Verification
                                    ↓
                               Projector
                                    ↓
                               CFSMs (per role)
                                    ↓
                    🆕 Safety Checker ← NEW!
                         ↓         ↓
                    Type System  Simulator
```

### Key Components

1. **TypingContext** - CFSMs at current states
   ```typescript
   interface TypingContext {
     session: string;
     cfsms: Map<Role, {machine: CFSM, currentState: string}>;
   }
   ```

2. **SafetyChecker** - Implements Definition 4.1
   ```typescript
   class SafetyChecker {
     check(Γ: TypingContext): boolean {
       // [S-⊕&] Check sends match receives
       // [S-→]  Check preserved by reductions
     }
   }
   ```

3. **Parametric φ** - Different safety levels
   ```typescript
   const φ_basic = new BasicSafety();      // Just type safety
   const φ_df = new DeadlockFreedom();     // + no deadlocks
   const φ_live = new LivenessProperty();  // + all I/O fires
   ```

## Key Theorems (from Paper)

### Theorem 4.6 (Subject Reduction)
If Γ⊢P with Γ safe, and P→P', then ∃Γ' safe with Γ→*Γ' and Γ'⊢P'

**Meaning**: Typed processes stay typed as they execute.

### Corollary 4.7 (Type Safety)
If ∅⊢P and P→*P', then P' has no errors.

**Meaning**: Safe protocols never go wrong!

### Lemma 5.9 (Hierarchy)
```
consistent(Γ) ==> safe(Γ)  ✓
safe(Γ) ==/=> consistent(Γ)  ✗
```

**Meaning**: Consistency is a special case of safety. Safety is strictly more general!

## Next Steps

### Implementation Priority

1. **Phase 1**: Implement `BasicSafety` checker (Definition 4.1)
   - File: `src/core/safety/safety-checker.ts`
   - Test on OAuth example

2. **Phase 2**: Integrate with type system ([TGen-ν])
   - Modify session restriction typing rule
   - Use parametric φ

3. **Phase 3**: Extend to stronger properties
   - Deadlock-freedom (Fig. 5.2)
   - Liveness (Fig. 5.5)
   - Live+ (Fig. 5.6)

### Testing Strategy

```typescript
describe('Safety', () => {
  it('accepts OAuth (rejected by classic MPST)', () => {
    const cfsms = projectOAuth();
    const Γ = initialContext(cfsms);
    expect(new BasicSafety().check(Γ)).toBe(true);
  });

  it('rejects mismatched send/receive', () => {
    // s sends 'foo', q expects 'bar'
    const cfsms = createMismatched();
    const Γ = initialContext(cfsms);
    expect(new BasicSafety().check(Γ)).toBe(false);
  });

  it('is preserved by reduction', () => {
    const cfsms = projectOAuth();
    let Γ = initialContext(cfsms);

    // Step through protocol
    while (!isTerminal(Γ)) {
      expect(new BasicSafety().check(Γ)).toBe(true);
      Γ = step(Γ);  // Execute one communication
    }
  });
});
```

## Questions?

### "Why can't we just use consistency?"

Because it rejects too many valid protocols! OAuth is safe but not consistent.

### "Is safety decidable?"

Yes! CFSMs have finite states, so reachability is computable.

### "What's the complexity?"

O(2^n) where n = total states in all CFSMs. But:
- CFSMs are small in practice (< 100 states)
- Model checkers handle this efficiently
- Can cache reachability computation

### "How does this relate to global types?"

Safety doesn't need global types! That's the point - it's **bottom-up**:

```
Classic MPST:  Global → Project → Local → Check consistency
Bottom-up:     Local → Check safety (no global needed!)
```

But you can still use global types if you want - they're a **special case** of safety (Lemma 5.9).

## Further Reading

- Paper: Scalas & Yoshida (2019) "Less is More: Multiparty Session Types Revisited"
- Section 3: Why classic MPST is broken
- Section 4: Safety definition and new type system
- Section 5: Properties (deadlock-freedom, liveness)
- Section 6: μ-calculus formulas for model checking

## Related SMPST Docs

- [`bottom-up-mpst.md`](./bottom-up-mpst.md) - Bottom-up MPST overview
- [`tcp-session-types-specification.md`](./tcp-session-types-specification.md) - TCP use case
- [`THEORY_INTEGRATION_PLAN.md`](../THEORY_INTEGRATION_PLAN.md) - Overall theory roadmap

---

**Status**: Theory documented ✓
**Next**: Implement SafetyChecker
**Priority**: High (enables OAuth and many other protocols!)
