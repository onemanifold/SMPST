# CFSM Projection Design Specification

**Version**: 1.0
**Date**: 2025-01-11
**Status**: Design Phase (Layer 5)

---

## 1. Overview

This document specifies the **projection algorithm** that transforms a global CFG into role-specific CFSMs (Communicating Finite State Machines).

**Purpose**: Extract each role's local view of the protocol from the global choreography.

**Input**: Global CFG (from Layer 2)
**Output**: Map of role → CFSM (one per declared role)

**Theoretical Foundation**:
- Honda, Yoshida, Carbone (2008): "Multiparty Asynchronous Session Types"
- Deniélou, Yoshida (2012): "Multiparty Session Types Meet Communicating Automata"

---

## 2. Formal Definitions

### 2.1 CFSM Structure

A **CFSM** (Communicating Finite State Machine) represents a single role's local protocol:

```
CFSM = (C, Σ, c₀, Δ)
```

Where:
- **C**: Set of control states (nodes in the state machine)
- **Σ**: Message alphabet (action types: send, receive, tau, choice)
- **c₀**: Initial state (∈ C)
- **Δ**: Transition relation: C × Σ × C (state × action × state)

### 2.2 LTS Semantics

**Key Principle**: Actions live on TRANSITIONS, not states!

```
LTS = ⟨Q, Q₀, A, →⟩
```

Where:
- **Q**: Set of states
- **Q₀**: Initial states
- **A**: Set of actions
- **→**: Transition relation Q × A × Q

**Notation**: `s —α→ s'` means "from state s, perform action α, reach state s'"

### 2.3 Action Types

Following session types notation:

| Action Type | Notation | Meaning |
|-------------|----------|---------|
| Send | `!⟨p, l⟨U⟩⟩` | Send message `l` with type `U` to role `p` |
| Receive | `?⟨p, l⟨U⟩⟩` | Receive message `l` with type `U` from role `p` |
| Internal Choice | `⊕{l₁, l₂, ...}` | Select one of the branches |
| External Choice | `&{l₁, l₂, ...}` | React to received message |
| Tau (τ) | `τ` | Silent/internal transition (role not involved) |

### 2.4 CFG to LTS Mapping

Our CFG has **actions on nodes**, but CFSM uses **actions on transitions** (LTS).

**Mapping** (Deniélou & Yoshida 2012):
- CFG action node `n:action[A→B:msg]` ≡ LTS state AFTER transition `A!B⟨msg⟩`
- CFG edge ≡ LTS structural connection (ordering)

**For projection**:
- When role IS involved in action → create transition with send/receive action
- When role NOT involved → skip action (tau-elimination)

---

## 3. Projection Rules

### 3.1 Message Transfer

**CFG Structure**:
```
... → ActionNode[A→B:msg] → ...
```

**Projection Rules**:

**For sender (A)**:
```
s1 —!⟨B, msg⟩→ s2
```
Create transition with **send action**.

**For receiver (B)**:
```
s1 —?⟨A, msg⟩→ s2
```
Create transition with **receive action**.

**For uninvolved role (C)**:
```
s1 → s2  (skip, tau-elimination)
```
Merge states (no transition needed).

### 3.2 Choice

**CFG Structure**:
```
        ┌→ branch1 → merge
branch →┤
        └→ branch2 → merge
```

**Projection Rules**:

**For decider role**:
- **Internal choice (⊕)**: Role actively selects branch
- Create choice state with outgoing transitions for each branch
- Each branch gets a send action (first message in branch)

```
       !⟨B, msg1⟩
    s ────────────→ s1  (branch 1)
    │
    └─ !⟨B, msg2⟩ → s2  (branch 2)
```

**For non-decider role**:
- **External choice (&)**: Role reacts to received message
- Create branching receives (one per branch)
- Branch selection based on which message received

```
       ?⟨A, msg1⟩
    s ────────────→ s1  (branch 1)
    │
    └─ ?⟨A, msg2⟩ → s2  (branch 2)
```

**Key Property**: External choices must be **deterministic** (different message labels).

### 3.3 Parallel Composition

**CFG Structure**:
```
       ┌→ branch1 ─┐
fork →─┼→ branch2 ─┼→ join
       └→ branch3 ─┘
```

**Projection Rules**:

**Case 1: Role in single branch only**
- Projection is **sequential** (no fork/join needed)
- Skip fork/join nodes
- Project only the branch containing the role

```
CFG: fork → [A→B:msg1] → join → ...
Projection(A): s1 —!⟨B,msg1⟩→ s2
```

**Case 2: Role in multiple branches**
- **Preserve fork/join structure**
- Create fork state with transitions to each branch
- Create join state where branches merge
- Represents **local concurrency** for this role

