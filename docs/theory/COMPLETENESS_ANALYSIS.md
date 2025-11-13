# MPST Theory Completeness Analysis

**Date**: 2025-11-13
**Purpose**: Identify gaps by analyzing formal claims in existing documentation

---

## Method: Gap Analysis via Claim Extraction

### Step 1: Extract All Formal Claims

From each existing doc, extract:
1. **Theorems Stated** (with/without proofs)
2. **Lemmas Referenced** (from papers)
3. **Properties Assumed** (without verification)
4. **Invariants Claimed** (in code comments)
5. **Cross-References** (to unverified properties)

### Step 2: Classify Each Claim

- ✅ **Proven**: Has formal proof or proof sketch
- 📝 **Stated**: Claimed but not proven
- 🔗 **Referenced**: Cites paper but doesn't explain
- ⚠️ **Assumed**: Implicit assumption without justification
- ❌ **Missing**: Referenced but not documented

### Step 3: Identify Gaps

For each ❌ or ⚠️ claim, generate Perplexity query.

---

## Analysis of Existing Documentation

### From `docs/foundations.md`

#### Claims Found

1. **Line 70-78: LTS Semantics**
   - **Claim**: "LTS semantics are well-understood theory for concurrent systems"
   - **Status**: 📝 Stated without formal definition
   - **Gap**: No operational semantics rules given
   - **Query Needed**: "What are the formal LTS operational semantics for MPST?"

2. **Line 143-162: Projection Rules**
   - **Claim**: "Projection extracts role A's view from global type G"
   - **Status**: 📝 Rules shown informally
   - **Gap**: No projection correctness theorem
   - **Query Needed**: "State the projection soundness and completeness theorems for MPST"

3. **Line 167-176: Well-Formedness**
   - **Claim**: "Global type G is well-formed if: Connectedness, Determinism, No races, Progress"
   - **Status**: ⚠️ Assumed without formal definitions
   - **Gap**: What are the formal definitions of these properties?
   - **Query Needed**: "Formal definitions of well-formedness conditions in MPST"

4. **Line 260-295: Recursion Semantics**
   - **Claim**: "continue is explicit, paths without it exit rec block"
   - **Status**: ✅ Well-explained
   - **Gap**: None (good!)

#### Perplexity Queries Needed

**Query 1: LTS Operational Semantics**
```
I need the complete formal operational semantics (reduction rules) for Multiparty Session Types using Labeled Transition Systems.

SPECIFIC REQUIREMENTS:
1. Configuration syntax: ⟨G, σ⟩ where G = global type, σ = state
2. Transition rules for:
   - Message send: p → q: ℓ
   - Choice selection
   - Parallel fork/join
   - Recursion entry/continue
3. Action labels: what actions appear on transitions?
4. Formal notation following Honda, Yoshida, Carbone (JACM 2016)

OUTPUT: Complete set of inference rules with precise notation
CITE: Specific sections/theorems from Honda et al. 2016
```

**Query 2: Well-Formedness Formal Definitions**
```
I need formal definitions for MPST well-formedness conditions.

SPECIFIC REQUIREMENTS:
1. Connectedness: Formal definition + decision procedure
2. Determinism (choice branches distinguishable): Formal definition
3. No races (parallel conflicts): Formal definition
4. Progress (deadlock-freedom): Formal definition
5. State theorems for each property

For each property:
- Formal definition (mathematical)
- Decidability result
- Verification algorithm (if exists)

CITE: Honda et al. (JACM 2016), Deniélou & Yoshida (ESOP 2012)
OUTPUT: Formal definitions + decidability theorems
```

---

### From `docs/cfg-design.md`

#### Claims Found

1. **Line 53-58: CFG = Semantic Artifact**
   - **Claim**: "CFG is central semantic artifact"
   - **Status**: 📝 Stated
   - **Gap**: No formal semantics for CFG itself
   - **Query Needed**: "Formal semantics of Control Flow Graphs for session types"

2. **Line 333-380: CFG vs LTS Reconciliation**
   - **Claim**: "Node-labeled CFG equivalent to edge-labeled LTS (Deniélou & Yoshida)"
   - **Status**: 🔗 Referenced
   - **Gap**: Equivalence theorem not stated
   - **Query Needed**: "State the formal equivalence theorem between node-labeled CFG and edge-labeled LTS"

3. **Line 1438-1445: References**
   - **Lists papers but doesn't extract specific theorems**
   - **Gap**: Which theorems specifically apply?

#### Perplexity Queries Needed

**Query 3: CFG ↔ LTS Equivalence**
```
I use node-labeled Control Flow Graphs for MPST protocols, but session type theory uses edge-labeled LTS. I need the formal equivalence.

SPECIFIC REQUIREMENTS:
1. Formal definition of node-labeled CFG for session types
2. Formal definition of edge-labeled LTS for session types
3. STATE THE EQUIVALENCE THEOREM (Deniélou & Yoshida 2012)
4. Proof sketch: why are they equivalent?
5. What properties are preserved?

CONTEXT: We have actions on CFG nodes, not edges.
CITE: Deniélou, Yoshida (ESOP 2012), specific theorem number
OUTPUT: Complete theorem statement + equivalence proof sketch
```

---

### From `docs/projection-design.md`

#### Claims Found

