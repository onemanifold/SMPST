# Control Flow Graph (CFG) Design Specification

## Purpose

This document specifies the **Control Flow Graph (CFG)** representation for Scribble protocols. The CFG is the **central semantic artifact** in our IDE, serving as the foundation for:

- **Verification**: Deadlock detection, liveness, progress checking
- **Projection**: Local CFSM generation per role
- **Simulation**: Interactive protocol execution
- **Code Generation**: State machine classes, API stubs, mocks

---

## Why CFG-Based Architecture?

### The Problem with AST-Only Approaches

**Abstract Syntax Trees (ASTs)** capture **syntactic structure** but obscure **semantic behavior**:

```scribble
choice at Server {
    success() from Server to Client;
    data() from Client to Server;
} or {
    failure() from Server to Client;
}
```

**AST view**: Nested tree of `Choice`, `MessageTransfer` nodes

**CFG view**: Explicit branching, state transitions, reachability:
```
s0 --[Server chooses]--> s1: success → s2: data → s3
                      └-> s4: failure → s5
```

The CFG makes **control flow explicit**, enabling:
- **Reachability analysis** (which states are reachable?)
- **Deadlock detection** (any states with no outgoing transitions?)
- **Liveness** (can we always make progress?)

### Best Practices from the Literature

**Standard approach in session types research:**

1. Parse → AST (syntax)
2. AST → CFG (semantics)
3. CFG → Local CFSMs (projection)
4. Verify on CFG/CFSMs

**References:**
- Yoshida & Hu: "Multiparty Session Types" (survey)
- Honda et al.: "Multiparty Asynchronous Session Types" (POPL 2008)
- Scalas & Yoshida: "Linear Session Types" (tutorial)

---

## CFG Structure

### Overview

A **Global CFG** represents the execution graph of a global protocol:

```
GlobalCFG = (Nodes, Edges, InitialNode, Metadata)
```

**Components:**
- **Nodes**: States in protocol execution
- **Edges**: Communication actions or control flow
- **InitialNode**: Entry point
- **Metadata**: Role declarations, imported types, etc.

### Node Types

```typescript
type CfgNode = {
    id: NodeId;              // Unique identifier
    type: NodeType;          // Kind of node
    label: string;           // Human-readable label
    metadata?: NodeMetadata; // Optional annotations
}

type NodeId = string; // e.g., "n0", "n1", "n2"

type NodeType =
    | "initial"      // Entry point
    | "terminal"     // Successful termination
    | "action"       // Communication action
    | "branch"       // Choice point (control splits)
    | "merge"        // Merge point (control joins)
    | "recursive"    // Recursion entry point
```

**Node Semantics:**

1. **Initial**: Single entry point for the protocol
   - No incoming edges
   - Exactly one outgoing edge

2. **Terminal**: Successful end of protocol
   - No outgoing edges
   - May have multiple terminal nodes (different completion paths)

3. **Action**: Represents a communication (message send/receive)
   - Exactly one incoming edge
   - Exactly one outgoing edge
   - Carries message metadata (label, payload, sender, receiver)

4. **Branch**: Choice point where control splits
   - Exactly one incoming edge
   - Multiple outgoing edges (one per alternative)
   - Annotated with decider role

5. **Merge**: Point where alternative paths rejoin
   - Multiple incoming edges
   - Exactly one outgoing edge
   - Ensures all branches converge to a single continuation

6. **Recursive**: Marks a recursion point
   - Target of `continue` edges (back-edges)
   - May have self-loops

---

### Edge Types

```typescript
type CfgEdge = {
    source: NodeId;      // Source node
    target: NodeId;      // Target node
    type: EdgeType;      // Kind of edge
    action?: Action;     // Optional action label
    metadata?: EdgeMetadata;
}

type EdgeType =
    | "sequence"    // Sequential composition (A; B)
    | "message"     // Message transfer
    | "branch"      // Choice alternative
    | "continue"    // Recursion back-edge
    | "epsilon"     // Silent transition (ε)

type Action = MessageAction | ControlAction;

type MessageAction = {
    kind: "message";
    label: MessageLabel;
    payloadTypes: PayloadType[];
    sender: Role;
    receivers: Role[];  // Multiple receivers for multicast
}

type ControlAction = {
    kind: "choice";
    decider: Role;
    branchLabel: string; // Identifier for this branch (e.g., "success", "failure")
}
```

**Edge Semantics:**

1. **Sequence**: Normal flow (`;` in Scribble)
   - No action, just ordering

2. **Message**: Communication action
   - Labeled with message signature (label, types)
   - Specifies sender and receiver(s)

