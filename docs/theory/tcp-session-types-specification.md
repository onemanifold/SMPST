# TCP Session Types: Formal Specification and Implementation Requirements

**Date**: 2025-11-13
**Source**: "Session Types for the Transport Layer: Towards an Implementation of TCP" (Cavoj et al., arXiv:2404.05478v1)
**Status**: Specification Document - Analysis for SMPST Implementation

---

## Executive Summary

This document captures the formal session type specification for TCP protocol from the research paper by Cavoj et al. (2024), analyzes the MPST extensions and features required for implementation, and provides a comprehensive gap analysis against the current SMPST IDE capabilities.

**Key Findings**:
- TCP can be modeled using **bottom-up multiparty session types** (Scalas & Yoshida 2019)
- Requires **asynchronous semantics** with message buffers and retransmission
- Critical gaps: timeout handling, asynchronous communication, retransmission logic, state machine encoding
- SMPST currently provides: global choreography, synchronous simulation, projection
- **Major Extension Needed**: Asynchronous CFSM semantics with timeouts and failure handling

---

## Table of Contents

1. [TCP Protocol Overview](#1-tcp-protocol-overview)
2. [Session Type Approach](#2-session-type-approach)
3. [Roles in TCP Session Types](#3-roles-in-tcp-session-types)
4. [Formal Session Type Specifications](#4-formal-session-type-specifications)
5. [Required MPST Extensions](#5-required-mpst-extensions)
6. [Implementation Patterns](#6-implementation-patterns)
7. [Gap Analysis with SMPST](#7-gap-analysis-with-smpst)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Testing Strategy](#9-testing-strategy)
10. [References](#10-references)

---

## 1. TCP Protocol Overview

### 1.1 TCP Characteristics

**Transmission Control Protocol (TCP)** provides:
- **Reliable delivery**: Acknowledgments and retransmissions
- **Ordered delivery**: Sequence numbers ensure correct ordering
- **Connection-oriented**: Three-way handshake for setup
- **Flow control**: Sliding window mechanism
- **Congestion control**: Dynamic rate adjustment

### 1.2 TCP State Machine

The TCP specification (RFC 9293) defines a complex state machine with states:

```
CLOSED → LISTEN → SYN-RCVD → ESTABLISHED →
  → (data exchange) →
  → FIN-WAIT-1 → FIN-WAIT-2 → TIME-WAIT → CLOSED

Alternative closing paths:
  → CLOSE-WAIT → LAST-ACK → CLOSED
```

### 1.3 Key Operations

1. **Connection Establishment**: Three-way handshake (SYN, SYN-ACK, ACK)
2. **Data Transfer**: Segments with sequence numbers, sliding window
3. **Retransmission**: Timeout-based and triple-duplicate ACK triggered
4. **Connection Termination**: Four-way handshake (FIN, ACK, FIN, ACK)

---

## 2. Session Type Approach

### 2.1 Bottom-Up Multiparty Session Types

The paper uses **bottom-up MPST** (Scalas & Yoshida 2019) instead of traditional top-down MPST.

**Key Differences**:

| Top-Down MPST | Bottom-Up MPST |
|---------------|----------------|
| Global type → Projection → Local types | Direct local type specification |
| Duality checking | Compatibility checking |
| Requires global choreography | Per-role specifications sufficient |

**From the paper**:
> "In this paper, the bottom-up multiparty session type approach is used to describe TCP."
>
> "The implications of this approach are that global types and the concept of duality are not used. Instead of duality, the **compatibility invariant** is used to check that actions are dual between the given types."

### 2.2 Safety Invariants

**Definition**: Safety invariants are parameters that guarantee protocol properties at runtime.

**Properties** (when protocol type-checks):
- Deadlock-freedom
- Liveness
- Protocol conformance

**Important Note** from paper:
> "If the protocol successfully type-checks with the instantiation of the safety invariant, it will manifest the property represented by the invariant during its runtime."

---

## 3. Roles in TCP Session Types

The paper models three roles:

### 3.1 Server User
- **Description**: The server application using TCP
- **Actions**: Open, Send data, Receive data, Close
- **Interface**: User/TCP interface (system calls)

### 3.2 Server System
- **Description**: The TCP implementation (protocol logic)
- **Actions**: Manage state machine, buffers, retransmissions
- **Dual Interfaces**:
  - Communicates with Server User (application)
  - Communicates with Client System (network)

### 3.3 Client System
- **Description**: TCP implementation on remote host
- **Actions**: Send/receive TCP segments over network
- **Modeling**: Assumed to exist on Internet, not part of program

**Key Insight**: This three-role decomposition separates:
1. Application logic (Server User)
2. Protocol implementation (Server System)
3. Network peer (Client System)

---

## 4. Formal Session Type Specifications

### 4.1 Session Type Syntax (Rust Encoding)

The paper implements session types using Rust generic types:

```rust
// Basic session type constructors
struct OfferOne<R, M, A>     // Receive one message type
struct OfferTwo<R, M1, M2, A1, A2>  // Receive with two branches
struct SelectOne<R, M, A>    // Send one message type
struct SelectTwo<R, M1, M2, A1, A2> // Send with two branches
struct End                   // Termination

// Where:
// R: Role (peer)
// M, M1, M2: Message types
// A, A1, A2: Continuation session types
```

### 4.2 Macro Syntax

The paper provides a macro for readable session type definitions:

```rust
// Example from paper:
type ClientSt = St! {
    Server + Request,
    Server & Response,
    end
};

// Expands to:
type ClientSt = SelectOne<Server, Request,
                  OfferOne<Server, Response, End>>;
```

**Notation**:
- `Role + Message`: Send (select) message to role
- `Role & Message`: Receive (offer) message from role
- `end`: Protocol termination

### 4.3 Connection Establishment Session Type

**Server System Session Type** (three-way handshake):

```rust
type ServerSystemSessionType = St! {
    (RoleServerUser & Open).           // 1. Receive Open from user
    (RoleServerUser + TcbCreated).     // 2. Send TcbCreated to user
    (RoleClientSystem & Syn).          // 3. Receive SYN from network
    (RoleClientSystem + SynAck).       // 4. Send SYN-ACK to network
    ServerSystemSynRcvd                // 5. Continue in SYN-RCVD state
};
```

**SYN-RCVD State** (waiting for ACK):

```rust
type ServerSystemSynRcvd = St! {
    (RoleClientSystem & {
        Ack.  // Acceptable ACK
            (RoleServerUser + Connected).
            ServerSystemCommLoop,
        Ack.  // Unacceptable ACK
            (RoleClientSystem + {
                Ack.ServerSystemSynRcvd,       // Retry
                Rst.(RoleServerUser + Close).end  // Reset
            })
    })
};
```

**Key Features**:
1. **Multi-way branching**: `{branch1, branch2}`
2. **Nested branching**: Branches contain further branches
3. **Recursion**: `ServerSystemSynRcvd` appears in its own definition
4. **State encoding**: Session types encode TCP state machine

### 4.4 Data Exchange Session Type

**Main Communication Loop**:

```rust
type ServerSystemCommLoop = St! {
    (RoleClientSystem & {
        // Branch 1: Acceptable data segment
        Data.
            (RoleClientSystem + Ack /* empty */).
            (RoleServerUser + Data).
            (RoleServerUser & {
                Data.
                    (RoleClientSystem + Ack /* with data */).
                    ServerSystemCommLoop,
                Close.
                    (RoleClientSystem + FinAck).
                    ServerSystemFinWait1
            }),

        // Branch 2: Acceptable ACK (no data)
        Ack.
            ServerSystemCommLoop,

        // Branch 3: FIN-ACK (peer closing)
        FinAck.
            (RoleClientSystem + Ack).
            (RoleServerUser + Close).
            ServerSystemCloseWait,

        // Branch 4: Unacceptable segment
        Unacceptable.
            (RoleClientSystem + Ack).
            ServerSystemCommLoop,
    })
};
```

**Data Flow**:
1. Receive acceptable data segment from network
2. Send empty ACK to network
3. Forward data to server user
4. User responds with data OR close
5. If data: send ACK with data, loop
6. If close: send FIN-ACK, transition to closing

### 4.5 Connection Closing Session Types

**Server Initiates Close** (FIN-WAIT-1):

```rust
type ServerSystemFinWait1 = St! {
    (RoleClientSystem & {
        Ack.  // ACK of our FIN
            ServerSystemFinWait2,
        FinAck.  // FIN+ACK (simultaneous close)
            (RoleClientSystem + Ack).
            end
    })
};
```

**Peer Initiates Close** (CLOSE-WAIT):

```rust
type ServerSystemCloseWait = St! {
    (RoleServerUser & {
        Data.  // User sends more data
            (RoleClientSystem + Ack).
            (RoleClientSystem & Ack).
            ServerSystemCloseWait,
        Close.  // User closes
            (RoleClientSystem + FinAck).
            (RoleClientSystem & Ack).
            end
    })
};
```

---

## 5. Required MPST Extensions

### 5.1 Bottom-Up MPST Framework

**Required Features**:
1. ✅ **Per-role session types**: Specify each role's behavior independently
2. ❌ **Compatibility checking**: Verify actions are dual between roles
3. ❌ **Safety invariant parametrization**: Select deadlock-freedom, liveness properties

**SMPST Status**:
- Currently implements **top-down MPST** (global → projection)
- Does NOT implement bottom-up compatibility checking
- Has deadlock detection but not parametrized by safety invariants

### 5.2 Multi-Way Branching

**Requirement**: Support N-way branching in offers/selects

**Paper's Approach**:
```rust
// Explicit OfferTwo, OfferThree, etc.
// OR nested binary branches:
OfferTwo<R, M1, M2,
         Action1,
         OfferTwo<R, M3, M4, Action3, Action4>>
```

**SMPST Status**:
- ✅ Supports N-way choice in global protocols
- ✅ Projects to local external/internal choice
- ⚠️ Implementation uses binary choice nodes, could support nesting

### 5.3 Recursive Session Types

**Requirement**: Type-level recursion for protocol loops

**Paper's Approach**:
```rust
// Type aliases in Rust cannot be directly recursive
// Solution: Use indirection (Box<T>, &T)
struct RecursiveType {
    continuation: Box<Action>  // Indirection breaks cycle
}
```

**SMPST Status**:
- ✅ Supports recursion in Scribble (`rec Label { ... continue Label }`)
- ✅ CFG has recursive nodes with back-edges
- ✅ Projection handles recursion correctly

### 5.4 Timeout Handling

**Critical Requirement**: TCP requires timeouts for retransmission

**Paper's Approach** (from Section 4.6):
> "The session type theory we are using does not have a notion of timeouts, nor does any session type work containing timeouts have the ability to model the operations needed for TCP timeouts. Hence, we opt to **emulate timeouts by introducing a virtual message type** and adding it as another branch to the offer session type."

**Implementation**:
```rust
// Add timeout as virtual message branch
OfferThree<R,
    RealMessage1, RealMessage2, TimeoutMessage,
    Action1, Action2, RetransmitAction
>

// Timeout branch retransmits and recurses:
TimeoutMessage ->
    (RoleClientSystem + Ack).  // Retransmit ACK
    ServerSystemCommLoop       // Loop back
```

**SMPST Status**:
- ❌ **NO timeout support** in syntax or semantics
- ❌ No clock system
- ❌ No time constraints in verification
- 📝 Theory documented in `docs/theory/timed-session-types.md` but not implemented

**Gap Severity**: 🔴 **CRITICAL** - TCP cannot be fully modeled without timeouts

### 5.5 Asynchronous Communication

**Requirement**: Asynchronous send/receive with message buffers

**Paper's Approach**:
- Sends are non-blocking
- Receives block until message available
- Network channel has underlying buffer

**SMPST Status**:
- ✅ CFG Simulator: Synchronous (orchestrated) execution
- ✅ CFSM Simulator: **Asynchronous with FIFO buffers**
- ✅ Distributed Simulator: Coordinator-mediated async
- ⚠️ FIFO semantics enforced, matches TCP requirements

**Assessment**: ✅ **ADEQUATE** - CFSM simulator provides needed async semantics

### 5.6 Context-Dependent Branching

**Requirement**: Branch selection based on external state (not just message type)

**Paper's Implementation** (Section 4.4):
```rust
// Picker function determines branch based on TCP state
channel.offer_two_filtered(
    st,
    |packet| match tcp_state.acceptable(&packet) {
        Acceptable(_, _) => Branch::Left(packet),
        NotAcceptable => Branch::Right(packet),
    },
    &tcp_state
)
```

**Key Insight**:
- Same message type (ACK) can be acceptable or unacceptable
- Decision depends on **sequence numbers** in TCP state
- Session types alone cannot express this

**SMPST Status**:
- ❌ No support for context-dependent branching
- Choice selection based only on message labels
- No access to external state during simulation

**Gap Severity**: 🟠 **HIGH** - Needed for realistic transport layer protocols

### 5.7 State Machine Encoding

**Requirement**: Encode protocol state machine in session types

**Paper's Approach**:
```rust
// Each TCP state becomes a session type
type ServerSystemClosed = St! { ... };
type ServerSystemListen = St! { ... };
type ServerSystemSynRcvd = St! { ... };
type ServerSystemEstablished = St! { ... };
type ServerSystemFinWait1 = St! { ... };

// State transitions via continuation types
```

**SMPST Status**:
- ✅ CFG nodes represent states
- ✅ Edges represent transitions
- ⚠️ States not explicitly named (implicit in CFG structure)
- ⚠️ Could benefit from state annotations

### 5.8 Retransmission Logic

**Requirement**: Handle duplicate/lost packets with retransmission

**Paper's Implementation**:
- Retransmission queue tracks unacknowledged segments
- Timeout triggers retransmit
- Triple-duplicate ACK triggers fast retransmit

**SMPST Status**:
- ❌ No retransmission logic
- ❌ No duplicate detection
- ❌ No packet loss handling
- Messages assumed to be delivered exactly once

**Gap Severity**: 🔴 **CRITICAL** - Core TCP mechanism

---

## 6. Implementation Patterns

### 6.1 Type-State Pattern

**Pattern**: Encode protocol states as types, transitions as methods

```rust
struct TcpClosed;
struct TcpListen;
struct TcpSynRcvd;

impl TcpClosed {
    fn open(self) -> TcpListen { ... }
}

impl TcpListen {
    fn recv_syn(self, syn: Syn) -> TcpSynRcvd { ... }
}
```

**Benefits**:
- Compiler enforces valid state transitions
- Invalid transitions are type errors
- No runtime state checks needed

### 6.2 Channel Abstraction

**Pattern**: Channel provides session-typed send/receive methods

```rust
impl<R1, R2> Channel<R1, R2> {
    fn select_one<M, A>(
        self,
        token: SelectOne<R2, M, A>,
        msg: M
    ) -> A
    where M: Message, A: Action;

    fn offer_one<M, A>(
        self,
        token: OfferOne<R2, M, A>
    ) -> (M, A)
    where M: Message, A: Action;
}
```

**Benefits**:
- Type-safe message passing
- Session type token consumed on use
- Continuation type returned for next operation

### 6.3 Picker Functions

**Pattern**: Function determines branch selection based on runtime state

```rust
fn picker(packet: Packet, tcp_state: &TcpState) -> Branch {
    if tcp_state.is_acceptable(&packet) {
        Branch::Left(packet)
    } else {
        Branch::Right(packet)
    }
}

channel.offer_two_filtered(session_type, picker, &tcp_state)
```

**Benefits**:
- Integrates session types with stateful logic
- Allows context-dependent branching
- Maintains type safety

### 6.4 Virtual Messages for Timeouts

**Pattern**: Represent timeouts as special message type

```rust
enum NetworkMessage {
    RealPacket(Packet),
    Timeout,
}

// Session type includes timeout branch
type SessionWithTimeout = St! {
    (Network & {
        Packet. handle_packet_action,
        Timeout. retransmit_action
    })
};
```

**Benefits**:
- No session type extension needed
- Timeouts handled like messages
- External timeout mechanism triggers virtual message

---

## 7. Gap Analysis with SMPST

### 7.1 Feature Comparison Matrix

| Feature | TCP Paper | SMPST Current | Gap Severity | Notes |
|---------|-----------|---------------|--------------|-------|
| **Bottom-Up MPST** | ✅ Used | ❌ Top-down only | 🟠 HIGH | Could add compatibility checker |
| **Multi-way Branching** | ✅ Required | ✅ Supported | 🟢 LOW | Already supported in choice |
| **Recursive Types** | ✅ Required | ✅ Supported | 🟢 NONE | `rec`/`continue` works |
| **Timeout Support** | ✅ Critical | ❌ None | 🔴 CRITICAL | No syntax or semantics |
| **Asynchronous Comm** | ✅ Required | ✅ CFSM | 🟢 NONE | CFSM simulator is async |
| **Context Branching** | ✅ Used | ❌ None | 🟠 HIGH | No external state access |
| **State Encoding** | ✅ Used | ⚠️ Partial | 🟡 MEDIUM | CFG nodes implicit states |
| **Retransmission** | ✅ Core | ❌ None | 🔴 CRITICAL | Not modeled |
| **Compatibility Check** | ✅ Bottom-up | ❌ None | 🟠 HIGH | Uses duality instead |
| **Safety Invariants** | ✅ Parametrized | ⚠️ Fixed | 🟡 MEDIUM | Hard-coded properties |

### 7.2 Architecture Alignment

**TCP Paper Architecture**:
```
User ←→ System ←→ Network
     (session typed interfaces)
```

**SMPST Architecture**:
```
Global Protocol → CFG → Projection → CFSMs → Simulation
```

**Alignment Analysis**:
- ✅ SMPST CFSMs can represent per-role views (System, User, Network)
- ✅ Projection separates roles correctly
- ❌ No bottom-up composition (compatibility checking)
- ❌ No timeout-aware simulation

### 7.3 Critical Gaps for TCP Implementation

#### Gap 1: Timeout Semantics 🔴 CRITICAL

**What's Missing**:
- No `within <time>` syntax in Scribble
- No clock variables or time constraints
- No timeout branches in CFG/CFSM

**Impact**:
- **Cannot model TCP retransmission** accurately
- Cannot express time-bounded operations
- No way to trigger timeout branches

**Workaround (from paper)**:
- Virtual timeout messages
- External timeout mechanism
- Manual timeout handling in implementation

**Recommendation**:
- Implement timed session types (see `docs/theory/timed-session-types.md`)
- Add `within` syntax to Scribble
- Extend CFSM simulator with clock system

#### Gap 2: Retransmission Logic 🔴 CRITICAL

**What's Missing**:
- No packet loss model
- No duplicate detection
- No retransmission queue

**Impact**:
- **Cannot verify TCP reliability mechanism**
- Cannot test loss recovery
- Cannot model real network behavior

**Workaround**:
- Assume perfect network in verification
- Test retransmission separately
- Manual queue management in code

**Recommendation**:
- Add network error injection to simulator
- Implement message loss/duplication
- Add retransmission queue to CFSM state

#### Gap 3: Context-Dependent Branching 🟠 HIGH

**What's Missing**:
- Branch selection only by message label
- No access to external state (sequence numbers, etc.)
- No predicate-based branching

**Impact**:
- **Cannot distinguish acceptable vs. unacceptable ACK** in types
- Same message type must go to different branches
- Semantic validation outside session types

**Workaround (from paper)**:
- Picker functions with external state
- Runtime validation, not type-checked
- Branching logic outside session type system

**Recommendation**:
- Add refinement types (dependent types)
- Allow predicates on messages: `Ack{seq: n > expected}`
- Extend verification to check predicates

#### Gap 4: Bottom-Up MPST 🟠 HIGH

**What's Missing**:
- No compatibility checking algorithm
- No bottom-up composition
- Only top-down projection supported

**Impact**:
- Cannot directly encode TCP paper's approach
- Must convert bottom-up specs to global protocol
- Loss of flexibility

**Workaround**:
- Manually write global protocol
- Use projection to get local types
- Verify compatibility manually

**Recommendation**:
- Implement compatibility checking (Scalas & Yoshida 2019)
- Support both top-down and bottom-up workflows
- Add "infer global type" from local types

### 7.4 Strengths of Current SMPST

**What SMPST Does Well** (relevant to TCP):

1. ✅ **Asynchronous Semantics**: CFSM simulator with FIFO buffers matches TCP async model
2. ✅ **Recursion**: Full support for recursive protocols (essential for TCP loops)
3. ✅ **Multi-party**: Can model three roles (User, System, Network)
4. ✅ **Verification**: Comprehensive checks (deadlock, liveness, determinism)
5. ✅ **Projection**: Formal projection from global to local types
6. ✅ **Simulation**: Can execute protocols interactively

**How These Help**:
- CFSM simulation can model async message passing (like TCP segments)
- Recursion models TCP's continuous send/receive loops
- Multi-party separation matches paper's role decomposition
- Verification catches protocol bugs early

---

## 8. Implementation Roadmap

### Phase 1: Timed Session Types Foundation 🔴 CRITICAL

**Goal**: Add timeout support to SMPST

**Tasks**:
1. **Parser Extension**
   - Add `within <time>` syntax: `A -> B: Msg() within 5s;`
   - Parse timeout constraints
   - Extend AST with timeout annotations

2. **Clock System**
   - Add clock variables to CFG/CFSM
   - Implement time progression semantics
   - Add constraint checking

3. **Timeout Branches**
   - Generate timeout branches in CFG
   - Add timeout events to simulator
   - Integrate with CFSM execution

4. **Verification**
   - Check time-error freedom (Bocchi et al. 2014)
   - Validate timeout constraints satisfiable
   - Ensure no timing deadlocks

**Duration**: 4-6 weeks
**Complexity**: High
**Dependencies**: None
**Deliverables**:
- `timeout-syntax.md` - Syntax specification
- `timeout-semantics.md` - Formal semantics
- Timeout tests in test suite

### Phase 2: Context-Dependent Branching 🟠 HIGH

**Goal**: Support predicates and external state in branching

**Tasks**:
1. **Refinement Types**
   - Add predicate syntax: `Msg{field > value}`
   - Type-level constraints on message fields
   - Integration with verification

2. **External State Access**
   - Allow simulation to access context
   - Pass state to picker functions
   - Type-check state dependencies

3. **Predicate Verification**
   - SMT solver integration (optional)
   - Static checking of predicates
   - Runtime validation fallback

**Duration**: 3-4 weeks
**Complexity**: Medium-High
**Dependencies**: None
**Deliverables**:
- Predicate syntax in Scribble
- Context-aware CFSM simulation

### Phase 3: Bottom-Up MPST Support 🟠 HIGH

**Goal**: Add compatibility checking for bottom-up workflow

**Tasks**:
1. **Local Type Specification**
   - Support specifying local types directly
   - No global protocol required
   - Per-role Scribble files

2. **Compatibility Algorithm**
   - Implement Scalas & Yoshida (2019) compatibility
   - Check duality of actions between roles
   - Verify safety invariants

3. **Global Type Inference**
   - Infer global protocol from compatible local types
   - Generate choreography automatically
   - Visualize inferred global view

**Duration**: 3-4 weeks
**Complexity**: High
**Dependencies**: None
**Deliverables**:
- Compatibility checker
- Local type syntax
- Inference algorithm

### Phase 4: Retransmission and Reliability 🔴 CRITICAL

**Goal**: Model packet loss, duplication, retransmission

**Tasks**:
1. **Network Error Model**
   - Configurable loss rate
   - Duplication probability
   - Delay/reordering simulation

2. **Retransmission Queue**
   - Track unacknowledged messages
   - Timeout-triggered retransmit
   - Duplicate ACK detection

3. **Reliability Verification**
   - Verify eventual delivery
   - Check retransmission bounds
   - Test loss recovery

**Duration**: 2-3 weeks
**Complexity**: Medium
**Dependencies**: Phase 1 (timeouts)
**Deliverables**:
- Network simulator with errors
- Retransmission queue implementation
- Reliability tests

### Phase 5: TCP Case Study Implementation 🎯 INTEGRATION

**Goal**: Implement full TCP subset using enhanced SMPST

**Tasks**:
1. **Model TCP State Machine**
   - Connection establishment (3-way handshake)
   - Data transfer (with retransmission)
   - Connection closing (4-way handshake)

2. **Generate Code**
   - TypeScript/Rust code generation
   - Interoperate with real TCP stack
   - Test against Linux kernel TCP

3. **Validation**
   - Test all TCP states
   - Verify against RFC 9293
   - Measure correctness

**Duration**: 4-6 weeks
**Complexity**: High
**Dependencies**: Phases 1-4
**Deliverables**:
- TCP protocol in Scribble (with timeouts)
- Generated implementation
- Interoperability tests
- Case study paper/report

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Timeout Semantics**:
```typescript
describe('Timeout Support', () => {
  it('should parse timeout constraints', () => {
    const proto = `
      protocol Test(role A, role B) {
        A -> B: Request();
        B -> A: Response() within 5s;
      }
    `;
    const ast = parse(proto);
    expect(ast.messages[1].timeout).toBe(5000);
  });

  it('should generate timeout branches in CFG', () => {
    // Verify timeout creates choice node
  });

  it('should trigger timeout in simulation', () => {
    // Advance clock beyond timeout
    // Verify timeout branch taken
  });
});
```

**Context-Dependent Branching**:
```typescript
describe('Context Branching', () => {
  it('should allow predicate-based routing', () => {
    const proto = `
      protocol TCP(role Client, role Server) {
        Client -> Server: Ack{seq: n};
        choice at Server {
          Server -> Client: Accept() if (n == expected);
        } or {
          Server -> Client: Reject() if (n != expected);
        }
      }
    `;
    // Verify predicate attached to branches
  });
});
```

### 9.2 Integration Tests

**TCP Three-Way Handshake**:
```typescript
describe('TCP Connection Establishment', () => {
  it('should complete handshake successfully', () => {
    const tcp = new TcpProtocol();

    // Client sends SYN
    tcp.step({ from: 'Client', to: 'Server', type: 'SYN', seq: 100 });

    // Server sends SYN-ACK
    tcp.step({ from: 'Server', to: 'Client', type: 'SYNACK', seq: 200, ack: 101 });

    // Client sends ACK
    tcp.step({ from: 'Client', to: 'Server', type: 'ACK', ack: 201 });

    expect(tcp.state).toBe('ESTABLISHED');
  });

  it('should handle unacceptable ACK', () => {
    // Test SYN-RCVD with wrong ACK number
  });
});
```

**Retransmission**:
```typescript
describe('TCP Retransmission', () => {
  it('should retransmit on timeout', async () => {
    const tcp = new TcpProtocol({ timeout: 1000 });

    tcp.send({ data: 'hello', seq: 100 });

    // Wait for timeout
    await sleep(1100);

    // Verify retransmission occurred
    expect(tcp.retransmitQueue).toContain({ data: 'hello', seq: 100 });
  });

  it('should retransmit on triple-duplicate ACK', () => {
    // Fast retransmit test
  });
});
```

### 9.3 Conformance Tests

**RFC 9293 Compliance**:
- Test all state transitions from Figure 1
- Verify sequence number handling
- Check window management
- Validate error handling

**Interoperability**:
- Connect to Linux TCP stack (netcat)
- Exchange data bidirectionally
- Handle packet loss (netem)
- Measure throughput and correctness

---

## 10. References

### Primary Paper

**Cavoj et al. (2024)**:
- **Title**: "Session Types for the Transport Layer: Towards an Implementation of TCP"
- **Source**: arXiv:2404.05478v1 [cs.PL] 08 Apr 2024
- **URL**: https://arxiv.org/abs/2404.05478
- **Key Contributions**:
  - Bottom-up MPST for TCP (§2)
  - Session type library in Rust (§4.1)
  - Three-way handshake implementation (§4.5, Appendix A.1)
  - Timeout emulation via virtual messages (§4.6)
  - Retransmission handling (§4.6, Appendix A.2)
  - Interoperability testing against Linux kernel (§5)

### Session Types Theory

1. **Scalas & Yoshida (2019)**: "Less is More: Multiparty Session Types Revisited"
   - Bottom-up MPST framework
   - Compatibility invariant instead of duality
   - Safety invariant parametrization

2. **Honda, Yoshida, Carbone (2008)**: "Multiparty Asynchronous Session Types"
   - Classic MPST formalization
   - Projection rules
   - Asynchronous semantics

3. **Bocchi et al. (2014)**: "Timed Multiparty Session Types"
   - Timeout semantics
   - Time-error freedom theorem
   - Clock constraints

### TCP Specification

4. **RFC 9293** (2022): "Transmission Control Protocol (TCP)"
   - Latest TCP specification
   - State machine definition
   - Reliability mechanisms

### Related Work

5. **SMTP/POP3 Session Types**: Multiple works model application-layer protocols
   - Difference: Assume reliable transport (TCP abstracts failures)
   - TCP models transport layer (handles failures explicitly)

---

## Appendix A: Session Type Syntax Reference

### A.1 Rust Macro Syntax (from Paper)

```rust
St! {
    // Send message
    Role + Message,

    // Receive message
    Role & Message,

    // Send with choice (internal choice)
    Role + { Msg1, Msg2 },

    // Receive with choice (external choice)
    Role & { Msg1, Msg2 },

    // Recursion
    RecursiveType,

    // Termination
    end
}
```

### A.2 Scribble Equivalent (Proposed Extension)

```scribble
protocol TCPHandshake(role User, role System, role Network) {
  // User -> System
  User -> System: Open();
  System -> User: TcbCreated();

  // Three-way handshake
  Network -> System: Syn();
  System -> Network: SynAck();

  rec WaitAck {
    choice at Network {
      Network -> System: Ack();  // Acceptable
      System -> User: Connected();
    } or {
      Network -> System: Ack();  // Unacceptable
      choice at System {
        System -> Network: Ack();
        continue WaitAck;
      } or {
        System -> Network: Rst();
        System -> User: Close();
      }
    }
  }
}
```

### A.3 Extended Syntax with Timeouts (Proposed)

```scribble
protocol TCPDataTransfer(role User, role System, role Network) {
  rec Loop {
    choice at Network {
      Network -> System: Data() within 2s;
      System -> Network: Ack();
      System -> User: Data();
      // ...
      continue Loop;
    } or {
      timeout;  // No data received in 2s
      System -> Network: KeepAlive();
      continue Loop;
    }
  }
}
```

---

## Appendix B: Comparison with Application-Layer Protocols

### B.1 SMTP (Application Layer)

**Characteristics**:
- Runs over reliable transport (TCP)
- Assumes no packet loss
- No retransmission at SMTP level
- Linear request-response pattern

**Session Type** (simplified):
```scribble
protocol SMTP(role Client, role Server) {
  Server -> Client: Ready();
  Client -> Server: Helo();
  Server -> Client: Ok();
  Client -> Server: Mail();
  Server -> Client: Ok();
  // ... etc
}
```

**Modeling Complexity**: 🟢 LOW
- Synchronous exchanges
- No timeouts needed
- No reliability concerns
- Deterministic choice

### B.2 TCP (Transport Layer)

**Characteristics**:
- Handles unreliable network (IP)
- Packet loss, duplication, reordering
- Retransmission required
- Complex state machine

**Session Type** (from paper):
```rust
// Much more complex - see Section 4
// - Timeout branches
// - Retransmission logic
// - Sequence number validation
// - Multiple state types
```

**Modeling Complexity**: 🔴 HIGH
- Asynchronous with buffers
- Timeouts critical
- Reliability mechanisms
- Context-dependent branching
- State machine encoding

### B.3 Key Differences

| Aspect | Application Layer (SMTP) | Transport Layer (TCP) |
|--------|-------------------------|----------------------|
| **Transport** | Over TCP (reliable) | Over IP (unreliable) |
| **Reliability** | Assumed | Must implement |
| **Timeouts** | Optional | Essential |
| **Retransmission** | None | Core mechanism |
| **State Machine** | Simple | Complex (11 states) |
| **Session Types** | Standard MPST | Extended MPST |
| **Complexity** | Low | High |

**Implication for SMPST**:
- Current SMPST adequate for application-layer protocols (SMTP, HTTP, POP3)
- **Significant extensions needed** for transport-layer protocols (TCP, QUIC)

---

## Appendix C: Related SMPST Documentation

### Existing Theory Documents

1. **`docs/theory/timed-session-types.md`**
   - Status: Theory documented, NOT implemented
   - Relevance: Critical for TCP timeouts
   - Recommendation: Implement this first (Phase 1)

2. **`docs/theory/exception-handling.md`**
   - Status: Theory documented, NOT implemented
   - Relevance: Error handling, connection reset
   - Recommendation: Useful for robust TCP implementation

3. **`docs/theory/asynchronous-subtyping.md`**
   - Status: Theory documented, NOT implemented
   - Relevance: Protocol evolution, refinement
   - Recommendation: Medium priority

### Implementation Status

4. **`docs/STATUS.md`**
   - Current: Layers 1-5 complete (parser, CFG, verification, projection, simulation)
   - Strengths: CFSM async simulation with FIFO
   - Gaps: No timeouts, no bottom-up MPST, no context branching

### Architecture

5. **`docs/foundations.md`**
   - MPST formal foundations
   - LTS semantics
   - CFG approach (node-labeled vs edge-labeled)

6. **`docs/projection-design.md`**
   - Projection algorithm (global → local)
   - Follows Honda et al. (2008)
   - Relevant for TCP: Server System is a projected local type

---

**Document Status**: Complete
**Last Updated**: 2025-11-13
**Total Pages**: ~35
**Next Steps**: Review with team, prioritize roadmap phases
