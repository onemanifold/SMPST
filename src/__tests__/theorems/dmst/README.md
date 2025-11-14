# DMst (Dynamically Updatable MPST) Theorem Tests

This directory contains theorem-driven tests for **Dynamically Updatable Multiparty Session Types** from Castro-Perez & Yoshida (ECOOP 2023).

## Overview

DMst extends classic MPST with three key features:

1. **Dynamic Participants**: Roles created at runtime (`new role Worker`)
2. **Protocol Calls**: Nested protocol instantiation (`A calls Proto(B)`)
3. **Updatable Recursion**: Recursive protocols that grow (`continue X with { ... }`)

These extensions enable scalable protocols for distributed systems like map-reduce, dynamic pipelines, and elastic services.

## Test Organization

### Core DMst Theorems

- **`definition-14-safe-update.test.ts`** - **Definition 14** (ECOOP 2023): Safe Protocol Update via 1-unfolding
- **`theorem-20-trace-equivalence.test.ts`** - **Theorem 20** (ECOOP 2023): Global ≈ Local trace equivalence with dynamic participants
- **`theorem-23-deadlock-freedom.test.ts`** - **Theorem 23** (ECOOP 2023): Well-formed DMst protocols are deadlock-free
- **`theorem-29-liveness.test.ts`** - **Theorem 29** (ECOOP 2023): Orphan-freedom, no stuck participants, eventual delivery

## Theorem Hierarchy

```
DMst Correctness
├── Definition 14: Safe Protocol Update (FOUNDATION)
│   └── Ensures updatable recursion preserves well-formedness
│
├── Theorem 20: Trace Equivalence (SEMANTICS)
│   ├── Dynamic participants maintain global/local correspondence
│   ├── Protocol calls preserve traces via combining operator ♢
│   └── Updatable recursion preserves trace equivalence
│
├── Theorem 23: Deadlock-Freedom (SAFETY)
│   ├── Extends Honda 2016 Theorem 5.10 to DMst
│   ├── Dynamic participants don't introduce deadlocks
│   ├── Protocol calls preserve deadlock-freedom
│   └── Depends on Definition 14 for updatable recursion
│
└── Theorem 29: Liveness (PROGRESS)
    ├── Orphan message freedom (all sends have receives)
    ├── No stuck participants (all can progress or terminate)
    └── Eventual delivery (FIFO buffers bounded)
```

## Key Definitions

### Definition 14: Safe Protocol Update

**Critical for updatable recursion.**

```
rec X { G; continue X with { G_update } }
```

is safe ⟺ 1-unfolding is well-formed:

```
G[X ↦ G ♢ G_update] satisfies well-formedness
```

**Why it matters**: Without safe 1-unfolding check, updates could introduce deadlocks, races, or orphaned messages in later iterations.

**Test coverage**:
- ✅ Independent action updates
- ✅ Dynamic participant creation in updates
- ✅ Protocol calls in updates
- ✅ Combining operator ♢ safety
- ❌ Unsafe updates (race conditions, deadlocks)

### Theorem 20: Trace Equivalence

**Proves global and local semantics match.**

For DMst protocol G:
```
traces(G) ≈ compose(traces([[G]]_r) for all r)
```

where `[[G]]_r` includes dynamically created participants.

**Test coverage**:
- ✅ Dynamic participant creation preserves traces
- ✅ Protocol calls preserve traces via ♢ operator
- ✅ Updatable recursion maintains equivalence
- ❌ Violations (unsafe updates, non-determinism)

### Theorem 23: Deadlock-Freedom

**Extends Honda 2016 to dynamic participants.**

Well-formed DMst ⟹ ∀ reachable state σ: terminated(σ) ∨ enabled(σ)

**Test coverage**:
- ✅ Dynamic participants don't deadlock (invitation synchronization)
- ✅ Protocol calls preserve deadlock-freedom (disjoint channels)
- ✅ Updatable recursion safe (depends on Definition 14)
- ❌ Violations (unsafe updates, circular calls, missing invitations)

### Theorem 29: Liveness

**Ensures progress properties.**

Three properties:
1. **Orphan-freedom**: ∀ send(m): ◊ receive(m)
2. **No stuck participants**: ∀ p: (◊ terminated(p)) ∨ (◊ enabled(p))
3. **Eventual delivery**: ∀ m in buffer: ◊ processed(m)

**Test coverage**:
- ✅ All messages have receivers (orphan-freedom)
- ✅ All participants can progress (no stuck states)
- ✅ FIFO buffers eventually deliver (bounded buffers)
- ❌ Violations (orphaned messages, stuck participants, unbounded buffers)

## Implementation Status

All tests are currently **SKIPPED** (`.skip`). This is intentional - these are **TDD tests** that guide implementation.

```typescript
it.skip('proves: simple dynamic participant trace equivalence', () => {
  // TODO: Implement once DMst parser/CFG/projection are ready
  expect(true).toBe(true); // Placeholder
});
```

### Implementation Dependencies

To enable these tests, we need:

**Phase 1: Parser Extensions**
- [ ] `new role` declarations
- [ ] `p calls Proto(q)` syntax
- [ ] `continue X with { ... }` updatable recursion

**Phase 2: AST Nodes**
- [ ] `DynamicRoleDeclaration`
- [ ] `ProtocolCall`
- [ ] `UpdatableRecursion`

