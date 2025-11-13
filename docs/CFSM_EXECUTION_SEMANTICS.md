# CFSM Execution Semantics for MPST

**Formal Reference**: Honda, Yoshida, Carbone (2008) "Multiparty Asynchronous Session Types" + Deniélou, Yoshida (2012) "Multiparty Session Types Meet Communicating Automata"

This document describes the **correct execution semantics** for Communicating Finite State Machines (CFSMs) as used in Multiparty Session Types (MPST) implementations.

---

## 1. Message Queue Model

### Formal Model

**Per-Pair FIFO Queues**: Each ordered pair of roles `(p, q)` has a dedicated FIFO message queue from `p` to `q`.

- **NOT** a single global queue
- **NOT** one queue per role
- **Distinct FIFO queues** for each directed communication channel

### Message Delivery Semantics

When a **send action** executes:
```
Role p executes: send(q, label, payload)
→ Message is appended to queue(p → q)
```

When a **receive action** executes:
```
Role q executes: receive(p, label)
→ Message is dequeued from head of queue(p → q)
→ Only succeeds if message is at head AND label matches
```

### Critical Timing Rule

**A receiver CANNOT observe a message in the same execution step it was sent.**

- Send and receive are **separate transitions**
- This preserves **asynchronous semantics**
- Messages are "in flight" between send and receive steps

**Example**:
```
Step 1: Client sends Request to Server
  → Message added to queue(Client → Server)

Step 2: Server receives Request
  → Message dequeued from queue(Client → Server)
```

The Server cannot receive in Step 1. Send and receive are distinct steps.

---

## 2. Execution Interleaving and Steps

### What is a "Step"?

In formal CFSM semantics, a **step** is:

```
One role executes ONE action (send, receive, or epsilon)
```

**NOT**:
- ❌ All roles executing in parallel
- ❌ Multiple actions by one role
- ❌ Batching of actions

### Execution Model

**Interleaving of Independent CFSMs**, one per role:

```
Global execution = interleaving of local transitions

Global Step i: Role p executes transition t_p
Global Step i+1: Role q executes transition t_q
Global Step i+2: Role p executes transition t_p'
...
```

### Simulator Implementation

Simulators can implement **any fair scheduling**:

- Round-robin (execute each role in turn)
- Random selection
- Priority-based

But formally, **one step = one transition by one role**.

### Fairness Requirement

Every role that **can** make progress **must eventually** be scheduled.

Starvation (never scheduling a ready role) is not allowed.

---

## 3. Deadlock vs Blocked State

### Definitions

#### Blocked State (Temporary)

A role is **blocked** when:
```
Role p is waiting for message(s) that are not currently at the head of its input queue(s)
```

This is **normal** and **temporary** in asynchronous execution.

**Example**:
```
Client waits for Response
→ Blocked (temporarily)

Server sends Response
→ Message added to queue(Server → Client)

Client receives Response
→ No longer blocked
```

#### Deadlock (Permanent)

The system is **deadlocked** when:

```
ALL roles are blocked
AND
ALL message queues are empty (no messages in transit)
```

**Formal Definition**:
```
∀ role p: p is blocked
∧
∀ queue q_ij: q_ij is empty
```

### Critical Distinction

**NOT deadlock**:
- Client blocked waiting for Response
- Server has sent Response (message in queue)
- ✓ Client will unblock when it receives the message

**IS deadlock**:
- Client blocked waiting for Response
- Server blocked waiting for Ack
- No messages in any queue
- ✗ No role can make progress

### Implementation Rule

**Only declare deadlock when**:
1. All roles are blocked OR completed
2. At least one role is NOT completed
3. No blocked role has pending messages in its input queue(s)

```typescript
const deadlocked =
  allRolesBlockedOrCompleted &&
  someRoleNotCompleted &&
  !anyBlockedRoleHasPendingMessages;
```

---

## 4. Epsilon/Tau Transitions

### What are Epsilon Transitions?

