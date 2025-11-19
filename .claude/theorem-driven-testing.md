# Theorem-Driven Testing Quick Reference

**Read full methodology:** `docs/theory/THEOREM_DRIVEN_TESTING.md`

---

## Core Pattern

### Traditional Test (❌ DON'T DO THIS)
```typescript
it('should handle recursion', () => {
  const result = parse(protocol);
  expect(result).toBeDefined();
});
```

### Theorem-Driven Test (✅ DO THIS)
```typescript
/**
 * THEOREM 5.1: Recursion Scoping (Demangeon & Honda 2012)
 *
 * STATEMENT: In sub-protocol do P(r̃), recursion variables
 * defined within P cannot escape to parent scope.
 *
 * FORMAL: X ∈ FV(rec X.G) ⟹ X ∉ FV(Parent)
 */
describe('Theorem 5.1: Recursion Scoping', () => {
  it('proves: recursion variable X is bound within protocol P', () => {
    const protocol = `...`;
    const ast = parse(protocol);
    // Test that VERIFIES the theorem
  });
});
```

---

## Test Template

```typescript
/**
 * THEOREM [Number]: [Name] ([Paper, Year])
 *
 * STATEMENT: [English description]
 *
 * FORMAL: [Mathematical notation]
 *
 * PROOF OBLIGATIONS:
 *   1. [Property 1]
 *   2. [Property 2]
 */
describe('Theorem [Number]: [Name]', () => {
  const theorem = {
    source: '[Paper]',
    number: '[Number]',
    documentation: 'docs/theory/[file].md',
  };

  describe('Proof Obligation 1: [Name]', () => {
    it('proves: [specific property]', () => {
      // Test implementation
    });
  });

  describe('Proof Obligation 2: [Name]', () => {
    it('proves: [specific property]', () => {
      // Test implementation
    });
  });
});
```

---

## Benefits

**When test fails:**
- Traditional: "Something broke, no idea what"
- Theorem-driven: "Theorem 5.1 violated - recursion scoping broken"

**When reading tests:**
- Traditional: "Why does this test exist?"
- Theorem-driven: "This verifies Theorem 5.1 from Demangeon & Honda 2012"

**When adding features:**
- Traditional: Write code, add tests afterward
- Theorem-driven: Find theorem, write tests, implement

---

## Workflow

1. **Identify theorem** from literature
2. **Create theory doc** (`docs/theory/[topic].md`)
3. **Write test skeleton** with proof obligations
4. **Implement** to make tests pass
5. **Verify** all obligations satisfied

---

## Example in Codebase

See: `src/__tests__/theorems/projection/soundness.test.ts`

This test verifies Theorem 4.7 (Projection Soundness) from Honda et al. JACM 2016.

---

## Quick Check

Before writing any test, ask:
- [ ] What formal property does this verify?
- [ ] Which paper/theorem defines this property?
- [ ] Is there a theory doc for this?

If you can't answer these, it's not a theorem-driven test.