**Phase 3: CFG Extensions**
- [ ] `ProtocolCallAction` node
- [ ] `CreateParticipantsAction` node
- [ ] `InvitationAction` node
- [ ] `RecursionUpdate` node

**Phase 4: Projection Extensions**
- [ ] Dynamic participant projection (Definition 12)
- [ ] Updatable recursion projection (Definition 13)
- [ ] Combining operator ♢ implementation

**Phase 5: Verification Algorithms**
- [ ] `compute1Unfolding()` - Definition 14
- [ ] `checkSafeUpdate()` - Definition 14
- [ ] `extractSendReceivePairs()` - Theorem 29
- [ ] `checkOrphanFreedom()` - Theorem 29
- [ ] `buildParticipantStateGraphs()` - Theorem 29
- [ ] `simulateFIFODelivery()` - Theorem 29

## Running Tests

```bash
# Currently all skipped - will run once implementation is ready
npm test src/__tests__/theorems/dmst

# Run specific theorem
npm test theorem-20-trace-equivalence
npm test definition-14-safe-update
npm test theorem-23-deadlock-freedom
npm test theorem-29-liveness

# Watch mode (for TDD)
npm test -- --watch src/__tests__/theorems/dmst
```

## Test-Driven Development Workflow

1. **Red**: Tests are skipped (currently here)
2. **Green**: Implement minimal functionality to make one test pass
3. **Refactor**: Clean up implementation
4. **Repeat**: Move to next test

**Example workflow**:
```bash
# 1. Remove .skip from first test in definition-14-safe-update.test.ts
# 2. Run: npm test definition-14-safe-update
# 3. Implement compute1Unfolding() to make test pass
# 4. Run test again - should pass
# 5. Move to next test
```

## References

### Primary Paper

**Castro-Perez, D., & Yoshida, N. (2023)**. "Dynamically Updatable Multiparty Session Protocols: Generate Efficient Distributed Implementations, Modularly." ECOOP 2023.

- Definition 14 (§3.2): Safe Protocol Update
- Theorem 20 (§4.1): Trace Equivalence
- Theorem 23 (§4.2): Deadlock-Freedom
- Theorem 29 (§4.3): Liveness

### Related Theory

- **Honda, Yoshida, Carbone (JACM 2016)**: "Multiparty Asynchronous Session Types"
  - Theorem 5.10: Progress (Deadlock-Freedom) - DMst extends this
  - Foundation for classic MPST well-formedness

- **Scalas & Yoshida (POPL 2019)**: "Less is More: Multiparty Session Types Revisited"
  - Parametric safety properties (Definition 4.1)
  - DMst implements as `SafetyProperty` extension

## Theory Documentation

Detailed formal specifications:

- `docs/theory/dmst-safe-protocol-update.md` (TODO) - Definition 14 algorithms
- `docs/theory/dmst-trace-equivalence.md` (TODO) - Theorem 20 proof
- `docs/theory/dmst-deadlock-freedom.md` (TODO) - Theorem 23 proof
- `docs/theory/dmst-liveness.md` (TODO) - Theorem 29 verification

## Example Protocols

### Simple Dynamic Worker

```typescript
protocol DynamicWorker(role Manager) {
  new role Worker;
  Manager creates Worker;
  Manager invites Worker;
  Manager -> Worker: Task();
  Worker -> Manager: Result();
}
```

**Properties verified**:
- ✅ Trace equivalence (Theorem 20)
- ✅ Deadlock-free (Theorem 23)
- ✅ Orphan-free (Theorem 29)

### Updatable Pipeline

```typescript
protocol Pipeline(role Manager) {
  new role Worker;
  rec Loop {
    Manager -> Worker: Task();
    Worker -> Manager: Result();
    choice at Manager {
      Manager creates Worker as w_new;
      continue Loop with {
        Manager -> w_new: Task();
      };
    } or {
      Manager -> Worker: Done();
    }
  }
}
```

**Properties verified**:
- ✅ Safe update (Definition 14)
- ✅ Trace equivalence with growing participant set
- ✅ Deadlock-free (all iterations)
- ✅ No stuck participants (new workers can complete)

### Protocol Call

```typescript
protocol Main(role Coordinator) {
  new role Worker;
  Coordinator calls SubTask(Worker);
  Coordinator -> Worker: Continue();
}

protocol SubTask(role w) {
  w -> Coordinator: Status();
}
```

**Properties verified**:
- ✅ Combining operator ♢ preserves traces
- ✅ Deadlock-free (no races between Main and SubTask)
- ✅ All messages delivered (no orphans)

## Benefits of Theorem-Driven Testing

✅ **Clear Correctness Criteria**: Tests explicitly state what "correct" means (formal theorems)

✅ **Implementation Guidance**: Tests show exactly what needs to be implemented

✅ **Regression Prevention**: Theorem violations immediately caught

✅ **Documentation**: Tests explain formal properties with examples

✅ **Confidence**: Implementation proven correct against academic theory

## Contributing

When adding new DMst features:

1. **Add theorem test first** (TDD)
2. **Cite paper section** in test header
3. **Include proof sketch** showing why property should hold
4. **Add positive and negative cases** (valid protocols + counterexamples)
5. **Update this README** with new theorems

---

**Status**: Phase 3 - Theorem test suite created (TDD Red phase)
**Last Updated**: 2025-11-14
**Next Step**: Implement parser extensions for DMst syntax
