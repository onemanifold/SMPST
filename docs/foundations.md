# Formal Foundations of Multiparty Session Types

This document establishes the formal foundations necessary to understand the SMPST IDE implementation. It synthesizes theory from session types literature with practical considerations for tool implementation.

## 1. Session Types in a Nutshell

### The Problem

**Distributed systems are hard to get right:**
- Communication errors (wrong message, wrong order)
- Deadlocks (processes waiting for each other)
- Protocol mismatches (client expects X, server sends Y)
- Race conditions (concurrent access to shared resources)

**Traditional approaches:**
- Testing catches bugs late
- Runtime errors in production
- No static guarantees

### The Solution: Session Types

**Session types** provide **compile-time guarantees** for communication correctness:

- **Type safety**: Can't send wrong message type
- **Deadlock freedom**: Guaranteed no circular waits
- **Protocol conformance**: Implementation matches specification
- **Progress**: Protocols can always advance

**Key insight**: Treat communication protocols as **types**, checked statically.

### History

1. **Binary Session Types** (Honda 1993, Honda et al. 1998)
   - Two-party protocols
   - Linear types ensure channels used exactly once

2. **Multiparty Session Types (MPST)** (Honda et al. 2008)
   - N-party protocols
   - Global protocol + projection to local types
   - This is what we implement

---

## 2. Labeled Transition Systems (LTS)

### Definition

A **Labeled Transition System** is a tuple `(S, Act, →, s₀)` where:
- `S` is a set of states
- `Act` is a set of actions (labels)
- `→ ⊆ S × Act × S` is the transition relation
- `s₀ ∈ S` is the initial state

**Notation**: `s --[α]--> s'` means "from state s, perform action α, reach state s'"

### Actions in Session Types

**Communication actions**:
- `A!B⟨ℓ⟩`: Role A sends message ℓ to role B
- `A?B⟨ℓ⟩`: Role A receives message ℓ from role B

**Internal actions**:
- `τ` (tau): Silent transition (internal choice, structural move)

**Example**:
```
s0 --[Client!Server⟨Request⟩]--> s1 --[Server!Client⟨Response⟩]--> s2
```

### Why LTS?

1. **Standard semantics**: Well-understood theory for concurrent systems
2. **Actions on transitions**: Captures that communication happens during state changes
3. **Verification algorithms**: Reachability, bisimulation, model checking
4. **Formal rigor**: Precise operational semantics

**Critical point**: In LTS, **actions live on transitions (edges)**, not on states (nodes).

---

## 3. Multiparty Session Types (MPST)

### Overview

MPST extends binary session types to N participants:

**Global type (G)**: Choreography view
- Specifies protocol from neutral viewpoint
- Shows all participants' interactions

**Local type (T)**: Participant view
- Specifies what ONE role does
- Derived from global type via **projection**

**Endpoint implementation**: Code that implements local type

### Global Types (Syntax)

```
G ::= A → B: ⟨ℓ(T)⟩.G           (message transfer)
    | A → {B₁, ..., Bₙ}: ⟨ℓ(T)⟩.G  (multicast)
    | choice at A {              (choice)
        B₁ → C₁: ⟨ℓ₁⟩.G₁
      } or {
        B₂ → C₂: ⟨ℓ₂⟩.G₂
      }
    | G₁ | G₂                    (parallel composition)
    | μX.G                        (recursion)
    | X                           (recursion variable)
    | end                         (termination)
```

**Semantics**:
- **Sequence**: `A → B: ⟨msg⟩.G` means A sends msg to B, then continue as G
- **Choice**: One branch is selected (non-deterministically or by decider)
- **Parallel**: Both branches execute concurrently (interleaving)
- **Recursion**: `μX.G` binds variable X in G, allowing loops

### Local Types (Syntax)

```
T ::= B!⟨ℓ(T)⟩.T     (send to B)
    | B?⟨ℓ(T)⟩.T     (receive from B)
    | B ⊕ {           (internal choice - I decide)
        ℓ₁: T₁
      ⊕ ℓ₂: T₂
      }
    | B & {           (external choice - B decides)
        ℓ₁: T₁
      & ℓ₂: T₂
      }
    | T₁ | T₂         (parallel)
    | μX.T            (recursion)
    | X               (recursion variable)
    | end             (termination)
```

**Key distinction**:
- **Internal choice (⊕)**: This role decides which branch
- **External choice (&)**: Other role decides, we react

### Projection (G ↾ A)

**Definition**: Extract role A's view from global type G

**Rules**:

1. **Message involving A**:
   ```
   (A → B: ⟨ℓ⟩.G) ↾ A = B!⟨ℓ⟩.(G ↾ A)   (A is sender)
   (A → B: ⟨ℓ⟩.G) ↾ B = A?⟨ℓ⟩.(G ↾ A)   (B is receiver)
   (A → B: ⟨ℓ⟩.G) ↾ C = G ↾ C           (C uninvolved)
   ```

