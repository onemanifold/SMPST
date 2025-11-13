# Theorem-Driven Testing Methodology

**Date**: 2025-11-13
**Purpose**: Framework for writing tests as theorem verification

---

## Core Insight

**Traditional Testing**:
```typescript
it('should handle recursion correctly', () => {
  // What does "correctly" mean?
  // Why does this test exist?
});
```

**Theorem-Driven Testing**:
```typescript
describe('Theorem 5.1: Recursion Scoping (Demangeon & Honda 2012)', () => {
  it('proves: rec X.G binds X only within G', () => {
    // This test verifies a formal property
    // Failure means theorem violation
  });
});
```

**Benefits**:
- 📖 **Clear reasoning**: Know *why* test exists
- 🎯 **Precise semantics**: Know *what* "correct" means
- 🔬 **Formal grounding**: Linked to theory
- 🐛 **Better debugging**: Failure indicates theorem violation
- 📚 **Documentation**: Tests explain formal properties

---

## Framework Design

### Level 1: Property-Based Tests (Weakest)

**Format**: Assert general properties without theorem reference

```typescript
describe('Projection Properties', () => {
  it('should preserve message actions', () => {
    // Test that messages appear in projections
  });
});
```

**When to Use**: Exploratory testing, sanity checks

---

### Level 2: Theorem-Referenced Tests (Better)

**Format**: Reference theorem but don't state it formally

```typescript
describe('Projection Soundness (Honda et al. 2016)', () => {
  it('verifies projection preserves semantics', () => {
    // Test based on theorem but informally
  });
});
```

**When to Use**: When theorem is complex to state formally

---

### Level 3: Theorem-Verified Tests (Best)

**Format**: State theorem formally, test is proof obligation

```typescript
/**
 * THEOREM 4.7 (Honda, Yoshida, Carbone, JACM 2016):
 * Projection Soundness
 *
 * ∀G (global type), ∀r ∈ roles(G):
 *   G ↓r ⟹ Tr (local type)
 *   ∧ [[G]] ≈ ⊗r∈roles [[Tr]]  (semantic equivalence)
 *
 * Where:
 *   - G ↓r = projection of G to role r
 *   - [[·]] = denotational semantics
 *   - ⊗ = parallel composition
 *
 * PROOF OBLIGATION: Show projections compose to original semantics
 */
describe('Theorem 4.7: Projection Soundness', () => {
  const theorem = {
    source: 'Honda, Yoshida, Carbone (JACM 2016)',
    number: '4.7',
    statement: 'Projection preserves global protocol semantics',
    formalStatement: '∀G, ∀r: G ↓r ⟹ Tr ∧ [[G]] ≈ ⊗r[[Tr]]',
  };

  it('proves: projection exists for all roles', () => {
    // ∀r ∈ roles(G): G ↓r exists
  });

  it('proves: semantic equivalence', () => {
    // [[G]] ≈ ⊗r∈roles [[Tr]]
  });

  it('proves: composition is well-formed', () => {
    // ⊗r∈roles [[Tr]] is defined
  });
});
```

**When to Use**: Core correctness properties, verification tests

---

## Test Organization Structure

### Organize by Theorem Hierarchy

```
tests/
  formal-properties/
    foundations/
      theorem-4.7-projection-soundness.test.ts
      theorem-4.8-causal-delivery.test.ts
      theorem-5.3-fifo-guarantee.test.ts

    well-formedness/
      theorem-3.1-connectedness.test.ts
      theorem-3.2-determinism.test.ts
      theorem-3.3-deadlock-freedom.test.ts

    sub-protocols/
      theorem-4.1-projection-preservation.test.ts
      theorem-5.1-recursion-scoping.test.ts

    verification/
      theorem-6.2-decidability.test.ts
```

---

## Test Template

### Standard Theorem Test Structure