3. **Branch**: Alternative in a choice
   - Labeled with branch identifier
   - Decider role makes the choice

4. **Continue**: Loop back to recursion point
   - Back-edge in the graph
   - Target must be a `recursive` node

5. **Epsilon (ε)**: Silent transition
   - Used for structural purposes (merging branches)
   - No observable action

---

## CFG Construction Rules

### Overview

The CFG is built by **traversing the AST** and applying transformation rules. Each AST node type has a corresponding construction rule.

**General Pattern:**

```
construct(astNode, entryNode) → exitNode
```

Given an AST node and an entry node, produce the exit node after processing the AST node.

---

### Rule 1: Message Transfer

**AST:**
```scribble
msg(Type) from A to B;
```

**CFG Construction:**

```
Input:  entryNode
Output: exitNode

1. Create actionNode with metadata:
   - label: "msg"
   - payloadTypes: [Type]
   - sender: A
   - receivers: [B]

2. Create edge: entryNode --[message]--> actionNode

3. Create exitNode

4. Create edge: actionNode --[sequence]--> exitNode

5. Return exitNode
```

**Graph:**
```
entryNode --[msg(Type) from A to B]--> actionNode --[ε]--> exitNode
```

**Multiple receivers (multicast):**

```scribble
msg(Type) from A to B, C, D;
```

```
entryNode --[msg(Type) from A to {B,C,D}]--> actionNode --[ε]--> exitNode
```

---

### Rule 2: Sequential Composition

**AST:**
```scribble
I1; I2; I3;
```

**CFG Construction:**

```
1. node0 = entryNode
2. node1 = construct(I1, node0)
3. node2 = construct(I2, node1)
4. node3 = construct(I3, node2)
5. Return node3
```

**Graph:**
```
entryNode --> [I1] --> node1 --> [I2] --> node2 --> [I3] --> exitNode
```

---

### Rule 3: Choice

**AST:**
```scribble
choice at R {
    Branch1
} or {
    Branch2
} or {
    Branch3
}
```

**CFG Construction:**

```
Input:  entryNode
Output: exitNode

1. Create branchNode (type: "branch", decider: R)

2. Create edge: entryNode --[ε]--> branchNode

3. For each branch i:
   a. Create branchExit_i = construct(Branch_i, branchNode)
   b. Create edge: branchNode --[branch: "branch_i"]--> (first node of Branch_i)

4. Create mergeNode (type: "merge")

5. For each branchExit_i:
   Create edge: branchExit_i --[ε]--> mergeNode

6. Create exitNode

7. Create edge: mergeNode --[ε]--> exitNode

8. Return exitNode
```

**Graph:**
```
                    ┌--> [Branch1] --> branch1Exit ┐
entryNode --> branchNode ---> [Branch2] --> branch2Exit --> mergeNode --> exitNode
                    └--> [Branch3] --> branch3Exit ┘
```

**Key Point:** All branches **must merge** at a single merge node before continuing. This ensures proper control flow and simplifies verification.

---

### Rule 4: Recursion

**AST:**
```scribble
rec Label {
    Body
}
```

**CFG Construction:**

```
Input:  entryNode
Output: exitNode

1. Create recursiveNode (type: "recursive", label: "Label")

2. Create edge: entryNode --[ε]--> recursiveNode

3. Register recursiveNode in recursion environment: Γ[Label] = recursiveNode

4. bodyExit = construct(Body, recursiveNode, Γ)

5. exitNode = bodyExit  // Exit is the end of the body

6. Return exitNode
```

**Graph:**
```
          ┌---------------------------┐
          |                           |
entryNode --> recursiveNode --> [Body] --> bodyExit
                                           (may contain continue edges back to recursiveNode)
```

---

### Rule 5: Continue

**AST:**
```scribble
continue Label;
```

**CFG Construction:**

```
Input:  entryNode
        Γ (recursion environment, maps Label -> recursiveNode)
Output: exitNode (special: has no outgoing edges in linear flow)

1. Lookup: recursiveNode = Γ[Label]

2. Create edge: entryNode --[continue: "Label"]--> recursiveNode

3. Return entryNode (no new node needed; this is a jump)
```

**Graph:**
```
recursiveNode --[Body]--> ... --[continue Label]--> recursiveNode (back-edge)
```

**Note:** After a `continue`, there is no sequential continuation. If there are subsequent statements after `continue` in a scope, they are **unreachable** (validation error).

---

### Rule 6: Do (Subprotocol Invocation)

**AST:**
```scribble
do SubProtocol(A as X, B as Y);
```

