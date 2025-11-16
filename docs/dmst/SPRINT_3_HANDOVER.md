# Sprint 3 Handover: Updatable Recursion Runtime

**Status**: ✅ COMPLETE (Runtime Infrastructure)
**Date**: 2025-11-16
**Branch**: `claude/dmst-simulator-parity-013VtfVDjCvqpJ51RgR3bZSU`
**Commits**: `9ec350a`

---

## Executive Summary

Sprint 3 implements the **core runtime infrastructure** for DMst updatable recursion based on Castro-Perez & Yoshida (ECOOP 2023), Section 3.2. This enables protocols to evolve at runtime by adding new behavior without breaking existing participants.

**What's Complete**:
- ✅ Versioned CFSM data structures (Phase 3a)
- ✅ Update mechanism and version registry (Phase 3b)
- ✅ Comprehensive test suite (Phase 3e)
- ✅ Executor version tracking
- ✅ Simulator update broadcasting

**What's Deferred** (Future Work):
- ⏸️ Syntax parsing for `continue X with { G }` (Phase 3c)
- ⏸️ Projection rules for continue-with (Phase 3d)
- ⏸️ End-to-end protocol examples with parser integration

---

## Key Concept: Updatable Recursion

### Classic MPST Recursion (Fixed)
```
protocol Fixed(role A, role B) {
  rec X {
    A -> B: Data;
    continue X;  // Always repeats same behavior
  }
}
```
**Problem**: Cannot add new behavior once protocol starts.

### DMst Updatable Recursion
```
protocol Updatable(role A, role B) {
  rec X {
    A -> B: Data;
    choice at A {
      continue X;
      continue X with {
        A -> B: NewData;  // Extension
      };
    }
  }
}
```

**Operational Semantics** (ECOOP 2023):
```
continue X with { G' } ≡ G' ; (rec X { G' ; (unfold X) })
```

**Meaning**:
1. Execute extension `G'`
2. Next iteration uses `G' ; original` instead of just `original`
3. Extension persists across all future iterations
4. ALL roles see the updated protocol

---

## Architecture

### Before Sprint 3 (Static CFSMs)
```
┌──────────────────┐
│  DMstSimulator   │
│  - executors     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  DMstExecutor    │
│  - currentCFSM   │  ← Static, never changes
│  - currentState  │
└──────────────────┘
```

### After Sprint 3 (Versioned CFSMs)
```
┌──────────────────────────────────────────┐
│          DMstSimulator                   │
│  - executors: Map<string, DMstExecutor>  │
│  - versionRegistry: CFSMVersionRegistry  │
│  - protocolName: string                  │
└────────┬─────────────────────────────────┘
         │
         │ When continue-with executed:
         │ 1. Create extended CFSM
         │ 2. Register new version
         │ 3. Broadcast to all executors
         │
         ▼
┌──────────────────────────────────────────┐
│          DMstExecutor                    │
│  - currentCFSM: CFSM                     │
│  - cfsmVersion: number                   │
│  - protocolName: string                  │
│                                          │
│  + applyCFSMUpdate(newCFSM, newVersion) │
└──────────────────────────────────────────┘
```

### Version Registry Structure
```typescript
CFSMVersionRegistry {
  versions: Map<"Protocol:Role", VersionedCFSM[]>
  // e.g., "TaskDistribution:Coordinator" -> [v1, v2, v3]

  activeVersion: Map<"Protocol:Role", number>
  // e.g., "TaskDistribution:Coordinator" -> 2
}

VersionedCFSM {
  version: number           // 1, 2, 3, ...
  cfsm: CFSM               // The actual CFSM
  parentVersion?: number   // Version this extends (for v2+)
  extension?: CFSM         // Extension added via continue-with
  createdAt: number        // Timestamp
}
```

---

## Implementation Details

### Phase 3a: Versioned CFSM Data Structures

**File**: `src/core/runtime/versioned-cfsm.ts` (336 lines)

**Key Types**:
```typescript
interface VersionedCFSM {
  version: number;
  cfsm: CFSM;
  parentVersion?: number;
  extension?: CFSM;
  createdAt: number;
}

interface CFSMVersionRegistry {
  versions: Map<string, VersionedCFSM[]>;
  activeVersion: Map<string, number>;
}

interface CFSMUpdate {
  protocolName: string;
  roleName: string;
  recursionVar: string;
  extension: CFSM;
  targetVersion: number;
}
```