```
        !⟨B, msg1⟩
fork ────────────→ s1 ──┐
  │                      ├→ join
  └─ !⟨C, msg2⟩ → s2 ───┘
```

**Case 3: Role in no branches**
- Skip entire parallel block
- Connect predecessor to successor (tau-elimination)

### 3.4 Recursion

**CFG Structure**:
```
... → RecNode[label:X] → body → ... → continue → RecNode[X] → ...
                                   └→ exit (no continue)
```

**Projection Rules**:

1. **Recursion label**: Mark entry point state with label
   - `rec X { ... }`
2. **Continue edge**: Create back-edge to labeled state
   - Transition back to recursion entry
3. **Exit path**: Path without continue exits recursion
   - Proceeds to next protocol step

**Example**:
```
CFG rec Loop:
  choice at Server {
    Data() from Server to Client; continue Loop;
  } or {
    End() from Server to Client;
  }

Projection(Server):
  s0 (rec Loop) ──┬─ !⟨Client,Data⟩ → s1 ──→ s0 (back-edge)
                  └─ !⟨Client,End⟩ → s2 (exit)
```

### 3.5 Merge Nodes

**CFG Structure**:
```
branch1 ──┐
          ├→ merge → ...
branch2 ──┘
```

**Projection Rules**:

- If role appears in **all branches**: Create merge state
- If role appears in **some branches**: Merge with continuation
- If role appears in **no branches**: Skip merge

**Consistency requirement** (from verification):
- All branches must have consistent continuations for each role
- Checked by `choice-mergeability` verification

---

## 4. Algorithm Design

### 4.1 High-Level Algorithm

```
function project(cfg: CFG, role: string): CFSM {
  // 1. Initialize
  states: CFSMState[] = []
  transitions: CFSMTransition[] = []
  stateMap: Map<CFGNodeId, CFSMStateId> = {}

  // 2. Traverse CFG in topological order
  for each node in topologicalSort(cfg) {
    if isActionNode(node) {
      if isRoleInvolved(node.action, role) {
        // Create state and transition with action
        createActionTransition(node, role)
      } else {
        // Skip (tau-elimination)
        mergeStates(predecessor, successor)
      }
    } else if isBranchNode(node) {
      // Choice projection
      projectChoice(node, role)
    } else if isForkNode(node) {
      // Parallel projection
      projectParallel(node, role)
    } else if isRecursiveNode(node) {
      // Recursion projection
      projectRecursion(node, role)
    }
  }

  // 3. Handle back-edges (continue statements)
  for each continueEdge in cfg.edges.filter(e => e.type === 'continue') {
    createBackEdge(continueEdge, role)
  }

  // 4. Return CFSM
  return {
    role,
    states,
    transitions,
    initialState: states[0].id,
    terminalStates: findTerminalStates(states)
  }
}
```

### 4.2 Action Projection

```
function projectAction(cfgNode: ActionNode, role: string): void {
  const action = cfgNode.action

  if (action.from === role) {
    // Role is sender
    createTransitionWithAction({
      type: 'send',
      to: action.to,
      label: action.label,
      payloadType: action.payloadType
    })
  } else if (action.to === role || action.to.includes(role)) {
    // Role is receiver
    createTransitionWithAction({
      type: 'receive',
      from: action.from,
      label: action.label,
      payloadType: action.payloadType
    })
  } else {
    // Role not involved - skip (tau-elimination)
    skipNode(cfgNode)
  }
}
```

### 4.3 Choice Projection

```
function projectChoice(branchNode: BranchNode, role: string): void {
  const branches = getBranches(branchNode)

  // Determine if role is decider
  const isDecider = (branchNode.decider === role)

  if (isDecider) {
    // Internal choice (⊕)
    createInternalChoice(branches, role)
  } else {
    // External choice (&)
    createExternalChoice(branches, role)
  }
}
```

### 4.4 Parallel Projection

```
function projectParallel(forkNode: ForkNode, role: string): void {
  const branches = getParallelBranches(forkNode)
  const branchesWithRole = branches.filter(b => branchContainsRole(b, role))

  if (branchesWithRole.length === 0) {
    // Role not in any branch - skip entire parallel
    skipParallel(forkNode)
  } else if (branchesWithRole.length === 1) {
    // Role in single branch - sequential projection
    projectSequential(branchesWithRole[0], role)
  } else {
    // Role in multiple branches - preserve fork/join
    createForkState(branchesWithRole)
    for (const branch of branchesWithRole) {
      projectBranch(branch, role)
    }
    createJoinState()
  }
}
```

---

## 5. Correctness Properties

### 5.1 Completeness

**Property**: Every protocol interaction appears in some CFSM.

**Check**: For each message `A→B:msg` in CFG:
- Appears exactly once in CFSM(A) as send action
- Appears exactly once in CFSM(B) as receive action