2. **Choice**:
   ```
   (choice at A { ℓ₁: G₁ } or { ℓ₂: G₂ }) ↾ A = ⊕ { ℓ₁: (G₁ ↾ A), ℓ₂: (G₂ ↾ A) }
   (choice at A { ℓ₁: G₁ } or { ℓ₂: G₂ }) ↾ B = & { ℓ₁: (G₁ ↾ B), ℓ₂: (G₂ ↾ B) }
   ```
   (A makes internal choice, others make external choice)

3. **Parallel**: Project each branch, keep parallel structure

4. **Recursion**: Preserve recursion structure

### Well-Formedness

**A global type G is well-formed if:**

1. **Connectedness**: All declared roles appear in G
2. **Determinism**: External choices have distinguishable message labels
3. **No races**: Parallel branches don't conflict on same channel
4. **Progress**: No deadlocks in any execution

**These properties are CHECKED, not assumed**. Verification algorithms ensure well-formedness.

---

## 4. Scribble Language

### Overview

**Scribble** is a practical language for specifying MPST:
- Concrete syntax for global and local protocols
- Tool support (parser, projection, code generation)
- Based on formal MPST theory

**Version**: We follow **Scribble Language Reference v0.3** (January 2013)

**Specification**: http://www.doc.ic.ac.uk/~rhu/scribble/langref.html

### Core Constructs

#### 1. Message Transfer

**Syntax**:
```scribble
msg(PayloadType) from Sender to Receiver;
```

**Semantics**: Asynchronous send/receive
- Sender continues immediately (non-blocking)
- Receiver must eventually receive (guaranteed delivery)

#### 2. Choice

**Syntax**:
```scribble
choice at Decider {
  msg1() from Decider to Other;
  ...
} or {
  msg2() from Decider to Other;
  ...
}
```

**Semantics**: Decider selects one branch
- Other roles react based on which message received
- External choice for non-decider roles

#### 3. Parallel Composition

**Syntax**:
```scribble
par {
  Branch1
} and {
  Branch2
} and {
  Branch3
}
```

**Semantics**: All branches execute concurrently
- Actions can interleave in any order
- Synchronization at end (join point)

#### 4. Recursion

**Syntax**:
```scribble
rec Label {
  Body
}
```

**Semantics**: Marks recursion point named Label

#### 5. Continue

**Syntax**:
```scribble
continue Label;
```

**Semantics**: Jump back to recursion point Label

### Recursion Semantics (Critical)

This is the most important semantic detail for our implementation.

**From Scribble Language Reference v0.3, Section 3.5.5:**

> "A recursion point is specified by the keyword `rec` and an identifier label for this point. Within the following global interaction block, the keyword `continue` followed by a recursion point identifier **specifies** that the control flow of the protocol should return to that point."

**From Section 4.1.4 (Well-Formedness):**

> "A `global-continue`, of the form `continue label`, **should only appear** in a `global-recursion` block introduced by `rec label`."

**Key interpretations**:

1. **`continue` is EXPLICIT**: You must write it to loop back
2. **`continue` is OPTIONAL**: Not all paths need it
3. **Without `continue`**: Control flow proceeds forward (exits rec block)

**Example**:

```scribble
rec Loop {
  choice at Server {
    Data() from Server to Client;
    continue Loop;  // ← Explicit loop back
  } or {
    End() from Server to Client;
    // ← No continue: exits rec block
  }
}
Next() from A to B;  // ← Executed after End branch
```

**Common misunderstanding**: Thinking `continue` is implicit (all paths loop).

**Correct understanding**: Only explicit `continue` statements create back-edges.

### Parallel Composition Well-Formedness

**From Section 4.1.3:**

> "There should not be any `global-continue` in any of the blocki, unless the `global-recursion` is also defined in the same block blocki."

**Interpretation**: Recursion cannot span across parallel branches (must be scoped within one branch).

**From Section 4.1.3 (Linearity):**

> "If, in blocki, there is a message with label `msg` sent by A to B, then such a message cannot appear in any other blockj."

**Interpretation**: No duplicate messages on same channel in parallel branches (prevents races).

---

## 5. Control Flow Graphs (CFG)

### Why CFG for Session Types?

**Literature approach** (Honda et al., Yoshida et al., Deniélou & Yoshida):

1. Parse source → AST (syntax)
2. **Transform to CFG** (semantics)
3. Project to local CFSMs (per-role state machines)
4. Verify properties on CFG/CFSM
5. Generate code from CFSM

**Why CFG?**

