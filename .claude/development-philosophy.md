# SMPST Development Philosophy

**⚠️ READ THIS FIRST IN EVERY SESSION ⚠️**

This file contains the core principles that guide all development on this project.

---

## Core Principle: Formal Correctness Over Convenience

**This is NOT a typical web app**. This is a **formally verified implementation** of multiparty session types.

### What This Means

❌ **NOT ACCEPTABLE:**
- "The tests pass, ship it"
- Implementing features without understanding the theory
- Ignoring error cases because "it probably won't happen"
- Incomplete integration between backend and frontend

✅ **REQUIRED:**
- Every feature grounded in published research
- Tests verify **theorems**, not just "it works"
- Complete, faithful implementation of backend contracts
- Formal documentation of all assumptions

---

## Three Pillars of Development

### 1. Theorem-Driven Testing

**See:** `.claude/theorem-driven-testing.md`

**Core Idea:** Tests are **proof obligations** for formal theorems, not arbitrary checks.

**Example:**
```typescript
// ❌ WRONG - No formal grounding
it('should handle recursion', () => {
  expect(parse(protocol)).not.toThrow();
});

// ✅ RIGHT - Verifies formal property
describe('Theorem 5.1: Recursion Scoping (Demangeon & Honda 2012)', () => {
  it('proves: rec X.G binds X only within G', () => {
    // Test that verifies lexical scoping theorem
  });
});
```

**Why:** When tests fail, you know **which theorem is violated**, not just "something broke".

---

### 2. Store Contract Enforcement

**See:** `.claude/store-development-protocol.md`

**Core Idea:** Frontend must **faithfully implement** backend, exposing ALL return values.

**Example:**
```typescript
// ❌ WRONG - Ignores 75% of backend
const result = simulator.step(); // Returns: {success, state, error, event}
executionState.set(result.state); // Only uses state!

// ✅ RIGHT - Handles all properties
handleStepResult(result, {
  onSuccess: (state, event) => {
    executionState.set(state);
    lastEvent.set(event ?? null);
    lastError.set(null);
  },
  onError: (error, state) => {
    lastError.set(error);
    executionState.set(state);
  }
});
```

**Why:** Backend implements features correctly, frontend often doesn't, users see broken UI.

---

### 3. Formal Methods Workflow

**See:** `.claude/formal-methods-workflow.md`

**Core Idea:** Theory → Documentation → Tests → Implementation (in that order).

**Process:**
1. **Literature Review**: Find papers defining the feature
2. **Theory Doc**: Document formal semantics in `docs/theory/`
3. **Theorem Tests**: Write tests as proof obligations
4. **Implement**: Make tests pass
5. **Verify**: All theorems hold

**Example:** Adding channel delegation
1. Read papers on higher-order MPST
2. Document formal semantics
3. Write tests: "Theorem X: Delegation preserves linearity"
4. Implement delegator
5. Tests verify theorem

**Why:** Ensures implementation matches formal definition, not just "seems to work".

---

## When Adding New Features

### Mandatory Checklist

Before implementing ANY new feature:

- [ ] **Found papers** defining the feature formally?
- [ ] **Created theory doc** (`docs/theory/[feature].md`)?
- [ ] **Identified theorems** that must hold?
- [ ] **Written tests** as proof obligations?
- [ ] **Implemented** with formal annotations?
- [ ] **All tests pass** (theorems verified)?

### If Blocked by Academic Papers

Use **Perplexity as proxy** (see `CONTRIBUTING.md` section "Perplexity Proxy Workflow"):

1. Generate detailed query requesting formal definitions
2. Run through Perplexity
3. Document response in `docs/theory/`
4. Cite Perplexity-assisted research

**Example queries** in `docs/THEORY_INTEGRATION_PLAN.md` Section 4.

---

## For Frontend Changes (Stores/Components)

### Mandatory Pattern

1. **Generate** store with tests: `npm run create:store <name> <backend-path>`
2. **Implement** using contract handlers (forces handling all backend returns)
3. **Test** in watch mode: `npm run test:stores:ui`
4. **Verify** all backend properties exposed

**Pre-commit hook** automatically enforces this - commit fails if store contracts violated.

---

## For Backend Changes (Core Logic)

### Mandatory Pattern

1. **Document** formal semantics in code comments
2. **Reference** theorem numbers and papers
3. **Link** to theory docs and tests
4. **Ensure** tests exist verifying the formal properties

