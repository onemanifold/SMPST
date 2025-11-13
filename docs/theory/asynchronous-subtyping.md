# Asynchronous Session Subtyping - Formal Theory

**Date**: 2025-11-13
**Source**: Perplexity synthesis + Ghilezan et al. 2023 + Barbanera et al. 2021
**Status**: Theory documentation

---

## 1. Formal Definition

### Subtyping Relation $$T_1 <: T_2$$

**Intuition**: $$T_1$$ is a subtype of $$T_2$$ if any process implementing $$T_1$$ can **safely replace** one implementing $$T_2$$ without introducing communication errors under **asynchronous semantics**.

**Formal Definition**:

$$
T_1 <: T_2 \iff \forall P, E: \quad \vdash P : T_1 \land \vdash E : T_2 \implies \text{Safe}(P \mid E)
$$

**Key Difference from Sync**: Async allows action reordering due to message buffers.

---

## 2. Inference Rules

### Output Subtyping (Covariance)

$$
\frac{
  \forall i \in I: \quad U_i \leq V_i \quad \land \quad T_i \leq S_i
}{
  \bigoplus_{i \in I} !p.\ell_i(U_i).T_i \; <: \; \bigoplus_{i \in I} !p.\ell_i(V_i).S_i
}
$$

**Meaning**:
- Output types are **covariant** in payload and continuation
- Subtype can send **more refined** types ($$U_i$$ subtypes $$V_i$$)
- Subtype can continue with **more refined** protocol ($$T_i$$ subtypes $$S_i$$)

**Example**:
```typescript
// T1: Send Int, continue T'
!p.msg(Int).T'

// T2: Send Number, continue T'
!p.msg(Number).T'

// T1 <: T2 (Int <: Number)
```

---

### Input Subtyping (Contravariance)

$$
\frac{
  J \subseteq I \quad \land \quad \forall j \in J: \quad V_j \leq U_j \quad \land \quad S_j \leq T_j
}{
  \&_{i \in I} ?p.\ell_i(U_i).T_i \; <: \; \&_{j \in J} ?p.\ell_j(V_j).S_j
}
$$

**Meaning**:
- Input types are **contravariant** in payload, **covariant** in continuation
- Subtype can accept **fewer options** ($$J \subseteq I$$)
- For accepted options, can handle **more general** types ($$V_j \leq U_j$$)

**Example**:
```typescript
// T1: Receive msg1 OR msg2
?p.msg1(Int).T1' & ?p.msg2(String).T2'

// T2: Receive only msg1 (fewer options)
?p.msg1(Number).T1'

// T2 <: T1 (accepts subset, Number >: Int)
```

---

### Role of Asynchronous Buffers

**Key Insight**: Subtyping correctness depends on **buffer semantics**.

**Why Buffers Matter**:
- Buffers allow message reordering consistent with queue properties
- Some action permutations are safe async but not sync
- Subtyping rules must account for buffer behavior

**Example**: Adding internal choices in outputs is safe in async:
```
T1 = !p.msg1(Int).T'
T2 = (!p.msg1(Int).T') ⊕ (!p.msg2(Bool).T')

// T1 <: T2 in async (can choose to only send msg1)
// But NOT in sync (extra choice not allowed)
```

---

## 3. Soundness Theorem

### Theorem (Ghilezan et al. 2023, Theorem 5.3)

**Statement**: If $$T_1 <: T_2$$, then for any process $$P$$ typed by $$T_1$$ and any environment $$E$$ typed by $$T_2$$, the asynchronous composition preserves safety and progress:

$$
\vdash P : T_1 \quad \land \quad T_1 <: T_2 \quad \Rightarrow \quad \text{Safe}(P \mid E[T_2])
$$

Where:
- **Safe**: No communication errors (wrong message type, deadlock)
- **Progress**: Protocol can always advance (no infinite blocking)

---

### Proof Sketch

**Goal**: Show reductions of $$P$$ under async buffer semantics can be simulated by $$E$$ expecting $$T_2$$.

**Steps**:
1. **Buffer Behavior Lemma** (Lemma 5.2):
   - Buffers + subtyping ensure messages consumed respecting typing constraints
   - Key: Output covariance allows sending "better" types
   - Key: Input contravariance allows receiving "worse" types

2. **Induction on Typing Derivations**:
   - Base case: Primitive send/receive
   - Inductive case: Choices, recursion, parallel

3. **Simulation Argument**:
   - Every step of $$P$$ (typed by $$T_1$$) can be matched by $$E$$ (expecting $$T_2$$)
   - Buffer reordering doesn't violate typing constraints

**Citation**: Ghilezan et al. (2023), §5, Theorem 5.3, Proof in Appendix A

---

## 4. Completeness

### The Bad News

**Statement**: The asynchronous subtyping relation is **sound but NOT complete**.

### Characterizing Incompleteness

**Formal Result**: There exist safe refinements that are NOT captured by the subtype relation.