- **Explicit control flow**: Shows all possible execution paths
- **Verification target**: Graph algorithms for deadlock, liveness
- **Simulation guide**: Walk the graph to execute protocol
- **Projection source**: Extract per-role CFSMs

### CFG vs LTS: Reconciliation

**Question**: Session types are defined via LTS (actions on transitions/edges). Our CFG has actions on nodes. Are these compatible?

**Answer** (Deniélou & Yoshida, ESOP 2012): **YES**, via a formal mapping.

**LTS representation**:
```
s0 --[A!B⟨msg⟩]--> s1 --[B!C⟨ack⟩]--> s2
```

**CFG representation** (our approach):
```
s0 --[sequence]--> n0:action[A→B:msg] --[sequence]--> s1 --[sequence]--> n1:action[B→C:ack] --[sequence]--> s2
```

**Mapping**:
- CFG action node `n:action[A→B:msg]` = LTS state AFTER transition `A!B⟨msg⟩`
- CFG sequence edge = structural connection (ordering)
- Each action node **encodes** the LTS transition that produced it

**Equivalence**: The two representations have the same semantics.

**Why we chose node-labeled CFG**:

1. **Visualization**: Action nodes are natural breakpoints
2. **Instrumentation**: Attach trace data, breakpoints to nodes
3. **Simulation**: Stop at action nodes for interactive stepping
4. **Implementation**: Easier to implement state machine executor

### CFG Node Types

Our CFG has these node types:

- **initial**: Entry point
- **terminal**: Successful completion
- **action**: Communication action (message send/receive)
- **branch**: Choice point (control splits, one branch selected)
- **merge**: Merge point (control joins from choice)
- **fork**: Parallel fork (concurrent branches start)
- **join**: Parallel join (synchronization barrier)
- **recursive**: Recursion point (target of continue edges)

### CFG Edge Types

- **sequence**: Normal control flow (A; B means A then B)
- **branch**: Choice alternative (from branch node to choice body)
- **fork**: Parallel branch (from fork node to parallel body)
- **continue**: Back-edge to recursive node (loops)

**Note**: We do NOT use "epsilon" edges. All structural transitions use `sequence` edges.

---

## 6. References

### Session Types Foundations

1. **Honda, Vasconcelos, Kubo (1998)**: "Language Primitives and Type Discipline for Structured Communication-Based Programming"
   - Original binary session types

2. **Honda, Yoshida, Carbone (2008)**: "Multiparty Asynchronous Session Types", POPL
   - MPST formalization
   - Projection and verification algorithms

3. **Deniélou, Yoshida (2012)**: "Multiparty Session Types Meet Communicating Automata", ESOP
   - CFG/CFSM approach to MPST
   - **Key contribution**: Node-labeled CFG equivalent to edge-labeled LTS

4. **Scalas, Yoshida (2019)**: "Linear Session Types: A Survey", CSUR
   - Comprehensive tutorial

### Scribble Language

5. **Yoshida, Hu et al. (2013)**: "The Scribble Protocol Language", TGC
   - Scribble language specification

6. **Scribble Language Reference v0.3** (2013)
   - Official specification
   - URL: http://www.doc.ic.ac.uk/~rhu/scribble/langref.html
   - **Critical resource**: Defines formal syntax and semantics

---

## 7. Key Takeaways for Implementation

### From Session Types Theory

1. **Actions on transitions**: LTS semantics standard, well-understood
2. **CFG reconciliation**: Node-labeled CFG is equivalent, easier to implement
3. **Projection is compositional**: Local types derived systematically
4. **Verification via reachability**: Deadlock detection uses graph algorithms

### From Scribble Specification

1. **`continue` is explicit**: Paths without it exit the rec block
2. **Recursion is scoped**: Cannot span across parallel branches
3. **Linearity in parallel**: No duplicate messages on same channel
4. **Asynchronous semantics**: Send is non-blocking, receive blocks until message arrives

### Implementation Principles

1. **Follow the spec exactly**: Don't add implicit semantics
2. **Keep it simple**: Complex heuristics indicate wrong model
3. **Test exhaustively**: Use known-good and known-bad protocols
4. **Cite sources**: Link design decisions to authoritative references

---

## Summary

This document establishes:

1. **MPST theory**: Global types, local types, projection
2. **LTS semantics**: Actions on transitions, standard operational semantics
3. **Scribble language**: Practical syntax with formal semantics
4. **Critical insight**: Recursion requires explicit `continue` to loop
5. **CFG approach**: Node-labeled CFG equivalent to edge-labeled LTS

With these foundations, we can now:
- Parse Scribble protocols correctly
- Build CFGs with correct semantics
- Verify protocols for safety properties
- Simulate execution interactively
- Project to local CFSMs for implementation