```typescript
/**
 * THEOREM [Number]: [Name]
 * SOURCE: [Paper, Year]
 *
 * STATEMENT:
 *   [Formal mathematical statement]
 *
 * PROOF SKETCH:
 *   [High-level proof approach]
 *
 * PROOF OBLIGATIONS:
 *   1. [Property 1]
 *   2. [Property 2]
 *   ...
 */
describe('Theorem [Number]: [Name]', () => {
  const theorem = {
    source: '[Paper]',
    number: '[Number]',
    statement: '[English]',
    formalStatement: '[Math notation]',
    proofSketch: '[Proof approach]',
  };

  // One test per proof obligation
  it('proves: [obligation 1]', () => {
    // Test implementation
  });

  it('proves: [obligation 2]', () => {
    // Test implementation
  });

  // Edge cases / counterexamples
  describe('Edge Cases', () => {
    it('handles: [edge case]', () => {
      // Test
    });
  });

  // Link to documentation
  it('references formal documentation', () => {
    expect(theorem.source).toBeDefined();
    // Could check docs/theory/[file].md exists
  });
});
```

---

## Example: Complete Theorem Test

### Theorem 5.1: Recursion Scoping

```typescript
/**
 * THEOREM 5.1 (Demangeon, Honda, CONCUR 2012):
 * Recursion Scoping in Nested Protocols
 *
 * STATEMENT:
 *   In sub-protocol invocation do P(r̃), recursion variables
 *   defined within P cannot escape to parent protocol scope.
 *
 * FORMAL:
 *   X ∈ FV(rec X.G) ⟹ X ∉ FV(Parent)
 *   where FV = free variables
 *
 * PROOF SKETCH:
 *   By lexical scoping: each protocol has independent variable namespace.
 *   Sub-protocol creates new scope, variables bound within that scope only.
 *
 * PROOF OBLIGATIONS:
 *   1. Recursion variables bound within defining protocol
 *   2. No cross-protocol variable references
 *   3. Nested sub-protocols have independent variable spaces
 */
describe('Theorem 5.1: Recursion Scoping (Demangeon & Honda 2012)', () => {
  const theorem = {
    source: 'Demangeon, Honda (CONCUR 2012)',
    number: '5.1',
    statement: 'Recursion variables cannot escape sub-protocol boundaries',
    formalStatement: 'X ∈ FV(rec X.G) ⟹ X ∉ FV(Parent)',
    proofApproach: 'Lexical scoping enforces variable isolation',
    documentation: 'docs/theory/sub-protocol-formal-analysis.md',
  };

  describe('Proof Obligation 1: Variable Binding', () => {
    it('proves: recursion variable X defined in protocol P is bound within P', () => {
      const source = `
        protocol P(role A, role B) {
          rec Loop {
            A -> B: Msg();
            continue Loop;
          }
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0];
      const recNode = findRecursionNode(protocol, 'Loop');

      // Verify: Loop is bound within P's scope
      expect(recNode).toBeDefined();
      expect(recNode.scope).toBe('P'); // Scoped to protocol P
    });

    it('proves: continue statement references only in-scope labels', () => {
      const source = `
        protocol P(role A, role B) {
          rec Loop {
            continue Loop;  // Valid: Loop is in scope
          }
        }
      `;

      const ast = parse(source);
      const verifier = new RecursionVerifier();
      const result = verifier.checkContinueReferences(ast);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Proof Obligation 2: No Cross-Protocol References', () => {
    it('proves: parent protocol cannot reference sub-protocol recursion labels', () => {
      const source = `
        protocol Child(role A, role B) {
          rec ChildLoop {
            A -> B: Msg();
            continue ChildLoop;
          }
        }

        protocol Parent(role A, role B) {
          do Child(A, B);
          continue ChildLoop;  // INVALID: ChildLoop not in scope
        }
      `;

      const ast = parse(source);
      const verifier = new RecursionVerifier();
      const result = verifier.checkContinueReferences(ast);

      // Must reject: ChildLoop not in Parent's scope
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'unbound-recursion-label',
          label: 'ChildLoop',
        })
      );
    });

    it('proves: sub-protocol cannot reference parent recursion labels', () => {
      const source = `
        protocol Parent(role A, role B) {
          rec ParentLoop {
            do Child(A, B);
          }
        }

        protocol Child(role A, role B) {
          A -> B: Msg();
          continue ParentLoop;  // INVALID: ParentLoop not in scope
        }
      `;

      const ast = parse(source);
      const verifier = new RecursionVerifier();
      const result = verifier.checkContinueReferences(ast);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'unbound-recursion-label',
          label: 'ParentLoop',
        })
      );
    });
  });

  describe('Proof Obligation 3: Independent Nested Scopes', () => {
    it('proves: sibling sub-protocols have independent variable spaces', () => {
      const source = `
        protocol Sub1(role A, role B) {
          rec Loop {
            A -> B: M1();
            continue Loop;
          }
        }

        protocol Sub2(role A, role B) {
          rec Loop {  // Same label name, different scope
            A -> B: M2();
            continue Loop;
          }
        }

        protocol Parent(role A, role B) {
          do Sub1(A, B);
          do Sub2(A, B);
        }
      `;

      const ast = parse(source);
      const registry = createProtocolRegistry(ast);

      const sub1 = registry.resolve('Sub1');
      const sub2 = registry.resolve('Sub2');

      const loop1 = findRecursionNode(sub1, 'Loop');
      const loop2 = findRecursionNode(sub2, 'Loop');

      // Verify: Loop labels are distinct (different scopes)
      expect(loop1.id).not.toBe(loop2.id);
      expect(loop1.scope).toBe('Sub1');
      expect(loop2.scope).toBe('Sub2');
    });

    it('proves: runtime execution maintains scope isolation', () => {
      const source = `
        protocol Child(role A, role B) {
          rec Inner {
            A -> B: Ping();
            continue Inner;
          }
        }

        protocol Parent(role A, role B) {
          rec Outer {
            do Child(A, B);
            continue Outer;
          }
        }
      `;

      const ast = parse(source);
      const registry = createProtocolRegistry(ast);
      const callStack = createCallStackManager();

      const parent = registry.resolve('Parent');
      const cfg = buildCFG(parent);
      const simulator = new CFGSimulator(cfg, {
        protocolRegistry: registry,
        callStackManager: callStack,
        maxSteps: 100,
      });

      // Run simulation
      simulator.run();

      // Verify: Inner and Outer recursion stacks are independent
      // Check call stack state during execution
      const trace = simulator.getTrace();
      const recursionEvents = trace.events.filter(e =>
        e.type === 'recursion-enter' || e.type === 'recursion-exit'
      );

      // Verify proper nesting: Inner fully enters/exits before Outer continues
      // (This tests runtime scope isolation)
      expect(recursionEvents).toBeDefined();
      // Add specific assertions about stack behavior
    });
  });

  describe('Edge Cases', () => {
    it('handles: same label name in non-nested protocols', () => {
      // Two protocols with same rec label, never nested
      // Should be valid (no interference)
    });

    it('handles: deeply nested sub-protocols (>3 levels)', () => {
      // Test recursion scoping with deep nesting
    });

    it('handles: multiple recursion labels in same protocol', () => {
      // Test that different labels within same protocol are distinct
    });
  });

  describe('Documentation Link', () => {
    it('references formal analysis document', () => {
      const fs = require('fs');
      const path = require('path');
      const docPath = path.join(
        __dirname,
        '../../../docs/theory/sub-protocol-formal-analysis.md'
      );

      expect(fs.existsSync(docPath)).toBe(true);

      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain('Theorem 5.1');
      expect(content).toContain('Demangeon');
      expect(content).toContain('Honda');
    });
  });
});
```

---

## Integration with Implementation

### Code Comments Reference Theorems

```typescript
/**
 * Recursion stack management.
 *
 * FORMAL PROPERTY (Theorem 5.1, Demangeon & Honda 2012):
 *   Recursion variables are lexically scoped to defining protocol.
 *
 * IMPLEMENTATION:
 *   Each CFGSimulator instance has private recursionStack.
 *   New sub-protocol invocation creates new simulator → new stack.
 *   This enforces lexical scoping by construction.
 *
 * VERIFIED BY: tests/formal-properties/sub-protocols/theorem-5.1-recursion-scoping.test.ts
 */