**Key Functions**:
- `createVersionRegistry()`: Initialize empty registry
- `registerInitialVersion()`: Register v1 for a role
- `getActiveVersion()`: Get current version for a role
- `getVersion()`: Get specific version number
- `getVersionHistory()`: Get all versions chronologically

### Phase 3b: Update Mechanism

**CFSM Extension Algorithm** (`extendCFSM()`):
```typescript
// Original CFSM:
//   S0 -> S1 -> S2(rec X) -> S3 -> S2
//
// Extension CFSM:
//   E0 -> E1 -> E2(terminal)
//
// Extended CFSM:
//   S0 -> S1 -> E0 -> E1 -> E2 -> S2 -> S3 -> S2
//                      ^           ^
//                   extension   recursion point

1. Find recursion point in original (state containing recursion var)
2. Create unique IDs for extension states (avoid conflicts)
3. Remap extension transitions with new IDs
4. Redirect transitions TO recursion point -> go through extension first
5. Add bridge transitions from extension terminals TO recursion point
6. Return combined CFSM
```

**Update Registration** (`registerCFSMUpdate()`):
```typescript
1. Get target version from registry
2. Call extendCFSM(target.cfsm, extension, recursionVar)
3. Create new VersionedCFSM:
   - version = currentMax + 1
   - parentVersion = targetVersion
   - extension = extension
4. Add to registry.versions
5. Update registry.activeVersion
6. Return new version number
```

**Executor Update** (`DMstExecutor.applyCFSMUpdate()`):
```typescript
1. Swap this.currentCFSM = newCFSM  (atomic)
2. Update this.cfsmVersion = newVersion
3. DO NOT change currentState (execution continues from same state)
4. DO NOT change callStack (sub-protocol context preserved)
```

**Simulator Broadcasting** (`DMstSimulator.handleContinueWith()`):
```typescript
1. Executor sends continue-with message to "__simulator__"
2. Simulator intercepts message in handleDMstMessages()
3. For each active executor:
   a. Create CFSMUpdate descriptor
   b. Call registerCFSMUpdate() to get new version
   c. Retrieve new VersionedCFSM from registry
   d. Call executor.applyCFSMUpdate(newCFSM, newVersion)
4. All executors now have same version number
```

### Phase 3e: Comprehensive Tests

**File**: `src/__tests__/integration/updatable-recursion.test.ts` (658 lines)

**Test Coverage**:

1. **Version Registry Operations** (5 tests)
   - Create empty registry
   - Register initial version
   - Retrieve active version
   - Retrieve specific version
   - Track version history

2. **CFSM Extension** (3 tests)
   - Extend CFSM with new states
   - Connect extension to recursion point
   - Preserve original terminal states

3. **Update Registration** (3 tests)
   - Register CFSM update
   - Track parent version in update
   - Support multiple updates (chaining)

4. **Executor Version Tracking** (3 tests)
   - Track CFSM version in executor
   - Apply CFSM update to executor
   - Preserve executor state after update

5. **Simulator Integration** (2 tests)
   - Initialize simulator with version registry
   - Track protocol name in simulator

6. **End-to-End** (2 tests)
   - Execute simple protocol with version tracking
   - Handle version registry across execution

7. **Correctness Properties** (3 tests)
   - Maintain CFSM well-formedness after extension
   - Preserve type safety across updates
   - Maintain version monotonicity

**Total**: 21 test cases demonstrating all runtime features

---

## Example: Updatable Task Distribution

### Protocol Definition (Conceptual)
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
Iteration 1 (Version 1 - Original):
  Coordinator -> Worker: Task
  Worker -> Coordinator: Result
  [Coordinator chooses: continue X with logging]

----> VERSION UPDATE BROADCAST <----
All executors swap to Version 2

Iteration 2 (Version 2 - Extended):
  Coordinator -> Worker: Task
  Worker -> Coordinator: Result
  Worker -> Coordinator: Log        ← NEW (from extension)
  Coordinator -> Worker: Ack        ← NEW (from extension)
  [Coordinator chooses: continue X]

