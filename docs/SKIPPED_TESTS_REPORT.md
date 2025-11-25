# Skipped Tests Report

**Generated:** 2025-11-25
**Total Skipped Tests:** 73
**Test Framework:** Vitest

---

## Executive Summary

The codebase contains **73 skipped tests** across 5 test files. The vast majority (72 tests) are related to **DMst (Dynamically Updatable Multiparty Session Types)** features that are planned but not yet implemented. These tests follow a **Test-Driven Development (TDD)** approach where tests are written before implementation.

| Category | Count | Status |
|----------|-------|--------|
| DMst Theorem Tests | 72 | Planned - awaiting implementation |
| Parser Limitations | 1 | Known limitation |

---

## Detailed Breakdown by File

### 1. Integration Edge Cases (1 skipped test)

**File:** `src/__tests__/integration/edge-cases.test.ts:337`

| Test Name | Reason |
|-----------|--------|
| `should handle nested recursion (PARSER LIMITATION)` | Parser does not support nested recursion (`rec` inside `rec`) |

**Details:**
This is a **known parser limitation**, not a safety checker bug. The Scribble parser implementation expects a simpler recursion structure and cannot produce CFSMs for nested recursive protocols.

```typescript
// Example of unsupported syntax:
protocol NestedRec(role A, role B) {
  rec Outer {
    msg1() from A to B;
    rec Inner {
      msg2() from B to A;
      choice at A {
        repeat() from A to B;
        continue Inner;
      } or {
        breakInner() from A to B;
      }
    }
    // ...
  }
}
```

**To Implement:**
- Parser support for nested `rec` blocks
- Parser support for `continue` statements inside choice branches

---

### 2. Theorem 29: Liveness for DMst (22 skipped tests)

**File:** `src/__tests__/theorems/dmst/theorem-29-liveness.test.ts`

**Paper Reference:** Castro-Perez & Yoshida, ECOOP 2023, §4.3, Theorem 29

**Theorem Statement:**
> Well-formed dynamically updatable protocols satisfy liveness properties:
> 1. **Orphan Message Freedom:** Every message sent is eventually received
> 2. **No Stuck Participants:** Every participant either completes or can make progress
> 3. **Eventual Delivery:** Messages in FIFO buffers are eventually consumed

#### Skipped Tests by Category:

**Proof Obligation 1: Orphan Message Freedom (4 tests)**
| Line | Test Name |
|------|-----------|
| 124 | `proves: simple protocol has no orphan messages` |
| 150 | `proves: dynamic participant messages are not orphaned` |
| 173 | `proves: protocol call messages are not orphaned` |
| 194 | `proves: updatable recursion messages are not orphaned` |

**Proof Obligation 2: No Stuck Participants (4 tests)**
| Line | Test Name |
|------|-----------|
| 226 | `proves: static participants never get stuck` |
| 254 | `proves: dynamic participants never get stuck` |
| 272 | `proves: participants in protocol calls never get stuck` |
| 280 | `proves: choice branches never leave participants stuck` |

**Proof Obligation 3: Eventual Delivery (4 tests)**
| Line | Test Name |
|------|-----------|
| 310 | `proves: FIFO buffers eventually deliver all messages` |
| 336 | `proves: parallel branches deliver all messages` |
| 350 | `proves: dynamic participants deliver all messages` |
| 359 | `proves: updatable recursion has bounded buffers` |

**Proof Obligation 4: Asynchronous Liveness (3 tests)**
| Line | Test Name |
|------|-----------|
| 390 | `proves: delayed messages eventually delivered` |
| 406 | `proves: asynchronous choice preserves liveness` |
| 421 | `proves: concurrent sends preserve liveness` |

**Proof Obligation 5: Complete DMst Liveness (2 tests)**
| Line | Test Name |
|------|-----------|
| 444 | `proves: dynamic pipeline satisfies all liveness properties` |
| 474 | `proves: map-reduce satisfies liveness` |

**Counterexamples (4 tests)**
| Line | Test Name |
|------|-----------|
| 491 | `counterexample: orphaned message (missing receiver)` |
| 505 | `counterexample: stuck participant (no progress)` |
| 521 | `counterexample: unbounded buffer growth` |
| 534 | `counterexample: orphaned dynamic participant` |

**Integration Tests (2 tests)**
| Line | Test Name |
|------|-----------|
| 555 | `proves: deadlock-free implies no stuck participants` |
| 564 | `proves: well-formed DMst satisfies both safety and liveness` |

**Implementation Requirements:**
- [ ] Algorithm: `extractSendReceivePairs(CFSMs) → pairs`
- [ ] Check: `allSendsHaveReceivers(pairs) → boolean`
- [ ] Algorithm: `buildParticipantStateGraphs(CFG) → graphs`
- [ ] Check: `allParticipantsProgress(graphs) → boolean`
- [ ] Simulation: `FIFOBufferSimulator` for message delivery
- [ ] Check: `noOrphanedDynamicParticipants() → boolean`
- [ ] Verification: `protocolCallsCompleteDelivery() → boolean`
- [ ] Property: `updatableRecursionBoundedBuffers() → boolean`

