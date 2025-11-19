# MPST Theory Documentation

This section contains formal foundations and theoretical documentation for Multiparty Session Types (MPST) and related concepts.

**Purpose:** Provide complete formal foundations for understanding and reimplementing MPST systems.

---

## 📚 Core Theory

### Foundational Documents
- **[MPST Foundations](../foundations.md)** - Complete formal foundations of Multiparty Session Types
- **[Projection Correctness](projection-correctness.md)** - Proofs of projection soundness and completeness
- **[LTS Operational Semantics](lts-operational-semantics.md)** - Labeled Transition System semantics for protocols
- **[CFG-LTS Equivalence](cfg-lts-equivalence.md)** - Relationship between Control Flow Graphs and LTS

---

## 🔒 Safety & Verification

### Safety Properties
- **[Safety Invariant Deep Dive](safety-invariant-deep-dive.md)** - Formal safety guarantees and proofs
- **[Safety vs Consistency (Visual)](safety-vs-consistency-visual.md)** - Visual explanations of safety properties
- **[Safety Check OAuth Walkthrough](safety-check-oauth-walkthrough.md)** - Example: Verifying OAuth protocol safety
- **[README: Safety](README-safety.md)** - Safety checking overview

### Verification Methods
- **[Theorem-Driven Testing](THEOREM_DRIVEN_TESTING.md)** - Formal verification through theorem-based tests
- **[Formal Methods Workflow](FORMAL_METHODS_WORKFLOW.md)** - Testing and verification methodology
- **[Completeness Analysis](COMPLETENESS_ANALYSIS.md)** - Verification completeness guarantees
- **[FIFO Verification](fifo-verification.md)** - Message ordering verification
- **[Tau Transitions (Formal Justification)](TAU_TRANSITIONS_FORMAL_JUSTIFICATION.md)** - Formal tau semantics
- **[Tau Transitions (Verified)](TAU_TRANSITIONS_VERIFIED.md)** - Tau transition correctness proof
- **[Well-Formedness Properties](well-formedness-properties.md)** - Protocol well-formedness conditions

---

## 🚀 Extensions & Variants

### Protocol Composition
- **[Sub-Protocol Formal Analysis](sub-protocol-formal-analysis.md)** - Theory of protocol composition
- **[Parameterized Protocols](parameterized-protocols.md)** - Parametric session types

### Alternative Approaches
- **[Bottom-Up MPST](bottom-up-mpst.md)** - Alternative MPST formalization
- **[Asynchronous Subtyping](asynchronous-subtyping.md)** - Subtyping in asynchronous contexts

### Advanced Features
- **[Exception Handling](exception-handling.md)** - Error handling in session types
- **[Timed Session Types](timed-session-types.md)** - Temporal constraints and deadlines
- **[Refinement & Dependent Types](refinement-dependent-types.md)** - Advanced type refinements

---

## 🌐 Network & Transport

### Protocol Implementations
- **[Transport Layer Protocols](transport-layer-protocols.md)** - Session types for transport protocols
- **[TCP Session Types](tcp-session-types-specification.md)** - TCP-specific session type specifications

---

## 📊 Document Categories

### By Topic

**Foundational (5 docs)**
- Projection, LTS semantics, CFG-LTS equivalence, formal foundations, well-formedness

**Safety & Verification (10 docs)**
- Safety invariants, theorem testing, formal methods, FIFO, tau transitions, completeness

**Extensions (7 docs)**
- Sub-protocols, parameterization, exceptions, timed types, refinement, transport protocols

**Alternative Approaches (2 docs)**
- Bottom-up MPST, asynchronous subtyping

---

## 🎓 Suggested Reading Order

### For Beginners
1. Start with [MPST Foundations](../foundations.md)
2. Read [Projection Correctness](projection-correctness.md)
3. Study [LTS Operational Semantics](lts-operational-semantics.md)
4. Explore [Safety vs Consistency](safety-vs-consistency-visual.md)

### For Implementers
1. [Theorem-Driven Testing](THEOREM_DRIVEN_TESTING.md)
2. [Formal Methods Workflow](FORMAL_METHODS_WORKFLOW.md)
3. [Tau Transitions (Formal Justification)](TAU_TRANSITIONS_FORMAL_JUSTIFICATION.md)
4. [Well-Formedness Properties](well-formedness-properties.md)

### For Researchers
1. [Bottom-Up MPST](bottom-up-mpst.md)
2. [Asynchronous Subtyping](asynchronous-subtyping.md)
3. [Sub-Protocol Formal Analysis](sub-protocol-formal-analysis.md)
4. [Refinement & Dependent Types](refinement-dependent-types.md)

---

## 🔗 Related Documentation

- **[Architecture Overview](../architecture/overview.md)** - How theory maps to implementation
- **[Implementation Lessons](../implementation-lessons.md)** - Theory to code insights
- **[CFSM Architecture](../architecture/cfsm.md)** - CFSM formal definition and tau semantics

---

## 📚 Academic References

Key papers referenced in this section:

1. **Honda, Yoshida, Carbone (2008)**: "Multiparty Asynchronous Session Types" (POPL)
2. **Scalas & Yoshida (2019)**: "Less is More: Multiparty Session Types Revisited"
3. **Deniélou & Yoshida (2012)**: "Multiparty Session Types Meet Communicating Automata"
4. **Milner (1980)**: "A Calculus of Communicating Systems" (CCS - tau calculus)

---

**Last Updated:** 2025-11-19