**Why Incomplete?**:
- Some safe reorderings (allowed by buffer semantics) aren't expressible in the subtype rules
- Infinite internal choices or non-regular behaviors not captured

**Counterexample**:
```
// Safe replacement (observationally equivalent):
T1 = !p.msg().?q.ack().end
T2 = ?q.ack().!p.msg().end

// But T1 ⊀: T2 and T2 ⊀: T1
// (Actions reordered - not syntactically a subtype)
```

**However**: For **practical protocols** (finite, regular), the relation is sufficiently expressive.

**Citation**: Ghilezan et al. (2023), §6, Completeness Discussion

---

## 5. Fair Subtyping

### Motivation

**Problem**: Standard async subtyping can be **too restrictive** in some cases.

**Example**:
```
// T1: Infinitely offers both options
rec X. (?p.msg1().X ⊕ ?p.msg2().X)

// T2: Eventually offers both (but maybe delayed)
rec X. ?p.msg1().X or ?p.msg2().X

// Intuitively safe, but standard subtyping rejects
```

---

### Definition (Barbanera et al. 2021, Def. 6.4)

**Fair Subtyping** refines async subtyping by adding **controllability**:

$$
T_1 <:_{\text{fair}} T_2 \iff T_1 <: T_2 \land \text{Controllable}(T_1, T_2)
$$

Where **Controllable** means:
- Subtype can **fairly simulate** all outputs and inputs of supertype
- No infinite internal loops preventing progress
- Ensures liveness properties

---

### Theorem (Barbanera et al. 2021, Theorem 6.7)

**Statement**: Fair subtyping relation is **strictly more permissive** than standard async subtyping:

$$
T_1 <: T_2 \implies T_1 <:_{\text{fair}} T_2
$$

but the converse does NOT hold (strict containment).

### Proof Sketch

1. **Fair subtyping allows more refinements**:
   - Accounts for fairness constraints in trace permutations
   - Limits unfair infinite loops

2. **Strictly more permissive**:
   - Exhibits protocols where fair subtyping holds but standard doesn't
   - Uses controllability to prune infinite unfair traces

3. **Soundness preserved**:
   - Fairness assumption ensures liveness
   - Safety guaranteed by underlying subtyping rules

**Citation**: Barbanera et al. (2021), §6, Theorem 6.7

---

## 6. Intuition and Examples

### Why is Async Subtyping Different?

**Synchronous**:
- Actions happen atomically (no buffering)
- Strict ordering constraints
- Less permissive subtyping

**Asynchronous**:
- Messages buffered in FIFO queues
- Actions can be reordered (within constraints)
- More permissive subtyping

**Key Difference**: Async allows anticipating sends and delaying receives.

---

### Example 1: Safe Replacement

**Protocol P1** (subtype):
```scribble
protocol P1(role Client, role Server) {
  Client -> Server: Request(Int);
  Server -> Client: Response(Int);
}
```

**Protocol P2** (supertype):
```scribble
protocol P2(role Client, role Server) {
  Client -> Server: Request(Number);  // More general type
  Server -> Client: Response(Number);
}
```

**Subtyping**: $$P1 <: P2$$

**Why Safe?**:
- Client sends `Int` (subtype of `Number`) ✅
- Server sends `Int` (subtype of `Number`) ✅
- Can replace $$P2$$ implementation with $$P1$$ safely

---

### Example 2: Internal Choice

**T1** (subtype):
```
!p.msg1(Int).T'
```

**T2** (supertype):
```
!p.msg1(Int).T' ⊕ !p.msg2(Bool).T''
```

**Subtyping**: $$T1 <: T2$$ in **async only**