Iteration 3 (Version 2 - Extension Persists):
  Coordinator -> Worker: Task
  Worker -> Coordinator: Result
  Worker -> Coordinator: Log        ← Still present
  Coordinator -> Worker: Ack        ← Still present
```

**Key Property**: Extension persists across future iterations until another update.

---

## Code Changes

### New Files Created

#### `src/core/runtime/versioned-cfsm.ts` (336 lines)
```typescript
export interface VersionedCFSM { ... }
export interface CFSMVersionRegistry { ... }
export interface CFSMUpdate { ... }

export function createVersionRegistry(): CFSMVersionRegistry
export function registerInitialVersion(...)
export function registerCFSMUpdate(...)
export function getActiveVersion(...)
export function getVersion(...)
export function extendCFSM(...)
export function getVersionHistory(...)
```

#### `src/__tests__/integration/updatable-recursion.test.ts` (658 lines)
21 test suites covering:
- Version registry CRUD
- CFSM extension correctness
- Update registration
- Executor integration
- Simulator integration
- Correctness properties

### Modified Files

#### `src/core/projection/types.ts`
```typescript
// Added new action type
export type CFSMAction =
  | SendAction
  | ReceiveAction
  | TauAction
  | ChoiceAction
  | SubProtocolCallAction
  | CreateAction
  | InviteAction
  | ContinueWithAction;  // NEW

export interface ContinueWithAction {
  type: 'continue-with';
  recursionVar: string;
  extension: CFSM;
  returnState: string;
}
```

#### `src/core/runtime/types.ts`
```typescript
export interface CallStackFrame {
  parentCFSM: CFSM;
  returnState: string;
  roleMapping: Record<string, string>;
  protocol: string;

  // NEW: Version tracking
  cfsmVersion?: number;
}
```

#### `src/core/runtime/dmst-executor.ts`
```typescript
export interface DMstExecutorConfig extends ExecutorConfig {
  dynamicRegistry?: DynamicParticipantRegistry;
  dynamicCFSMs?: Map<string, CFSM>;

  // NEW: Version tracking
  cfsmVersion?: number;
  protocolName?: string;
}

export class DMstExecutor extends Executor {
  private cfsmVersion: number;
  private protocolName?: string;

  // NEW: Version management
  applyCFSMUpdate(newCFSM: CFSM, newVersion: number): void
  getCFSMVersion(): number
  getProtocolName(): string | undefined

  // NEW: Handle continue-with action
  private async executeContinueWith(...): Promise<ExecutionResult>
}
```

#### `src/core/runtime/dmst-simulator.ts`
```typescript
export class DMstSimulator {
  // NEW: Version registry
  private versionRegistry: CFSMVersionRegistry;
  private protocolName: string;

  constructor(
    staticRoles: Map<string, CFSM>,
    dynamicRoles: Map<string, CFSM> = new Map(),
    transport?: MessageTransport,
    cfsmRegistry?: Map<string, Map<string, CFSM>>,
    options?: {
      recordTrace?: boolean;
      protocolName?: string;  // NEW
    }
  ) {
    // Initialize version registry
    this.versionRegistry = createVersionRegistry();
    this.protocolName = options?.protocolName || 'UnnamedProtocol';

    // Register v1 for each role
    for (const [role, cfsm] of staticRoles.entries()) {
      registerInitialVersion(this.versionRegistry, this.protocolName, role, cfsm);
    }

    // Create executors with version tracking
    for (const [role, cfsm] of staticRoles.entries()) {
      const config: DMstExecutorConfig = {
        role, cfsm, transport,
        cfsmRegistry: this.cfsmRegistry,
        dynamicRegistry: this.state.dynamicParticipants,
        dynamicCFSMs: this.dynamicCFSMs,
        cfsmVersion: 1,              // NEW
        protocolName: this.protocolName,  // NEW
      };
      this.executors.set(role, new DMstExecutor(config));
    }
  }

