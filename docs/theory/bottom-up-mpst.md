# Bottom-Up Multiparty Session Types - Formal Theory

**Date**: 2025-11-13
**Source**: Scalas & Yoshida (2019) "Less is More: Multiparty Session Types Revisited"
**Application**: TCP Protocol Implementation (Cavoj et al. 2024)
**Status**: Theory documentation - Not Implemented

---

## Table of Contents

1. [Overview](#1-overview)
2. [Top-Down vs Bottom-Up](#2-top-down-vs-bottom-up)
3. [Formal Definitions](#3-formal-definitions)
4. [Compatibility Checking](#4-compatibility-checking)
5. [Safety Invariants](#5-safety-invariants)
6. [TCP Implementation Use Case](#6-tcp-implementation-use-case)
7. [Implementation Considerations](#7-implementation-considerations)
8. [References](#8-references)

---

## 1. Overview

### Motivation

**Traditional MPST (Top-Down)**:
- Starts with **global type** (choreography)
- **Projects** to local types per role
- Checks **duality** between roles
- Global view required upfront

**Problem**: In practice, protocols are often developed **incrementally** and **per-role**:
- Each role implementation developed separately
- No central choreography initially
- Composition happens gradually
- Real-world protocols (like TCP) specify per-role behavior

**Solution**: **Bottom-Up MPST** allows:
- Direct specification of **local types** per role
- **Compatibility checking** (instead of duality)
- No global type required upfront
- **Safety invariant parametrization**

---

## 2. Top-Down vs Bottom-Up

### 2.1 Top-Down Workflow

```
┌─────────────────┐
│  Global Type G  │  ← Write this first (choreography)
└────────┬────────┘
         │ Projection (G ↾ r)
         ↓
  ┌──────────────────────┐
  │ Local Types T₁...Tₙ  │  ← Derived automatically
  └──────────┬───────────┘
             │ Implementation
             ↓
      ┌────────────────┐
      │  Code per role │
      └────────────────┘
```

**Advantages**:
- Global view ensures consistency
- Well-studied theory
- Projection is algorithmic

**Disadvantages**:
- Requires global specification upfront
- Less flexible for incremental development
- Not how real protocols are often developed

### 2.2 Bottom-Up Workflow

```
  ┌────────────────┐
  │ Local Types T₁ │  ← Write these directly (per-role specs)
  │ Local Types T₂ │
  │      ...       │
  │ Local Types Tₙ │
  └────────┬───────┘
           │ Compatibility Check
           ↓
    ┌─────────────┐
    │ Compatible? │  ← Verify roles can interact safely
    └──────┬──────┘
           │ Yes: Safe to compose
           ↓
    ┌────────────────┐
    │  Composition   │
    └────────────────┘
```

**Advantages**:
- Matches incremental development
- Each role specified independently
- Flexible composition
- Better for distributed teams

**Disadvantages**:
- No global view initially
- Compatibility checking more complex than projection
- Composition may fail if types incompatible

---

## 3. Formal Definitions

### 3.1 Local Types

**Syntax** (same as traditional MPST):

```
T ::= p!⟨ℓ(U)⟩.T         Send message ℓ with payload U to role p
    | p?⟨ℓ(U)⟩.T         Receive message ℓ with payload U from role p
    | p ⊕ {ℓᵢ: Tᵢ}ⁱ       Internal choice (I decide)
    | p & {ℓᵢ: Tᵢ}ⁱ       External choice (p decides)
    | μX.T                Recursion
    | X                   Recursion variable
    | end                 Termination
```

**Key Difference from Top-Down**: These are **written directly**, not derived via projection.

### 3.2 Environments (Γ)

A **typing environment** maps role names to local types:

$$
\Gamma = \\{r_1: T_1, r_2: T_2, \ldots, r_n: T_n\\}
$$

**Example** (simple ping-pong):
$$
\Gamma = \\{
  \text{Client}: \text{Server}!\langle\text{Ping}\rangle.\text{Server}?\langle\text{Pong}\rangle.\text{end}, \\\\
  \text{Server}: \text{Client}?\langle\text{Ping}\rangle.\text{Client}!\langle\text{Pong}\rangle.\text{end}
\\}
$$

### 3.3 Compatibility Invariant

**Definition** (Scalas & Yoshida 2019, Definition 3.1):

An environment $$\Gamma$$ satisfies the **compatibility invariant** if all interactions between roles are **dual** (matching sends and receives).

**Formal**:
$$
\Gamma \text{ compatible} \iff \forall r_1, r_2 \in \text{roles}(\Gamma): \text{interactions}(r_1, r_2, \Gamma) \text{ are dual}
$$

**Duality** means:
- Every send `p!⟨ℓ⟩` has a matching receive `p?⟨ℓ⟩` on the other side
- Internal choice `⊕` matches external choice `&`
- All branches have compatible continuations

---

## 4. Compatibility Checking

### 4.1 Algorithm Overview

**Input**: Environment $$\Gamma = \\{r_1: T_1, \ldots, r_n: T_n\\}$$

**Output**: `Compatible` or `Incompatible` + error trace

**Steps**:

1. **Build interaction graph**
   - Nodes: (role, state) pairs
   - Edges: communication actions

2. **Check duality** for each interaction
   - For each `r₁ -> r₂: msg`, verify `r₂` expects to receive `msg` from `r₁`

3. **Check progress** (no deadlocks)
   - Use SCC (Strongly Connected Components) analysis
   - Detect circular waits

4. **Check termination**
   - All paths eventually reach `end`

### 4.2 Checking Send/Receive Duality

**Rule**:
$$
\frac{
  \Gamma(r_1) = r_2!⟨\ell(U)⟩.T_1 \quad
  \Gamma(r_2) = r_1?⟨\ell(V)⟩.T_2 \quad
  U \leq V
}{
  \Gamma \vdash r_1 \leftrightarrow r_2 : \text{compatible}
}
$$

**Meaning**:
- $$r_1$$ sends message $$\ell$$ to $$r_2$$
- $$r_2$$ expects to receive $$\ell$$ from $$r_1$$
- Payload types compatible ($$U$$ subtype of $$V$$)
- Continuations must also be compatible

### 4.3 Checking Choice Duality

**Rule**:
$$
\frac{
  \Gamma(r_1) = r_2 \oplus \\{\ell_i: T_{1i}\\}^{i \in I} \quad
  \Gamma(r_2) = r_1 \& \\{\ell_j: T_{2j}\\}^{j \in J} \quad
  I \subseteq J
}{
  \Gamma \vdash r_1 \leftrightarrow r_2 : \text{compatible}
}
$$

**Meaning**:
- $$r_1$$ offers internal choice (selects one of $$\ell_i$$)
- $$r_2$$ has external choice (reacts to $$r_1$$'s selection)
- $$r_2$$ must handle **at least** all labels $$r_1$$ might send ($$I \subseteq J$$)

---

## 5. Safety Invariants

### 5.1 Concept

**Safety invariants** are **parameters** of the type system that guarantee runtime properties.

**Formalization**:
$$
\Gamma \vdash_{\mathcal{I}} P : T
$$

Where:
- $$\Gamma$$: Environment (role → type mapping)
- $$P$$: Process implementation
- $$T$$: Session type
- $$\mathcal{I}$$: **Safety invariant** parameter

**If type-checking succeeds with invariant $$\mathcal{I}$$, then property $$\mathcal{I}$$ holds at runtime.**

### 5.2 Standard Invariants

#### Deadlock-Freedom ($$\mathcal{I}_{\text{DF}}$$)

**Property**: No configuration reaches a state where all processes are blocked waiting.

**Checking**: SCC analysis on interaction graph, ensure no cyclic dependencies.

#### Liveness ($$\mathcal{I}_{\text{L}}$$)

**Property**: All processes eventually terminate or make progress.

**Checking**: Every infinite path has infinitely many actions (not stuck).

#### Type Safety ($$\mathcal{I}_{\text{TS}}$$)

**Property**: No message type mismatches.

**Checking**: All sends/receives have matching types.

### 5.3 Parametrization

**Key Idea**: Choose which invariants to check based on application needs.

**Examples**:

```typescript
// Check only type safety (fast)
const result1 = checkCompatibility(env, [TypeSafety]);

// Check deadlock-freedom + liveness (thorough)
const result2 = checkCompatibility(env, [DeadlockFree, Liveness]);

// Check all invariants (maximum safety)
const result3 = checkCompatibility(env, [TypeSafety, DeadlockFree, Liveness, Progress]);
```

**Tradeoff**: More invariants = stronger guarantees but slower checking.

---

## 6. TCP Implementation Use Case

### 6.1 Why TCP Uses Bottom-Up MPST

**From Cavoj et al. (2024) paper**:

> "In this paper, the bottom-up multiparty session type approach is used to describe TCP."

**Reasons**:

1. **Per-Role Specification Natural**
   - TCP specification (RFC 9293) describes behavior per role (server, client)
   - No global choreography in RFC

2. **Incremental Implementation**
   - Server system implemented independently
   - Client system assumed to exist (Linux kernel)
   - User interface added separately

3. **Compatibility Checking Sufficient**
   - Verify server system compatible with standard TCP client
   - No need to derive from global type

### 6.2 TCP Roles and Local Types

**Roles** (from Cavoj et al. paper):
- **Server User**: Application using TCP
- **Server System**: TCP implementation
- **Client System**: Remote TCP peer

**Example Local Type** (Server System, simplified):

```rust
type ServerSystemSessionType = St! {
    (ServerUser & Open).           // User opens connection
    (ServerUser + TcbCreated).     // System confirms
    (ClientSystem & Syn).          // Receive SYN from network
    (ClientSystem + SynAck).       // Send SYN-ACK
    (ClientSystem & Ack).          // Receive ACK (3-way handshake complete)
    (ServerUser + Connected).      // Notify user
    // ... continue with data exchange
};
```

**Compatibility Check**:
- Verify `Server System ↔ Client System` interactions are dual
- Verify `Server System ↔ Server User` interactions are dual
- No global type needed

### 6.3 Benefits for TCP

1. **Modular Implementation**
   - Each role (User, System, Network) implemented separately
   - Easier to test in isolation

2. **Realistic Modeling**
   - Matches how TCP is actually specified (per-endpoint behavior)
   - Aligns with RFC structure

3. **Flexible Composition**
   - Can verify compatibility with different TCP implementations
   - Supports gradual adoption

---

## 7. Implementation Considerations

### 7.1 Compatibility Checker Architecture

```typescript
interface CompatibilityChecker {
  /**
   * Check if environment Γ satisfies compatibility invariant
   */
  check(env: Environment, invariants: SafetyInvariant[]): CheckResult;
}

interface Environment {
  roles: Map<RoleName, LocalType>;  // r → T
}

interface CheckResult {
  compatible: boolean;
  violations?: Violation[];
  trace?: ExecutionTrace;
}

enum SafetyInvariant {
  TypeSafety,
  DeadlockFree,
  Liveness,
  Progress,
}
```

### 7.2 Implementation Steps

**Phase 1: Basic Compatibility**
1. Parse local types from syntax
2. Build interaction graph
3. Check send/receive duality
4. Detect simple incompatibilities

**Phase 2: Safety Invariants**
1. Implement deadlock detection (SCC)
2. Implement liveness checking
3. Parametrize by invariant selection

**Phase 3: Integration**
1. Integrate with existing SMPST projection
2. Support both top-down and bottom-up workflows
3. Allow hybrid approaches (some roles projected, others specified)

### 7.3 Testing Strategy

```typescript
describe('Bottom-Up MPST Compatibility', () => {
  it('should verify compatible ping-pong protocol', () => {
    const env = {
      Client: parseLocalType("Server!⟨Ping⟩.Server?⟨Pong⟩.end"),
      Server: parseLocalType("Client?⟨Ping⟩.Client!⟨Pong⟩.end"),
    };

    const result = checkCompatibility(env, [TypeSafety, DeadlockFree]);
    expect(result.compatible).toBe(true);
  });

  it('should detect incompatible send/receive', () => {
    const env = {
      A: parseLocalType("B!⟨Msg1⟩.end"),
      B: parseLocalType("A?⟨Msg2⟩.end"),  // Expects different message!
    };

    const result = checkCompatibility(env, [TypeSafety]);
    expect(result.compatible).toBe(false);
    expect(result.violations[0].type).toBe('MessageMismatch');
  });

  it('should detect deadlock in circular wait', () => {
    const env = {
      A: parseLocalType("B?⟨Msg⟩.C!⟨Msg⟩.end"),
      B: parseLocalType("C?⟨Msg⟩.A!⟨Msg⟩.end"),
      C: parseLocalType("A?⟨Msg⟩.B!⟨Msg⟩.end"),
    };

    const result = checkCompatibility(env, [DeadlockFree]);
    expect(result.compatible).toBe(false);
    expect(result.violations[0].type).toBe('Deadlock');
  });
});
```

### 7.4 Visualization

**Interaction Graph**:
```
    Server User
        ↓ Open
        ↑ TcbCreated
    Server System
        ↓ SYN
        ↑ SYN-ACK
        ↓ ACK
    Client System
```

**Compatibility Verification**:
- Check each edge: sender's output matches receiver's input
- Check cycles: no deadlocks
- Check termination: all paths reach `end`

---

## 8. References

### Primary Paper

**Scalas & Yoshida (2019)**:
- **Title**: "Less is More: Multiparty Session Types Revisited"
- **Published**: POPL 2019
- **URL**: https://dl.acm.org/doi/10.1145/3290343
- **Key Contributions**:
  - Bottom-up MPST formalization (§3)
  - Compatibility invariant definition (Definition 3.1)
  - Safety invariant parametrization (§4)
  - Comparison with top-down approach (§5)

### Application

**Cavoj et al. (2024)**:
- **Title**: "Session Types for the Transport Layer: Towards an Implementation of TCP"
- **Source**: arXiv:2404.05478v1
- **URL**: https://arxiv.org/abs/2404.05478
- **Relevance**: Uses bottom-up MPST for TCP implementation

### Related Work

- **Honda, Yoshida, Carbone (2008)**: "Multiparty Asynchronous Session Types" (traditional top-down)
- **Deniélou & Yoshida (2012)**: "Multiparty Session Types Meet Communicating Automata" (CFSM-based)

---

## 9. Comparison Table

| Aspect | Top-Down MPST | Bottom-Up MPST |
|--------|---------------|----------------|
| **Starting Point** | Global type G | Local types T₁...Tₙ |
| **Derivation** | Projection G ↾ r | Direct specification |
| **Correctness** | Duality (automatic) | Compatibility (check) |
| **Flexibility** | Less (global view fixed) | More (incremental) |
| **Theory** | Well-established | Recent (2019) |
| **Tools** | Scribble, Mungo | Fewer tools |
| **Use Cases** | Choreography-first design | Per-role implementation |
| **TCP Suitability** | Poor (no global view in RFC) | Excellent (matches RFC) |

---

## 10. Future Work for SMPST

### Implementation Priorities

**Phase 1** (Weeks 1-2):
- Design compatibility checker API
- Implement basic send/receive duality checking
- Add tests for simple protocols

**Phase 2** (Weeks 3-4):
- Implement choice duality checking
- Add deadlock detection (SCC-based)
- Parametrize by safety invariants

**Phase 3** (Weeks 5-6):
- Integrate with existing projection system
- Support hybrid workflows (top-down + bottom-up)
- Add TCP example using bottom-up approach

### UI Integration

**New Features**:
1. **Local Type Editor** (per role)
   - Tab for each role
   - Direct local type specification
   - Syntax highlighting

2. **Compatibility Checker**
   - Run compatibility check
   - Visualize interaction graph
   - Show violations with explanations

3. **Safety Invariant Selection**
   - Checkbox: Type Safety
   - Checkbox: Deadlock-Freedom
   - Checkbox: Liveness
   - Display verification results

---

**Document Status**: Complete
**Last Updated**: 2025-11-13
**Implementation Priority**: 🟠 **HIGH** (needed for TCP support)
**Estimated Effort**: 4-6 weeks