**CFG Construction:**

**Strategy 1: Inline Expansion (Recommended)**

```
Input:  entryNode
Output: exitNode

1. Lookup SubProtocol definition in global environment

2. Create a fresh copy of SubProtocol's CFG (to avoid sharing state)

3. Apply role substitution:
   - Replace all occurrences of X with A
   - Replace all occurrences of Y with B

4. Inline the substituted CFG:
   a. Connect entryNode to SubProtocol's initialNode
   b. Connect SubProtocol's terminalNode to a new exitNode

5. Return exitNode
```

**Graph:**
```
entryNode --> [SubProtocol CFG with roles substituted] --> exitNode
```

**Benefits:**
- Simple to implement
- Preserves all semantic information
- Works naturally with recursion (including mutual recursion)

**Strategy 2: Call/Return Nodes (Alternative)**

```
1. Create callNode with metadata: targetProtocol, roleMapping
2. Create returnNode
3. entryNode --[call]--> callNode --[SubProtocol CFG]--> returnNode --[ε]--> exitNode
```

**We'll use Strategy 1 (inline expansion)** for simplicity and alignment with session types semantics.

---

## Complete CFG Example

### Scribble Protocol

```scribble
global protocol TwoPhaseCommit(role Coordinator, role Participant) {
    prepare(Transaction) from Coordinator to Participant;

    choice at Participant {
        vote_commit(Vote) from Participant to Coordinator;
        commit() from Coordinator to Participant;
    } or {
        vote_abort(Reason) from Participant to Coordinator;
        abort() from Coordinator to Participant;
    }
}
```

### Generated CFG

**Nodes:**
```
n0: initial
n1: action  [prepare(Transaction) from Coordinator to Participant]
n2: branch  [choice at Participant]
n3: action  [vote_commit(Vote) from Participant to Coordinator]
n4: action  [commit() from Coordinator to Participant]
n5: action  [vote_abort(Reason) from Participant to Coordinator]
n6: action  [abort() from Coordinator to Participant]
n7: merge
n8: terminal
```

**Edges:**
```
n0 --[ε]--> n1
n1 --[prepare(Transaction) C→P]--> n2
n2 --[branch: "commit"]--> n3
n3 --[vote_commit(Vote) P→C]--> n4
n4 --[commit() C→P]--> n7
n2 --[branch: "abort"]--> n5
n5 --[vote_abort(Reason) P→C]--> n6
n6 --[abort() C→P]--> n7
n7 --[ε]--> n8
```

**Visualization:**
```
                      ┌--> n3 [vote_commit] --> n4 [commit] ----┐
n0 --> n1 [prepare] --> n2 (branch)                              --> n7 (merge) --> n8
                      └--> n5 [vote_abort] --> n6 [abort] ------┘
```

---

## Local CFSM Projection

### Overview

Given a **Global CFG** and a **role R**, we derive a **Local CFSM** (Communicating Finite State Machine) for R.

**Projection Rule:**
- Keep only actions involving R (as sender or receiver)
- Preserve control flow structure (branches, loops, merges)
- Transform global branching into local send/receive choices

### Local CFSM Structure

```typescript
type LocalCfsm = {
    role: Role;
    nodes: LocalCfsmNode[];
    edges: LocalCfsmEdge[];
    initialNode: NodeId;
    metadata?: CfsmMetadata;
}

type LocalCfsmNode = {
    id: NodeId;
    type: "initial" | "terminal" | "send" | "receive" | "internal_choice" | "external_choice" | "merge";
    label: string;
}

type LocalCfsmEdge = {
    source: NodeId;
    target: NodeId;
    action: LocalAction;
}

type LocalAction =
    | { kind: "send"; label: MessageLabel; payloadTypes: PayloadType[]; to: Role; }
    | { kind: "receive"; label: MessageLabel; payloadTypes: PayloadType[]; from: Role; }
    | { kind: "internal_choice"; branch: string; }  // Choice made by this role
    | { kind: "external_choice"; branch: string; }  // Choice made by another role
    | { kind: "epsilon"; }
```

---

### Projection Rules

**Rule P1: Message Transfer**

Global CFG edge:
```
n1 --[msg(Type) from A to B]--> n2
```

**For role A (sender):**
```
n1 --[send: msg(Type) to B]--> n2
```

**For role B (receiver):**
```
n1 --[receive: msg(Type) from A]--> n2
```

**For role C (uninvolved):**
```
(edge is omitted; nodes n1 and n2 may be merged if this is the only edge between them)
```

---