**Epsilon (ε) or Tau (τ) transitions** are internal/silent actions:

- No message exchange
- Used for control flow (merges, internal choices, etc.)
- Example: Transitioning from merge node to next action

### Execution Semantics

**Each epsilon transition is a separate step**:

```
NOT automatically collapsed!

Step 1: Role p executes action A (send/receive)
Step 2: Role p executes epsilon transition ε₁
Step 3: Role p executes epsilon transition ε₂
Step 4: Role p executes action B (send/receive)
```

### Implementation Guideline

While formally each epsilon is a step, **practical implementations** may:

**Auto-advance through epsilon transitions** until reaching:
- A send/receive action (stops here)
- A terminal state (stops here)
- Another action requiring input (stops here)

This is an **optimization** that preserves observational equivalence.

**Our implementation approach**:
```
step():
  1. Execute one send/receive action
  2. Auto-advance through subsequent epsilon transitions
  3. Stop at next action or terminal state
  4. Return
```

This counts as "one step" for practical purposes while respecting that epsilons are conceptually separate transitions.

---

## 5. Call Stack for Sub-Protocols

### Sub-Protocol Invocation

When a protocol executes `do SubProtocol(args)`:

**NOT simply inlined**: Sub-protocols are represented as separate CFSMs invoked with **push/pop semantics**.

### Execution State Management

The execution state tracks entering/exiting sub-protocols via a **call stack**:

```
Stack Frame:
  - Current CFSM (which sub-protocol)
  - Current state within that CFSM
  - Return continuation (where to resume in parent)
  - Role mapping (argument substitution)
```

### Example Execution

```scribble
protocol Parent(role A, role B) {
  A -> B: Start();
  do Child(A, B);  // Sub-protocol invocation
  A -> B: End();
}

protocol Child(role X, role Y) {
  X -> Y: Data();
}
```

**Execution trace**:
```
Step 1: A sends Start to B
  Stack: [Parent @ state_after_start]

Step 2: A enters Child sub-protocol
  Stack: [Parent @ after_do, Child @ initial]

Step 3: A sends Data to B (within Child)
  Stack: [Parent @ after_do, Child @ after_send]

Step 4: Child completes, returns to Parent
  Stack: [Parent @ after_do]

Step 5: A sends End to B
  Stack: [Parent @ after_end]
```

### Projection Rule for Sub-Protocols

For CFSM projection, sub-protocols are treated via **tau-elimination**:

```
For role p NOT involved in SubProtocol:
  GlobalCFG node: do SubProtocol(...)
  → ProjectedCFSM: epsilon transition (tau)

For role p involved in SubProtocol:
  GlobalCFG node: do SubProtocol(p as X, ...)
  → ProjectedCFSM: inline or recursive CFSM call
```

**Our current implementation**: Sub-protocols are tau-eliminated in CFSM projection. The CFG builder emits `SubProtocolAction`, which the projector converts to epsilon transitions.

**Future enhancement**: For full sub-protocol execution, would need call stack in CFSM executor.

---

## 6. Implementation Checklist

Use this to verify correctness of CFSM simulator/executor:

### Message Queues
- [ ] Per-pair FIFO queues `queue(sender → receiver)`
- [ ] Send appends to queue immediately
- [ ] Receive dequeues from head only
- [ ] Cannot receive in same step as send

### Execution Steps
- [ ] One step = one role executes one action
- [ ] Interleaving of role transitions
- [ ] Fair scheduling (all ready roles eventually execute)

### Deadlock Detection
- [ ] Check: all roles blocked or completed
- [ ] Check: at least one role not completed
- [ ] Check: no blocked role has pending messages
- [ ] Only then declare deadlock

### Epsilon Transitions
- [ ] Epsilon transitions are valid transition types
- [ ] May auto-advance through epsilons (optimization)
- [ ] Must eventually reach action or terminal

