# DMst Implementation Plan: Enabling 74 Skipped Tests

## Executive Summary

The 74 skipped tests require completing the DMst (Dynamically Updatable Multiparty Session Types) implementation from ECOOP 2023. The infrastructure is partially built, but key integration points need completion.

## Current State Analysis

### Already Implemented ✓
- **Lexer tokens**: All DMst keywords (`new`, `creates`, `invites`, `calls`, `with`)
- **Parser rules**: Grammar for all DMst constructs exists
- **AST types**: `CreateParticipants`, `UpdatableRecursion`, `DynamicRoleDeclaration`, etc.
- **CFG types**: `CreateParticipantsAction`, `UpdatableRecursionAction`, etc.
- **CFG builder**: Functions to build CFG nodes from AST
- **Runtime**: `DMstSimulator` with protocol call stack semantics
- **Liveness**: `verifyLiveness()` with orphan/progress checking

### Missing/Incomplete ✗
1. **Parser CST→AST transformation** for DMst constructs
2. **Projection** for dynamic participant actions
3. **Safe Update verification** (Definition 14)
4. **1-Unfolding computation** for updatable recursion
5. **Full integration testing**

---

## Phase 1: Parser Completion (8 tests)

### 1.1 CST→AST Visitor for DMst Constructs

**Files to modify**: `src/core/parser/parser.ts`

The parser rules exist but CST→AST visitors need completion:

```typescript
// Required AST builders to verify/complete:
visitDynamicRoleDeclaration(ctx) → DynamicRoleDeclaration
visitCreateParticipants(ctx) → CreateParticipants
visitInvitation(ctx) → Invitation
visitUpdatableRecursion(ctx) → UpdatableRecursion
visitProtocolCall(ctx) → ProtocolCall
```

**Test criteria**: Parse all DMst syntax patterns from test comments:
- `new role Worker;`
- `Manager creates Worker;`
- `Manager creates Worker as w1;`
- `Manager invites Worker;`
- `continue Loop with { ... };`
- `Coordinator calls SubTask(Worker);`

### 1.2 Parser Ambiguity Resolution

**Issue**: `continueStatement` vs `updatableRecursion` both start with `continue Identifier`

**Solution**: Use lookahead or GATE:
```typescript
// continueStatement: continue Identifier ;
// updatableRecursion: continue Identifier with { ... } ;

private globalInteraction = this.RULE('globalInteraction', () => {
  this.OR([
    // Put updatableRecursion BEFORE continueStatement with GATE
    {
      GATE: () => this.LA(3).tokenType === With,  // Lookahead for 'with'
      ALT: () => this.SUBRULE(this.updatableRecursion)
    },
    { ALT: () => this.SUBRULE(this.continueStatement) },
    // ... other alternatives
  ]);
});
```

---

## Phase 2: Projection for DMst (19 tests)

### 2.1 Dynamic Participant Projection

**File**: `src/core/projection/dmst-projector.ts`

Implement projection rules for:

1. **CreateParticipantsAction** → Creates new CFSM instance
2. **InvitationAction** → Synchronization point in both inviter/invitee CFSMs
3. **DynamicRoleDeclaration** → Registers role template in projection context

```typescript
export function projectDynamicParticipant(
  cfg: CFG,
  dynamicRole: string,
  creatorRole: string
): CFSM {
  // 1. Find CreateParticipants node for this role
  // 2. Start CFSM at creation point (not initial)
  // 3. Project all transitions involving this role
  // 4. Handle invitation synchronization
}
```

### 2.2 Protocol Call Projection

**Files**: `src/core/projection/dmst-projector.ts`, `src/core/projection/projector.ts`

```typescript
export function projectProtocolCall(
  action: ProtocolCallAction,
  currentRole: string,
  subProtocolCFSMs: Map<string, CFSM>
): CFSMTransition[] {
  // 1. Look up role in roleMapping
  // 2. Get sub-protocol CFSM for mapped role
  // 3. Create subprotocol-call transition
  // 4. Handle return state after sub-protocol completes
}
```

### 2.3 Updatable Recursion Projection

```typescript
export function projectUpdatableRecursion(
  action: UpdatableRecursionAction,
  updateBody: CFG,
  currentRole: string
): CFSMTransition[] {
  // 1. Project base recursion normally
  // 2. For 'continue X with { G }':
  //    - Compute 1-unfolding (G; rec X)
  //    - Project 1-unfolding
  //    - Add transitions for update body
}
```

---

## Phase 3: Safe Update Verification - Definition 14 (18 tests)

### 3.1 1-Unfolding Computation

**File**: `src/core/verification/dmst/safe-update.ts`

```typescript
/**
 * Definition 13: 1-unfolding of updatable recursion
 *
 * Given: rec X { G; continue X with { G' } }
 * 1-unfolding: G; G'; rec X { G; continue X with { G' } }
 */
export function compute1Unfolding(
  recursionBody: CFG,
  updateBody: CFG
): CFG {
  // 1. Clone recursionBody → G1
  // 2. Clone updateBody → G'
  // 3. Clone recursionBody again → G2
  // 4. Connect: G1 → G' → G2 (with back-edge to start of G2)
  // 5. Return combined CFG
}
```

### 3.2 Safe Update Check

```typescript
/**
 * Definition 14: Safe Protocol Update
 *
 * An update is safe iff:
 * 1. Channel disjointness: channels(G') ∩ channels(G) doesn't cause races
 * 2. Well-formedness preserved: 1-unfolding is well-formed
 *    - Connectedness
 *    - Determinism
 *    - Race-freedom
 *    - Progress
 */
export function checkSafeUpdate(
  oneUnfolding: CFG
): SafeUpdateResult {
  // 1. Extract channels from original vs update
  // 2. Check for race conditions
  // 3. Verify well-formedness properties
  // 4. Return detailed result
}
```

