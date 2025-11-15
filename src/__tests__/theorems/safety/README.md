# Safety Theorem Tests

## Theorem-Driven Development for "Less is More" MPST

This directory contains test files that encode the formal theorems from Scalas & Yoshida (2019) "Less is More: Multiparty Session Types Revisited" into executable tests.

### Philosophy

**Theorem-Driven Development (TDD)**: Write tests that encode formal theorems FIRST, then implement the code to make them pass.

Benefits:
1. **Correctness**: Implementation must satisfy formal properties by construction
2. **Documentation**: Tests explain what theorems mean in concrete terms
3. **Regression**: Can't accidentally break theoretical guarantees
4. **Understanding**: Forces deep comprehension of formal definitions

### Test Files

#### 1. `definition-4.1-safety-property.test.ts`

**Encodes**: Definition 4.1 (Safety Property)

**Key Tests**:
- Rule [S-⊕&]: Send/receive compatibility
- Rule [S-μ]: Recursion unfolding
- Rule [S-→]: Preservation by reduction
- **OAuth Example**: The protocol that breaks classic MPST!

**Status**: ❌ All tests currently throw "Not implemented"

**When passing**: Safety checker correctly implements Definition 4.1

---

#### 2. `theorem-4.6-subject-reduction.test.ts`

**Encodes**: Theorem 4.6 (Subject Reduction)

**Statement**: If Γ⊢P with Γ safe and P→P', then ∃Γ' safe with Γ→*Γ' and Γ'⊢P'

**Key Tests**:
- Safety preserved after single step
- Safety preserved through choice branches
- Safety preserved through recursion
- Full protocol execution maintains safety

**Status**: ❌ All tests currently throw "Not implemented"

**When passing**: Subject reduction theorem holds for all protocols

---

#### 3. `corollary-4.7-and-lemma-5.9.test.ts`

**Encodes**:
- Corollary 4.7 (Type Safety)
- Lemma 5.9 (Property Hierarchy)

**Corollary 4.7**: If ∅⊢P and P→*P', then P' has no errors

**Lemma 5.9**:
- consistent(Γ) ⟹ safe(Γ)
- live(Γ) ⟹ df(Γ) ⟹ safe(Γ)
- OAuth is safe but NOT consistent (proves strict hierarchy)

**Key Tests**:
- Well-typed processes never go wrong
- OAuth executes without errors
- Property hierarchy verified

**Status**: ❌ All tests currently throw "Not implemented"

**When passing**: Type safety guaranteed for all safe protocols

---

## Test Structure

Each test file follows this pattern:

```typescript
/**
 * THEOREM X.Y: Name
 *
 * STATEMENT: [Formal statement from paper]
 *
 * INTUITION: [Plain English explanation]
 *
 * PROOF SKETCH: [Key steps of proof]
 */

describe('Theorem X.Y', () => {
  it('proof obligation 1', () => {
    // Arrange: Set up protocol
    const protocol = `...`;
    const Γ = ...;

    // Act: Run check/reduction
    const result = checker.check(Γ);

    // Assert: Verify theorem holds
    expect(result).toBe(true);
  });
});
```

## Implementation Strategy

### Phase 1: Implement Stubs

**Target**: Make tests compile (but fail/throw)

**Files to create**:
- `src/core/safety/types.ts` - TypingContext, SafetyProperty interface
- `src/core/safety/safety-checker.ts` - SafetyChecker class (stub)
- `src/core/safety/context-reducer.ts` - ContextReducer class (stub)

**Status**: ✓ Done (stubs in test files)

### Phase 2: Implement Definition 4.1

**Target**: Make `definition-4.1-safety-property.test.ts` pass

**Implementation**:
1. `checkSendReceiveCompatibility()` - Rule [S-⊕&]
2. `computeReachable()` - Finite reachability
3. `checkPreservationByReduction()` - Rule [S-→]

**Core Algorithm**:
```typescript
function checkSafety(Γ: TypingContext): boolean {
  // [S-⊕&]: Check enabled sends have matching receives
  for (const [roleP, {machine, currentState}] of Γ.cfsms) {
    for (const sendTrans of getEnabledSends(machine, currentState)) {
      const roleQ = sendTrans.action.to;
      const msg = sendTrans.action.message.label;

      if (!hasMatchingReceive(Γ, roleP, roleQ, msg)) {
        return false;  // UNSAFE!
      }
    }
  }

  // [S-→]: Check all reachable contexts
  for (const Γ_next of computeReachable(Γ)) {
    if (!checkSendReceiveCompatibility(Γ_next)) {
      return false;  // UNSAFE!
    }
  }

  return true;  // SAFE!
}
```

**Complexity**: O(|States| × |Transitions|) - polynomial in CFSM size

**Decidability**: ✓ Decidable (finite state CFSMs)

### Phase 3: Implement Context Reduction

**Target**: Make `theorem-4.6-subject-reduction.test.ts` pass

