# Implementation Lessons: From Theory to Code

## Purpose

This document captures **critical implementation insights** learned while building the SMPST IDE. It bridges the gap between **theoretical session type concepts** and **practical implementation**, explaining the "why" behind design decisions.

**Target audience:** Developers implementing session type systems, students learning MPST, or anyone wanting to understand the engineering decisions behind this codebase.

---

## Table of Contents

1. [Layer 3: Verification Algorithms](#layer-3-verification-algorithms)
2. [Layer 4: Projection Algorithms](#layer-4-projection-algorithms)
3. [Layer 5: Async/Concurrent Execution Architecture](#layer-5-asyncconcurrent-execution-architecture)
4. [Cross-Cutting Concerns](#cross-cutting-concerns)
5. [Testing Strategy Insights](#testing-strategy-insights)
6. [Summary: Key Implementation Patterns](#summary-key-implementation-patterns)

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

---

### 4.6 Tau Transitions: Eager Application is Critical

**Critical Discovery**: Tau transitions must be applied **immediately and eagerly** after
every communication step, not lazily.

#### The Bug

Initially, the ContextReducer would advance sender and receiver states after a
communication, but would NOT apply tau transitions. This caused protocols to get
stuck in intermediate states:

```typescript
// Before fix:
reduceBy(context, comm) {
  // Update sender state
  // Update receiver state
  return newContext;  // ❌ Missing tau application!
}
```

#### Why This Matters

In projected CFSMs, tau transitions represent:
1. **Post-choice transitions** - Moving from choice state to continuation after branch selected
2. **Merge point transitions** - Synchronizing after parallel branches
3. **Terminal transitions** - Reaching final state after last action

**Without eager tau application**:
- Protocol appears incomplete (not at terminal)
- `isTerminal()` returns false
- Integration tests fail (protocols "stuck")

**Example Impact**: OAuth protocol in "Less is More" examples was stuck at intermediate
states instead of reaching terminals.

#### The Solution

Apply tau transitions in a **loop until fixpoint**:

```typescript
private applyTauTransitions(context: TypingContext): TypingContext {
  let current = context;
  let changed = true;

  // Loop until no more tau transitions enabled
  while (changed) {
    changed = false;
    const newCFSMs = new Map(current.cfsms);

    for (const [role, instance] of current.cfsms) {
      const tauTrans = this.getEnabledTauTransition(instance.machine, instance.currentState);
      if (tauTrans) {
        // Apply tau transition
        newCFSMs.set(role, {
          machine: instance.machine,
          currentState: tauTrans.to,
        });
        changed = true;
      }
    }

    if (changed) {
      current = { session: current.session, cfsms: newCFSMs };
    }
  }

  return current;
}
```

**Key insight**: Must iterate because applying one tau might enable another tau in a
different role. Stop only when no role has enabled tau transitions.

#### When to Apply

**After every communication** in the reduction step:

```typescript
reduceBy(context: TypingContext, comm: Communication): TypingContext {
  // 1. Advance sender and receiver states
  let newContext = { ... };

  // 2. Apply tau transitions eagerly for ALL roles
  newContext = this.applyTauTransitions(newContext);

  return newContext;
}
```

#### Results

**Test improvements**:
- Integration tests: 73/85 → 94/99 passing (58% reduction in failures)
- OAuth protocol: Now executes correctly to completion
- Theorem tests: Still 30/30 passing (safety preserved)

#### Lessons Learned

1. **Fixpoint iteration is necessary** - One tau can enable another
2. **Apply after every step** - Don't defer tau application
3. **All roles must be checked** - Tau in one role independent of others
4. **Test with complete protocols** - Integration tests caught this, unit tests didn't

**Implementation**: `src/core/safety/context-reducer.ts:applyTauTransitions()`

**Reference**: Scalas & Yoshida (2019), Section 3.2 (CFSM operational semantics)

---

## Layer 5: Async/Concurrent Execution Architecture

### 5.1 Two Execution Modes

**Key Design Decision**: Support both **scheduled synchronous** and **concurrent
asynchronous** execution.

#### Mode 1: Scheduled Simulation (Deterministic)

**Use Case**: Testing, debugging, bisimulation verification

```typescript
class DistributedSimulator {
  async run(): Promise<Result> {
    while (!allComplete && !deadlocked) {
      const enabled = this.getEnabledRoles();
      const role = this.selectRole(enabled);  // Round-robin/fair/random

      await simulator.step();  // Await async step
      this.globalSteps++;
    }
    return { success: !deadlocked };
  }
}
```

**Characteristics**:
- Coordinator orchestrates (chooses which role executes)
- Deterministic with fixed scheduling strategy
- Reproducible execution traces
- Good for CFG bisimulation testing

#### Mode 2: Concurrent Runtime (Realistic)

**Use Case**: Performance testing, realistic network simulation, actor model

```typescript
class DistributedRuntime {
  async runConcurrently(): Promise<Result> {
    // Launch ALL roles in parallel
    const executionPromises = Array.from(this.executors.values()).map(executor =>
      this.runExecutor(executor)
    );

    // Wait for all to complete OR deadlock detection
    const result = await Promise.race([
      Promise.all(executionPromises),
      this.detectDeadlock()
    ]);

    return result;
  }

  private async runExecutor(executor: CFSMSimulator): Promise<void> {
    while (!executor.isComplete()) {
      const result = await executor.step();

      if (!result.success && result.error?.type === 'message-not-ready') {
        // Blocked - wait and retry
        await this.delay(10);
        continue;
      }
    }
  }
}
```

**Characteristics**:
- Each participant executes autonomously
- True concurrency (actor model)
- Coordinator only observes (doesn't orchestrate)
- Async message passing with configurable delays

### 5.2 Event-Driven Coordination

**Core Principle**: Coordinator doesn't orchestrate, it **observes**.

#### Events Emitted by Participants

```typescript
// Execution lifecycle
'step-start': { stepCount, currentState }
'step-end': { stepCount, result, state }
'complete': { role, steps }

// Sub-protocol navigation
'step-into': { protocol, depth, roleMapping }
'step-out': { protocol, depth }

// User interaction needed
'choice-required': { role, options: CFSMTransition[] }

// Actions
'send': { messageId, to, label, payloadType }
'receive': { messageId, from, label, payloadType }
'tau': { stateId }

// Errors
'error': { type, message, state }
'deadlock': { role, state }
```

#### Coordinator Event Handling

```typescript
class DistributedRuntime {
  private handleChoiceRequired(event: ChoiceRequiredEvent): void {
    // Pause execution for this role
    // Present options to UI
    // Wait for user selection via selectTransition()
    this.emit('ui-choice-needed', event);
  }

  private handleError(event: ErrorEvent): void {
    if (event.type === 'message-not-ready') {
      // Normal blocking - executor will retry
      return;
    }
    // Fatal error - may need to abort
    this.emit('ui-error', event);
  }
}
```

### 5.3 Message Transport with Configurable Delays

**Testing Strategy**: Test at multiple levels of realism

#### Synchronous (No Delay)
```typescript
const transport = new InMemoryTransport({});
```
**Use**: Unit testing, immediate message delivery

#### Microtask Delay
```typescript
const transport = new InMemoryTransport({ useMicrotaskDelay: true });
```
**Use**: Fast async testing via Promise.resolve()

#### Fixed Delay
```typescript
const transport = new InMemoryTransport({ messageDelay: 50 });
```
**Use**: Simulate network latency (50ms)

#### Random Delay (Network Jitter)
```typescript
const transport = new InMemoryTransport({ messageDelay: [10, 100] });
```
**Use**: Realistic network with variable delays

### 5.4 Deadlock Detection in Concurrent Mode

**Challenge**: Detect global deadlock when roles execute independently

**Solution**: Periodic global state check

```typescript
private async detectDeadlock(): Promise<{ deadlocked: boolean }> {
  while (true) {
    await this.delay(100);  // Check every 100ms

    const allBlocked = Array.from(this.executors.values()).every(e =>
      e.isComplete() || e.isBlocked()
    );

    const anyNotCompleted = Array.from(this.executors.values()).some(e =>
      !e.isComplete()
    );

    const messagesInFlight = this.transport.getTotalPendingMessages();

    if (allBlocked && anyNotCompleted && messagesInFlight === 0) {
      return { deadlocked: true };
    }

    const allComplete = Array.from(this.executors.values()).every(e => e.isComplete());
    if (allComplete) {
      return { deadlocked: false };
    }
  }
}
```

**Key**: Deadlock = all roles blocked AND no messages in-flight AND not all completed

### 5.5 Blocked vs Error

**Critical distinction**: Waiting for message is normal, not an error

```typescript
// Normal blocking (retry)
{ type: 'message-not-ready' }

// Fatal deadlock (halt)
{ type: 'deadlock' }
```

**Why**: In asynchronous execution, roles frequently wait for messages. Only flag as
deadlock when **all** roles blocked simultaneously.

### 5.6 Implementation Status

**Current**: Scheduled synchronous mode fully implemented
**Planned**: Concurrent asynchronous mode (architecture designed, not implemented)

**Files**:
- `src/core/simulation/distributed-simulator.ts` - Scheduled mode ✅
- Design doc: `ASYNC_CONCURRENT_ARCHITECTURE_PLAN.md` (archived)

---

## Cross-Cutting Concern: Theorem-Driven Testing

### 6.1 Behavioral vs Theorem-Driven Testing

#### Traditional Behavioral Testing

```typescript
it('should project protocol correctly', () => {
  const protocol = `...`;
  const projected = project(protocol, 'A');
  expect(projected).toBeDefined();
  expect(projected.actions.length).toBeGreaterThan(0);
});
```

**Characteristics**:
- ✅ Easy to write
- ✅ Quick feedback
- ❌ Unclear what "correct" means
- ❌ No formal grounding
- ❌ Incomplete coverage (what's missing?)

#### Theorem-Driven Testing

```typescript
/**
 * THEOREM 4.7 (Honda et al. JACM 2016): Projection Completeness
 * ∀ a ∈ actions(G), ∃ r ∈ Roles, a ∈ actions(G ↓ r)
 */
it('proves: every message appears in sender and receiver projections', () => {
  const protocol = `...`;
  const projections = projectAll(cfg);

  // Theorem 4.7: Every global action must appear in projections
  for (const action of globalActions) {
    const appearsInSender = contains(projections.get(action.from), action);
    const appearsInReceiver = contains(projections.get(action.to), action);

    expect(appearsInSender).toBe(true); // Formal requirement
    expect(appearsInReceiver).toBe(true); // Formal requirement
  }
});
```

**Characteristics**:
- ✅ **Formal grounding**: Every test proves a theorem
- ✅ **Precise semantics**: Know exactly what "correct" means
- ✅ **Complete coverage**: All proof obligations tested
- ✅ **Better debugging**: Failure = theorem violation
- ✅ **Documentation**: Tests explain theory
- ⚠️ **Higher initial cost**: More setup required
- ⚠️ **Exposes gaps**: Reveals missing implementation

### 6.2 Value Delivered

**API Gaps Discovered**:
- Projection returns incomplete CFSMs (critical gap)
- Race detector too conservative (false positives)
- ProtocolRegistry API undocumented
- Multicast syntax not implemented

**Theorem-driven tests found these because they test formal properties, not just behaviors.**

### 6.3 Tests as Executable Proofs

Each theorem test is a **correctness invariant**:

```typescript
describe('Theorem 5.10: Progress (Honda 2016)', () => {
  // Reading the test teaches you the theorem
  // Passing test proves implementation is correct
  // Failing test shows exactly which property violated
});
```

**Benefits**:
1. **Formal correctness verification** - Mathematical certainty, not empirical confidence
2. **Regression prevention** - Future changes can't violate theorems
3. **Living documentation** - Executable specifications of formal properties
4. **Trust in implementation** - "Theorem 4.7 verified ✓" > "tests pass"

### 6.4 Comparison Matrix

| Aspect | Behavioral Testing | Theorem-Driven Testing |
|--------|-------------------|------------------------|
| **Clarity** | "Test passes" | "Theorem X.Y verified" |
| **Coverage** | Unknown gaps | Complete (all proof obligations) |
| **Debugging** | "Something broke" | "Theorem 4.7 violated at line X" |
| **Documentation** | Implicit | Explicit (cites papers) |
| **Confidence** | Empirical | Mathematical |
| **Maintenance** | Fragile (tests may be wrong) | Robust (theorems are correct) |
| **API Discovery** | Slow | **Fast** (gaps immediately visible) |
| **Value** | Catches bugs | **Proves correctness** |

### 6.5 Implementation Approach

**Our Process**:
1. Identify formal theorem from academic literature
2. Write test that encodes theorem as executable code
3. Implement minimal code to satisfy theorem
4. Verify implementation passes all theorem tests

**Example Theorems Tested**:
- Theorem 4.7 (Projection Completeness) - 9 tests
- Theorem 3.1 (Soundness) - 7 tests
- Theorem 5.3 (Composability) - 9 tests
- Lemma 3.6 (Preservation) - 4 tests

**Files**: `src/__tests__/theorems/` - 110 tests across 12 theorem categories

**Status**: 75/110 passing (68% - gaps identified and documented)

### 6.6 Lessons Learned

1. **Theorem tests expose real gaps** - Not just edge cases, but fundamental missing features
2. **Failing tests are features** - They reveal what needs to be implemented
3. **Tests teach theory** - Reading theorem tests is an education in formal methods
4. **Investment pays off** - Higher initial cost, lower long-term maintenance

**Reference**: `THEOREM_TESTING_FINDINGS.md` (archived temporary doc)

---

## Layer 5.5: Sub-Protocol Support Patterns

### 7.1 Protocol Registry Pattern

**Problem**: Need to resolve sub-protocol references during execution

**Solution**: Dependency injection with validation

```typescript
interface IProtocolRegistry {
  resolve(name: string): GlobalProtocolDeclaration;
  has(name: string): boolean;
  validateDependencies(): ValidationResult;
  getDependencies(name: string): string[];
  createRoleMapping(protocol: string, roles: string[]): RoleMapping;
  getCFG(protocolName: string): CFG;
}
```

**Key Features**:
1. **Protocol resolution by name** - Look up sub-protocols during execution
2. **Dependency extraction from AST** - Analyze `do` statements
3. **Circular dependency detection** - DFS-based cycle detection
4. **Role mapping validation** - Ensure arity matches
5. **CFG caching** - Build once, reuse

**Implementation**: `src/core/protocol-registry/registry.ts`

### 7.2 Call Stack Manager Pattern

**Problem**: Track nested protocol execution context

**Solution**: Unified stack for recursion and sub-protocols with event emission

```typescript
interface ICallStackManager {
  getState(): CallStackState;
  push(frame): ProtocolCallFrame;
  pop(): ProtocolCallFrame;
  step(nodeId: string, action?: string): void;
  reset(): void;
  on(eventType: string, handler): void;
  off(eventType: string, handler): void;
}
```

**Key Design Decisions**:

#### Unified Stack
```typescript
type ProtocolCallFrame =
  | RecursionFrame   // rec/continue
  | SubProtocolFrame // do statement
```

Why: Both recursion and sub-protocols need context tracking. Unified stack simplifies.

#### Event-Driven
```typescript
'frame-push': { frame, depth }
'frame-pop': { frame, duration }
'frame-step': { nodeId, action, stepCount }
'stack-reset': { previousDepth }
```

Why: UI needs real-time call stack visualization for debugging.

#### Bounded Limits
```typescript
interface CallStackConfig {
  maxDepth?: number;        // Default: 100
  maxIterations?: number;   // Default: 1000
  emitEvents?: boolean;     // Default: true
}
```

Why: Prevent infinite recursion, detect tail-recursion violations.

**Implementation**: `src/core/simulation/call-stack-manager.ts`

### 7.3 Sub-Protocol Execution Pattern

**Execution Flow**:
```
1. Detect SubProtocolAction node
2. Resolve protocol from registry
3. Create role mapping
4. Build CFG for sub-protocol
5. Push call stack frame
6. Emit enter event
7. Create nested simulator
8. Run to completion
9. Merge trace events
10. Pop call stack frame
11. Emit exit event
12. Continue parent execution
```

**Implementation**:
```typescript
async executeSubProtocol(node: Node, action: SubProtocolAction): Promise<Result> {
  // 1. Resolve protocol
  const protocol = registry.resolve(action.protocol);

  // 2. Create role mapping
  const roleMapping = registry.createRoleMapping(action.protocol, action.roleArguments);

  // 3. Build CFG
  const subCFG = buildCFG(protocol);

  // 4. Push call stack
  callStackManager.push({
    type: 'subprotocol',
    protocol: action.protocol,
    roleMapping
  });

  // 5. Emit enter event
  this.emit('subprotocol', { action: 'enter', ... });

  // 6. Create nested simulator
  const subSimulator = new CFGSimulator(subCFG, {
    protocolRegistry: this.protocolRegistry,
    callStackManager: this.callStackManager
  });

  // 7. Run to completion
  const subResult = await subSimulator.run();

  // 8. Merge traces
  this.trace.push(...subResult.trace);

  // 9. Pop call stack
  callStackManager.pop();

  // 10. Emit exit event
  this.emit('subprotocol', { action: 'exit', ... });

  // 11. Continue parent
  return { success: true };
}
```

### 7.4 Known Issue: Nested Sub-Protocol Execution

**Problem**: Shared call stack manager across nested simulators causes state conflicts

**Symptom**: Tests with deeply nested sub-protocols (3+ levels) hang indefinitely

**Root Cause**: When nested simulator pushes frame, it affects parent simulator's stack view

**Proposed Solution**:
```typescript
// Create separate call stack context for each nesting level
const subCallStack = callStackManager.createChildContext({
  parentFrame: currentFrame,
  inheritLimits: true,
});

const subSimulator = new CFGSimulator(subCFG, {
  callStackManager: subCallStack,  // Isolated context
  ...config
});
```

**Status**: Documented, not yet implemented

**Impact**: Medium - affects nested protocols only, basic sub-protocols work correctly

### 7.5 Test Results

**Protocol Registry**: 34/34 tests passing (100%)
**Call Stack Manager**: 49/49 tests passing (100%)
**Sub-Protocol Execution**: 13/17 tests passing (76.5%)

**Failing Tests**: Related to nested sub-protocol issue above

**Implementation**: `src/core/protocol-registry/`, `src/core/simulation/call-stack-*`

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