**Example:**
```typescript
/**
 * THEOREM 4.7 (Honda et al. JACM 2016): Projection Soundness
 *   ∀G, ∀r: G ↓r ⟹ Tr ∧ [[G]] ≈ ⊗r[[Tr]]
 *
 * DOCUMENTED IN: docs/theory/projection-correctness.md
 * VERIFIED BY: tests/__tests__/theorems/projection/soundness.test.ts
 */
function projectForRole(G: GlobalType, r: Role): LocalType {
  // Implementation
}
```

---

## Testing Philosophy

### Not Just Code Coverage - Theorem Coverage

**Traditional approach:**
- 80% line coverage ✓
- All tests pass ✓
- Ship it!

**Our approach:**
- Which theorems does this verify? ✓
- Are all proof obligations tested? ✓
- Do tests reference formal properties? ✓
- Are theorems documented? ✓
- Ship it!

### Test Organization

```
tests/
  __tests__/
    theorems/              # Theorem verification tests
      projection/          # Projection theorems
      well-formedness/     # Wellformedness theorems
      safety/              # Safety theorems
      dmst/                # Dynamic MPST theorems
```

---

## Documentation Requirements

Every feature MUST have:

1. **Theory Doc** (`docs/theory/[feature].md`)
   - Formal definition from literature
   - Theorem statements with numbers
   - Proof sketches
   - References to papers

2. **Implementation Comments**
   - Theorem references
   - Formal properties being implemented
   - Links to tests and theory docs

3. **Tests**
   - Written as theorem verification
   - Reference theorem numbers
   - Link to theory docs

---

## Common Anti-Patterns to Avoid

### ❌ Implementation-First Development
```typescript
// Wrote code first, tests later, no theory
function doSomething() {
  // It works! Ship it!
}
```

### ❌ Partial Backend Implementation
```typescript
// Store only uses some backend returns
const result = backend.call();
store.set(result.data); // Ignores result.error!
```

### ❌ Tests Without Formal Grounding
```typescript
it('should work', () => {
  // What does "work" mean formally?
});
```

### ❌ Missing Theory Documentation
```typescript
// Code exists but no formal documentation
// Why does this exist? What theorem does it implement?
```

---

## Correct Patterns

### ✅ Theory-First Development
```typescript
/**
 * THEOREM 5.3: FIFO Ordering
 * See: docs/theory/fifo-verification.md
 * Verified by: tests/.../theorem-5.3-fifo.test.ts
 */
function verifyFIFO(cfg: CFG): boolean {
  // Implementation grounded in theorem
}
```

### ✅ Complete Backend Implementation
```typescript
handleStepResult(result, {
  onSuccess: (state, event) => { /* handle ALL success properties */ },
  onError: (error, state) => { /* handle ALL error properties */ }
});
```

### ✅ Theorem-Driven Tests
```typescript
describe('Theorem 4.7: Projection Soundness', () => {
  it('proves: projections preserve semantics', () => {
    // Test verifies formal theorem
  });
});
```

### ✅ Complete Documentation
```
Code → Theory Doc → Test → All linked
```

---

## Quick Reference

| Task | Command/Tool | Doc Reference |
|------|-------------|---------------|
| Add new store | `npm run create:store <name> <path>` | `.claude/store-development-protocol.md` |
| Test stores | `npm run test:stores:ui` | `FRONTEND-TESTING.md` |
| Add new feature | Theory → Tests → Code | `.claude/formal-methods-workflow.md` |
| Write theorem test | Use template | `.claude/theorem-driven-testing.md` |
| Need papers | Perplexity proxy | `CONTRIBUTING.md` §Perplexity |
| Check coverage | `npm run test:coverage` | N/A |

---

## Session Handoff Protocol

At END of each session, document:

1. **What theorems were verified** (tests added/passing)
2. **What formal properties implemented** (with references)
3. **What theory gaps remain** (for next session)
4. **What contracts enforced** (frontend-backend integration)

At START of each session, check:

1. **Read `.claude/` directory** - core principles
2. **Check `docs/STATUS.md`** - current state
3. **Run tests** - what theorems are verified
4. **Review recent commits** - what changed

---

## Why This Matters

This project implements **formally verified session types**. We're not just building a tool - we're implementing a **mathematical model** with **proven correctness properties**.

If we don't ground implementation in theory:
- ❌ Implementation diverges from formal semantics
- ❌ "Bugs" are actually **theorem violations**
- ❌ Can't trust correctness claims
- ❌ Research value diminishes

With theory-driven development:
- ✅ Implementation **provably correct**
- ✅ Tests **verify theorems**
- ✅ Can cite **verified properties**
- ✅ Research **credible and reproducible**

---

**Remember: If you can't point to the theorem, you shouldn't be writing the code.**
