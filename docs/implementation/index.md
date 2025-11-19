# Implementation Documentation

This section contains implementation-specific notes and guides for the TypeScript/JavaScript implementation of SMPST.

**Purpose:** Document implementation details, design decisions, and lessons learned.

---

## 📚 Key Documents

### [Implementation Lessons](../implementation-lessons.md) ⭐
**Critical insights from translating theory to code**

This is the **most important implementation document**. It bridges the gap between formal theory and practical implementation.

**Key Topics:**
- **Layer 3: Verification Algorithms**
  - Parallel deadlock detection (senders vs receivers)
  - Tarjan's algorithm for SCC
  - Liveness vs progress
  - Fork-join matching

- **Layer 4: Projection Algorithms**
  - Epsilon transitions (the core insight!)
  - Two-pass algorithm for recursion
  - Recursion labels are transparent
  - Fork-join optimization
  - Node mapping strategy

- **Layer 4.6: Tau Transitions** (Critical!)
  - Eager application after every communication
  - Fixpoint iteration algorithm
  - 58% test improvement case study

- **Layer 5: Async/Concurrent Architecture**
  - Scheduled vs concurrent execution modes
  - Event-driven coordination
  - Message transport patterns
  - Deadlock detection strategies

- **Cross-Cutting: Theorem-Driven Testing**
  - Behavioral vs theorem-driven comparison
  - API gaps discovered through formal tests
  - Tests as executable proofs

- **Layer 5.5: Sub-Protocol Patterns**
  - Protocol Registry pattern
  - Call Stack Manager pattern
  - Nested execution handling
  - Known limitations

**Read this document** to understand the "why" behind implementation choices.

---

## 🔧 Implementation Status

See **[STATUS.md](../STATUS.md)** for:
- Layer-by-layer completion status
- Test coverage metrics
- Recent changes and fixes
- Known issues
- Next priorities

**Current Status:** Layer 5 complete (Projection & CFSM Simulation)

---

## 📁 Additional Implementation Notes

### Simulation & Engines
- **[Simulation Engine Design](simulation-engine-design.md)** - CFG and CFSM simulator architectures
- **[Simulation Formal Verification](simulation-formal-verification.md)** - Correctness proofs for simulators

### Syntax & Compatibility
- **[Syntax Compatibility](syntax-compatibility.md)** - Cross-version compatibility notes
- **[Protocol Syntax Inconsistency](protocol-syntax-inconsistency.md)** - Known syntax edge cases

---

## 🏗️ Architecture Overview

The implementation follows a strict layered architecture:

```
Layer 6: Code Generation     [⏸️  Planned]
    ↓
Layer 5: Projection & CFSM    [✅ Complete - 69/69 tests]
    ↓
Layer 4: CFG Simulator        [✅ Complete - 23/23 tests]
    ↓
Layer 3: Verification         [✅ Complete - 47/47 tests]
    ↓
Layer 2: CFG Builder          [✅ Complete - 100% coverage]
    ↓
Layer 1: Parser               [✅ Complete - 100% coverage]
```

**Total Tests Passing:** 139+ tests across all implemented layers

---

## 🧪 Testing Strategy

### Test-Driven Development (TDD)
1. **RED:** Write failing test first
2. **GREEN:** Implement minimal code to pass
3. **REFACTOR:** Clean up and optimize

### Test Organization
- Unit tests per module
- Integration tests for complete flows
- Theorem tests for formal properties
- Known-good and known-bad protocols

See **[Testing Strategy](../contributing/testing-strategy.md)** for detailed testing methodology.

---

## 🎯 Key Implementation Patterns

### 1. Epsilon Transitions
```typescript
if (!isRoleInvolved(action)) {
  continue; // Don't create state - epsilon transition
}
```

### 2. Two-Pass for Back Edges
```typescript
// Pass 1: Forward edges only
// Pass 2: Back edges (continue edges)
```

### 3. Eager Tau Application
```typescript
private applyTauTransitions(context): context {
  while (changed) {
    // Apply all enabled tau transitions
  }
  return context;
}
```

### 4. BFS Graph Traversal
```typescript
const queue = [initialNodeId];
while (queue.length > 0) {
  const current = queue.shift();
  // Process and enqueue successors
}
```

---

## 🔗 Related Documentation

- **[Architecture Overview](../architecture/overview.md)** - Abstract architecture design
- **[CFSM Architecture](../architecture/cfsm.md)** - CFSM formal definition & tau semantics
- **[Theory Foundations](../foundations.md)** - Formal theory
- **[Contributing Guide](../contributing/roadmap.md)** - Development workflow

---

## 📊 Quality Metrics

### Code Quality
- **Type Safety:** 100% TypeScript, strict mode
- **Test Coverage:** 100% for implemented layers
- **Documentation:** All public APIs documented
- **Linting:** ESLint, Prettier

### Correctness
- **Formal Verification:** CFG semantics match Scribble spec
- **Theorem Tests:** Formal properties verified
- **Reference Implementation:** Follows literature algorithms

### Performance
- **Parser:** O(n) - Chevrotain LL(k)
- **CFG Builder:** O(n) - Single AST traversal
- **Verification:** O(n²) - Graph algorithms
- **Simulator:** O(steps × nodes)

---

## 🐛 Known Issues

**None** - All implemented layers have 100% test pass rate.

See [STATUS.md](../STATUS.md#known-issues) for details.

---

## 📚 References

### Implementation Libraries
- **Chevrotain** - Parser combinator library
- **Vitest** - Testing framework
- **TypeScript** - Type safety
- **D3.js** - Visualization (planned)
- **ts-morph** - Code generation (planned)

### Academic References
- Honda, Yoshida, Carbone (2008): MPST foundation
- Deniélou, Yoshida (2012): CFG/CFSM approach
- Scalas, Yoshida (2019): "Less is More"

---

**Last Updated:** 2025-11-19
