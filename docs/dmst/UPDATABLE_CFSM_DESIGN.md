# Updatable CFSM Runtime Design (Sprint 3)

**Status**: Design Phase
**Issue**: #8
**Priority**: P1 (Advanced feature)
**Based on**: Castro-Perez & Yoshida (ECOOP 2023), Section 3.2

---

## Executive Summary

**Updatable recursion** is the key distinguishing feature of DMst that allows protocols to evolve at runtime. This enables:
- Adding new participants to ongoing sessions
- Extending protocol behavior without breaking existing participants
- Runtime adaptation to changing requirements

This document outlines the design for implementing updatable CFSM runtime semantics in the SMPST simulator.

---

## Background: What is Updatable Recursion?

### Classic MPST Recursion (Fixed)

```
protocol Fixed(role A, role B) {
  rec X {
    A -> B: Data;
    continue X;
  }
}
```

**Problem**: Cannot add new behavior once protocol starts. Participants are locked into the original definition.

### DMst Updatable Recursion

```
protocol Updatable(role A, role B) {
  rec X {
    A -> B: Data;
    choice at A {
      continue X;
      continue X with {
        A -> B: NewData;  // Extended behavior
      };
    }
  }
}
```

**Key Insight**: `continue X with { G }` means:
1. Unroll recursion one more time (like `continue X`)
2. BUT replace the recursion body with `G ; X` instead of just `X`
3. All participants see the updated behavior from next iteration

### Formal Semantics (ECOOP 2023)

From Definition 3 (Global Types):
```
G ::= ... | continue X with { G }
```

**Operational semantics**:
```
continue X with { G' } ≡ G' ; (rec X { G' ; (unfold X) })
```

Where:
- `unfold X` retrieves the original recursion body
- `G'` is the extension
- Next iteration uses `G' ; (original body)` instead of just `original body`

---

## Architecture Design

### Current State (Sprint 1 & 2)

```
┌──────────────────┐
│  DMstSimulator   │
│  - executors     │
│  - fair sched    │
│  - observers     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  DMstExecutor    │
│  - currentCFSM   │  ← Static CFSM, no versioning
│  - currentState  │
│  - callStack     │
└──────────────────┘
```

### Target State (Sprint 3)

```
┌──────────────────┐
│  DMstSimulator   │
│  - executors     │
│  - cfsmVersions  │  ← NEW: Version registry
│  - updateQueue   │  ← NEW: Pending updates
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  DMstExecutor    │
│  - currentCFSM   │  ← Can be updated at runtime
│  - cfsmVersion   │  ← NEW: Tracks active version
│  - callStack     │  ← Extended with version info
└──────────────────┘
```

---

## Implementation Plan

### Phase 1: Versioned CFSM Data Structures

**Goal**: Support multiple versions of the same CFSM in memory.

#### New Types (dmst-runtime.ts)

```typescript
/**
 * Versioned CFSM entry
 *
 * Tracks a specific version of a CFSM for a role.
 * Multiple versions can coexist during protocol evolution.
 */
export interface VersionedCFSM {
  version: number;              // Version number (increments on update)
  cfsm: CFSM;                   // The actual CFSM
  parentVersion?: number;       // Version this extends (for continue-with)
  extension?: CFSM;             // Extension added via continue-with
  createdAt: number;            // Timestamp
}

/**
 * CFSM version registry
 *
 * Stores all versions of all CFSMs in a protocol.
 * Key: `${protocolName}:${roleName}`
 */
export interface CFSMVersionRegistry {
  versions: Map<string, VersionedCFSM[]>;  // All versions per role
  activeVersion: Map<string, number>;      // Current version per role
}

/**
 * CFSM update descriptor
 *
 * Describes a protocol update to be applied.
 */
export interface CFSMUpdate {
  protocolName: string;
  roleName: string;
  recursionVar: string;         // Which recursion point (e.g., "X")
  extension: CFSM;              // New behavior to add
  targetVersion: number;        // Version to extend
}
```

#### Updated CallStackFrame

```typescript
export interface CallStackFrame {
  parentCFSM: CFSM;
  returnState: string;
  roleMapping: Record<string, string>;
  protocol: string;

  // NEW: Version tracking for updatable recursion
  cfsmVersion?: number;         // Version active when call was made
}
```

