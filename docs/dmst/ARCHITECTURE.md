# DMst Architecture & Design Decisions

**Implementation**: Production-Ready
**Based On**: Castro-Perez & Yoshida, ECOOP 2023
**Last Updated**: 2025-11-18

---

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Architecture Layers](#architecture-layers)
4. [Type System](#type-system)
5. [Class Hierarchy](#class-hierarchy)
6. [Design Decisions](#design-decisions)
7. [Extension Points](#extension-points)

---

## Overview

This implementation provides complete support for **DMst (Dynamically Updatable Multiparty Session Types)** as specified in Castro-Perez & Yoshida (ECOOP 2023). DMst extends classical MPST with three dynamic features:

1. **Updatable Recursion** - Protocols that evolve during execution
2. **Dynamic Participants** - Roles created at runtime
3. **Protocol Calls** - Dynamic protocol instantiation

### Implementation Philosophy

- **Formal Correctness First**: Every component verified against paper specifications
- **Type Safety**: Leverage TypeScript's type system for compile-time guarantees
- **Separation of Concerns**: Clear boundaries between parser, builder, verification, execution
- **Extensibility**: Generic types and protected fields enable safe extension

---

## Design Principles

### 1. Layered Architecture

The implementation follows a strict 7-layer architecture, where each layer depends only on layers below it:

```
Layer 7: Verification (DMst-specific)
Layer 6: Runtime Execution
Layer 5: CFSM Types & Projection
Layer 4: CFG Builder
Layer 3: AST Types
Layer 2: Parser
Layer 1: Lexer
```

**Rationale**:
- **Testability**: Each layer can be tested independently
- **Maintainability**: Changes localized to single layer
- **Reusability**: Lower layers used by both MPST and DMst

### 2. Theorem-Driven Development (TDD)

Every DMst theorem from ECOOP 2023 has corresponding executable tests:

- **Definition 14**: 28 tests for safe protocol update
- **Theorem 20**: 19 tests for trace equivalence
- **Property-Based**: 10 tests with 1000+ generated cases

**Rationale**:
- Executable formal verification
- Tests serve as specification
- Regression protection for complex properties

### 3. Two-Level Testing Strategy

Tests exist at both CFG level (global types) and CFSM level (local types):

**CFSM-Level**: Tests runtime behavior (what actually executes)
**CFG-Level**: Tests source-to-runtime compilation

**Rationale**:
- CFSM tests verify execution semantics
- CFG tests verify projection correctness
- Both needed for end-to-end correctness

### 4. Generic Type System

Base classes use generic parameters to enable type-safe extension:

```typescript
class Simulator<TTrace extends ExecutionTrace<any>, TState extends SimulationState>
class DMstSimulator extends Simulator<DMstExecutionTrace, DMstSimulationState>
```

**Rationale**:
- **Liskov Substitution Principle**: Subclasses properly extend base behavior
- **Type Safety**: Compile-time checking of state/trace compatibility
- **Covariance**: Return types naturally specialize in subclasses

---

## Architecture Layers

### Layer 1: Lexer

**File**: `src/core/parser/lexer.ts`

**DMst Tokens**:
- `new` - Dynamic role declaration
- `creates` - Participant creation
- `calls` - Protocol invocation
- `invites` - Invitation protocol
- `with` - Updatable recursion extension

**Design Decision**: Reuse existing lexer infrastructure
**Rationale**: Minimal changes to proven parser foundation

---

### Layer 2: Parser

**File**: `src/core/parser/parser.ts`

**Grammar Extensions**:
```typescript
dynamicRoleDeclaration: 'new' 'role' Identifier ';'
createParticipants: Identifier 'creates' Identifier ('as' Identifier)? ';'
invitation: Identifier 'invites' Identifier ';'
protocolCall: Identifier 'calls' Identifier '(' roleArgs ')' ';'
updatableRecursion: 'continue' Identifier 'with' '{' body '}'
```

**Design Decision**: Extend Scribble 2.0 grammar conservatively
**Rationale**:
- Backward compatible with existing protocols
- DMst syntax clearly distinguishable
- No ambiguous parses

**CST → AST Visitor**: One method per DMst construct
**Rationale**: Clear mapping from syntax to semantics

---

### Layer 3: AST Types

**File**: `src/core/ast/types.ts`

**DMst Nodes**:
```typescript
interface DynamicRoleDeclaration {
  type: 'DynamicRoleDeclaration';
  roleName: string;
  location?: SourceLocation;
}

interface CreateParticipants {
  type: 'CreateParticipants';
  creator: string;
  roleName: string;
  instanceName?: string;
  location?: SourceLocation;
}

interface Invitation {
  type: 'Invitation';
  inviter: string;
  invitee: string;
  location?: SourceLocation;
}

interface ProtocolCall {
  type: 'ProtocolCall';
  caller: string;
  protocol: string;
  roleArguments: string[];
  location?: SourceLocation;
}

interface UpdatableRecursion {
  type: 'UpdatableRecursion';
  recursionVar: string;
  updateBody: GlobalInteraction[];
  location?: SourceLocation;
}
```

**Design Decision**: Flat AST node hierarchy
**Rationale**:
- Simple type discrimination via `type` field
- Easy pattern matching in visitors
- Matches paper's syntax closely

---

### Layer 4: CFG Builder

**File**: `src/core/cfg/builder.ts`

**DMst Actions**:
```typescript
interface DynamicRoleDeclarationAction {
  kind: 'dynamic-role-declaration';
  roleName: string;
  location?: SourceLocation;
}

interface CreateParticipantsAction {
  kind: 'create-participants';
  creator: string;
  roleName: string;
  instanceName?: string;
  location?: SourceLocation;
}

interface InvitationAction {
  kind: 'invitation';
  inviter: string;
  invitee: string;
  location?: SourceLocation;
}

interface ProtocolCallAction {
  kind: 'protocol-call';
  caller: string;
  protocol: string;
  roleArguments: string[];
  location?: SourceLocation;
}

interface UpdatableRecursionAction {
  kind: 'updatable-recursion';
  label: string;
  location?: SourceLocation;
}
```

**Design Decision**: CFG nodes mirror AST nodes 1:1
**Rationale**:
- Straightforward AST → CFG transformation
- Preserves source location for error messages
- Graph structure added without changing semantics

**Builder Functions**: One per DMst construct
**Rationale**: Modular, testable, matches paper's structure

---

### Layer 5: CFSM Types & Projection

**Files**:
- `src/core/projection/types.ts` (CFSM action types)
- `src/core/projection/projector.ts` (projection algorithm)

**CFSM Actions**:
```typescript
interface CreateAction {
  type: 'create';
  role: string;           // Role type being created
  instance?: string;      // Optional instance identifier
}

interface InviteAction {
  type: 'invite';
  target: string;         // Instance ID to invite
}

interface ContinueWithAction {
  type: 'continue-with';
  recursionVar: string;   // Recursion variable being updated
  extension: CFSM;        // Extension behavior to add
  returnState: string;    // State to return to after extension
}
```

**Projection Rules** (Following Definition 12, ECOOP 2023):

```typescript
// CreateParticipants: p creates r
// [[p creates r]]_p = CreateAction (creator)
// [[p creates r]]_r = CreateAction (created)
// [[p creates r]]_q = skip (tau-elimination for uninvolved roles)

// Invitation: p invites q
// [[p invites q]]_p = InviteAction (inviter)
// [[p invites q]]_q = InviteAction (invitee)
// [[p invites q]]_r = skip (tau-elimination for uninvolved roles)

// ProtocolCall: p calls Proto(args)
// [[p calls Proto(args)]]_p = SubProtocolCallAction (caller and arguments)
// [[p calls Proto(args)]]_q = skip (tau-elimination for uninvolved roles)

// DynamicRoleDeclaration: new role Worker
// [[new role Worker]]_p = skip (metadata only, all roles)

// UpdatableRecursion: continue X with { G }
// [[continue X with { G }]]_p = skip (handled at CFG level)
```

**Design Decision**: Tau-elimination for uninvolved roles
**Rationale**:
- Follows Honda et al. (2008) projection semantics
- Minimizes CFSM state space
- Preserves trace equivalence (Theorem 20)

**Design Decision**: Handle updatable recursion at CFG level
**Rationale**:
- Extension already integrated into CFG by builder
- Projection sees pre-extended CFG
- Version management handled by runtime, not projection

---

### Layer 6: Runtime Execution

**Files**:
- `src/core/runtime/executor.ts` (base executor)
- `src/core/runtime/dmst-executor.ts` (DMst executor)
- `src/core/runtime/simulator.ts` (base simulator)
- `src/core/runtime/dmst-simulator.ts` (DMst simulator)
- `src/core/runtime/versioned-cfsm.ts` (version management)
- `src/core/runtime/dmst-runtime.ts` (dynamic participant registry)

**Class Hierarchy**:
```typescript
// Executors
class Executor {
  async step(): Promise<ExecutionResult>
  async run(): Promise<void>
  // ... standard MPST execution
}

class DMstExecutor extends Executor {
  // Overrides step() to handle DMst actions
  private async executeCreate(action: CreateAction): Promise<ExecutionResult>
  private async executeInvite(action: InviteAction): Promise<ExecutionResult>
  // ... DMst-specific behavior
}

// Simulators
class Simulator<TTrace, TState> {
  async step(role?: string): Promise<SimulationStepResult>
  async run(): Promise<SimulationStepResult>
  pause(): void
  // ... multi-role orchestration
}

class DMstSimulator extends Simulator<DMstExecutionTrace, DMstSimulationState> {
  // Overrides step() for DMst-specific pre/post processing
  private async processPendingInvitations(): Promise<void>
  private async handleDMstMessages(): Promise<void>
  // ... dynamic participant management
}
```

**Design Decision**: Executor pattern with inheritance
**Rationale**:
- **Single Responsibility**: Executor = one role, Simulator = multi-role orchestration
- **Testability**: Can test single role in isolation
- **Reusability**: Base executor used for static MPST

**Design Decision**: Generic simulator types
**Rationale**:
- **Type Safety**: DMstSimulator properly typed for DMst state/trace
- **LSP Compliance**: Subclass can be used wherever base class expected
- **Covariance**: Methods return specialized types naturally

**Version Management**:
```typescript
interface CFSMVersionRegistry {
  protocols: Map<string, ProtocolVersions>;
}

interface ProtocolVersions {
  name: string;
  roles: Map<string, RoleVersions>;
}

interface RoleVersions {
  versions: CFSM[];        // versions[0] = v1, versions[1] = v2, ...
  currentVersion: number;  // Latest version index
}
```

**Design Decision**: Version registry with monotonic versioning
**Rationale**:
- **Immutability**: Old versions never modified
- **Auditability**: Full version history preserved
- **Simplicity**: Array index = version number

**Dynamic Participant Registry**:
```typescript
interface DynamicParticipantRegistry {
  participants: Map<string, DynamicParticipant>;
  nextInstanceId: Map<string, number>;
  pendingInvitations: Map<string, string[]>;
}
```

**Design Decision**: Centralized registry for dynamic participants
**Rationale**:
- **Consistency**: Single source of truth
- **Garbage Collection**: Can track and clean up terminated participants
- **Deadlock Detection**: Global view of all participants

---

### Layer 7: Verification (DMst-Specific)

**Files**:
- `src/core/verification/dmst/safe-update.ts` (Definition 14)
- `src/core/verification/dmst/safe-update-cfsm.ts` (Definition 14 at CFSM level)
- `src/core/verification/trace-semantics.ts` (Theorem 20)
- `src/core/cfg/combining-operator.ts` (Combining operator ♢)

**Definition 14: Safe Protocol Update**:
```typescript
export function checkSafeProtocolUpdate(cfg: CFG): SafeUpdateResult {
  // 1. Find all updatable recursions
  const updatableRecursions = findUpdatableRecursions(cfg);

  for (const recAction of updatableRecursions) {
    // 2. Extract recursion body G and update body G_update
    const { recursionBody, updateBody } = extractBodies(cfg, recAction.label);

    // 3. Compute 1-unfolding: G[X ↦ G ♢ G_update]
    const unfolding = compute1Unfolding(recursionBody, updateBody);

    // 4. Check well-formedness
    const verificationResult = verifyProtocol(unfolding);

    // Check: connectedness, determinism, no races, progress
    // ...
  }

  return { isSafe: violations.length === 0, violations };
}
```

**Design Decision**: Separate global-level and CFSM-level verification
**Rationale**:
- **Global-level** (`safe-update.ts`): Checks source protocol before projection
- **CFSM-level** (`safe-update-cfsm.ts`): Checks runtime behavior after projection
- Both needed for complete correctness proof

**Combining Operator ♢**:
```typescript
export function combineProtocols(g1: CFG, g2: CFG): CombineResult {
  // 1. Check channel disjointness
  const channelCheck = checkChannelDisjointness(g1, g2);
  if (!channelCheck.isDisjoint) {
    return { success: false, channelCheck, error: 'Channels overlap' };
  }

  // 2. Build product automaton
  const combined = buildProductAutomaton(g1, g2);

  return { success: true, combined, channelCheck };
}
```

**Design Decision**: Require channel disjointness for combining
**Rationale**:
- **Safety**: Prevents race conditions
- **Formal Correctness**: Matches ECOOP 2023 definition
- **Simplicity**: No complex merge logic needed

---

## Type System

### Generic Base Classes

The type system uses generics to enable type-safe extension:

```typescript
// Base event structure
interface BaseEvent {
  type: string;
  timestamp: number;
}

// Trace events (extensible)
type TraceEvent = StateChangeEvent | MessageSentEvent | MessageReceivedEvent | ErrorEvent

type DMstTraceEvent = TraceEvent | ParticipantCreationEvent | InvitationCompleteEvent

// Generic trace (covariant in event type)
interface ExecutionTrace<TEvent extends BaseEvent = TraceEvent> {
  events: TEvent[];
  startTime: number;
  endTime?: number;
  completed: boolean;
}

// Concrete traces
interface DMstExecutionTrace extends ExecutionTrace<DMstTraceEvent> {}

// Generic simulator (covariant in trace and state types)
class Simulator<
  TTrace extends ExecutionTrace<any> = ExecutionTrace,
  TState extends SimulationState = SimulationState
> {
  protected trace: TTrace;
  protected state: TState;

  getState(): TState { ... }
  getTrace(): TTrace { ... }
}

// Concrete simulator
class DMstSimulator extends Simulator<DMstExecutionTrace, DMstSimulationState> {}
```

**Design Decision**: Generic base classes with default parameters
**Rationale**:
- **Backward Compatibility**: Default parameters maintain existing API
- **Type Safety**: Subclasses properly typed without casts
- **LSP Compliance**: Covariant return types allowed in TypeScript

### State Type Hierarchy

```typescript
interface SimulationState {
  roles: Map<string, ExecutionState>;
  messageQueue: Message[];
  step: number;
  completed: boolean;
  deadlocked: boolean;
  error?: ExecutionError;
}

interface DMstSimulationState extends SimulationState {
  dynamicParticipants: DynamicParticipantRegistry;
  protocolCallStack: ProtocolCallStack;
  creationEvents: ParticipantCreationEvent[];
  invitationEvents: InvitationCompleteEvent[];
}
```

**Design Decision**: State extension via interface inheritance
**Rationale**:
- DMst state is superset of base state
- All base simulator methods work with DMst state
- Type-safe access to DMst-specific fields

---

## Class Hierarchy

### Inheritance Diagram

```
Executor
  └─ DMstExecutor

Simulator<TTrace, TState>
  └─ DMstSimulator extends Simulator<DMstExecutionTrace, DMstSimulationState>

ExecutionTrace<TEvent>
  └─ DMstExecutionTrace extends ExecutionTrace<DMstTraceEvent>

SimulationState
  └─ DMstSimulationState
```

### Protected vs Private Fields

**Base Simulator**:
- `protected executors` - Subclasses can replace with DMstExecutor
- `protected transport` - Subclasses can access for DMst operations
- `protected trace` - Subclasses can add DMst events
- `protected observers` - Subclasses can add DMst observers

**Design Decision**: Protected fields for extension points
**Rationale**:
- Enables controlled inheritance
- Subclasses can override behavior safely
- Maintains encapsulation (not public)

---

## Design Decisions

### 1. Why Separate CFSM-Level and Global-Level Tests?

**Decision**: Maintain two parallel test suites
**Rationale**:
- **CFSM tests** verify runtime behavior (what actually runs)
- **CFG tests** verify compilation (source → runtime)
- Both needed for end-to-end correctness
- Mirrors theory: global types ≠ local types

### 2. Why Tau-Elimination in Projection?

**Decision**: Uninvolved roles skip DMst actions (no CFSM transitions)
**Rationale**:
- **Formal Correctness**: Follows Honda et al. (2008) projection
- **Efficiency**: Smaller state space
- **Trace Equivalence**: Preserves semantics (Theorem 20)

### 3. Why Version Registry Instead of In-Place CFSM Updates?

**Decision**: Immutable versions in registry, never mutate old CFSMs
**Rationale**:
- **Debugging**: Can inspect any historical version
- **Auditability**: Full version history preserved
- **Safety**: No accidental mutation bugs
- **Simplicity**: Array index = version number

### 4. Why Generic Simulator Types?

**Decision**: `Simulator<TTrace, TState>` with defaults
**Rationale**:
- **Type Safety**: Compile-time checking of state/trace compatibility
- **LSP Compliance**: Subclasses properly extend base
- **Covariance**: Return types specialize naturally
- **Backward Compatibility**: Default parameters maintain existing API

### 5. Why Two-Level CFG Builder?

**Decision**: AST → CFG → Extended CFG (with updates integrated)
**Rationale**:
- **Separation of Concerns**: Parsing ≠ update integration
- **Reusability**: Base CFG builder used for both MPST and DMst
- **Testability**: Can test CFG building separately from updates

### 6. Why Executor Pattern?

**Decision**: Separate Executor (single role) from Simulator (multi-role)
**Rationale**:
- **Single Responsibility**: Executor = one role logic
- **Testability**: Can test single role in isolation
- **Performance**: Can parallelize executor steps
- **Clarity**: Clear separation of concerns

---

## Extension Points

### Adding New DMst Features

To add a new DMst feature (e.g., protocol delegation):

1. **Lexer**: Add new tokens (`src/core/parser/lexer.ts`)
2. **Parser**: Add grammar rule and CST→AST visitor (`src/core/parser/parser.ts`)
3. **AST**: Define new node type (`src/core/ast/types.ts`)
4. **CFG**: Define new action type and builder (`src/core/cfg/types.ts`, `builder.ts`)
5. **Projection**: Add projection rule (`src/core/projection/projector.ts`)
6. **CFSM**: Define new action type (`src/core/projection/types.ts`)
7. **Runtime**: Add execution handler (`src/core/runtime/dmst-executor.ts`)
8. **Tests**: Add theorem tests and integration tests

### Adding New Verification Properties

To add a new theorem (e.g., Theorem 23):

1. **Algorithm**: Implement verification algorithm (`src/core/verification/dmst/`)
2. **Tests**: Create test file (`src/__tests__/theorems/dmst/theorem-23.test.ts`)
3. **Integration**: Call from `verifyProtocol()` if needed

### Extending Simulator

To extend the simulator (e.g., add replay functionality):

1. **Base Class**: Add method to `Simulator` with default implementation
2. **Override**: Override in `DMstSimulator` if DMst-specific behavior needed
3. **Protected Fields**: Use `protected` fields for access to internals

---

## Performance Considerations

### CFSM State Space

- **Tau-Elimination**: Reduces states for uninvolved roles
- **Lazy Projection**: CFSMs projected on-demand, not eagerly
- **Version Registry**: O(1) lookup by version number

### Dynamic Participant Scaling

- **Registry Lookup**: O(1) hash map access
- **Garbage Collection**: Terminated participants can be pruned
- **Fair Scheduling**: Round-robin prevents starvation

### Verification Complexity

- **1-Unfolding**: Linear in protocol size (one iteration)
- **Channel Disjointness**: O(n²) in number of actions
- **State Graph**: Exponential worst-case, but tau-elimination helps

---

## References

1. **Castro-Perez, D., & Yoshida, N. (2023)**. Dynamically Updatable Multiparty Session Protocols. ECOOP 2023.
2. **Honda, K., Yoshida, N., & Carbone, M. (2008)**. Multiparty Asynchronous Session Types. POPL 2008.
3. **Honda, K., Yoshida, N., & Carbone, M. (2016)**. Multiparty Session Types. Communications of the ACM, 59(11), 67-77.

---

**Last Updated**: 2025-11-18
**Implementation**: Production-ready for updatable recursion, near-complete for dynamic participants and protocol calls
**Verification Level**: Academic/research-grade formal verification
