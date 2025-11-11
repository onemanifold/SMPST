# Implementation Lessons: From Theory to Code

## Purpose

This document captures **critical implementation insights** learned while building the SMPST IDE. It bridges the gap between **theoretical session type concepts** and **practical implementation**, explaining the "why" behind design decisions.

**Target audience:** Developers implementing session type systems, students learning MPST, or anyone wanting to understand the engineering decisions behind this codebase.

---

## Table of Contents

1. [Layer 3: Verification Algorithms](#layer-3-verification-algorithms)
2. [Layer 4: Projection Algorithms](#layer-4-projection-algorithms)
3. [Cross-Cutting Concerns](#cross-cutting-concerns)
4. [Testing Strategy Insights](#testing-strategy-insights)

---

## Layer 3: Verification Algorithms

### 3.1 Parallel Deadlock Detection: Senders vs Receivers

**The Critical Distinction:**

```typescript
// ❌ DEADLOCK RISK: Same role SENDING in multiple branches
par {
  A -> B: M1();
} and {
  A -> C: M2();
}
// Problem: A must send M1 and M2 concurrently
// If A is single-threaded or sends are blocking, this deadlocks
```

```typescript
// ✅ SAFE: Same role RECEIVING from multiple sources
par {
  A -> B: M1();
} and {
  C -> B: M2();
}
// Safe: B can buffer incoming messages
// With FIFO buffering, B processes M1 and M2 as they arrive
```

**Why this distinction matters:**

1. **Send operations are typically blocking** - A sender waits for the message to be transmitted
2. **Receive operations use message queues** - Messages arrive asynchronously and are buffered
3. **Session type theory assumes async messaging** - Receivers have unbounded buffers (FIFO queues)

**Implementation in `src/core/verification/verifier.ts:237-272`:**

```typescript
export function detectParallelDeadlock(cfg: CFG): ParallelDeadlockResult {
  const conflicts: ParallelConflict[] = [];
  const forks = cfg.nodes.filter(isForkNode) as ForkNode[];

  for (const fork of forks) {
    const branches = getParallelBranches(cfg, fork);
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        // KEY: Only check SENDERS, not receivers
        const sendersInBranch1 = getSendersInBranch(cfg, branches[i]);
        const sendersInBranch2 = getSendersInBranch(cfg, branches[j]);
        const commonSenders = [...sendersInBranch1].filter(r => sendersInBranch2.has(r));

        if (commonSenders.length > 0) {
          conflicts.push({
            parallelId: fork.parallel_id,
            branch1: branches[i],
            branch2: branches[j],
            description: `Roles ${commonSenders.join(', ')} send in multiple parallel branches`,
          });
        }
      }
    }
  }
  return { hasDeadlock: conflicts.length > 0, conflicts };
}
```

**Test demonstrating this:** `src/core/verification/verifier.test.ts:307-362`

---

### 3.2 Tarjan's Algorithm for Deadlock Detection

**Why Strongly Connected Components (SCC)?**

A deadlock occurs when:
1. There's a cycle in the CFG (back to an earlier state)
2. All participants in the cycle are **waiting** (not making progress)
3. The cycle is **not** a valid recursion loop

**Tarjan's algorithm finds all SCCs in O(V + E) time.**

**Key insight:** Not all cycles are deadlocks!

```typescript
// ✅ VALID: Recursion cycle (intentional loop)
rec Loop {
  A -> B: Data();
  continue Loop;  // Back edge - this is OK!
}
```

```typescript
// ❌ DEADLOCK: Circular wait
A -> B: M1();
B -> C: M2();
C -> A: M3();
// If all three block waiting, this is a deadlock
```

**Implementation strategy in `src/core/verification/verifier.ts:32-57`:**

1. Find all SCCs using Tarjan's algorithm
2. For each SCC with more than 1 node:
   - Check if it's just a recursion loop (has continue edges)
   - If not, it's a potential deadlock cycle
3. Report cycles with descriptions

**Why exclude recursion cycles?**

```typescript
function isOnlyRecursion(cfg: CFG, scc: string[]): boolean {
  // Check if all back edges in this SCC are 'continue' edges
  const backEdges = cfg.edges.filter(e =>
    scc.includes(e.from) &&
    scc.includes(e.to) &&
    isBackEdge(e, scc)
  );

  return backEdges.every(e => e.edgeType === 'continue');
}
```

**Test case:** `src/core/verification/verifier.test.ts:39-58` (Recursion should NOT be flagged as deadlock)

---

### 3.3 Liveness vs Progress: What's the Difference?

**Liveness:**
> Can the protocol make progress and eventually terminate?

**Progress:**
> Are there any stuck states (nodes with no outgoing transitions)?

**Key difference:**

```typescript
// ❌ LIVENESS VIOLATION: Infinite loop without progress
rec Loop {
  A -> B: Ping();
  continue Loop;
  // Never reaches terminal - violates liveness
}
// But this might be INTENTIONAL (e.g., server loop)
```

```typescript
// ❌ PROGRESS VIOLATION: Stuck state
A -> B: Request();
// No response - B is stuck!
// This is ALWAYS a bug
```

**Implementation approach:**

**Liveness check (`verifier.ts:142-171`):**
- Check if terminal states are reachable from initial state
- Allow intentional infinite loops (recursion)
- Flag unreachable terminals

**Progress check (`verifier.ts:459-480`):**
- Check each non-terminal node has outgoing edges
- Flag nodes with no successors (stuck states)

**Design decision:** We check both because:
- Progress violations are always bugs
- Liveness violations might be intentional (servers, daemons)

---

### 3.4 Fork-Join Matching: Why It Matters

**The problem:**

```typescript
// ❌ BAD: Unmatched fork
par {
  A -> B: M1();
} and {
  A -> C: M2();
  // Missing join here!
}
A -> B: M3(); // Which branch does this belong to?
```

**Why we verify fork-join matching:**

1. **Synchronization correctness** - All parallel branches must complete before proceeding
2. **Projection correctness** - Can't project to local CFSMs without proper joins
3. **Runtime correctness** - Simulation needs to know when to synchronize

**Implementation (`verifier.ts:389-457`):**

```typescript
export function checkForkJoinMatching(cfg: CFG): ForkJoinResult {
  const mismatches: ForkJoinMismatch[] = [];
  const forks = cfg.nodes.filter(isForkNode) as ForkNode[];

  for (const fork of forks) {
    // Find corresponding join
    const join = cfg.nodes.find(
      n => isJoinNode(n) && n.parallel_id === fork.parallel_id
    ) as JoinNode | undefined;

    if (!join) {
      mismatches.push({
        forkId: fork.id,
        parallelId: fork.parallel_id,
        description: `Fork ${fork.id} has no matching join`,
      });
      continue;
    }

    // Verify all branches reach the join
    const branches = getParallelBranches(cfg, fork);
    for (const branch of branches) {
      if (!branchReachesJoin(cfg, branch, join.id)) {
        mismatches.push({
          forkId: fork.id,
          joinId: join.id,
          description: `Branch does not reach join ${join.id}`,
        });
      }
    }
  }

  return { hasErrors: mismatches.length > 0, mismatches };
}
```

**Test coverage:** `src/core/cfg/builder.test.ts` (CFG construction already ensures proper fork-join structure)

---

## Layer 4: Projection Algorithms

### 4.1 Epsilon Transitions: The Core Insight

**The fundamental principle of projection:**

> When a role is not involved in an action, create an **epsilon transition** (invisible edge) rather than a visible state.

**Why?**

1. **Semantic correctness** - Role's behavior shouldn't include irrelevant actions
2. **Minimality** - Local CFSMs should be minimal (no unnecessary states)
3. **Session type theory** - Projection rule: π_R(A -> B: M) = ε if R ∉ {A, B}

**Example:**

```typescript
// Global protocol:
A -> B: Request();
B -> C: Forward();
C -> B: Response();
B -> A: Response();

// Projection for A:
A -> B: Request();     // Keep (A is sender)
// ε (skip B -> C)     // Epsilon - A not involved
// ε (skip C -> B)     // Epsilon - A not involved
B -> A: Response();    // Keep (A is receiver)

// Result: A's CFSM is just:
initial -> send(Request) -> receive(Response) -> terminal
```

**Implementation in `src/core/projection/projector.ts:150-165`:**

```typescript
if (isActionNode(targetNode)) {
  const action = targetNode.action;
  if (isMessageAction(action) && isRoleInvolved(action)) {
    // Role is involved - create send or receive state
    const stateType = action.from === role ? 'send' : 'receive';
    const actionState = createState(stateType, action);
    targetStateId = actionState.id;
    nodeMap.set(targetNode.id, targetStateId);
  } else {
    // KEY: Role not involved - skip this node (epsilon transition)
    // Don't create a state, continue traversal to next node
    if (!visited.has(targetNode.id)) {
      visited.add(targetNode.id);
      processQueue.push(targetNode.id);
    }
    continue; // ← This is the epsilon transition!
  }
}
```

**Critical implementation detail:**

When we `continue`, we:
1. Don't create a CFSM state for this CFG node
2. Don't map the CFG node to any CFSM state
3. Continue traversal to find the next relevant node

This effectively "collapses" irrelevant nodes, creating direct transitions between relevant states.

**Test demonstrating this:** `src/core/projection/projector.test.ts:67-94`

---

### 4.2 The Two-Pass Algorithm for Recursion

**The Problem:**

```typescript
// CFG structure for: rec Loop { A -> B: Data(); continue Loop; }
n0 [initial] -> n1 [recursive: "Loop"] -> n2 [action: A->B] -> n3 [continue edge back to n1]
```

If we process in single BFS pass:
1. Visit n0 → n1 → n2
2. When we reach n2's outgoing edge (continue to n1)
3. n1 is already visited → we skip it
4. **Result:** Continue edge is never added! ❌

**The Solution: Two-Pass Algorithm**

**Pass 1: Forward traversal (skip continue edges)**

```typescript
const continueEdges: Edge[] = [];

for (const edge of outgoingEdges) {
  if (edge.edgeType === 'continue') {
    continueEdges.push(edge); // Save for later
    continue;                  // Skip now
  }
  // Process normally...
}
```

**Pass 2: Process continue edges (back edges)**

```typescript
for (const edge of continueEdges) {
  const fromStateId = nodeMap.get(edge.from);
  let toStateId = nodeMap.get(edge.to);

  // Recursion labels might not have states - find the first real state after them
  if (!toStateId) {
    const recursionNode = cfg.nodes.find(n => n.id === edge.to);
    if (recursionNode && isRecursiveNode(recursionNode)) {
      const successorEdges = getOutgoingEdges(recursionNode.id);
      for (const succEdge of successorEdges) {
        toStateId = nodeMap.get(succEdge.to);
        if (toStateId) break;
      }
    }
  }

  // Create the back edge transition
  if (fromStateId && toStateId) {
    createTransition(fromStateId, toStateId, edge.label);
  }
}
```

**Why this works:**

1. **Pass 1** creates all states in topological order
2. **Pass 2** can safely reference already-created states
3. Back edges don't interfere with BFS traversal

**Implementation:** `src/core/projection/projector.ts:112-253`

**Test case:** `src/core/projection/projector.test.ts:275-302`

---

### 4.3 Recursion Labels Are Transparent

**Key insight:** Recursive nodes don't create CFSM states.

**Why?**

```typescript
// CFG structure:
n1 [action: A->B] -> n2 [recursive: "Loop"] -> n3 [action: B->A] -> continue to n2
```

The recursion label is just a **marker** for where back edges point. It's not a real "state" in the protocol execution.

**Projection result for A:**

```typescript
// Wrong approach (creating state for recursion label):
s1 [send] -> s2 [recursion] -> s3 [receive] -> back to s2
// Problem: s2 does nothing! It's a no-op state

// Correct approach (skip recursion label):
s1 [send] -> s2 [receive] -> back to s1
// The continue edge points to the first REAL state in the loop
```

**Implementation in `src/core/projection/projector.ts:208-224`:**

```typescript
} else if (isRecursiveNode(targetNode)) {
  // Recursion point - this is a label, not a real state
  // We need to find what comes after this label and map to that
  const recursionOutgoing = getOutgoingEdges(targetNode.id);
  if (recursionOutgoing.length > 0 && currentStateId) {
    // Process what comes after recursion label
    if (!visited.has(targetNode.id)) {
      visited.add(targetNode.id);
      processQueue.push(targetNode.id);
    }
  }
  continue; // ← Skip creating state for this node
}
```

**In Pass 2 (continue edge handling):**

```typescript
// If the recursion label node wasn't mapped, find the first real state after it
if (!toStateId) {
  const recursionNode = cfg.nodes.find(n => n.id === edge.to);
  if (recursionNode && isRecursiveNode(recursionNode)) {
    // Find the first non-recursion successor
    const successorEdges = getOutgoingEdges(recursionNode.id);
    for (const succEdge of successorEdges) {
      toStateId = nodeMap.get(succEdge.to);
      if (toStateId) break; // Found the real target!
    }
  }
}
```

**Result:** Continue edges create back-edges to **actual states**, not to recursion label markers.

**Test demonstrating this:** `src/core/projection/projector.test.ts:275-302`

---

### 4.4 Fork-Join Optimization: When to Project Parallel

**The Rule:**

> Only create fork/join in local CFSM if the role participates in **multiple** branches.

**Case 1: Role in ONE branch → Sequential projection**

```typescript
// Global:
par {
  A -> B: M1();
} and {
  C -> D: M2();
}

// Projection for A:
send(M1) to B;
// No fork/join needed - A only in first branch
```

**Case 2: Role in MULTIPLE branches → Preserve fork/join**

```typescript
// Global:
par {
  A -> B: M1();
} and {
  A -> C: M2();
}

// Projection for A:
fork
  ├─ send(M1) to B
  └─ send(M2) to C
join
// Fork/join preserved - A must handle concurrency
```

**Why this optimization matters:**

1. **Performance** - Simpler CFSMs are easier to execute
2. **Clarity** - Don't show unnecessary parallelism
3. **Type checking** - Simpler types for roles with sequential behavior

**Implementation in `src/core/projection/projector.ts:98-110`:**

```typescript
const roleInMultipleBranches = (forkNode: ForkNode): boolean => {
  const branches = getParallelBranches(cfg, forkNode);
  let branchesWithRole = 0;

  for (const branch of branches) {
    if (branchContainsRole(cfg, branch, role)) {
      branchesWithRole++;
    }
  }

  return branchesWithRole > 1; // Only true if in 2+ branches
};

// Later, when processing fork nodes:
if (isForkNode(targetNode)) {
  if (roleInMultipleBranches(targetNode)) {
    // Create fork state
    const forkState = createState('fork');
    targetStateId = forkState.id;
    nodeMap.set(targetNode.id, targetStateId);
  } else {
    // Skip fork - role only in one branch (sequential)
    if (!visited.has(targetNode.id)) {
      visited.add(targetNode.id);
      processQueue.push(targetNode.id);
    }
    continue;
  }
}
```

**Test cases:**
- Single branch: `src/core/projection/projector.test.ts:232-253`
- Multiple branches: `src/core/projection/projector.test.ts:255-277`

---

### 4.5 The Node Mapping Strategy

**Critical data structure:**

```typescript
const nodeMap = new Map<string, string>(); // CFG node ID → CFSM state ID
```

**Key properties:**

1. **Many-to-one or many-to-zero** - Multiple CFG nodes may map to:
   - Same CFSM state (merges)
   - No CFSM state (epsilon transitions)

2. **Not every CFG node has a corresponding CFSM state**
   - Irrelevant actions → no state
   - Recursion labels → no state
   - Forks where role in single branch → no state

3. **Node map enables back-edge resolution**
   - Continue edges use the map to find target states
   - Without the map, we can't create back edges

**Example mapping for role A:**

```typescript
// CFG nodes:
n0 [initial]         → s0 [initial]
n1 [A -> B: M1]      → s1 [send]
n2 [B -> C: M2]      → (no mapping - epsilon)
n3 [C -> A: M3]      → s2 [receive]
n4 [recursive: Loop] → (no mapping - transparent)
n5 [terminal]        → s3 [terminal]

// Node map:
{ 'n0': 's0', 'n1': 's1', 'n3': 's2', 'n5': 's3' }
```

**Usage patterns:**

```typescript
// Creating a new state:
const state = createState('send', action);
nodeMap.set(cfgNodeId, state.id);

// Checking if node already has a state:
let stateId = nodeMap.get(cfgNodeId);
if (!stateId) {
  // Need to create a new state or skip
}

// Resolving continue edges:
const fromStateId = nodeMap.get(edge.from);
const toStateId = nodeMap.get(edge.to);
if (fromStateId && toStateId) {
  createTransition(fromStateId, toStateId);
}
```

---

## Cross-Cutting Concerns

### Graph Traversal: BFS vs DFS

**We use BFS (Breadth-First Search) throughout:**

**Why BFS?**

1. **Level-order processing** - Process nodes level by level (natural for protocols)
2. **Shortest paths** - BFS finds shortest path to terminal (useful for liveness checks)
3. **Queue-based** - Natural for iterative processing (no stack overflow risk)

**Where we use BFS:**

- **CFG builder** (`src/core/cfg/builder.ts`) - Build CFG level by level
- **Projection** (`src/core/projection/projector.ts`) - Project in topological order
- **Liveness check** (`src/core/verification/verifier.ts`) - Check reachability

**Example pattern:**

```typescript
const queue: string[] = [initialNodeId];
const visited = new Set<string>();

while (queue.length > 0) {
  const nodeId = queue.shift()!; // Dequeue
  if (visited.has(nodeId)) continue;
  visited.add(nodeId);

  // Process node...

  // Enqueue successors
  const successors = getSuccessors(nodeId);
  for (const succ of successors) {
    queue.push(succ);
  }
}
```

**Alternative (DFS) would require recursion or explicit stack:**

```typescript
function dfs(nodeId: string, visited: Set<string>) {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  // Process node...

  const successors = getSuccessors(nodeId);
  for (const succ of successors) {
    dfs(succ, visited); // Recursive call
  }
}
```

**Trade-offs:**
- BFS: Better for shortest paths, level-order, no recursion
- DFS: Better for cycle detection, topological sort, sometimes simpler code

We chose BFS for consistency and safety.

---

### Handling Edge Cases: Empty Protocols

**Edge case:**

```typescript
protocol Empty(role A, role B) {
  // Nothing here!
}
```

**What should projection produce?**

```typescript
// CFSM for A:
initial -> terminal
// Single transition, no actions
```

**Implementation consideration:**

Our algorithm naturally handles this:
1. Create initial state
2. Find terminal node in CFG
3. Create terminal state
4. Create transition initial → terminal
5. Done!

**Why this matters:**

Empty protocols are:
- **Valid test cases** (edge case coverage)
- **Useful for scaffolding** (start with empty, add behavior)
- **Composable** (empty protocol + another protocol)

**Test:** `src/core/projection/projector.test.ts:449-463`

---

## Testing Strategy Insights

### Test-Driven Development: RED → GREEN → REFACTOR

**We followed strict TDD for all layers:**

**RED Phase:**
1. Write comprehensive tests first
2. Run tests → all fail (or don't compile)
3. Verify failures are for the right reasons

**GREEN Phase:**
1. Implement minimal code to pass tests
2. Don't optimize yet!
3. Get to 100% passing

**REFACTOR Phase:**
1. Clean up implementation
2. Extract helpers
3. Add comments
4. Tests still pass!

**Example (Layer 4 Projection):**

1. **RED:** Created 21 tests, all failing with "Not implemented yet"
2. **GREEN:** Implemented projection algorithm, 19/21 passing
3. **Fix bugs:** Fixed recursion handling, 21/21 passing
4. **REFACTOR:** (Future) Extract helper functions, add more comments

**Benefits:**

- **Confidence** - Tests define behavior before implementation
- **Documentation** - Tests show how to use the API
- **Regression prevention** - Tests catch future breaks
- **Design feedback** - Hard-to-test code → bad design

---

### Known-Good and Known-Bad Protocols

**Strategy:** Test with real-world protocols:

**Known-Good (should pass all verifications):**
- Request-Response
- Two-Phase Commit
- Streaming
- Ping-Pong

**Known-Bad (should fail specific verifications):**
- Parallel branch deadlock
- Circular dependencies
- Race conditions
- Fork-join mismatch

**Why this works:**

1. **Real-world relevance** - These are actual protocols developers use
2. **Comprehensive coverage** - Each protocol exercises different features
3. **Regression tests** - If a known-good protocol fails, we broke something
4. **Specification by example** - Shows what "correct" and "incorrect" mean

**Example from verification tests:**

```typescript
describe('Deadlock Detection - Known-Good Protocols', () => {
  it('[Request-Response] should pass deadlock check', () => {
    // Real protocol from distributed systems
    const source = `
      protocol RequestResponse(role Client, role Server) {
        Client -> Server: Request();
        Server -> Client: Response();
      }
    `;
    const result = detectDeadlock(buildCFG(parse(source)));
    expect(result.hasDeadlock).toBe(false);
  });
});

describe('Deadlock Detection - Known-Bad Protocols', () => {
  it('should detect parallel branch deadlock', () => {
    // Known anti-pattern
    const source = `
      protocol ParallelDeadlock(role A, role B, role C) {
        par {
          A -> B: M1();
          B -> A: M2();
        } and {
          A -> C: M3();
          C -> A: M4();
        }
      }
    `;
    const result = detectParallelDeadlock(buildCFG(parse(source)));
    expect(result.hasDeadlock).toBe(true);
  });
});
```

---

### Test Organization by Feature

**Structure:**

```typescript
describe('Feature Category', () => {
  it('should handle basic case');
  it('should handle edge case');
  it('should handle nested case');
});
```

**Example (Projection tests):**

```
CFSM Projection - Basic Message Passing (4 tests)
  ├─ should project simple send action for sender role
  ├─ should project simple receive action for receiver role
  ├─ should project sequence of messages
  └─ should exclude irrelevant actions

CFSM Projection - Choice (3 tests)
  ├─ should project choice where role is sender
  ├─ should project choice where role is receiver
  └─ should handle nested choices

CFSM Projection - Parallel Composition (4 tests)
  ├─ should project role in single parallel branch as sequential
  ├─ should preserve fork-join when role appears in multiple branches
  ├─ should project independent parallel branches correctly
  └─ should handle three-way parallel
```

**Benefits:**

- **Clear organization** - Easy to find relevant tests
- **Feature coverage** - Can see at a glance what's tested
- **Incremental development** - Implement one category at a time

---

## Summary: Key Implementation Patterns

### 1. **Epsilon Transitions for Irrelevant Actions**

```typescript
if (!isRoleInvolved(action)) {
  continue; // Don't create state
}
```

### 2. **Two-Pass for Back Edges**

```typescript
// Pass 1: Forward edges only
// Pass 2: Back edges (continue edges)
```

### 3. **Recursion Labels Are Transparent**

```typescript
if (isRecursiveNode(node)) {
  continue; // Skip, don't create state
}
```

### 4. **Fork-Join Optimization**

```typescript
if (roleInMultipleBranches(fork)) {
  createFork(); // Only if needed
}
```

### 5. **Sender Conflicts ≠ Receiver Conflicts**

```typescript
// Flag sender conflicts in parallel
// Allow receiver conflicts (FIFO buffering)
```

### 6. **BFS for Graph Traversal**

```typescript
const queue = [initial];
while (queue.length > 0) {
  const current = queue.shift();
  // Process...
}
```

### 7. **Node Mapping for Projection**

```typescript
const nodeMap = new Map<string, string>();
// CFG node → CFSM state (many-to-one or many-to-zero)
```

---

## What's Next?

**Layers to document as we implement:**

- **Layer 5: Runtime/Simulation** - State machine execution, message queuing, trace recording
- **Layer 6: Code Generation** - TypeScript generation, type safety, API design
- **Visualization** - DOT export, D3.js rendering, interactive stepping

**Keep this document updated as we learn more!**

---

## References

**Session Type Theory:**
- Honda, Yoshida, Carbone: "Multiparty Asynchronous Session Types" (POPL 2008)
- Yoshida & Hu: "Multiparty Session Types" (survey paper)
- Scalas & Yoshida: "Linear Session Types" (tutorial)

**Verification Algorithms:**
- Tarjan: "Depth-First Search and Linear Graph Algorithms" (SCC algorithm)
- Aho, Sethi, Ullman: "Compilers: Principles, Techniques, and Tools" (CFG analysis)

**Our Implementation:**
- Test files: `src/core/*/**.test.ts` (comprehensive test suites)
- Implementation: `src/core/*/**.ts` (production code)
- Design docs: `docs/cfg-design.md`, `docs/architecture-overview.md`