---

### 3. Theorem 20: Trace Equivalence for DMst (13 skipped tests)

**File:** `src/__tests__/theorems/dmst/theorem-20-trace-equivalence.test.ts`

**Paper Reference:** Castro-Perez & Yoshida, ECOOP 2023, §4, Theorem 20

**Theorem Statement:**
> For a dynamically updatable protocol G with dynamic participants, the global semantics and local semantics produce equivalent traces.

#### Skipped Tests by Category:

**Proof Obligation 1: Dynamic Participant Creation (2 tests)**
| Line | Test Name |
|------|-----------|
| 104 | `proves: simple dynamic participant trace equivalence` |
| 133 | `proves: multiple dynamic participants trace equivalence` |

**Proof Obligation 2: Protocol Calls with Combining Operator (3 tests)**
| Line | Test Name |
|------|-----------|
| 183 | `proves: simple protocol call trace equivalence` |
| 205 | `proves: nested protocol calls trace equivalence` |
| 214 | `proves: parallel protocol calls trace equivalence` |

**Proof Obligation 3: Updatable Recursion (3 tests)**
| Line | Test Name |
|------|-----------|
| 269 | `proves: simple updatable recursion trace equivalence` |
| 278 | `proves: updatable recursion with protocol calls` |
| 298 | `proves: multiple concurrent updatable loops` |

**Proof Obligation 4: Complete DMst Protocols (2 tests)**
| Line | Test Name |
|------|-----------|
| 321 | `proves: dynamic pipeline example from paper` |
| 330 | `proves: map-reduce with dynamic workers` |

**Counterexamples (3 tests)**
| Line | Test Name |
|------|-----------|
| 345 | `counterexample: unsafe protocol update breaks trace equivalence` |
| 353 | `counterexample: unguarded dynamic creation breaks traces` |
| 361 | `counterexample: non-deterministic participant creation` |

**Implementation Requirements:**
- [ ] Parser support for `new role` declarations
- [ ] Parser support for `p calls Proto(q)` syntax
- [ ] Parser support for `continue X with { ... }` updatable recursion
- [ ] CFG nodes for: `ProtocolCallAction`, `CreateParticipantsAction`, `InvitationAction`
- [ ] Projection algorithm for dynamic participants (Definition 12)
- [ ] Projection algorithm for updatable recursion (Definition 13)
- [ ] Trace extraction from CFSMs with dynamic participants
- [ ] Combining operator ♢ implementation

---

### 4. Definition 14: Safe Protocol Update (17 skipped tests)

**File:** `src/__tests__/theorems/dmst/definition-14-safe-update.test.ts`

**Paper Reference:** Castro-Perez & Yoshida, ECOOP 2023, §3.2, Definition 14

**Definition Statement:**
> An updatable recursion μt.C[t ♦ (γ⃗. p ↪→ x⟨q⃗⟩)] is safe if and only if the 1-unfolding is safe.

#### Skipped Tests by Category:

**Proof Obligation 1: Independent Action Updates (2 tests)**
| Line | Test Name |
|------|-----------|
| 128 | `proves: adding independent action is safe` |
| 174 | `proves: adding parallel independent action is safe` |

**Proof Obligation 2: Dynamic Participant Updates (2 tests)**
| Line | Test Name |
|------|-----------|
| 215 | `proves: creating new participant in update is safe` |
| 245 | `proves: protocol call in update is safe` |

**Proof Obligation 3: Combining Operator Safety (3 tests)**
| Line | Test Name |
|------|-----------|
| 283 | `proves: disjoint protocols combine safely` |
| 293 | `proves: shared coordinator combines safely` |
| 304 | `proves: sequential dependencies combine safely` |

**Proof Obligation 4: Well-Formedness Preservation (4 tests)**
| Line | Test Name |
|------|-----------|
| 335 | `proves: safe update preserves connectedness` |
| 344 | `proves: safe update preserves determinism` |
| 352 | `proves: safe update preserves race-freedom` |
| 360 | `proves: safe update preserves progress` |

**Counterexamples (4 tests)**
| Line | Test Name |
|------|-----------|
| 373 | `counterexample: update creates race condition` |
| 401 | `counterexample: update creates deadlock` |
| 412 | `counterexample: update violates progress` |
| 422 | `counterexample: non-deterministic update` |

**Edge Cases (3 tests)**
| Line | Test Name |
|------|-----------|
| 437 | `handles: empty update (no-op)` |
| 446 | `handles: nested updatable recursions` |
| 463 | `handles: update with multiple protocol calls` |

**Implementation Requirements:**
- [ ] Parser support for `continue X with { ... }` syntax
- [ ] AST node for `UpdatableRecursion`
- [ ] CFG node for `RecursionUpdate`
- [ ] Algorithm: `compute1Unfolding(μX.G, G_update) → G'`
- [ ] Algorithm: `checkSafeUpdate(1-unfolding) → boolean`
- [ ] Verification: well-formedness on 1-unfolding
- [ ] Combining operator ♦ implementation for interleaving