**Why Safe (async)**:
- $$T1$$ can choose to only send `msg1` (subset of $$T2$$'s choices)
- Buffer allows skipping `msg2` option

**Why Unsafe (sync)**:
- Sync requires exact choice match
- Can't silently omit options

---

### Example 3: Unfair vs Fair

**Unfair Protocol**:
```
rec X. (?p.msg1().X ⊕ ε)
```

**Issue**: Can loop infinitely without ever taking `msg1` (unfair).

**Fair Subtyping**: Rejects this as subtype of protocols expecting `msg1` eventually.

**Fair Protocol**:
```
rec X. ?p.msg1().X
```

**Fair subtyping**: Accepts because `msg1` will eventually be consumed.

---

## 7. When Can I Safely Replace $$P_1$$ with $$P_2$$?

### Decision Procedure

**Check**: $$P_2 <: P_1$$ (note: reversed!)

If yes, then $$P_2$$ can safely replace $$P_1$$ in any context expecting $$P_1$$.

### Practical Steps

1. **Parse protocols** $$P_1$$ and $$P_2$$ to session types
2. **Check subtyping** using inference rules
3. **Verify buffer behavior** (no FIFO violations)
4. **Consider fairness** (if liveness matters)

### Example

```typescript
// Context expects:
function useProtocol(p: Protocol_P1) { ... }

// Can we pass Protocol_P2?
if (Protocol_P2 <: Protocol_P1) {
  useProtocol(Protocol_P2);  // ✅ Safe!
} else {
  // ❌ Unsafe - may introduce bugs
}
```

---

## 8. Implementation Considerations

### Current SMPST IDE Status

**Not implemented**:
- ❌ Subtyping checker
- ❌ Protocol refinement verification
- ❌ Safe replacement checking

**What's needed**:
1. **Subtyping algorithm** implementing inference rules
2. **Buffer-aware checking** (ensure FIFO respected)
3. **Decidability** (finite types, regular protocols)

---

### Design Sketch

```typescript
class SubtypingChecker {
  /**
   * Check if T1 <: T2 (T1 is subtype of T2)
   */
  isSubtype(T1: SessionType, T2: SessionType): boolean {
    // Implement inference rules

    if (T1 is Output && T2 is Output) {
      // Covariance check
      return this.isCovariant(T1, T2);
    }

    if (T1 is Input && T2 is Input) {
      // Contravariance check
      return this.isContravariant(T1, T2);
    }

    if (T1 is Choice && T2 is Choice) {
      // Structural recursion
      return this.checkChoice(T1, T2);
    }

    // ... other cases
  }

  /**
   * Check fair subtyping (with controllability)
   */
  isFairSubtype(T1: SessionType, T2: SessionType): boolean {
    return this.isSubtype(T1, T2) && this.isControllable(T1, T2);
  }
}
```

---

### Testing Strategy

```typescript
describe('Asynchronous Subtyping', () => {
  it('should allow output covariance', () => {
    // T1: !p.msg(Int).end
    // T2: !p.msg(Number).end
    // T1 <: T2
  });

  it('should allow input contravariance', () => {
    // T1: ?p.msg(Number).end
    // T2: ?p.msg(Int).end
    // T1 <: T2
  });

  it('should allow internal choice refinement (async only)', () => {
    // T1: !p.msg1().end
    // T2: !p.msg1().end ⊕ !p.msg2().end
    // T1 <: T2 (async)
  });

  it('should reject unsafe replacements', () => {
    // T1: !p.msg1().end
    // T2: ?p.msg1().end
    // T1 ⊀: T2 (direction mismatch)
  });
});
```

---

## 9. References

### Primary Papers

1. **Ghilezan et al. (2023)**
   - Title: "Precise Subtyping for Asynchronous Multiparty Sessions"
   - Published: ACM Transactions on Computational Logic (TOCL)
   - **Subtyping rules**: Definition 4.1
   - **Soundness theorem**: Theorem 5.3
   - **Buffer lemma**: Lemma 5.2
   - **Completeness discussion**: §6

2. **Barbanera et al. (2021)**
   - Title: "Fair Refinement for Asynchronous Session Types"
   - Published: FOSSACS 2021
   - **Fair subtyping definition**: Definition 6.4
   - **Comparison theorem**: Theorem 6.7
   - **Controllability**: §5

3. **Related Work**:
   - Mostrous, Yoshida (2015): "Session Typing and Asynchronous Subtyping"
   - Chen et al. (2017): "Asynchronous Session Subtyping for Distributed Protocols"

---

## 10. Future Work

### For SMPST IDE

**Phase 1: Basic Subtyping**
- Implement inference rules (output covariance, input contravariance)
- Handle finite, regular protocols
- Basic decidability checks

**Phase 2: Fair Subtyping**
- Add controllability checking
- Liveness properties
- Handle recursive protocols

**Phase 3: Integration**
- Protocol refinement UI
- Safe replacement suggestions
- Automated refactoring

---

## 11. Formal Property Tests

### Property 1: Reflexivity

$$
\forall T: \quad T <: T
$$

### Property 2: Transitivity

$$
T_1 <: T_2 \land T_2 <: T_3 \implies T_1 <: T_3
$$

### Property 3: Soundness

$$
T_1 <: T_2 \implies \text{Safe}(P[T_1] \mid E[T_2])
$$

### Property 4: Covariance/Contravariance

Test output covariance and input contravariance rules hold.

---

## 12. Conclusion

### Summary

✅ **Theory Well-Defined**:
- Formal subtyping rules (covariance/contravariance)
- Soundness theorem (Theorem 5.3)
- Fair subtyping extension (Theorem 6.7)

❌ **Not Implemented**:
- Subtyping checker
- Protocol refinement verification
- Safe replacement analysis

### Practical Impact

**Enables**:
- Protocol evolution without breaking clients
- Safe component replacement
- Modular protocol development
- Gradual typing for session types

### Next Steps

1. Implement basic subtyping checker
2. Add tests for covariance/contravariance
3. Integrate with projection layer
4. Build UI for protocol refinement

---

**Document Status**: Complete
**Last Updated**: 2025-11-13
**Next Theory Doc**: Parameterized Protocols (Pabble)