**Rule P2: Choice (Internal)**

Global CFG:
```
choice at R {
    branch1: ...
} or {
    branch2: ...
}
```

**For role R (decider):**
```
n --[internal_choice: "branch1"]--> ...
n --[internal_choice: "branch2"]--> ...
```

R makes an **internal choice** (sends different initial messages in each branch).

**For other roles:**

If a role S participates in both branches:
```
n --[external_choice: "branch1" (receive from R)]--> ...
n --[external_choice: "branch2" (receive from R)]--> ...
```

S makes an **external choice** (reacts to which message it receives from R).

---

**Rule P3: Recursion**

Global CFG:
```
rec Label {
    ...
}
```

**For all roles:**

Preserve recursion structure:
```
recursiveNode --> [body] --> ... --[continue Label]--> recursiveNode
```

Recursion labels are **role-agnostic** (same label for all).

---

### Projection Example

**Global Protocol:**
```scribble
global protocol SimpleChoice(role Client, role Server) {
    request(Query) from Client to Server;
    choice at Server {
        success(Data) from Server to Client;
    } or {
        failure(Error) from Server to Client;
    }
}
```

**Global CFG:**
```
n0 --> n1 [request C→S] --> n2 (branch at Server)
                             ├--> n3 [success S→C] --> n5 (merge)
                             └--> n4 [failure S→C] --> n5 (merge)
n5 --> n6 (terminal)
```

**Projection for Client:**
```
n0 --> n1 [send: request to Server]
   --> n2 (external choice from Server)
       ├--> n3 [receive: success from Server] --> n5
       └--> n4 [receive: failure from Server] --> n5
   --> n6 (terminal)
```

**Projection for Server:**
```
n0 --> n1 [receive: request from Client]
   --> n2 (internal choice)
       ├--> n3 [send: success to Client] --> n5
       └--> n4 [send: failure to Client] --> n5
   --> n6 (terminal)
```

---

## Verification on CFG

### Properties to Check

1. **Deadlock Freedom**
   - No state where some roles wait forever
   - Formal: No reachable node with outgoing edges in some local CFSMs but not others

2. **Liveness**
   - Every reachable state has at least one outgoing transition
   - Formal: ∀ reachable n, ∃ outgoing edge

3. **Progress**
   - Every execution eventually reaches a terminal state
   - Formal: No infinite loops without reaching terminal

4. **Determinism**
   - External choices are distinguishable by message labels
   - Formal: For external choice nodes, all incoming messages have distinct labels

5. **Well-formedness**
   - All roles in messages are declared
   - All recursion labels have matching definitions
   - Branches in choices are consistent

---

### Deadlock Detection Algorithm

**Intuition:** Check if any state is reachable where roles are waiting for each other in a cycle.

**Algorithm:**

```
1. Construct global CFG
2. Project to local CFSMs for each role
3. Build product automaton (interleaving of all CFSMs)
4. Check for stuck states:
   - States where some roles have outgoing edges (waiting to act)
   - But no global transition is possible (all waiting for each other)
```

**Example of Deadlock:**
```scribble
global protocol Deadlock(role A, role B) {
    // A waits for B, B waits for A -> deadlock!
    msg1(Data) from B to A;
    msg2(Data) from A to B;
}
```

**Textbook algorithm:** Reachability analysis on product automaton (see Honda et al., POPL 2008).

---

### Liveness Checking

**Algorithm:**

```
For each node n in CFG:
    if n is not terminal and has no outgoing edges:
        Report liveness violation at n
```

**Example of Liveness Violation:**
```scribble
global protocol LivenessError(role A, role B) {
    msg(Data) from A to B;
    // Missing continuation! Protocol stuck here.
}
```

---

## CFG Visualization

### Format for UI

The CFG should be visualized as a **directed graph** with:

- **Nodes**: Circles/boxes with labels
  - Color-coded by type:
    - Initial: Green
    - Terminal: Red
    - Action: Blue
    - Branch: Orange
    - Merge: Yellow
    - Recursive: Purple

- **Edges**: Arrows with labels
  - Label format: `msg(Type) from A to B`
  - Back-edges (continue): Dashed arrows

- **Layout**: Force-directed or hierarchical (top-to-bottom)

---

## TypeScript Type Definitions

