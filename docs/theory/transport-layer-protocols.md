# Transport-Layer Protocol Verification - Formal Theory

**Date**: 2025-11-13
**Source**: Cavoj et al. (2024), RFC 9293
**Application**: TCP, QUIC, SCTP Modeling
**Status**: Theory documentation - Not Implemented

---

## Table of Contents

1. [Overview](#1-overview)
2. [Transport vs Application Layer](#2-transport-vs-application-layer)
3. [Reliability Mechanisms](#3-reliability-mechanisms)
4. [Network Error Models](#4-network-error-models)
5. [TCP Case Study](#5-tcp-case-study)
6. [Verification Techniques](#6-verification-techniques)
7. [Implementation Considerations](#7-implementation-considerations)
8. [References](#8-references)

---

## 1. Overview

### Motivation

**Application-Layer Protocols** (HTTP, SMTP, FTP):
- Run over **reliable transport** (TCP)
- Assume **no packet loss**
- Assume **ordered delivery**
- Assume **connection reliability**

**Transport-Layer Protocols** (TCP, QUIC, SCTP):
- Run over **unreliable network** (IP, UDP)
- Must **handle packet loss**
- Must **implement ordering**
- Must **ensure reliability**

**Key Insight**: Transport-layer protocols **implement** the reliability that application-layer protocols **assume**.

### Why Different Modeling Required

| Aspect | Application Layer | Transport Layer |
|--------|------------------|-----------------|
| **Underlying Network** | Reliable (TCP) | Unreliable (IP/UDP) |
| **Packet Loss** | Not modeled | Must handle |
| **Ordering** | Guaranteed | Must implement |
| **Retransmission** | Not needed | Core mechanism |
| **Timeouts** | Optional | Essential |
| **Session Types** | Standard MPST | Extended MPST |

---

## 2. Transport vs Application Layer

### 2.1 Application-Layer Example (SMTP)

**Protocol**:
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

**Assumptions**:
- Messages always delivered (TCP underneath)
- In-order delivery
- No timeouts needed
- No retransmission

**Session Type Modeling**: ✅ Straightforward
- Linear sequence of messages
- No failure handling
- Synchronous exchange patterns

### 2.2 Transport-Layer Example (TCP)

**Protocol** (simplified three-way handshake):
```scribble
protocol TCPHandshake(role Client, role Server) {
  Client -> Server: SYN(seq);

  // SYN may be lost! Server may need to wait or timeout
  rec WaitSyn {
    choice at Network {
      receive SYN within timeout;
    } or {
      timeout → continue WaitSyn;  // Retransmit
    }
  }

  Server -> Client: SYNACK(ack, seq);

  // SYNACK may be lost! Client may need to retransmit SYN
  rec WaitSynAck {
    choice at Network {
      receive SYNACK within timeout;
    } or {
      timeout → Client -> Server: SYN(seq);  // Retransmit
      continue WaitSynAck;
    }
  }

  Client -> Server: ACK(ack);
}
```

**Challenges**:
- Messages may be **lost** (IP is unreliable)
- **Timeouts** trigger retransmission
- **Duplicate** messages possible
- **Out-of-order** delivery possible
- **Sequence numbers** validate ordering

**Session Type Modeling**: ❌ Complex
- Requires timeout support
- Requires retransmission loops
- Requires state-dependent validation
- Requires network error injection

---

## 3. Reliability Mechanisms

### 3.1 Acknowledgments (ACKs)

**Purpose**: Confirm receipt of data

**Pattern**:
```
Sender                  Receiver
   |                       |
   |--- Data(seq=100) ---->|
   |                       | (Process data)
   |<--- Ack(ack=101) -----|
   |                       |
```

**Session Type**:
```scribble
protocol ReliableTransfer(role Sender, role Receiver) {
  Sender -> Receiver: Data(seq: Nat);
  Receiver -> Sender: Ack(ack: Nat){ack == seq + 1};
}
```

**Verification**: Ensure `ack == seq + 1` (cumulative acknowledgment).

### 3.2 Retransmission

**Trigger 1: Timeout**

```
Sender                  Receiver
   |                       |
   |--- Data(seq=100) ---->X (Lost!)
   |                       |
   | (Wait timeout...)     |
   | (Timeout expires)     |
   |--- Data(seq=100) ---->| (Retransmit)
   |                       |
   |<--- Ack(ack=101) -----|
   |                       |
```

**Session Type**:
```scribble
protocol TimeoutRetransmit(role Sender, role Receiver) {
  rec Loop {
    Sender -> Receiver: Data(seq);

    choice at Sender {
      Receiver -> Sender: Ack() within timeout;
      // Success, continue
    } or {
      timeout;
      // Retransmit
      continue Loop;
    }
  }
}
```

**Trigger 2: Duplicate ACK (Fast Retransmit)**

```
Sender                  Receiver
   |                       |
   |--- Data(seq=100) ---->| ✓
   |<--- Ack(ack=101) -----|
   |                       |
   |--- Data(seq=101) ---->X (Lost!)
   |                       |
   |--- Data(seq=102) ---->| (Out of order!)
   |<--- Ack(ack=101) -----| (Duplicate ACK)
   |--- Data(seq=103) ---->| (Out of order!)
   |<--- Ack(ack=101) -----| (Duplicate ACK #2)
   |--- Data(seq=104) ---->| (Out of order!)
   |<--- Ack(ack=101) -----| (Duplicate ACK #3 → Retransmit!)
   |                       |
   |--- Data(seq=101) ---->| (Fast retransmit)
   |<--- Ack(ack=105) -----| (All data received!)
```

**Session Type**:
```scribble
protocol FastRetransmit(role Sender, role Receiver) {
  rec Loop {
    Sender -> Receiver: Data(seq);

    rec WaitAck {
      Receiver -> Sender: Ack(ack);

      choice at Sender {
        // New ACK (progress)
        ack > prev_ack → continue Loop;
      } or {
        // Duplicate ACK (count)
        ack == prev_ack → {
          dupAckCount++;
          if (dupAckCount >= 3) {
            // Fast retransmit
            Sender -> Receiver: Data(missing_seq);
            dupAckCount = 0;
          }
          continue WaitAck;
        }
      }
    }
  }
}
```

### 3.3 Retransmission Queue

**Data Structure**:
```typescript
interface RetransmissionQueue {
  // Segments awaiting acknowledgment
  unacked: Map<SeqNum, Segment>;

  // Oldest unacknowledged segment
  oldestSeq: SeqNum;

  // Retransmission timer
  rto: Duration;  // Retransmission Timeout

  // Operations
  add(seg: Segment): void;
  ack(ackNum: SeqNum): void;  // Remove acked segments
  checkTimeout(): Segment[];  // Get segments to retransmit
}
```

**Semantics**:
- **Add**: When segment sent, add to queue
- **Ack**: When ACK received, remove segments with seq < ack
- **Timeout**: If timer expires, retransmit oldest unacked segment

### 3.4 Sliding Window

**Purpose**: Flow control (don't overwhelm receiver)

**Mechanism**:
```
Send Window:
  [Sent & Acked] [Sent & Not Acked] [Not Sent] [Beyond Window]
                 ^                  ^
                 |                  |
              SendBase          SendBase + WindowSize
```

**Invariant**:
$$
\text{NumUnacked} = \text{SendNext} - \text{SendBase} \leq \text{WindowSize}
$$

**Session Type**:
```scribble
protocol SlidingWindow(role Sender, role Receiver, windowSize: Nat) {
  rec Loop {
    // Can only send if window not full
    if (unacked < windowSize) {
      Sender -> Receiver: Data(seq);
      unacked++;
    }

    // Receive ACKs
    Receiver -> Sender: Ack(ack);
    unacked -= (ack - prevAck);  // Cumulative ACK

    continue Loop;
  }
}
```

---

## 4. Network Error Models

### 4.1 Error Types

#### Packet Loss
```
Sender ---X (Dropped by network)
```

**Model**: Probabilistic loss rate (e.g., 1% loss)

#### Packet Duplication
```
Sender --- Packet ---+---> Receiver
                     |
                     +---> Receiver (duplicate!)
```

**Model**: Occasional duplicates (e.g., 0.1% dup rate)

#### Packet Reordering
```
Sender --- Packet A ---------+---> Receiver (arrives 2nd)
       |                     |
       +-- Packet B ------+--+---> Receiver (arrives 1st!)
```

**Model**: Reorder within window (e.g., ±3 packets)

#### Packet Delay
```
Sender --- Packet --- (delay) --- (delay) ---> Receiver
```

**Model**: Variable latency (e.g., 10-100ms range)

### 4.2 Network Simulator

```typescript
interface NetworkSimulator {
  // Configuration
  lossRate: number;      // 0.0 - 1.0
  dupRate: number;       // 0.0 - 1.0
  reorderProb: number;   // 0.0 - 1.0
  delayRange: [number, number];  // Min/max latency (ms)

  // Inject errors
  send(msg: Message): DeliveryResult;
}

type DeliveryResult =
  | { type: 'delivered', delay: number }
  | { type: 'lost' }
  | { type: 'duplicated', count: number }
  | { type: 'reordered', newIndex: number };
```

**Usage in Tests**:
```typescript
describe('TCP Reliability', () => {
  it('should recover from 10% packet loss', async () => {
    const network = new NetworkSimulator({ lossRate: 0.1 });
    const tcp = new TcpProtocol(network);

    const data = "Hello, World!";
    await tcp.send(data);

    // Verify eventual delivery despite loss
    expect(await tcp.receive()).toBe(data);
  });
});
```

---

## 5. TCP Case Study

### 5.1 TCP State Machine

**States** (from RFC 9293):
```
CLOSED → LISTEN → SYN-RCVD → ESTABLISHED →
  → FIN-WAIT-1 → FIN-WAIT-2 → TIME-WAIT → CLOSED

Or:
  → CLOSE-WAIT → LAST-ACK → CLOSED
```

**Session Type Encoding**:
```rust
// Each state is a session type
type TcpClosed = ...;
type TcpListen = ...;
type TcpSynRcvd = ...;
type TcpEstablished = ...;
// etc.
```

### 5.2 Three-Way Handshake (with Loss Handling)

**From Cavoj et al. (2024)**:

```rust
type ServerSystemSessionType = St! {
    (ServerUser & Open).
    (ServerUser + TcbCreated).
    (ClientSystem & Syn).
    (ClientSystem + SynAck).
    ServerSystemSynRcvd
};

type ServerSystemSynRcvd = St! {
    (ClientSystem & {
        Ack.  // Acceptable ACK
            (ServerUser + Connected).
            ServerSystemEstablished,
        Ack.  // Unacceptable ACK (wrong seq)
            (ClientSystem + {
                Ack.ServerSystemSynRcvd,  // Retry
                Rst.(ServerUser + Close).end  // Reset
            })
    })
};
```

**Handles**:
- Acceptable vs unacceptable ACK (sequence validation)
- Retransmission (retry path)
- Connection reset (failure path)

### 5.3 Data Transfer (with Retransmission)

**Session Type**:
```rust
type ServerSystemEstablished = St! {
    (ClientSystem & {
        Data.  // New data
            (ClientSystem + Ack).
            (ServerUser + Data).
            ServerSystemEstablished,

        Ack.  // ACK only (no data)
            ServerSystemEstablished,

        Timeout.  // Retransmission timeout
            (ClientSystem + Data /* retransmit */).
            ServerSystemEstablished,

        FinAck.  // Peer closing
            (ClientSystem + Ack).
            ServerSystemCloseWait
    })
};
```

**Key Features**:
- Timeout as virtual message type
- Retransmission triggered by timeout branch
- Acceptable/unacceptable segments handled

### 5.4 Connection Closing

**Four-Way Handshake**:
```
Client                  Server
   |                       |
   |--- FIN(seq=x) ------->|
   |<--- ACK(ack=x+1) -----|
   |                       |
   |<--- FIN(seq=y) -------|
   |--- ACK(ack=y+1) ----->|
   |                       |
```

**Session Type**:
```rust
type ServerSystemFinWait1 = St! {
    (ClientSystem & {
        Ack.  // ACK of our FIN
            ServerSystemFinWait2,
        FinAck.  // FIN+ACK simultaneous
            (ClientSystem + Ack).
            end
    })
};
```

---

## 6. Verification Techniques

### 6.1 Eventual Delivery

**Property**: All sent messages eventually delivered (if connection established).

**Verification**:
```
∀ msg sent: ∃ time t: msg delivered at t
```

**Proof Sketch**:
1. Retransmission ensures repeated attempts
2. Timeout increases exponentially (bounded)
3. Either message delivered or connection fails
4. Both outcomes acceptable (safety preserved)

### 6.2 In-Order Delivery

**Property**: Messages delivered to application in send order.

**Verification**:
```
send_order = [m₁, m₂, m₃, ...]
deliver_order = [m₁, m₂, m₃, ...]
∀ i, j: i < j ⇒ deliver(mᵢ) before deliver(mⱼ)
```

**Mechanism**: Sequence numbers + receive buffer reordering

### 6.3 No Duplication

**Property**: Each message delivered exactly once (at application level).

**Verification**:
```
∀ msg: count(delivered, msg) = 1
```

**Mechanism**:
- Sequence numbers detect duplicates
- Receiver discards duplicates (seq < next_expected)
- ACKs prevent unnecessary retransmissions

### 6.4 Timeout Correctness

**Property**: RTO (Retransmission Timeout) eventually triggers if ACK not received.

**Verification**:
```
send(msg) at time t₀
no ACK received
⇒ timeout fires at time t₀ + RTO
⇒ retransmit(msg) at time t₀ + RTO
```

**Dynamic RTO**: Adapts based on RTT (Round-Trip Time) measurements.

---

## 7. Implementation Considerations

### 7.1 Extended CFSM Simulator

**Additions for Transport Layer**:

```typescript
interface TransportCFSM extends CFSM {
  // Retransmission queue
  retxQueue: RetransmissionQueue;

  // Network simulator (for testing)
  network: NetworkSimulator;

  // Timeout mechanism
  timers: Map<TimerID, Timer>;

  // Sequence number state
  sendSeq: number;
  recvSeq: number;

  // Window management
  sendWindow: SlidingWindow;
  recvWindow: SlidingWindow;
}
```

**Event Types**:
```typescript
type TransportEvent =
  | { type: 'send', seq: number, data: any }
  | { type: 'receive', seq: number, data: any }
  | { type: 'ack', ack: number }
  | { type: 'timeout', seq: number }
  | { type: 'retransmit', seq: number }
  | { type: 'duplicate', seq: number }
  | { type: 'outoforder', seq: number, expected: number };
```

### 7.2 Testing Strategy

**Test Categories**:

1. **Perfect Network** (baseline)
   - No loss, no reordering
   - Verify basic protocol

2. **Packet Loss**
   - 1%, 5%, 10% loss rates
   - Verify retransmission

3. **Packet Reordering**
   - Random reordering
   - Verify buffering + reordering

4. **Packet Duplication**
   - Occasional duplicates
   - Verify deduplication

5. **Combined Errors**
   - Loss + reordering + duplication
   - Verify robustness

**Example Test**:
```typescript
describe('TCP Reliability Mechanisms', () => {
  it('should handle 10% loss with retransmission', async () => {
    const network = new NetworkSimulator({ lossRate: 0.1 });
    const server = new TcpServer(network);
    const client = new TcpClient(network);

    await server.listen();
    await client.connect(server.address);

    // Send 100 messages
    for (let i = 0; i < 100; i++) {
      await client.send(`Message ${i}`);
    }

    // Verify all received (despite 10% loss)
    const received = await server.receiveAll();
    expect(received.length).toBe(100);
    expect(received).toEqual(
      Array.from({length: 100}, (_, i) => `Message ${i}`)
    );
  });
});
```

### 7.3 Visualization

**Sequence Diagram with Errors**:
```
Client          Network         Server
   |                |               |
   |-- Data(1) ---->X (Lost)        |
   |                |               |
   | (Timeout)      |               |
   |-- Data(1) ---------------------| (Retransmit)
   |                |               |
   |                |<---- Ack(2) --|
   |<---- Ack(2) ---|               |
```

**CFSM State Visualization**:
- Show current state
- Highlight retransmission queue
- Display timeout countdowns
- Indicate network errors

---

## 8. References

### Primary Papers

**Cavoj et al. (2024)**:
- **Title**: "Session Types for the Transport Layer: Towards an Implementation of TCP"
- **Source**: arXiv:2404.05478v1
- **URL**: https://arxiv.org/abs/2404.05478
- **Key Contributions**:
  - TCP session type specification (§4)
  - Timeout emulation via virtual messages (§4.6)
  - Retransmission handling (§A.2)
  - Interoperability testing (§5)

**RFC 9293**:
- **Title**: "Transmission Control Protocol (TCP)"
- **URL**: https://www.rfc-editor.org/rfc/rfc9293
- **Specification**: TCP state machine, reliability mechanisms, algorithms

### Related Work

**Session Types for Application Layer**:
- SMTP, POP3, HTTP modeling
- Assume reliable transport
- Simpler than transport layer

**Timed Session Types**:
- Bocchi et al. (2014): Timed MPST
- ECOOP 2024: Fearless async with timeouts
- Critical for transport layer

**Verification**:
- Brand & Zafiropulo (1983): Communicating systems verification
- Distributed protocol correctness

---

## 9. Comparison: SMTP vs TCP

| Aspect | SMTP (Application) | TCP (Transport) |
|--------|-------------------|-----------------|
| **Protocol Type** | Request-response | Connection-oriented |
| **Reliability** | Assumed (runs on TCP) | Implemented |
| **Message Loss** | Not modeled | Handled via retx |
| **Timeouts** | Optional | Essential |
| **Sequence Numbers** | Not used | Core mechanism |
| **State Machine** | Simple (5 states) | Complex (11 states) |
| **Session Types** | Standard MPST | Extended MPST |
| **Verification** | Structural | Structural + Semantic |
| **Testing** | Unit tests sufficient | Network simulation required |

---

## 10. Future Work for SMPST

### Phase 1: Network Error Injection (Weeks 1-2)
- Implement `NetworkSimulator` with loss/dup/reorder
- Integrate with CFSM simulator
- Add network error events to trace

### Phase 2: Timeout Mechanism (Weeks 3-4)
- Implement timer system
- Virtual timeout messages
- RTO calculation (dynamic)

### Phase 3: Retransmission Queue (Weeks 5-6)
- Implement retransmission queue data structure
- Integrate with CFSM state
- Trigger retransmission on timeout

### Phase 4: TCP Implementation (Weeks 7-8)
- Model TCP three-way handshake with errors
- Model data transfer with retransmission
- Model connection closing
- Interoperability tests

### Phase 5: Verification (Weeks 9-10)
- Verify eventual delivery property
- Verify in-order delivery
- Verify no duplication
- Performance testing

---

**Document Status**: Complete
**Last Updated**: 2025-11-13
**Implementation Priority**: 🔴 **CRITICAL** (needed for TCP support)
**Estimated Effort**: 8-10 weeks
**Dependencies**: Timed session types, refinement types