### State Machine Structure
- [ ] States are just control locations (no types/actions on states)
- [ ] Actions live on transitions (LTS semantics)
- [ ] Terminal states explicitly marked
- [ ] Transitions: `from_state --[action]--> to_state`

---

## 7. Common Implementation Mistakes

### ❌ Mistake 1: Synchronous Send/Receive

**Wrong**:
```typescript
// Both happen in one step
await client.send(message);
await server.receive(message);  // Same step!
```

**Correct**:
```typescript
// Step 1: Client sends
await client.step();  // Sends message to queue

// Step 2: Server receives
await server.step();  // Dequeues from queue
```

### ❌ Mistake 2: Premature Deadlock Detection

**Wrong**:
```typescript
// Declares deadlock if any role is blocked
const deadlocked = anyRoleBlocked;
```

**Correct**:
```typescript
// Only deadlock if blocked AND no messages pending
const deadlocked =
  allBlockedOrCompleted &&
  someNotCompleted &&
  !hasMessagesInTransit;
```

### ❌ Mistake 3: Actions on States Instead of Transitions

**Wrong** (CFG semantics, not CFSM semantics):
```typescript
interface CFSMState {
  id: string;
  type: 'send' | 'receive';  // ❌ Wrong!
  action: Action;             // ❌ Wrong!
}
```

**Correct** (LTS semantics):
```typescript
interface CFSMState {
  id: string;
  label?: string;  // Just a control location
}

interface CFSMTransition {
  from: string;
  to: string;
  action?: Action;  // ✓ Action on transition!
}
```

### ❌ Mistake 4: Global Message Queue

**Wrong**:
```typescript
// Single queue for all messages
const globalQueue: Message[] = [];
```

**Correct**:
```typescript
// Per-pair queues
const queues: Map<`${string}->${string}`, Message[]> = new Map();
```

---

## 8. Testing Guidance

### Test Cases for Correctness

1. **Asynchronous Timing**
   - Send then receive in separate steps
   - Verify message buffering between steps

2. **Interleaving**
   - Multiple roles sending concurrently
   - Messages should not get lost or reordered within a queue

3. **Deadlock Detection**
   - True deadlock: all blocked, no messages
   - False positive: blocked but messages pending

4. **Epsilon Transitions**
   - Control flow nodes (merge, join) should auto-advance
   - Should not get stuck on epsilon loops

5. **Sub-Protocols**
   - Nested invocation and return
   - Proper role mapping/argument substitution

---

## 9. References

### Foundational Papers

1. **Honda, Yoshida, Carbone (2008)**: "Multiparty Asynchronous Session Types", POPL
   - MPST formalization
   - Asynchronous semantics with message queues
   - Projection and safety theorems

2. **Deniélou, Yoshida (2012)**: "Multiparty Session Types Meet Communicating Automata", ESOP
   - CFSM approach to MPST
   - Equivalence between local types and CFSMs
   - Projection to communicating automata

3. **Brand, Zafiropulo (1983)**: "On Communicating Finite-State Machines"
   - Original CFSM formalism
   - Deadlock detection via reachability analysis

### Implementation Guides

4. **Scalas, Yoshida (2019)**: "Linear Session Types: A Survey", CSUR
   - Comprehensive tutorial on session types
   - Practical implementation guidance

5. **Scribble Language Specification** (2013)
   - Concrete syntax for MPST
   - Tool implementation examples

---

## 10. Summary

**Key Takeaways**:

1. **Per-pair FIFO queues** for message passing
2. **One step = one transition** by one role
3. **Deadlock = all blocked AND no messages** in transit
4. **Epsilon transitions** are separate steps (may auto-advance)
5. **Actions on transitions**, not on states (LTS semantics)
6. **Sub-protocols** use call stack semantics

**When in doubt**: Refer to Honda, Yoshida, Carbone (2008) formal semantics.

---

*This document provides the formal foundation for implementing correct CFSM execution in MPST systems. All simulator and executor implementations should adhere to these semantics.*