### Phase 2: Update Mechanism

**Goal**: Apply CFSM updates at recursion points.

#### Key Functions

```typescript
/**
 * Register a CFSM update
 *
 * Called when `continue X with { G }` is executed.
 * Updates are applied to all active executors at the recursion point.
 *
 * @param registry - Version registry
 * @param update - Update descriptor
 * @returns New version number
 */
export function registerCFSMUpdate(
  registry: CFSMVersionRegistry,
  update: CFSMUpdate
): number;

/**
 * Apply CFSM update to executor
 *
 * Swaps executor's currentCFSM to new version.
 * Preserves state continuity (current state carries over).
 *
 * @param executor - Executor to update
 * @param newCFSM - New CFSM version
 */
export function applyCFSMUpdate(
  executor: DMstExecutor,
  newCFSM: CFSM
): void;

/**
 * Create extended CFSM
 *
 * Combines original CFSM with extension.
 * Pattern: extension ; original
 *
 * @param original - Base CFSM
 * @param extension - Extension CFSM
 * @param recursionPoint - State to extend
 * @returns New CFSM with extension
 */
export function extendCFSM(
  original: CFSM,
  extension: CFSM,
  recursionPoint: string
): CFSM;
```

### Phase 3: Syntax Support

**Goal**: Parse `continue X with { G }` construct.

#### Grammar Extension (GRAMMAR.md)

```ebnf
RecursionExpression ::=
  | "continue" Identifier                          (* Classic continue *)
  | "continue" Identifier "with" "{" GlobalType "}" (* Updatable continue *)
```

#### AST Extension (ast/types.ts)

```typescript
export interface ContinueStatement extends ASTNode {
  type: 'ContinueStatement';
  recursionVar: string;
  extension?: GlobalProtocolDeclaration;  // Present for continue-with
}
```

### Phase 4: Projection

**Goal**: Project `continue X with { G }` to local CFSMs.

#### Projection Rule

For role `p`, projecting `continue X with { G }`:
1. Project extension: `G ↓ p = Gp`
2. Find recursion point in current CFSM: state `Sx`
3. Create new CFSM version:
   - Insert `Gp` before returning to `Sx`
   - Update transitions to route through extension
4. Register version in registry

### Phase 5: Runtime Execution

**Goal**: Execute updatable protocols.

#### Execution Flow

```
1. Execute normally until hitting continue-with
2. Detect continue-with action (new action type)
3. Broadcast update to all executors:
   a. Create extended CFSM
   b. Register new version
   c. Swap executor CFSM (atomic update)
4. Continue execution with new CFSM
5. Next recursion uses extended version
```

#### New Action Type

```typescript
export interface ContinueWithAction {
  type: 'continue-with';
  recursionVar: string;
  extension: CFSM;              // Extension behavior
  returnState: string;          // Where to return after extension
}
```

---

## Example: Updatable Task Distribution

### Protocol Definition

```
protocol TaskDistribution(role Coordinator, role Worker) {
  rec X {
    Coordinator -> Worker: Task;
    Worker -> Coordinator: Result;

    choice at Coordinator {
      continue X;  // Classic: repeat as-is

      continue X with {
        // Extension: Add logging
        Worker -> Coordinator: Log;
        Coordinator -> Worker: Ack;
      };
    }
  }
}
```

### Execution Trace

```
Iteration 1 (Original):
  Coordinator -> Worker: Task
  Worker -> Coordinator: Result
  [Coordinator chooses continue X with logging]

Iteration 2 (Extended):
  Coordinator -> Worker: Task
  Worker -> Coordinator: Result
  Worker -> Coordinator: Log        ← NEW
  Coordinator -> Worker: Ack        ← NEW
  [Coordinator chooses continue X]

Iteration 3 (Extended):
  Coordinator -> Worker: Task
  Worker -> Coordinator: Result
  Worker -> Coordinator: Log        ← Persisted
  Coordinator -> Worker: Ack        ← Persisted
```

**Key Property**: Extension persists across future iterations until another update.

---