### 5.2 Correctness

**Property**: Each role's CFSM contains only their actions.

**Check**: For CFSM(r):
- All send actions have `from === r`
- All receive actions have `to === r`

### 5.3 Composability

**Property**: All roles' CFSMs can be composed back to original CFG.

**Check**: Dual actions match:
- For each `r1 —!⟨r2,msg⟩→` in CFSM(r1)
- There exists `r2 —?⟨r1,msg⟩→` in CFSM(r2)

### 5.4 Well-Formedness

**Property**: Choice determinism and mergeability preserved.

**Check**:
- External choices have distinct message labels
- All branches have consistent continuations
- No orphaned states (all reachable from initial)

---

## 6. Design Decisions

### 6.1 LTS vs CFG

**Decision**: Use LTS semantics (actions on transitions) for CFSM.

**Rationale**:
- Matches formal session types literature
- Cleaner separation of control flow vs behavior
- Easier to verify duality (send/receive matching)
- Better for code generation

### 6.2 Tau-Elimination

**Decision**: Skip nodes where role is not involved (don't create tau transitions).

**Rationale**:
- Keeps CFSM minimal
- Role only sees relevant actions
- Matches intuitive "local view" concept
- Reduces state space

**Trade-off**: Lose global ordering information (but not needed for local execution).

### 6.3 State Merging

**Decision**: Merge CFG nodes when role skips actions.

**Example**:
```
CFG: s0 → [A→B:msg] → [B→C:msg2] → s1

Projection(A):
  s0 —!⟨B,msg⟩→ s1 (merge action2 into s1)
```

**Rationale**: Keeps state space minimal, only show states relevant to role.

### 6.4 Choice Representation

**Decision**: Use branching transitions (not choice states).

**Before** (wrong):
```
s0 → choiceState → {branch1, branch2}
```

**After** (correct):
```
s0 —action1→ s1  (branch1)
s0 —action2→ s2  (branch2)
```

**Rationale**: Matches LTS semantics, actions on transitions.

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Test categories**:
1. Basic message transfer (send/receive)
2. Sequential protocols (multiple messages)
3. Exclusion (uninvolved roles)
4. Choice (internal vs external)
5. Nested choice
6. Parallel (single branch, multiple branches)
7. Recursion (simple, conditional)
8. Known protocols (request-response, streaming, 2PC)

### 7.2 Property Tests

**Verify**:
- Completeness: All messages appear
- Correctness: Only relevant actions
- Composability: Duals match
- Well-formedness: Determinism, mergeability

### 7.3 Integration Tests

**Test with**:
- Protocols from verification suite (known-good)
- Protocols that fail verification (should error)
- Real-world protocols (HTTP, WebRTC signaling)

---

## 8. References

### Academic Papers

1. **Honda, Yoshida, Carbone (2008)**
   "Multiparty Asynchronous Session Types" (POPL)
   - Original MPST foundation
   - Projection rules for global → local types

2. **Deniélou, Yoshida (2012)**
   "Multiparty Session Types Meet Communicating Automata" (ESOP)
   - CFG → CFSM mapping
   - Formal equivalence proof

3. **Scalas, Yoshida (2019)**
   "Less is More: Multiparty Session Types Revisited" (POPL)
   - Simplified projection rules
   - Subtyping and composition

### Specifications

1. **Scribble Language Reference v0.3** (2013)
   Section 5: Projection
   http://www.doc.ic.ac.uk/~rhu/scribble/langref.html

2. **Communicating Finite State Machines**
   Brand & Zafiropulo (1983)
   - Original CFSM definition
   - Reachability and liveness properties

---

## 9. Implementation Notes

### 9.1 Prerequisites

**Before implementing**:
- ✅ CFG Builder complete (Layer 2)
- ✅ CFG structure correct (recursion semantics fixed)
- ✅ Verification complete (Layer 3)
- ✅ All P0-P3 checks passing

### 9.2 TDD Workflow

**RED → GREEN → REFACTOR**:
1. Write test for projection rule
2. Implement minimal code to pass
3. Refactor for clarity
4. Verify all tests still pass
5. Move to next rule

### 9.3 File Structure

```
src/core/projection/
├── types.ts          ✅ (already correct - LTS-based)
├── projector.ts      🔄 (rewrite from scratch)
├── projector.test.ts 🔄 (rewrite tests to check transitions)
└── README.md         📝 (document projection algorithm)
```

### 9.4 Next Steps

1. ✅ Design complete (this document)
2. ⏩ Write tests (basic message transfer first)
3. ⏩ Implement projection (TDD approach)
4. ⏩ Verify with known protocols
5. ⏩ Update STATUS.md

---

**Status**: Design complete, ready for implementation
**Next**: Write tests for basic message projection (Layer 5.1)