1. **Line 19-22: Theoretical Foundation**
   - **Lists papers**
   - **Gap**: Doesn't state which theorems we rely on

2. **Line 103-110: Tau-Elimination**
   - **Claim**: "Skip nodes where role not involved (tau-elimination)"
   - **Status**: ⚠️ Assumed sound
   - **Gap**: No formal justification for tau-elimination correctness
   - **Query Needed**: "Formal correctness of tau-elimination in MPST projection"

3. **Line 362-387: Correctness Properties**
   - **Claim**: "Completeness, Correctness, Composability, Well-Formedness"
   - **Status**: 📝 Informally stated
   - **Gap**: Not formalized as theorems
   - **Query Needed**: "Formal statements of projection correctness properties"

#### Perplexity Queries Needed

**Query 4: Projection Correctness Properties**
```
I need formal statements of MPST projection correctness properties.

SPECIFIC REQUIREMENTS:

1. COMPLETENESS THEOREM
   - Statement: Every protocol action appears in some local type
   - Formal definition

2. SOUNDNESS THEOREM
   - Statement: Projected local types preserve global protocol semantics
   - Formal definition

3. COMPOSABILITY THEOREM
   - Statement: Local types can be composed back to global
   - Formal definition (duality)

4. WELL-FORMEDNESS PRESERVATION
   - Statement: Well-formed global → well-formed local projections
   - Formal definition

For each: State theorem formally, cite paper/theorem number, proof sketch

CITE: Honda et al. (JACM 2016), Deniélou & Yoshida (ESOP 2012)
OUTPUT: 4 theorem statements with formal definitions
```

---

### From `docs/SUB_PROTOCOL_SUPPORT.md`

#### Claims Found

1. **Line 72-80: Projection Rules**
   - **Claim**: "Sub-protocol projection follows standard MPST projection rules"
   - **Status**: 🔗 Referenced (Honda et al. 2008)
   - **Gap**: Specific sub-protocol projection rules not given
   - **Query Needed**: Already covered in our Perplexity responses ✅

2. **Line 100-121: Call Stack Semantics**
   - **Claim**: "Call stack semantics with push/pop"
   - **Status**: 📝 Stated informally
   - **Gap**: ✅ **Now covered** in `sub-protocol-formal-analysis.md`

---

### From `docs/STATUS.md`

#### Claims Found

1. **Line 188-195: Execution Model**
   - **Claim**: "Asynchronous message passing with FIFO buffers"
   - **Status**: 📝 Stated
   - **Gap**: ✅ **Now covered** in `fifo-verification.md`

2. **Line 289-307: CFSM Network**
   - **Claim**: "FIFO enforcement per sender-receiver pair"
   - **Status**: 📝 Stated
   - **Gap**: ✅ **Now covered** in `fifo-verification.md`

---

### From `VERIFICATION_ANALYSIS.md`

#### Claims Found

1. **Line 262-277: FIFO Ordering**
   - **Claim**: "MISSING - Multiple messages same direction assume FIFO"
   - **Status**: ❌ Missing verification
   - **Gap**: ✅ **Now covered** in `fifo-verification.md`
   - **Action Needed**: Implement verification check

---

## Summary of Gaps Found

### ❌ Critical Gaps Requiring Perplexity Queries

1. **LTS Operational Semantics** (Query 1)
   - Need: Complete reduction rules
   - Impact: Foundation for all formal reasoning

2. **Well-Formedness Formal Definitions** (Query 2)
   - Need: Precise mathematical definitions
   - Impact: Verification correctness depends on this

3. **CFG ↔ LTS Equivalence Theorem** (Query 3)
   - Need: Formal equivalence statement
   - Impact: Justifies our CFG-based approach

4. **Projection Correctness Properties** (Query 4)
   - Need: 4 theorem statements (completeness, soundness, composability, well-formedness)
   - Impact: Guarantees projection implementation is correct

### ✅ Gaps Now Covered (from previous Perplexity queries)

1. Sub-protocol operational semantics ✅
2. FIFO buffer formal semantics ✅
3. Asynchronous subtyping ✅
4. Parameterized protocols ✅
5. Exception handling ✅
6. Timed session types ✅

---

## Recommended Next Steps

### Immediate Queries (Run in Perplexity)

**Run these 4 queries to fill critical gaps**:
1. LTS Operational Semantics (foundation)
2. Well-Formedness Definitions (verification basis)
3. CFG ↔ LTS Equivalence (architecture justification)
4. Projection Correctness (implementation guarantees)

### After Queries

Create 4 new theory docs:
- `docs/theory/lts-operational-semantics.md`
- `docs/theory/well-formedness-properties.md`
- `docs/theory/cfg-lts-equivalence.md`
- `docs/theory/projection-correctness.md`

---

## Cross-Cutting Concerns (Potential Additional Gaps)

### Areas Not Deeply Covered Yet

1. **Liveness Properties**
   - Progress guarantees
   - Eventual delivery
   - Fairness

2. **Bisimulation & Equivalence**
   - When are two protocols equivalent?
   - Observational equivalence

3. **Trace Semantics**
   - Valid execution traces
   - Trace refinement

4. **Compositionality**
   - Protocol composition operators
   - Modular verification

**Should we query these?** 🤔

---

**Next Action**: Run Queries 1-4 in Perplexity, then create 4 new theory docs.

Would you like me to refine any of these queries before you run them?