## Migration Path

### Sprint 3a: Data Structures (Week 1)

- [ ] Add VersionedCFSM types
- [ ] Add CFSMVersionRegistry to DMstSimulator
- [ ] Extend CallStackFrame with version tracking
- [ ] Update DMstExecutor to track cfsmVersion

### Sprint 3b: Update Mechanism (Week 1)

- [ ] Implement registerCFSMUpdate()
- [ ] Implement applyCFSMUpdate()
- [ ] Implement extendCFSM()
- [ ] Add ContinueWithAction type

### Sprint 3c: Syntax & Parsing (Week 2)

- [ ] Extend grammar for continue-with
- [ ] Update parser to recognize construct
- [ ] Extend AST with ContinueStatement
- [ ] Add validation for continue-with

### Sprint 3d: Projection & Execution (Week 2)

- [ ] Implement projection rule for continue-with
- [ ] Add continue-with execution to DMstExecutor
- [ ] Add update broadcasting to DMstSimulator
- [ ] Add version synchronization

### Sprint 3e: Testing & Integration (Week 2)

- [ ] Create updatable protocol examples
- [ ] Write comprehensive tests
- [ ] Validate against ECOOP 2023 semantics
- [ ] Update documentation

---

## Testing Strategy

### Unit Tests

1. **Version Registry**
   - Register new version
   - Retrieve version by number
   - Track active version per role

2. **CFSM Extension**
   - Combine CFSMs correctly
   - Preserve state IDs
   - Handle terminal states

3. **Update Application**
   - Swap executor CFSM
   - Preserve current state
   - Update version tracking

### Integration Tests

1. **Simple Extension**
   - Add one action to recursion
   - Verify extended behavior
   - Verify persistence

2. **Multiple Extensions**
   - Chain multiple continue-with
   - Verify cumulative behavior
   - Verify version history

3. **Multi-Role Updates**
   - Synchronize updates across roles
   - Handle concurrent execution
   - Verify consistency

### Correctness Properties

From ECOOP 2023 Theorem 20:
- **Trace Equivalence**: Updated protocol preserves safety
- **Progress**: No deadlock introduced by updates
- **Type Safety**: Updates maintain well-formedness

---

## Open Questions

1. **Update Atomicity**: How to ensure all roles see update simultaneously?
   - **Answer**: Use version numbers + synchronization barrier

2. **Rollback**: Should we support reverting to previous versions?
   - **Decision**: Phase 2 feature, defer to Sprint 4

3. **Nested Updates**: Can continue-with be nested?
   - **Answer**: Yes, per ECOOP 2023 Definition 3

4. **Performance**: Impact of version management on execution?
   - **Mitigation**: Use copy-on-write for CFSM versions

---

## Success Criteria

Sprint 3 is complete when:

✅ **Data Structures**:
- [ ] VersionedCFSM types defined
- [ ] CFSMVersionRegistry implemented
- [ ] Version tracking integrated

✅ **Runtime Support**:
- [ ] continue-with action executes correctly
- [ ] Updates apply atomically
- [ ] Extensions persist across iterations

✅ **Syntax Support**:
- [ ] continue-with parses correctly
- [ ] Projection generates versioned CFSMs
- [ ] Validation catches errors

✅ **Testing**:
- [ ] All unit tests pass
- [ ] Integration tests demonstrate updatability
- [ ] Trace equivalence validated

✅ **Documentation**:
- [ ] Examples added to examples/dmst/
- [ ] GRAMMAR.md updated
- [ ] This design doc → implementation guide

---

## References

- **Primary**: Castro-Perez & Yoshida (ECOOP 2023), Section 3.2
- **Definition 3**: Global types with updatable recursion
- **Theorem 20**: Trace equivalence for protocol updates
- **Figure 4**: Operational semantics of continue-with

---

## Next Steps

1. Review this design with stakeholders
2. Create GitHub issue for Sprint 3
3. Begin Sprint 3a: Data structures
4. Implement incrementally with tests

**Estimated Duration**: 2 weeks (40-60 hours)
**Risk Level**: Medium (complex feature, well-defined semantics)
**Blocking**: None (Sprint 1 & 2 complete)
