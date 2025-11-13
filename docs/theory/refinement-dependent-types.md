# Refinement Types & Context-Dependent Branching - Formal Theory

**Date**: 2025-11-13
**Source**: Castro et al. (2016), Cavoj et al. (2024)
**Application**: TCP Sequence Number Validation, Context-Dependent Routing
**Status**: Theory documentation - Not Implemented

---

## Table of Contents

1. [Overview](#1-overview)
2. [Refinement Types](#2-refinement-types)
3. [Context-Dependent Branching](#3-context-dependent-branching)
4. [Dependent Session Types](#4-dependent-session-types)
5. [TCP Use Case](#5-tcp-use-case)
6. [Implementation Considerations](#6-implementation-considerations)
7. [References](#7-references)

---

## 1. Overview

### Motivation

**Problem**: Traditional session types only specify **message labels**, not **message content**.

**Example - TCP ACK**:
```scribble
protocol TCP(role Client, role Server) {
  Client -> Server: Ack();  // Which ACK? Acceptable or not?
}
```

**Issue**:
- TCP has "acceptable" ACKs (correct sequence number) and "unacceptable" ACKs
- Same message label `Ack` routes to **different branches** based on **content**
- Session types cannot distinguish based on content

**Traditional Solution**: Different message labels
```scribble
Client -> Server: AcceptableAck();
Client -> Server: UnacceptableAck();
```

**Problem with This**:
- Sender decides which branch (internal choice)
- But **receiver** should decide based on **validation**
- Violates protocol semantics

**Desired Solution**: **Refinement Types** + **Context-Dependent Branching**
```scribble
Client -> Server: Ack{seq: n};  // ACK with sequence number n

choice at Server {
  accept Ack if (n == expected);  // Predicate-based routing
} or {
  reject Ack if (n != expected);
}
```

---

## 2. Refinement Types

### 2.1 Definition

**Refinement type** = Base type + Predicate

**Syntax**:
```
τ{x | φ(x)}
```

Where:
- $$\tau$$: Base type (e.g., `Int`, `String`, `Message`)
- $$x$$: Variable name
- $$\varphi(x)$$: Predicate (boolean expression over $$x$$)

**Examples**:
```typescript
// Non-negative integers
Int{n | n >= 0}

// Non-empty strings
String{s | length(s) > 0}

// TCP ACK with valid sequence
Ack{seq | seq > 0 && seq <= maxSeq}

// HTTP 2xx responses
HttpResponse{status | 200 <= status && status < 300}
```

### 2.2 Subtyping for Refinements

**Rule**:
$$
\frac{
  \varphi_1 \implies \varphi_2
}{
  \tau\\{x \mid \varphi_1(x)\\} <: \tau\\{x \mid \varphi_2(x)\\}
}
$$

**Meaning**: If predicate $$\varphi_1$$ is **stronger** (more restrictive) than $$\varphi_2$$, then it's a subtype.

**Examples**:
```typescript
// Positive integers are a subtype of non-negative
Int{n | n > 0} <: Int{n | n >= 0}

// Valid TCP sequences are subtype of all integers
Ack{seq | seq > 0 && seq <= maxSeq} <: Ack{seq | true}
```

### 2.3 Message Types with Refinements

**Syntax Extension**:
```scribble
protocol Example(role A, role B) {
  A -> B: Msg(Int{n | n > 0});  // Only positive integers allowed
}
```

**Typing Rule**:
$$
\frac{
  \Gamma \vdash e : \tau \quad \Gamma \vdash \varphi(e)
}{
  \Gamma \vdash \text{send}(p, \ell(e)) : p!\langle\ell(\tau\\{x \mid \varphi(x)\\})\rangle.T
}
$$

**Meaning**:
- Expression $$e$$ has type $$\tau$$
- Expression $$e$$ satisfies predicate $$\varphi$$
- Can send $$e$$ as message $$\ell$$

---

## 3. Context-Dependent Branching

### 3.1 Problem Statement

**Traditional Session Types**:
```scribble
choice at Server {
  Server -> Client: Response1();  // Server decides
} or {
  Server -> Client: Response2();
}
```

**Branch selection** based on:
- **Internal choice** (⊕): Sender decides
- **External choice** (&): Receiver reacts to sender's decision

**Limitation**: Cannot branch based on **received message content** + **external state**.

**TCP Example**:
```rust
// Receive ACK from network
let ack = receive_ack();

// Decision based on BOTH:
// 1. ACK content (sequence number)
// 2. External state (expected sequence)
if tcp_state.is_acceptable(&ack) {
    // Branch 1: Acceptable
} else {
    // Branch 2: Unacceptable
}
```

**Session Type Cannot Express This**:
- Decision not purely based on message label
- Requires access to `tcp_state` (external to session type)
- Same message label `Ack` → different branches

### 3.2 Solution: Picker Functions

**From Cavoj et al. (2024) TCP Paper**:

```rust
// Picker function: decides branch based on message + state
fn picker(packet: Packet, tcp_state: &TcpState) -> Branch {
    if tcp_state.is_acceptable(&packet) {
        Branch::Left(packet)   // Acceptable
    } else {
        Branch::Right(packet)  // Unacceptable
    }
}

// Session type includes picker
channel.offer_two_filtered(
    session_type,
    picker,
    &tcp_state  // External state passed to picker
);
```

**Key Insight**: Session types specify **structure**, picker provides **decision logic**.

### 3.3 Formal Model

**Extended Choice Syntax**:
```
T ::= ...
    | p & {ℓ₁: T₁, ..., ℓₙ: Tₙ}[picker]
```

Where `[picker]` is an optional **decision function**:
$$
\text{picker} : (\text{Message}, \text{State}) \to \\{1, \ldots, n\\}
$$

**Typing Rule**:
$$
\frac{
  \Gamma \vdash \text{picker} : (\text{Msg}, \Sigma) \to \text{Branch} \quad
  \forall i: \Gamma, \Sigma \vdash T_i
}{
  \Gamma, \Sigma \vdash p \& \\{\ell_i: T_i\\}[\text{picker}]
}
$$

**Meaning**:
- Picker function is well-typed
- Has access to session state $$\Sigma$$
- All continuations $$T_i$$ type-check with state

---

## 4. Dependent Session Types

### 4.1 Overview

**Dependent types** allow types to **depend on values**.

**Example** (non-session):
```typescript
// Vector of length n
Vector(n: Nat): Type

// Dependent function type
function replicate<n: Nat>(x: Int): Vector(n)
```

**Session Type Extension**:
```scribble
// Session type depends on sequence number
protocol TcpData(seq: Nat) {
  Client -> Server: Data(seq);
  Server -> Client: Ack(seq + 1);  // Next expected sequence
}
```

### 4.2 Dependent Message Types

**Syntax**:
$$
p!\langle\ell(x: \tau).T(x)\rangle
$$

**Meaning**:
- Send message $$\ell$$ with value $$x$$ of type $$\tau$$
- Continuation $$T$$ **depends on** value $$x$$

**Example** (TCP):
```scribble
protocol TcpSend(role Client, role Server) {
  Client -> Server: Data(seq: Nat);
  Server -> Client: Ack(ack: Nat){ack == seq + 1};  // Dependent constraint
}
```

**Verification**: Static checker ensures `ack == seq + 1` always holds.

### 4.3 Dependent Choice

**Syntax**:
```scribble
protocol DependentChoice(n: Nat) {
  choice at A {
    A -> B: Branch1() if (n > 10);
  } or {
    A -> B: Branch2() if (n <= 10);
  }
}
```

**Verification**:
- Predicates are **exhaustive** (cover all cases)
- Predicates are **mutually exclusive** (no overlap)

**SMT Solver** can verify:
$$
(n > 10) \lor (n \leq 10) = \text{true} \quad \text{(exhaustive)}
$$
$$
(n > 10) \land (n \leq 10) = \text{false} \quad \text{(exclusive)}
$$

---

## 5. TCP Use Case

### 5.1 Acceptable vs Unacceptable ACK

**TCP Spec** (RFC 9293):
- ACK is **acceptable** if sequence number is within receive window
- ACK is **unacceptable** otherwise

**Without Refinement Types**:
```rust
// Receive ACK (type checker can't help)
let ack = receive::<Ack>();

// Runtime check (not verified by types)
if tcp_state.is_acceptable(&ack) {
    process_acceptable_ack(ack);
} else {
    send_response_ack();
}
```

**With Refinement Types + Picker**:
```scribble
protocol TcpAckHandling(role Server, role Client) {
  rec WaitAck {
    choice at Client {
      Client -> Server: Ack{seq | isAcceptable(seq, server.window)};
      // Process acceptable ACK
      continue WaitAck;
    } or {
      Client -> Server: Ack{seq | !isAcceptable(seq, server.window)};
      // Send response ACK
      Server -> Client: Ack();
      continue WaitAck;
    }
  }
}
```

**Benefits**:
- Type system enforces correct handling of acceptable/unacceptable cases
- Picker function bridges runtime validation and compile-time types
- Clear protocol specification

### 5.2 TCP Three-Way Handshake with Refinements

**With Sequence Number Validation**:
```scribble
protocol TcpHandshake(role Server, role Client) {
  Client -> Server: Syn(seq: Nat);
  Server -> Client: SynAck(ack: Nat, seq: Nat){ack == client_seq + 1};

  choice at Server {
    Client -> Server: Ack{ack == server_seq + 1};  // Acceptable
    // Connection established
  } or {
    Client -> Server: Ack{ack != server_seq + 1};  // Unacceptable
    choice at Server {
      Server -> Client: Ack();  // Retry
    } or {
      Server -> Client: Rst();  // Reset
    }
  }
}
```

**Static Verification**:
- Ensures server validates ACK before establishing connection
- Catches bugs where unacceptable ACK is processed as acceptable

---

## 6. Implementation Considerations

### 6.1 Architecture

```typescript
interface RefinementType {
  baseType: Type;
  predicate: Predicate;
}

interface Predicate {
  variables: string[];
  expression: BooleanExpr;

  // Evaluate predicate with given values
  evaluate(values: Map<string, any>): boolean;
}

interface PickerFunction {
  // External state this picker depends on
  dependencies: StateDependency[];

  // Decision logic
  pick(message: Message, state: any): number;  // Branch index
}
```

### 6.2 Parser Extension

**Refinement Type Syntax**:
```scribble
// Message with refined parameter
A -> B: Msg(Int{n | n > 0});

// Choice with predicates
choice at A {
  A -> B: Msg1() if (condition1);
} or {
  A -> B: Msg2() if (condition2);
}
```

**Parser Changes**:
1. Extend message syntax to allow `Type{var | pred}`
2. Add `if (predicate)` to choice branches
3. Parse predicates as boolean expressions

### 6.3 Verification Strategy

**Static Checking** (when possible):
```typescript
function verifyRefinement(refinement: RefinementType): CheckResult {
  // Use SMT solver (Z3, CVC5) to check:
  // 1. Predicate is satisfiable
  // 2. All branches exhaustive
  // 3. No branch overlap

  return smtSolver.check(refinement.predicate);
}
```

**Runtime Checking** (fallback):
```typescript
function enforceRefinement(value: any, refinement: RefinementType): void {
  if (!refinement.predicate.evaluate({[refinement.variable]: value})) {
    throw new RefinementViolation(`Value ${value} doesn't satisfy predicate`);
  }
}
```

### 6.4 Testing Strategy

```typescript
describe('Refinement Types', () => {
  it('should accept values satisfying predicate', () => {
    const refinement = parseRefinement("Int{n | n > 0}");
    expect(refinement.check(5)).toBe(true);
    expect(refinement.check(-3)).toBe(false);
  });

  it('should verify predicate exhaustiveness', () => {
    const choice = parseChoice(`
      choice at A {
        A -> B: M1() if (n > 10);
      } or {
        A -> B: M2() if (n <= 10);
      }
    `);

    expect(verifyExhaustive(choice.predicates)).toBe(true);
  });

  it('should detect predicate overlap', () => {
    const choice = parseChoice(`
      choice at A {
        A -> B: M1() if (n >= 0);
      } or {
        A -> B: M2() if (n > 0);  // Overlaps with M1!
      }
    `);

    expect(verifyDisjoint(choice.predicates)).toBe(false);
  });
});

describe('Context-Dependent Branching', () => {
  it('should route based on picker function', () => {
    const tcpState = { expectedSeq: 100 };

    const picker = (msg: Ack, state: TcpState) => {
      return msg.seq === state.expectedSeq ? 0 : 1;  // Branch 0 or 1
    };

    expect(picker({seq: 100}, tcpState)).toBe(0);  // Acceptable
    expect(picker({seq: 99}, tcpState)).toBe(1);   // Unacceptable
  });
});
```

---

## 7. References

### Primary Papers

**Castro et al. (2016)**:
- **Title**: "Parameterised Multiparty Session Types"
- **Published**: LMCS 2016
- **URL**: https://lmcs.episciences.org/924
- **Key Contributions**:
  - Dependent session types formalization (§3)
  - Index-based refinement types (§4)
  - Verification via dependent type theory (§5)

**Cavoj et al. (2024)**:
- **Title**: "Session Types for the Transport Layer: Towards an Implementation of TCP"
- **Source**: arXiv:2404.05478v1
- **URL**: https://arxiv.org/abs/2404.05478
- **Key Contributions**:
  - Picker functions for context-dependent branching (§4.4)
  - TCP sequence number validation example (§4.5, §A.1)
  - Integration with external state (§4.4)

### Refinement Types Background

**Freeman & Pfenning (1991)**: "Refinement Types for ML"
- Original refinement types (non-session)

**Rondon et al. (2008)**: "Liquid Types"
- Practical refinement type system with inference

---

## 8. Comparison Table

| Feature | Traditional Session Types | With Refinement Types |
|---------|--------------------------|----------------------|
| **Message Constraints** | Label only | Label + Predicate |
| **Branching** | By label | By label + content + state |
| **Type Safety** | Message type | Message type + constraints |
| **Verification** | Structure only | Structure + semantics |
| **Expressiveness** | Limited | High |
| **Complexity** | Low | Medium-High (SMT) |
| **TCP Suitability** | Poor (can't validate seq) | Excellent (validates seq) |

---

## 9. Future Work for SMPST

### Implementation Roadmap

**Phase 1**: Basic Refinement Types (Weeks 1-2)
- Parse refinement syntax: `Type{var | pred}`
- Represent predicates as AST
- Runtime predicate checking

**Phase 2**: Static Verification (Weeks 3-4)
- Integrate SMT solver (Z3 via WASM)
- Verify predicate satisfiability
- Check exhaustiveness/disjointness

**Phase 3**: Context-Dependent Branching (Weeks 5-6)
- Extend offer/select with picker functions
- Pass external state to pickers
- Visualize decision logic

**Phase 4**: TCP Example (Weeks 7-8)
- Implement TCP with refinements
- Sequence number validation
- Acceptable/unacceptable ACK handling

---

**Document Status**: Complete
**Last Updated**: 2025-11-13
**Implementation Priority**: 🟠 **HIGH** (needed for TCP sequence validation)
**Estimated Effort**: 6-8 weeks