```typescript
// --- CFG Nodes ---

export type NodeId = string;

export interface CfgNode {
    id: NodeId;
    type: NodeType;
    label: string;
    metadata?: NodeMetadata;
}

export type NodeType = "initial" | "terminal" | "action" | "branch" | "merge" | "recursive";

export interface NodeMetadata {
    sourceLocation?: SourceLocation;  // Line/column in source
    [key: string]: any;               // Extensible
}

// --- CFG Edges ---

export interface CfgEdge {
    source: NodeId;
    target: NodeId;
    type: EdgeType;
    action?: Action;
    metadata?: EdgeMetadata;
}

export type EdgeType = "sequence" | "message" | "branch" | "continue" | "epsilon";

export type Action = MessageAction | ControlAction;

export interface MessageAction {
    kind: "message";
    label: MessageLabel;
    payloadTypes: PayloadType[];
    sender: Role;
    receivers: Role[];
}

export interface ControlAction {
    kind: "choice";
    decider: Role;
    branchLabel: string;
}

export interface EdgeMetadata {
    [key: string]: any;
}

// --- Global CFG ---

export interface GlobalCfg {
    protocolName: string;
    roles: Role[];
    nodes: CfgNode[];
    edges: CfgEdge[];
    initialNode: NodeId;
    terminalNodes: NodeId[];
    metadata?: CfgMetadata;
}

export interface CfgMetadata {
    imports?: ImportDeclaration[];
    [key: string]: any;
}

// --- Local CFSM ---

export interface LocalCfsm {
    protocolName: string;
    role: Role;
    nodes: LocalCfsmNode[];
    edges: LocalCfsmEdge[];
    initialNode: NodeId;
    terminalNodes: NodeId[];
}

export interface LocalCfsmNode {
    id: NodeId;
    type: LocalNodeType;
    label: string;
}

export type LocalNodeType = "initial" | "terminal" | "send" | "receive" | "internal_choice" | "external_choice" | "merge";

export interface LocalCfsmEdge {
    source: NodeId;
    target: NodeId;
    action: LocalAction;
}

export type LocalAction = SendAction | ReceiveAction | ChoiceAction | EpsilonAction;

export interface SendAction {
    kind: "send";
    label: MessageLabel;
    payloadTypes: PayloadType[];
    to: Role;
}

export interface ReceiveAction {
    kind: "receive";
    label: MessageLabel;
    payloadTypes: PayloadType[];
    from: Role;
}

export interface ChoiceAction {
    kind: "internal_choice" | "external_choice";
    branch: string;
}

export interface EpsilonAction {
    kind: "epsilon";
}

// --- Common Types ---

export type Role = string;
export type MessageLabel = string;
export type PayloadType = string;  // Can be extended to support generics

export interface SourceLocation {
    line: number;
    column: number;
}

export interface ImportDeclaration {
    typeSystem?: string;
    qualifiedName: string;
    alias?: string;
}
```

---

## Implementation Roadmap

### Phase 1: Core CFG Builder

**Task**: Implement AST → CFG transformation for basic constructs

**Components:**
- `CfgBuilder` class
- Rules for: message, sequence, choice, recursion, continue

**Tests**: Unit tests for each transformation rule

---

### Phase 2: Do Statement Support

**Task**: Add subprotocol invocation with role substitution

**Components:**
- Protocol environment (lookup table)
- Role substitution function
- CFG inlining logic

**Tests**: Nested protocol examples, mutual recursion

---

### Phase 3: Local Projection

**Task**: Implement CFG → Local CFSM projection

**Components:**
- `CfgProjector` class
- Rules for: send/receive, internal/external choice

**Tests**: Projection examples from literature

---

### Phase 4: Verification

**Task**: Implement deadlock, liveness, determinism checks

**Components:**
- `CfgVerifier` class
- Reachability analysis
- Product automaton construction (for deadlock)

**Tests**: Positive and negative examples

---

## References

1. **Honda, Yoshida, Carbone**: "Multiparty Asynchronous Session Types" (POPL 2008)
   - Original MPST paper with projection and verification algorithms

2. **Yoshida, Hu et al.**: "The Scribble Protocol Language" (TGC 2013)
   - Scribble language specification

3. **Scalas, Yoshida**: "Linear Session Types: A Survey" (CSUR 2019)
   - Comprehensive tutorial on session types

4. **Deniélou, Yoshida**: "Multiparty Session Types Meet Communicating Automata" (ESOP 2012)
   - CFG/CFSM approach to verification

---

## Next Steps

With the CFG design in place, we can now:

1. **Design the AST** (`ast-design.md`) - Concrete types matching the Scribble 2.0 grammar
2. **Implement the parser** - Tokenizer, parser, validator
3. **Implement CFG builder** - AST → CFG transformation
4. **Test thoroughly** - Comprehensive test suite for correctness

See `ast-design.md` for AST structure specification.