### 3.3 Combining Operator Verification

**File**: `src/core/cfg/combining-operator.ts`

Complete the interleaving composition:
```typescript
export function interleavingCompose(cfg1: CFG, cfg2: CFG): CFG {
  // 1. Create product state space: S = S₁ × S₂
  // 2. For each (s₁, s₂):
  //    - If cfg1 can step: add (s₁, s₂) → (s₁', s₂)
  //    - If cfg2 can step: add (s₁, s₂) → (s₁, s₂')
  // 3. Initial: (initial₁, initial₂)
  // 4. Terminal: both terminal
}
```

---

## Phase 4: Trace Equivalence - Theorem 20 (13 tests)

### 4.1 Dynamic Participant Trace Extraction

**File**: `src/core/verification/dmst/trace-equivalence.ts`

```typescript
export function extractDynamicParticipantTraces(
  projections: Map<string, CFSM>,
  dynamicRoleName: string
): TraceEvent[][] {
  // 1. Find all instances of dynamicRoleName
  // 2. For each instance:
  //    - Find creation point in global trace
  //    - Extract local trace from creation point
  // 3. Return array of traces (one per instance)
}
```

### 4.2 Protocol Call Trace Composition

```typescript
export function composeProtocolCallTraces(
  callerTrace: TraceEvent[],
  calleeTrace: TraceEvent[],
  callAction: ProtocolCallAction
): TraceEvent[] {
  // 1. Find call point in caller trace
  // 2. Insert callee trace at call point
  // 3. Continue with caller trace after call
  // 4. Handle role mapping in traces
}
```

---

## Phase 5: Deadlock Freedom - Theorem 23 (19 tests)

### 5.1 DMst-Aware Safety Checker

**File**: `src/core/verification/dmst/safety.ts`

```typescript
export function checkDMstDeadlockFreedom(
  cfg: CFG,
  projections: Map<string, CFSM>,
  dynamicRoleTemplates: Map<string, CFSM>
): DeadlockResult {
  // 1. Standard safety check for static participants
  // 2. For each reachable CreateParticipants:
  //    - Instantiate dynamic role CFSM
  //    - Extend state space with new participant
  //    - Check combined system for deadlocks
  // 3. For protocol calls:
  //    - Check sub-protocol is deadlock-free
  //    - Check composition is deadlock-free
  // 4. For updatable recursion:
  //    - Check 1-unfolding is deadlock-free
}
```

---

## Phase 6: Integration & Test Enablement (7 tests)

### 6.1 End-to-End Pipeline

```typescript
// Full DMst verification pipeline
export function verifyDMstProtocol(source: string): VerificationResult {
  // 1. Parse → AST (with DMst constructs)
  // 2. Build CFG (with DMst actions)
  // 3. Project to CFSMs (with dynamic participants)
  // 4. Verify safety (Theorem 23)
  // 5. Verify liveness (Theorem 29)
  // 6. Check trace equivalence (Theorem 20)
  // 7. If updatable: verify safe update (Definition 14)
}
```

### 6.2 Test Enablement Strategy

For each skipped test:

1. **Remove `.skip`** when underlying feature is complete
2. **Update test assertions** to use implemented APIs
3. **Add regression tests** for edge cases found

---

## Implementation Order

| Phase | Description | Tests Enabled | Dependencies |
|-------|-------------|---------------|--------------|
| 1 | Parser CST→AST | 8 | None |
| 2 | DMst Projection | 19 | Phase 1 |
| 3 | Safe Update (Def 14) | 18 | Phase 1, 2 |
| 4 | Trace Equivalence (Thm 20) | 13 | Phase 1, 2 |
| 5 | Deadlock Freedom (Thm 23) | 19 | Phase 1, 2, 3 |
| 6 | Integration | 7 | All above |

**Total**: 74 tests → 0 skipped

---

## Test Breakdown by Feature

### Theorem 29 - Liveness (23 skipped)
- Orphan freedom: 4 tests
- Stuck participants: 4 tests
- Eventual delivery: 4 tests
- Async properties: 3 tests
- Complex protocols: 2 tests
- Counterexamples: 4 tests
- Integration: 2 tests

### Definition 14 - Safe Update (18 skipped)
- Independent actions: 2 tests
- Dynamic participants: 2 tests
- Protocol calls: 1 test
- Combining operator: 3 tests
- Well-formedness preservation: 4 tests
- Counterexamples: 4 tests
- Edge cases: 2 tests

### Theorem 23 - Deadlock Freedom (19 skipped)
- Basic DMst: 2 tests
- Dynamic participants: 3 tests
- Protocol calls: 3 tests
- Updatable recursion: 3 tests
- Complex examples: 3 tests
- Counterexamples: 4 tests
- State space: 1 test

### Theorem 20 - Trace Equivalence (13 skipped)
- Dynamic creation: 2 tests
- Protocol calls: 3 tests
- Updatable recursion: 3 tests
- Complex examples: 2 tests
- Counterexamples: 3 tests

---

## Reference

Castro-Perez, D., & Yoshida, N. (2023). "Dynamically Updatable Multiparty Session Protocols."
ECOOP 2023. https://drops.dagstuhl.de/opus/volltexte/2023/18202/

Key formal definitions:
- **Definition 1**: Protocol call semantics (p ↪→ x⟨q⟩)
- **Definition 13**: Updatable recursion (continue X with { G })
- **Definition 14**: Safe protocol update (via 1-unfolding)
- **Theorem 20**: Trace equivalence preservation
- **Theorem 23**: Deadlock freedom for DMst
- **Theorem 29**: Liveness properties