private recursionStack: RecursionContext[] = [];
```

---

## Workflow Integration

### Development Process

1. **Identify Feature** → Find relevant theorem
2. **Write Test** → State theorem, decompose into proof obligations
3. **Implement** → Make tests pass
4. **Verify** → Tests are formal property checks

### Pull Request Template

```markdown
## Changes

[Description]

## Formal Properties Verified

- [ ] Theorem X.Y: [Name] (tests/formal-properties/.../theorem-X.Y.test.ts)
  - Proof obligation 1: ✅
  - Proof obligation 2: ✅

- [ ] Theorem Z.W: [Name]
  - ...

## References

- Theory doc: `docs/theory/[file].md`
- Paper: [Citation]
```

---

## Benefits Demonstrated

### Before (Traditional)

```typescript
describe('Projection', () => {
  it('works for simple protocols', () => {
    // Unclear what "works" means
  });

  it('handles choice', () => {
    // Why is this test here?
  });
});
```

**Issues**:
- ❌ No clear semantics
- ❌ Hard to debug failures
- ❌ Incomplete coverage (what's missing?)

---

### After (Theorem-Driven)

```typescript
describe('Theorem 4.7: Projection Soundness', () => {
  it('proves: every role gets projection', () => {
    // ∀r ∈ roles(G): G ↓r exists
  });

  it('proves: projections preserve semantics', () => {
    // [[G]] ≈ ⊗r[[Tr]]
  });
});