  // NEW: Handle protocol updates
  private async handleContinueWith(updater: string, msg: Message): Promise<void> {
    // Extract update info
    const { recursionVar, extension, currentVersion } = msg.payload;

    // For each executor, create and apply update
    for (const [roleName, executor] of this.executors.entries()) {
      const update: CFSMUpdate = {
        protocolName: this.protocolName,
        roleName,
        recursionVar,
        extension,
        targetVersion: currentVersion,
      };

      // Register update and get new version
      const newVersion = registerCFSMUpdate(this.versionRegistry, update);

      // Get new CFSM from registry
      const versionedCFSM = this.versionRegistry.versions
        .get(`${this.protocolName}:${roleName}`)
        ?.find(v => v.version === newVersion);

      // Apply update (atomic CFSM swap)
      executor.applyCFSMUpdate(versionedCFSM.cfsm, newVersion);
    }
  }
}
```

---

## API Usage Examples

### 1. Manual CFSM Update (Testing)
```typescript
import {
  createVersionRegistry,
  registerInitialVersion,
  registerCFSMUpdate,
  extendCFSM,
} from './versioned-cfsm';

// Create registry
const registry = createVersionRegistry();

// Register initial version
const aliceCFSM: CFSM = { /* ... */ };
registerInitialVersion(registry, 'MyProtocol', 'Alice', aliceCFSM);

// Create extension
const extensionCFSM: CFSM = { /* new behavior */ };

// Register update
const update: CFSMUpdate = {
  protocolName: 'MyProtocol',
  roleName: 'Alice',
  recursionVar: 'X',
  extension: extensionCFSM,
  targetVersion: 1,
};

const v2 = registerCFSMUpdate(registry, update);
console.log(`New version: ${v2}`);  // 2

// Get updated CFSM
const active = getActiveVersion(registry, 'MyProtocol', 'Alice');
console.log(active?.cfsm);  // Extended CFSM
```

### 2. Simulator with Version Tracking
```typescript
const aliceCFSM: CFSM = { /* ... */ };
const bobCFSM: CFSM = { /* ... */ };

const simulator = new DMstSimulator(
  new Map([
    ['Alice', aliceCFSM],
    ['Bob', bobCFSM],
  ]),
  new Map(),  // No dynamic roles
  undefined,  // Default transport
  undefined,  // No CFSM registry
  {
    protocolName: 'MyProtocol',
    recordTrace: true,
  }
);

// Simulator automatically:
// - Initializes version registry
// - Registers v1 for Alice and Bob
// - Creates executors with version tracking

await simulator.run();
```

### 3. Executor Version Tracking
```typescript
const executor = new DMstExecutor({
  role: 'Alice',
  cfsm: aliceCFSM,
  transport,
  cfsmVersion: 1,
  protocolName: 'MyProtocol',
});

// Check version
console.log(executor.getCFSMVersion());  // 1

// Execute some steps...
await executor.step();

// Apply update (when simulator broadcasts)
const newCFSM = extendCFSM(aliceCFSM, extensionCFSM, 'X');
executor.applyCFSMUpdate(newCFSM, 2);

console.log(executor.getCFSMVersion());  // 2
// State preserved - execution continues seamlessly
```

---

## Performance Characteristics

### Space Complexity
- **Version Registry**: O(R × V) where R = roles, V = versions
- **CFSM Extension**: O(S₁ + S₂) where S₁, S₂ = states in original and extension
- **Update Broadcast**: O(R) executors to update

### Time Complexity
- **Register Update**: O(S₁ + S₂) to create extended CFSM
- **Apply Update**: O(1) (atomic CFSM pointer swap)
- **Broadcast**: O(R) executors × O(1) update = O(R)

### Memory Management
- **Copy-on-Write**: Old versions retained for history/debugging
- **Shared Structures**: States and transitions reused where possible
- **Cleanup Strategy**: Could garbage-collect old versions (not implemented)

---

## Correctness Properties

### Theorem 1: Well-Formedness Preservation
**Property**: If `original` is a well-formed CFSM and `extension` is a well-formed CFSM, then `extendCFSM(original, extension, X)` is well-formed.

**Well-formedness**:
1. Has initial state
2. Initial state exists in states
3. All transitions reference existing states
4. Terminal states exist in states

**Tested**: ✅ `updatable-recursion.test.ts:443`

### Theorem 2: Type Safety
**Property**: All versions of a CFSM for a role have the same role name.

**Tested**: ✅ `updatable-recursion.test.ts:464`

### Theorem 3: Version Monotonicity
**Property**: Version numbers are strictly increasing: v₁ < v₂ < v₃ < ...

**Tested**: ✅ `updatable-recursion.test.ts:477`

### Theorem 4: State Preservation
**Property**: Applying a CFSM update preserves the executor's current state and call stack.

**Tested**: ✅ `updatable-recursion.test.ts:379`

### Theorem 5: Trace Equivalence (ECOOP 2023 Theorem 20)
**Property**: Updated protocol preserves safety properties of original.

**Status**: Not tested (requires full projection + syntax support)

---

## Future Work (Phase 3c/3d)

### Phase 3c: Syntax Parsing
**Goal**: Parse `continue X with { G }` construct

**Grammar Extension**:
```ebnf
RecursionExpression ::=
  | "continue" Identifier                          (* Classic *)
  | "continue" Identifier "with" "{" GlobalType "}" (* Updatable *)