---

### 5. Theorem 23: Deadlock-Freedom for DMst (20 skipped tests)

**File:** `src/__tests__/theorems/dmst/theorem-23-deadlock-freedom.test.ts`

**Paper Reference:** Castro-Perez & Yoshida, ECOOP 2023, §4.2, Theorem 23

**Theorem Statement:**
> Well-formed dynamically updatable protocols are deadlock-free.

#### Skipped Tests by Category:

**Proof Obligation 1: Static DMst Protocols (2 tests)**
| Line | Test Name |
|------|-----------|
| 119 | `proves: simple DMst protocol is deadlock-free` |
| 149 | `proves: DMst choice protocol is deadlock-free` |

**Proof Obligation 2: Dynamic Participant Creation (3 tests)**
| Line | Test Name |
|------|-----------|
| 174 | `proves: single dynamic participant is deadlock-free` |
| 203 | `proves: multiple dynamic participants are deadlock-free` |
| 223 | `proves: dynamic participant with choice is deadlock-free` |

**Proof Obligation 3: Protocol Calls (3 tests)**
| Line | Test Name |
|------|-----------|
| 259 | `proves: simple protocol call is deadlock-free` |
| 282 | `proves: nested protocol calls are deadlock-free` |
| 291 | `proves: parallel protocol calls are deadlock-free` |

**Proof Obligation 4: Updatable Recursion (3 tests)**
| Line | Test Name |
|------|-----------|
| 327 | `proves: simple updatable recursion is deadlock-free` |
| 363 | `proves: updatable recursion with dynamic participants is deadlock-free` |
| 389 | `proves: updatable recursion with protocol calls is deadlock-free` |

**Proof Obligation 5: Complete DMst Protocols (3 tests)**
| Line | Test Name |
|------|-----------|
| 409 | `proves: dynamic pipeline example is deadlock-free` |
| 418 | `proves: map-reduce with dynamic workers is deadlock-free` |
| 428 | `proves: recursive server with client spawning is deadlock-free` |

**Counterexamples (4 tests)**
| Line | Test Name |
|------|-----------|
| 446 | `counterexample: unsafe update creates deadlock` |
| 469 | `counterexample: missing invitation causes deadlock` |
| 480 | `counterexample: circular protocol calls create deadlock` |
| 491 | `counterexample: conflicting combining operators` |

**State Graph Verification (1 test)**
| Line | Test Name |
|------|-----------|
| 507 | `verifies: all reachable states can progress or terminate` |

**Implementation Requirements:**
- [ ] Extend connectedness check to dynamic participants
- [ ] Extend race detection to protocol calls
- [ ] Implement safe update verification (Definition 14)
- [ ] Build state reachability graph for DMst protocols
- [ ] Check enabled actions at each state
- [ ] Verify invitation synchronization
- [ ] Combining operator ♢ safety checks

---

## Implementation Roadmap

### Phase 1: Parser Extensions
1. Add `new role` declaration syntax
2. Add `p calls Proto(q)` protocol call syntax
3. Add `continue X with { ... }` updatable recursion syntax
4. Support nested `rec` blocks (optional - addresses 1 skipped test)

### Phase 2: AST/CFG Extensions
1. Add `UpdatableRecursion` AST node
2. Add `CreateParticipantsAction` CFG node
3. Add `ProtocolCallAction` CFG node
4. Add `InvitationAction` CFG node
5. Add `RecursionUpdate` CFG node

### Phase 3: Projection Algorithms
1. Implement projection for dynamic participants (Definition 12)
2. Implement projection for updatable recursion (Definition 13)
3. Implement combining operator ♢

### Phase 4: Verification
1. Implement `compute1Unfolding` algorithm
2. Implement `checkSafeUpdate` for Definition 14
3. Extend connectedness checking
4. Extend race detection
5. Build state reachability graph

### Phase 5: Liveness Verification
1. Implement `extractSendReceivePairs`
2. Implement `buildParticipantStateGraphs`
3. Implement `FIFOBufferSimulator`
4. Implement orphan detection

---

## References

- Castro-Perez, D., & Yoshida, N. (2023). *Dynamically Updatable Multiparty Session Protocols: Generate Efficient Distributed Implementations, Modularly*. ECOOP 2023.
- Honda, K., Yoshida, N., & Carbone, M. (2016). *Multiparty Asynchronous Session Types*. JACM 2016.
- Deniélou, P.-M., & Yoshida, N. (2012). *Multiparty Session Types Meet Communicating Automata*. ESOP 2012.

---

## Notes

- All DMst-related tests are intentionally skipped as they follow TDD methodology
- Tests are comprehensive and well-documented with formal proof obligations
- Implementation should follow the phase roadmap above
- The single parser limitation test is a separate concern from DMst features