describe('Theorem 4.8: Projection Completeness', () => {
  it('proves: every message appears once as send, once as receive', () => {
    // Formal completeness property
  });
});
```

**Benefits**:
- ✅ Clear formal semantics
- ✅ Failures indicate theorem violations
- ✅ Complete coverage (all proof obligations)
- ✅ Links to formal documentation

---

## Tooling Support

### Test Generator (Future)

```typescript
// Generate test skeleton from theorem statement
const theorem = {
  number: '5.1',
  source: 'Demangeon & Honda 2012',
  statement: 'Recursion scoping in nested protocols',
  formalStatement: 'X ∈ FV(rec X.G) ⟹ X ∉ FV(Parent)',
  proofObligations: [
    'Variables bound within defining protocol',
    'No cross-protocol references',
    'Independent nested scopes',
  ],
};

generateTestSkeleton(theorem);
// → Creates test file with structure
```

---

## Next Steps

### Immediate Actions

1. **Refactor Existing Tests**
   - Identify which tests verify formal properties
   - Reorganize into theorem-driven structure
   - Add theorem documentation

2. **Create Template**
   - Standardize theorem test format
   - Add to project scaffolding
   - Update CONTRIBUTING.md

3. **Link to Theory Docs**
   - Every theory doc should list tests that verify its theorems
   - Every test should link to theory doc

---

## Example Refactoring

### Current Test

```typescript
// src/core/simulation/cfg-simulator-subprotocol.test.ts
it('should execute nested sub-protocols', () => {
  const source = `...`;
  const simulator = new CFGSimulator(...);
  const result = simulator.run();
  expect(result.success).toBe(true);
});
```

### Refactored to Theorem-Driven

```typescript
/**
 * THEOREM 4.1 (Hu et al. 2014):
 * Sub-Protocol Projection Soundness
 *
 * STATEMENT:
 *   For parameterized sub-protocol invocation do P(r̃),
 *   projection preserves semantics: G ↓r ≈ (do P(r̃)) ↓r
 */
describe('Theorem 4.1: Sub-Protocol Projection (Hu et al. 2014)', () => {
  it('proves: nested sub-protocols execute to completion', () => {
    const source = `...`;
    const simulator = new CFGSimulator(...);
    const result = simulator.run();

    // Formal property: execution completes (termination)
    expect(result.success).toBe(true);
    expect(simulator.isComplete()).toBe(true);

    // Formal property: call stack empty after completion
    expect(callStack.isEmpty()).toBe(true);
  });
});
```

---

**Status**: Framework defined, ready for adoption

**Next Actions**:
1. Review and approve this framework
2. Start refactoring existing tests
3. Use for all new tests

Would you like me to refactor a specific test suite as an example?