```

**AST Extension**:
```typescript
interface ContinueStatement extends ASTNode {
  type: 'ContinueStatement';
  recursionVar: string;
  extension?: GlobalProtocolDeclaration;  // Present for continue-with
}
```

**Files to Modify**:
- `src/core/parser/grammar.pegjs`
- `src/core/ast/types.ts`
- `src/core/parser/parser.ts`

### Phase 3d: Projection
**Goal**: Project `continue X with { G }` to local CFSMs

**Projection Rule** (for role `p`):
```
[[continue X with { G }]]_p =
  1. Project extension: G ↓ p = Gp
  2. Find recursion point in current CFSM: state Sx
  3. Create new CFSM version:
     - Insert Gp before returning to Sx
     - Update transitions to route through extension
  4. Register version in registry
```

**Files to Modify**:
- `src/core/projection/projector.ts`
- `src/core/projection/cfg-to-cfsm.ts`

---

## Integration with Existing Code

### Backward Compatibility
✅ **All existing code continues to work**:
- Classic protocols ignore version tracking
- DMstExecutor defaults to version 1
- Version registry is optional (defaults to empty)
- No breaking changes to existing APIs

### Integration Points
1. **Parser** → AST with ContinueStatement
2. **Projector** → Generate ContinueWithAction in CFSM
3. **Executor** → Execute continue-with action
4. **Simulator** → Broadcast updates to all roles
5. **Tests** → Validate end-to-end updatable protocols

---

## Summary

### What We Achieved
✅ **Complete runtime infrastructure** for updatable recursion:
- Versioned CFSM data structures
- Update mechanism with extension semantics
- Atomic CFSM updates in executors
- Update broadcasting in simulator
- Comprehensive test coverage

### What's Missing
⏸️ **Parser and projection integration**:
- Syntax parsing for `continue X with { G }`
- Projection rules for continue-with
- End-to-end protocol examples

### Next Steps
1. **Immediate**: Test Sprint 3 runtime with manual CFSMs
2. **Short-term**: Implement Phase 3c (parsing) and 3d (projection)
3. **Medium-term**: Add protocol update events to trace
4. **Long-term**: Garbage collection for old CFSM versions

### Commit Summary
- **Files Added**: 2 (versioned-cfsm.ts, updatable-recursion.test.ts)
- **Files Modified**: 4 (types.ts, dmst-executor.ts, dmst-simulator.ts, projection/types.ts)
- **Lines Added**: 1,146
- **Lines Deleted**: 1
- **Tests**: 21 new test cases

---

## References

1. **Castro-Perez, D., & Yoshida, N. (2023)**. *ECOOP 2023: Dynamically Updatable Multiparty Session Types*, Section 3.2
   - Definition 3: Global types with updatable recursion
   - Theorem 20: Trace equivalence for protocol updates
   - Figure 4: Operational semantics of continue-with

2. **Honda, K., Yoshida, N., & Carbone, M. (2008)**. *POPL 2008: Multiparty Asynchronous Session Types*
   - Foundation for MPST theory

3. **SMPST Implementation**:
   - Sprint 1: Simulator parity (commit `e0aff57`)
   - Sprint 2: Observability features (commit `2db4bbf`)
   - Sprint 3: Updatable recursion runtime (commit `9ec350a`)

---

**Sprint 3 Status**: ✅ **RUNTIME COMPLETE**
**Next Sprint**: Parser/Projection Integration (3c/3d)
**Branch**: `claude/dmst-simulator-parity-013VtfVDjCvqpJ51RgR3bZSU`