**Implementation**:
1. `findEnabledCommunication()` - Find send/receive pairs
2. `reduce()` - Advance both CFSM states
3. `isTerminal()` - Check if all CFSMs at terminal states

**Core Algorithm**:
```typescript
function reduce(Γ: TypingContext): TypingContext {
  // Find enabled communication
  const {sender, receiver, message} = findEnabled(Γ);

  // Advance sender's CFSM
  const senderState = advanceSend(Γ.cfsms.get(sender)!, message);

  // Advance receiver's CFSM
  const receiverState = advanceReceive(Γ.cfsms.get(receiver)!, message);

  // Return new context
  return {
    session: Γ.session,
    cfsms: new Map([
      ...Γ.cfsms,
      [sender, senderState],
      [receiver, receiverState]
    ])
  };
}
```

### Phase 4: Verify Type Safety

**Target**: Make `corollary-4.7-and-lemma-5.9.test.ts` pass

**Implementation**:
- Use SafetyChecker + ContextReducer from Phases 2-3
- No new code needed! (Type safety follows from subject reduction)

**Verification**:
```typescript
function verifyTypeSafety(Γ: TypingContext): boolean {
  let current = Γ;

  while (!isTerminal(current)) {
    // Safety must hold before reduction
    if (!checker.check(current)) {
      return false;
    }

    // Reduce one step
    current = reducer.reduce(current);

    // Safety must hold after reduction (SUBJECT REDUCTION!)
    if (!checker.check(current)) {
      return false;
    }
  }

  return true;  // No errors reached! (TYPE SAFETY!)
}
```

## Running Tests

### Run all safety tests
```bash
npm test -- src/__tests__/theorems/safety
```

### Run specific theorem
```bash
npm test -- definition-4.1-safety-property.test.ts
npm test -- theorem-4.6-subject-reduction.test.ts
npm test -- corollary-4.7-and-lemma-5.9.test.ts
```

### Watch mode (TDD)
```bash
npm test -- --watch src/__tests__/theorems/safety
```

## Test Status

| Theorem | Test File | Status | Tests | Passing |
|---------|-----------|--------|-------|---------|
| Definition 4.1 | `definition-4.1-safety-property.test.ts` | ❌ Not Implemented | 15+ | 0 |
| Theorem 4.6 | `theorem-4.6-subject-reduction.test.ts` | ❌ Not Implemented | 10+ | 0 |
| Corollary 4.7 | `corollary-4.7-and-lemma-5.9.test.ts` | ❌ Not Implemented | 10+ | 0 |
| Lemma 5.9 | `corollary-4.7-and-lemma-5.9.test.ts` | ❌ Not Implemented | 5+ | 0 |

**Total**: 40+ tests, 0 passing

**Goal**: Make all tests pass!

## The OAuth Test

The most important test in this suite:

```typescript
it('accepts OAuth despite non-consistent types', () => {
  const oauth = `
    protocol OAuth(role s, role c, role a) {
      choice at s {
        s -> c: login();
        c -> a: passwd(Str);
        a -> s: auth(Bool);
      } or {
        s -> c: cancel();
        c -> a: quit();
      }
    }
  `;

  const Γ = createInitialContext(projectOAuth(oauth));

  expect(checker.check(Γ)).toBe(true);  // ← Safety accepts
  expect(consistencyChecker.check(Γ)).toBe(false);  // ← Classic MPST rejects

  // PROVES: safe(OAuth) ∧ ¬consistent(OAuth)
  // THEREFORE: Safety is strictly more general!
});
```

**When this test passes**: We've successfully implemented "Less is More"!

## References

- Paper: Scalas & Yoshida (2019) "Less is More: Multiparty Session Types Revisited"
- Theory Docs: `docs/theory/safety-invariant-deep-dive.md`
- Visual Guide: `docs/theory/safety-vs-consistency-visual.md`
- Walkthrough: `docs/theory/safety-check-oauth-walkthrough.md`

## Questions?

### "Why are all tests currently failing?"

That's the point! Theorem-driven development means:
1. Write tests that encode theorems
2. Tests fail/throw "Not implemented"
3. Implement code to make tests pass
4. When tests pass, theorems are proven correct in code!

### "How do I know what to implement?"

The tests tell you! Look at the `expect()` statements:
- `checker.check(Γ)` → Implement SafetyChecker
- `reducer.reduce(Γ)` → Implement ContextReducer
- Test names describe what must be true

### "What order should I implement?"

1. Definition 4.1 (safety) - Foundation
2. Theorem 4.6 (subject reduction) - Uses safety
3. Corollary 4.7 (type safety) - Follows from 1+2
4. Lemma 5.9 (hierarchy) - Verification only

### "How will I know when I'm done?"

When all tests pass! Specifically:
- ✓ OAuth test passes (proves generalization works)
- ✓ Subject reduction tests pass (proves correctness)
- ✓ Type safety tests pass (proves guarantee)

Then you'll have a working implementation of "Less is More"!

---

**Status**: Ready for implementation
**Next**: Implement SafetyChecker class
**Goal**: Make OAuth test pass!
