# CFSM Projection: From Theory to TypeScript

**A Tutorial Guide for Developers**

This tutorial explains how to implement CFSM projection for multiparty session types, bridging formal theory with practical TypeScript implementation.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Theoretical Foundations](#2-theoretical-foundations)
3. [Understanding LTS Semantics](#3-understanding-lts-semantics)
4. [Type System Design](#4-type-system-design)
5. [Projection Algorithm](#5-projection-algorithm)
6. [Implementation Guide](#6-implementation-guide)
7. [Testing for Correctness](#7-testing-for-correctness)
8. [Common Pitfalls](#8-common-pitfalls)
9. [References](#9-references)

---

## 1. Introduction

### What is Projection?

**Projection** extracts each role's local view from a global protocol specification. Think of it like this:

- **Global protocol**: "Alice sends request to Bob, Bob sends response to Alice"
- **Alice's local view**: "Send request to Bob, receive response from Bob"
- **Bob's local view**: "Receive request from Alice, send response to Alice"

### Why Do We Need It?

In distributed systems, each participant only sees their own actions. Projection formalizes this transformation, ensuring:

1. **Correctness**: Each role knows exactly what to do
2. **Composability**: All local views compose back to the global protocol
3. **Type Safety**: Can verify protocol adherence at compile time

### What You'll Learn

By the end of this tutorial, you'll understand:

- How global protocols map to local CFSMs (Communicating Finite State Machines)
- Why actions live on transitions, not states (LTS semantics)
- How to implement projection for messages, choice, parallel, and recursion
- How to test for formal correctness properties

---

## 2. Theoretical Foundations

### 2.1 The Papers That Matter

This implementation is based on two key papers:

**Honda, Yoshida, Carbone (2008)**: "Multiparty Asynchronous Session Types"
- Defines multiparty session types
- Formalizes projection operation
- Proves soundness and completeness theorems

**Deniélou, Yoshida (2012)**: "Multiparty Session Types Meet Communicating Automata"
- Maps session types to CFSMs
- Uses LTS (Labelled Transition System) semantics
- Shows equivalence between session types and CFSMs

### 2.2 CFSM Formal Definition

A **CFSM** (Communicating Finite State Machine) is a 4-tuple:

```
CFSM = (C, Σ, c₀, Δ)
```

Where:
- **C**: Set of control states (nodes in state machine)
- **Σ**: Message alphabet (action types)
- **c₀**: Initial state (c₀ ∈ C)
- **Δ**: Transition relation: C × Σ × C

**Example** (Request-Response):
```
C = {s0, s1, s2}
c₀ = s0
Σ = {!⟨Server, Request⟩, ?⟨Server, Response⟩}
Δ = {
  (s0, !⟨Server, Request⟩, s1),
  (s1, ?⟨Server, Response⟩, s2)
}
```

### 2.3 Session Type Projection

Session type projection is defined inductively. For role **p**, we write **G ↾ p** (read: "G projected onto p"):

**Message Transfer**:
```
(q → r: l⟨U⟩. G) ↾ p =
  | !⟨r, l⟨U⟩⟩. (G ↾ p)    if p = q  (sender)
  | ?⟨q, l⟨U⟩⟩. (G ↾ p)    if p = r  (receiver)
  | G ↾ p                   otherwise (uninvolved)
```

**Internal Choice** (⊕ - role q chooses):
```
(q ⊕ {lᵢ: Gᵢ}ᵢ∈I) ↾ p =
  | ⊕{lᵢ: (Gᵢ ↾ p)}ᵢ∈I     if p = q  (chooser)
  | &{lᵢ: (Gᵢ ↾ p)}ᵢ∈I     if p ∈ participants(G)  (reactor)
  | G ↾ p                   otherwise
```

**Recursion**:
```
(μX. G) ↾ p = μX. (G ↾ p)
```

### 2.4 Key Insight: LTS Semantics

**Critical**: Actions live on **transitions**, not on states!

```
Wrong (actions on states):
  [s0] → [s1: !Request] → [s2: ?Response] → [s3]

Correct (actions on transitions):
  s0 —!Request→ s1 —?Response→ s2
```

This is standard in automata theory (LTS) but often confusing when coming from CFG representations where actions are nodes.

---

## 3. Understanding LTS Semantics

### 3.1 What is an LTS?

An **LTS** (Labelled Transition System) is:

```
LTS = ⟨Q, Q₀, A, →⟩
```

Where:
- **Q**: Set of states
- **Q₀**: Initial states (Q₀ ⊆ Q)
- **A**: Set of actions (labels)
- **→**: Transition relation (Q × A × Q)

**Notation**: `s —α→ s'` means "from state s, perform action α, reach state s'"

### 3.2 Why Actions on Transitions?

**Semantic Clarity**: The state represents "where you are", the transition represents "what you do".

```
State s1: "waiting for response"
Transition s1 —?Response→ s2: "receive response"
State s2: "response received"
```

**Formal Verification**: Easy to check properties:
- "Can role A send message M?" → Check if ∃ transition `s —!M→ s'`
- "Is the protocol deterministic?" → Check if all transitions from same state have distinct labels

### 3.3 CFG vs LTS Mapping

Our CFG builder creates actions as **nodes** (because that's natural for AST transformation). But CFSM needs actions on **transitions** (LTS semantics).

**Mapping** (from Deniélou & Yoshida 2012):

```
CFG:
  ... → [ActionNode: A→B:msg] → ...

Maps to LTS:
  s1 —!⟨B,msg⟩→ s2

NOT to:
  s1 → [s2: action] → s3
```

**Implementation Strategy**:

When projecting an action node:
1. Create state BEFORE action (if needed)
2. Create state AFTER action
3. Create transition FROM → TO with action as label

---

## 4. Type System Design

### 4.1 Core Types

```typescript
// CFSM State - just a control point
interface CFSMState {
  id: string;
  label?: string;  // for debugging
}

// Action Types
type CFSMAction = SendAction | ReceiveAction | TauAction | ChoiceAction;

interface SendAction {
  type: 'send';
  to: string | string[];  // recipient(s)
  label: string;          // message label
  payloadType?: string;   // type information
}

interface ReceiveAction {
  type: 'receive';
  from: string;           // sender
  label: string;
  payloadType?: string;
}

interface TauAction {
  type: 'tau';  // silent/internal action
}

// Transition - where actions live!
interface CFSMTransition {
  id: string;
  from: string;           // source state id
  to: string;             // target state id
  action?: CFSMAction;    // THE ACTION IS HERE!
}

// Complete CFSM
interface CFSM {
  role: string;
  states: CFSMState[];
  transitions: CFSMTransition[];
  initialState: string;
  terminalStates: string[];
}
```

### 4.2 Design Rationale

**Why optional action?**
- Some transitions are purely structural (epsilon transitions)
- Useful for merging states when role is uninvolved

**Why from/to in transitions?**
- Makes transition relation explicit: Δ ⊆ Q × A × Q
- Easy to query: "what are all transitions from state s?"

**Why separate terminalStates array?**
- Protocol might have multiple exit points (different choice branches)
- Easy to check: "is the protocol complete?"

---

## 5. Projection Algorithm

### 5.1 High-Level Strategy

```typescript
function project(cfg: CFG, role: string): CFSM {
  // 1. Initialize CFSM structure
  const states: CFSMState[] = [];
  const transitions: CFSMTransition[] = [];

  // 2. BFS traversal of CFG, tracking (cfgNode, lastCFSMState)
  const visited = new Set<string>();
  const queue: Array<{cfgNodeId: string, lastStateId: string}> = [];

  // 3. Start from CFG initial node
  const initialState = createState();
  states.push(initialState);
  queue.push({cfgNodeId: cfg.initialNode, lastStateId: initialState.id});

  // 4. Process each CFG node
  while (queue.length > 0) {
    const {cfgNodeId, lastStateId} = queue.shift()!;

    if (visited.has(key(cfgNodeId, lastStateId))) continue;
    visited.add(key(cfgNodeId, lastStateId));

    const node = cfg.nodes.find(n => n.id === cfgNodeId)!;

    // Project based on node type
    if (node.type === 'action') {
      projectActionNode(node, lastStateId, role);
    } else if (node.type === 'branch') {
      projectBranchNode(node, lastStateId, role);
    } else if (node.type === 'fork') {
      projectForkNode(node, lastStateId, role);
    } else if (node.type === 'recursive') {
      projectRecursiveNode(node, lastStateId, role);
    }
    // ... handle other node types
  }

  // 5. Return complete CFSM
  return {role, states, transitions, initialState: initialState.id, terminalStates};
}
```

### 5.2 Key Insight: Visited State Tracking

**Problem**: CFG has cycles (recursion), but we need to avoid infinite loops.

**Wrong approach**: Track only visited CFG nodes
```typescript
// BAD - loses state information
const visited = new Set<string>();  // Just CFG node IDs
```

**Correct approach**: Track (CFG node, CFSM state) pairs
```typescript
// GOOD - preserves state context
const visited = new Set<string>();  // Keys like "n5:s3"
```

**Why?** Same CFG node might be visited multiple times from different CFSM states (e.g., in recursion).

### 5.3 Action Node Projection

**Case 1**: Role is sender
```typescript
if (action.from === role) {
  // Create new state
  const newState = createState();
  states.push(newState);

  // Create transition with send action
  transitions.push({
    id: genId(),
    from: lastStateId,
    to: newState.id,
    action: {
      type: 'send',
      to: action.to,
      label: action.label
    }
  });

  // Continue with new state
  queue.push({cfgNodeId: nextNode, lastStateId: newState.id});
}
```

**Case 2**: Role is receiver
```typescript
if (action.to === role) {
  // Similar, but with receive action
  transitions.push({
    id: genId(),
    from: lastStateId,
    to: newState.id,
    action: {
      type: 'receive',
      from: action.from,
      label: action.label
    }
  });
}
```

**Case 3**: Role is uninvolved (Tau-elimination)
```typescript
else {
  // Skip this action - don't create transition
  // Continue with SAME state
  queue.push({cfgNodeId: nextNode, lastStateId});  // reuse lastStateId
}
```

### 5.4 Choice Projection

**Internal Choice** (⊕): Role makes decision

```typescript
if (branchNode.at === role) {
  // Create transition for each branch
  for (const outEdge of branchEdges) {
    projectBranch(outEdge.to, lastStateId);  // same source state
  }
}
```

**External Choice** (&): Role reacts to decision

```typescript
else {
  // First action in each branch determines the choice
  for (const outEdge of branchEdges) {
    projectBranch(outEdge.to, lastStateId);  // will create multiple incoming transitions
  }
}
```

### 5.5 Recursion Projection

**Key Concepts**:
1. Recursion node becomes a CFSM state
2. `continue` statements create back-edges
3. Exit paths continue to next step

**Implementation**:
```typescript
// Recursion node → CFSM state
const recState = createState({label: recNode.label});
states.push(recState);

// First pass: process body (exclude continue edges)
const bodyEdges = cfg.edges.filter(
  e => e.from === recNode.id && e.edgeType !== 'continue'
);
for (const edge of bodyEdges) {
  queue.push({cfgNodeId: edge.to, lastStateId: recState.id});
}

// Second pass: handle continue edges (back-edges)
// (Done after all states are created)
```

**Continue edge handling**:
```typescript
// Find the recursion state this continue points to
const recStateId = findRecursionState(continueEdge.to);

// Walk backwards to find last relevant state before continue
const lastState = findLastRelevantState(continueEdge.from, role);

// Create back-edge
transitions.push({
  id: genId(),
  from: lastState,
  to: recStateId,
  // Usually no action on continue (structural)
});
```

---

## 6. Implementation Guide

### 6.1 Project Setup

```bash
# Type definitions
src/core/projection/types.ts        # CFSM types
src/core/projection/projector.ts    # Main algorithm
src/core/projection/projector.test.ts  # Tests
```

### 6.2 Step-by-Step Implementation

**Step 1**: Define types (see Section 4)

**Step 2**: Implement state/transition creation helpers
```typescript
let stateCounter = 0;
let transitionCounter = 0;

function createState(label?: string): CFSMState {
  return {id: `s${stateCounter++}`, label};
}

function createTransition(
  from: string,
  to: string,
  action?: CFSMAction
): CFSMTransition {
  return {id: `t${transitionCounter++}`, from, to, action};
}
```

**Step 3**: Implement main projection function (see Section 5.1)

**Step 4**: Implement node-specific projections (see Section 5.3-5.5)

**Step 5**: Implement helper utilities
```typescript
// Check if role is involved in action
function isRoleInvolved(action: MessageAction, role: string): boolean {
  return action.from === role || action.to === role;
}

// Get outgoing edges (excluding specific types)
function getOutgoingEdges(
  cfg: CFG,
  nodeId: string,
  exclude?: Edge['edgeType']
): Edge[] {
  return cfg.edges.filter(
    e => e.from === nodeId && (!exclude || e.edgeType !== exclude)
  );
}

// Find terminal states (no outgoing transitions)
function findTerminalStates(transitions: CFSMTransition[]): string[] {
  const hasOutgoing = new Set(transitions.map(t => t.from));
  const allStates = new Set([
    ...transitions.map(t => t.from),
    ...transitions.map(t => t.to)
  ]);

  return Array.from(allStates).filter(s => !hasOutgoing.has(s));
}
```

**Step 6**: Implement projectAll helper
```typescript
function projectAll(cfg: CFG): ProjectionResult {
  const cfsms = new Map<string, CFSM>();
  const errors: ProjectionError[] = [];

  for (const role of cfg.roles) {
    try {
      const cfsm = project(cfg, role);
      cfsms.set(role, cfsm);
    } catch (error) {
      errors.push({
        type: 'invalid-projection',
        role,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {cfsms, roles: cfg.roles, errors};
}
```

### 6.3 Critical Implementation Details

**Detail 1**: Handle CFG structural nodes

Branch, merge, fork, join nodes are structural (no actions). They guide traversal but don't create CFSM transitions:

```typescript
if (node.type === 'merge' || node.type === 'join') {
  // Pass through - continue with same state
  for (const edge of getOutgoingEdges(cfg, nodeId)) {
    queue.push({cfgNodeId: edge.to, lastStateId});
  }
}
```

**Detail 2**: Avoid duplicate state creation

When multiple paths converge (after choice/parallel), reuse existing state:

```typescript
// Check if we've already visited this (cfgNode, cfsmState) combination
const key = `${cfgNodeId}:${lastStateId}`;
if (visited.has(key)) continue;
```

**Detail 3**: Handle terminal node

CFG terminal node → CFSM terminal state:

```typescript
if (node.type === 'terminal') {
  // lastStateId becomes a terminal state
  terminalStates.push(lastStateId);
}
```

---

## 7. Testing for Correctness

### 7.1 The Four Formal Properties

Based on Honda-Yoshida-Carbone (2008), projection must satisfy:

**1. Completeness**: Every protocol message appears in some CFSM
```typescript
it('should project every message exactly once per role', () => {
  // For each message M in protocol:
  // - Sender's CFSM has exactly 1 send transition for M
  // - Receiver's CFSM has exactly 1 receive transition for M
});
```

**2. Correctness**: Each CFSM contains only relevant actions
```typescript
it('should only include actions where role is involved', () => {
  // For CFSM(r):
  // - All send actions are sent BY r
  // - All receive actions are received BY r
  // - No actions involving only other roles
});
```

**3. Composability**: Send/receive actions are dual
```typescript
it('should have matching send/receive pairs (duality)', () => {
  // For each send action in CFSM(r1):
  // - There exists matching receive in CFSM(r2)
  // - From/to roles match
  // - Labels match
});
```

**4. Well-Formedness**: Structure is valid
```typescript
it('should have no orphaned states', () => {
  // All states reachable from initial state
});

it('should have deterministic external choice', () => {
  // Multiple incoming transitions to same state have distinct labels
});

it('should have initial and terminal states', () => {
  // Every CFSM has exactly one initial, at least one terminal
});
```

### 7.2 Testing Strategy

**Level 1**: Unit tests for each projection rule
- Simple send/receive
- Choice (internal vs external)
- Parallel (single branch, multiple branches)
- Recursion (infinite, conditional, nested)

**Level 2**: Integration tests for combinations
- Choice within parallel
- Recursion within parallel
- Nested choices
- Nested recursion

**Level 3**: Known protocols from literature
- Two-Phase Commit
- Three-Buyer Protocol
- Streaming protocols
- Ping-Pong (alternation)

**Level 4**: Formal correctness properties
- The four properties from Section 7.1

### 7.3 Test Implementation Example

```typescript
describe('CFSM Projection - Recursion', () => {
  it('should project simple infinite loop', () => {
    const source = `
      protocol InfiniteLoop(role A, role B) {
        rec Loop {
          A -> B: Data();
          continue Loop;
        }
      }
    `;

    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Test 1: Action exists
    expect(hasSendAction(aCFSM, 'Data')).toBe(true);

    // Test 2: Structure correct (has cycle)
    function hasCycle(cfsm: CFSM): boolean {
      // DFS to detect back-edge
      const adjList = new Map<string, string[]>();
      for (const t of cfsm.transitions) {
        if (!adjList.has(t.from)) adjList.set(t.from, []);
        adjList.get(t.from)!.push(t.to);
      }

      function dfs(state: string, visited: Set<string>, recStack: Set<string>): boolean {
        visited.add(state);
        recStack.add(state);

        for (const neighbor of adjList.get(state) || []) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor, visited, recStack)) return true;
          } else if (recStack.has(neighbor)) {
            return true;  // Back-edge = cycle!
          }
        }

        recStack.delete(state);
        return false;
      }

      const visited = new Set<string>();
      for (const state of cfsm.states) {
        if (!visited.has(state.id)) {
          if (dfs(state.id, visited, new Set())) return true;
        }
      }
      return false;
    }

    expect(hasCycle(aCFSM)).toBe(true);
  });
});
```

**Key Testing Principle**: Tests must verify **behavior**, not just **structure**.

Bad test:
```typescript
expect(aCFSM.transitions.length).toBe(2);  // Fragile!
```

Good test:
```typescript
expect(hasSendAction(aCFSM, 'Data')).toBe(true);  // Semantic!
expect(hasCycle(aCFSM)).toBe(true);  // Formal property!
```

---

## 8. Common Pitfalls

### 8.1 Actions on States (Wrong!)

**Mistake**:
```typescript
interface CFSMState {
  id: string;
  action?: CFSMAction;  // ❌ WRONG!
}
```

**Why it's wrong**: Violates LTS semantics. States are control points, not behaviors.

**Fix**: Put actions on transitions (see Section 3).

### 8.2 Not Handling Tau-Elimination

**Mistake**: Create tau transitions for uninvolved roles
```typescript
// Role C not involved in A→B:msg
transitions.push({
  from: lastState,
  to: newState,
  action: {type: 'tau'}  // ❌ Clutters CFSM!
});
```

**Fix**: Skip the action entirely, reuse state
```typescript
// Just continue with same state
queue.push({cfgNodeId: nextNode, lastStateId});  // ✓
```

### 8.3 Forgetting State Context in Cycles

**Mistake**: Only track visited CFG nodes
```typescript
const visited = new Set<string>();
visited.add(cfgNodeId);  // ❌ Loses CFSM state info!
```

**Why it fails**: In recursion, same CFG node visited from different CFSM states.

**Fix**: Track (CFG node, CFSM state) pairs (see Section 5.2).

### 8.4 Not Testing Formal Properties

**Mistake**: Only test that code runs
```typescript
it('should project protocol', () => {
  const cfsm = project(cfg, 'A');
  expect(cfsm).toBeDefined();  // ❌ Too weak!
});
```

**Fix**: Test formal correctness (see Section 7).

### 8.5 Incorrect Continue Edge Handling

**Mistake**: Mark continue edges during CFG traversal
```typescript
// First pass - wrong to follow continue edges
const allEdges = getOutgoingEdges(cfg, recNode.id);  // ❌ Includes continues!
```

**Why it fails**: Creates infinite loops in projection.

**Fix**: Exclude continue edges in first pass, handle separately (see Section 5.5).

---

## 9. References

### Academic Papers

**[HYC08]** Honda, K., Yoshida, N., & Carbone, M. (2008). "Multiparty Asynchronous Session Types". *POPL '08*.
- **Section 2**: Multiparty session types syntax
- **Section 3**: Projection operation definition
- **Section 4**: Soundness and completeness theorems

**[DY12]** Deniélou, P.-M., & Yoshida, N. (2012). "Multiparty Session Types Meet Communicating Automata". *ESOP '12*.
- **Section 2.2**: CFSM formal definition
- **Section 3.1**: LTS semantics for CFSMs
- **Section 3.3**: Projection to CFSMs

**[BZ83]** Brand, D., & Zafiropulo, P. (1983). "On Communicating Finite-State Machines". *Journal of the ACM*.
- Classic CFSM definition
- Reachability and liveness properties

### Related Topics

**Session Types**: Type theory for communication protocols
- [Honda 1993] Original binary session types
- [Honda et al. 2008] Multiparty extension

**Automata Theory**: Foundation for CFSMs
- [Hopcroft & Ullman 1979] Introduction to Automata Theory
- LTS (Labelled Transition Systems) semantics

**Scribble Language**: Practical multiparty protocol language
- [Yoshida et al. 2013] Scribble language specification
- [Hu & Yoshida 2016] Hybrid session verification

### Implementation Resources

**This Project**:
- `docs/cfg-design.md`: CFG builder specification
- `docs/projection-design.md`: Formal projection rules
- `src/core/projection/projector.ts`: Reference implementation

**Online Resources**:
- Scribble.org: Protocol examples
- Session Types research group: Recent papers
- EPSRC ABCD project: Toolchain development

---

## Appendix: Complete Example

Let's walk through projecting the classic **Two-Phase Commit** protocol.

### Input: Global Protocol

```scribble
protocol TwoPhaseCommit(role Coordinator, role P1, role P2) {
  // Phase 1: Prepare
  par {
    Coordinator -> P1: Prepare();
    choice at P1 {
      P1 -> Coordinator: Yes();
    } or {
      P1 -> Coordinator: No();
    }
  } and {
    Coordinator -> P2: Prepare();
    choice at P2 {
      P2 -> Coordinator: Yes();
    } or {
      P2 -> Coordinator: No();
    }
  }

  // Phase 2: Decide
  choice at Coordinator {
    par {
      Coordinator -> P1: Commit();
    } and {
      Coordinator -> P2: Commit();
    }
  } or {
    par {
      Coordinator -> P1: Abort();
    } and {
      Coordinator -> P2: Abort();
    }
  }
}
```

### Output: Coordinator's CFSM

```
States: {s0, s1, s2, s3, s4}
Initial: s0
Terminal: {s4}

Transitions:
s0 —!⟨P1,Prepare⟩→ s1
s0 —!⟨P2,Prepare⟩→ s1
s1 —?⟨P1,Yes⟩→ s2
s1 —?⟨P1,No⟩→ s2
s1 —?⟨P2,Yes⟩→ s2
s1 —?⟨P2,No⟩→ s2
s2 —!⟨P1,Commit⟩→ s3
s2 —!⟨P2,Commit⟩→ s3
s2 —!⟨P1,Abort⟩→ s3
s2 —!⟨P2,Abort⟩→ s3
s3 → s4
```

**Observations**:
- Parallel branches create concurrent sends/receives (both Prepare at s0)
- External choice creates multiple incoming transitions (both Yes/No at s2)
- Internal choice creates branching (Commit vs Abort from s2)

### Output: Participant P1's CFSM

```
States: {s0, s1, s2}
Initial: s0
Terminal: {s2}

Transitions:
s0 —?⟨Coordinator,Prepare⟩→ s1
s1 —!⟨Coordinator,Yes⟩→ s2
s1 —!⟨Coordinator,No⟩→ s2
s2 —?⟨Coordinator,Commit⟩→ (terminal)
s2 —?⟨Coordinator,Abort⟩→ (terminal)
```

**Observations**:
- P1 doesn't see P2's messages (tau-elimination)
- Internal choice at P1 creates branching (Yes vs No)
- External choice from Coordinator creates multiple final transitions

---

**End of Tutorial**

This guide provides everything needed to implement CFSM projection from scratch. The combination of formal theory, practical design decisions, and concrete implementation details should enable any TypeScript developer to recreate this system.

For questions or improvements, please consult the references or examine the test suite for additional examples.
