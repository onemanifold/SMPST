# Backend Simulation Engines & Debuggers - Complete Capabilities

## Overview
The backend provides a 4-layer architecture for protocol simulation and debugging:
- **Layer 1**: Core Protocol Representation (CFG, CFSM)
- **Layer 2**: Execution Engines (CFGSimulator, DistributedSimulator, CFSMSimulator)
- **Layer 3**: Debugging Interfaces (CFGDebugger, DistributedDebugger)
- **Layer 4**: Validation (BisimulationValidator)

---

## 1. CFGSimulator - Global Orchestration Execution

### Purpose
Executes a global protocol step-by-step from a verified CFG (Control Flow Graph). Represents the "choreographer's view" where a single coordinator orchestrates all protocol actions synchronously.

### **Operations/Methods**

#### Core Execution
- `step()` → Execute one protocol-level action (message/choice/fork/join)
  - Returns: `CFGStepResult` with success status, event, and state
  - Auto-advances through structural nodes until reaching action or completion

- `run()` → Execute to completion or until error/maxSteps
  - Returns: `CFGRunResult` with final state and completion status

- `reset()` → Reset to initial state
  - Clears all execution state including history
  - Auto-advances to first meaningful state

#### Choice Management
- `choose(index: number)` → Make a choice at a choice point
  - Allows manual selection from available branches
  - Works with choiceStrategy configuration

#### Stepping & History
- `stepForward()` → Explicit step with history recording
- `stepBackward()` → Undo last step (requires history enabled)
- `stepInto()` → Step into sub-protocol
- `stepOver()` → Execute sub-protocol atomically
- `stepOut()` → Exit current sub-protocol call
- `enableHistory()` / `disableHistory()` → Toggle history tracking
- `getExecutionHistory()` → Retrieve history object

#### State & Observation
- `getState()` → Get current `CFGExecutionState`
  - currentNode, visitedNodes, stepCount
  - atChoice, availableChoices
  - inParallel, activeBranches
  - recursionStack, completed status

- `isComplete()` → Check if execution finished

- `getTrace()` → Get recorded event trace (`CFGExecutionTrace`)

#### Event Subscription
- `on(event: SimulatorEventType, callback)` → Subscribe to events
  - Returns unsubscribe function
- `off(event, callback)` → Unsubscribe from events

### **Configuration Options**

```typescript
CFGSimulatorConfig:
  - maxSteps (number): Step limit (default: 1000)
  - recordTrace (boolean): Whether to record event trace (default: false)
  - choiceStrategy ('manual' | 'first' | 'random'): How to auto-select choices
  - previewLimit (number): Preview branch depth limit (default: 5)
  - protocolRegistry? (IProtocolRegistry): For sub-protocol resolution
  - callStackManager? (ICallStackManager): For sub-protocol call tracking
  - executionHistory? (IExecutionHistory): Custom history manager
```

### **State Exposed**

```typescript
CFGExecutionState:
  - currentNode: string | string[] (node ID or parallel nodes)
  - visitedNodes: string[] (all nodes visited so far)
  - stepCount: number (number of steps executed)
  - completed: boolean
  - atChoice: boolean (waiting for choice?)
  - availableChoices: EnhancedChoiceOption[] | undefined
  - inParallel: boolean (in parallel section?)
  - activeBranches: string[][] | undefined (parallel branches)
  - reachedMaxSteps: boolean
  - recursionStack: RecursionContext[] (active recursion frames)
```

### **Events Emitted**

- `'step-start'` → Before step execution
- `'step-end'` → After successful step
- `'step-forward'` / `'step-back'` / `'step-over'` / `'step-out'` → Stepping modes
- `'message'` → Message action executed
- `'choice-point'` → At a choice node (with enhanced options)
- `'choice-selected'` → Choice was made
- `'recursion-enter'` → Entering recursion
- `'recursion-exit'` / `'recursion-continue'` → Recursion state changes
- `'fork'` → Parallel section started
- `'join'` → Parallel section merged
- `'node-enter'` / `'node-exit'` → Node transitions
- `'complete'` → Execution completed
- `'error'` → Error occurred

### **Guaranteed Assumptions**

The CFGSimulator assumes the CFG is verified and guarantees:
1. **Structural Correctness**: All nodes reachable, paths lead to terminal/recursion
2. **Deadlock Freedom**: No cycles (except via continue), no parallel deadlocks
3. **Choice Correctness**: Branches deterministic and mergeable
4. **Role Connectivity**: All declared roles participate
5. **Recursion Well-Formedness**: Proper scoping and targeting

### **Guarantees Provided**

1. **Faithful Execution**: Executes CFG exactly per Scribble semantics
2. **Complete State Tracking**: currentNode always valid, visitedNodes monotonic
3. **Termination**: Either completes or hits maxSteps (no infinite loops)
4. **Event Emission**: Every action emits corresponding event in causal order
5. **Execution Model**: Synchronous orchestration, interleaved parallel branches

---

## 2. DistributedSimulator - Multi-Role Distributed Execution

### Purpose
Coordinates execution of multiple CFSMs (Communicating Finite State Machines) running asynchronously. Implements distributed execution semantics with message passing and deadlock detection.

### **Operations/Methods**

#### Core Execution
- `async step()` → Execute one global step (one role executes one transition)
  - Returns: `DistributedStepResult` with role, transition, and state
  - Auto-delivers messages to recipient buffers (FIFO)

- `async run()` → Execute to completion or deadlock/maxSteps
  - Returns: `DistributedRunResult` with final state
  - Detects and reports deadlock or completion

- `reset()` → Reset all simulators and transport
  - Clears all role states
  - Resets message buffers and scheduling state

#### Role Management
- `getSimulator(role: string)` → Get individual CFSMSimulator for a role

#### State & Observation
- `getState()` → Get current `DistributedExecutionState`
  - roleStates: per-role current state
  - roleSteps: per-role step count
  - globalSteps: total coordination steps
  - inFlightMessages: pending messages
  - roleBuffers: message buffers
  - anyCompleted: at least one role done?
  - allCompleted: all roles done?
  - deadlocked: deadlock detected?
  - enabledRoles: which roles can make progress?

- `getTraces()` → Get execution traces for all roles
  - Returns: `Map<role, CFSMExecutionTrace>`

- `isDeadlocked()` → Check if stuck (no progress possible)

- `isComplete()` → Check if all roles finished

### **Configuration Options**

```typescript
DistributedSimulatorConfig:
  - maxSteps (number): Global step limit (default: 1000)
  - maxBufferSize (number): Max messages per buffer (default: 0 = unlimited)
  - deliveryModel ('fifo'): Message ordering guarantee (default: fifo)
  - recordTrace (boolean): Record execution traces (default: false)
  - schedulingStrategy ('round-robin' | 'fair' | 'random' | 'manual'): 
      How to select next enabled role (default: round-robin)
  - exploreAllInterleavings (boolean): Test all role orderings (default: false)
```

### **State Exposed**

```typescript
DistributedExecutionState:
  - roleStates: Map<role, state>
  - roleSteps: Map<role, step_count>
  - globalSteps: number
  - inFlightMessages: Message[]
  - roleBuffers: Map<role, MessageBuffer>
  - anyCompleted: boolean
  - allCompleted: boolean
  - deadlocked: boolean
  - enabledRoles: string[]
```

### **Architecture**

- **Per-Role**: Each role has its own CFSMSimulator with local state machine
- **Shared Transport**: InMemoryTransport provides FIFO channels between all roles
- **Coordination**: Global coordinator selects which role executes next
- **Delivery**: Messages sent asynchronously, collected and delivered to buffers

### **Scheduling Strategies**

1. **round-robin**: Cycle through roles in order
2. **fair**: Execute role with fewest steps so far
3. **random**: Random role selection
4. **manual**: User-controlled (not yet implemented)

### **Deadlock Detection**

- Detects when: No role has enabled transitions AND not all completed
- Distinguishes from normal termination (all roles complete)
- Reports which roles are stuck

---

## 3. CFGDebugger - Time-Travel Debugging for Global Orchestration

### Purpose
Wraps CFGSimulator to provide time-travel debugging, event annotation with step numbers, and complete execution history management.

### **Operations/Methods**

#### Stepping & Navigation
- `stepForward()` → Execute next instruction and record history
  - Returns: `DebugStepResult` with annotated event
  - Automatically records snapshots

- `stepBackward()` → Undo last step, restore previous state
  - Returns: `DebugStepResult`
  - Restores entire CFG state

- `jumpToStep(stepNumber: number)` → Jump to specific step
  - Direct jump to any recorded snapshot

#### Choice & Control
- `choose(choiceIndex: number)` → Make choice at choice point

- `reset()` → Reset to initial state
  - Clears all snapshots and events

#### State & History Query
- `getState()` → Get current `CFGExecutionState`

- `getCurrentPosition()` → Get current step number in history

- `getTotalSteps()` → Get total steps recorded (snapshots - 1)

- `canStepBack()` / `canStepForward()` → Check stepping capability

- `getVisibleEvents()` → Get all events up to current position
  - Filtered by `stepNumber <= currentPosition`

- `getAllEvents()` → Get all events recorded

- `getAllSnapshots()` → Get all state snapshots

- `getCFG()` → Get the CFG being debugged

### **Events Tracked**

Each event is annotated with:
```typescript
DebugEvent:
  - type: 'message' | 'choice' | 'recursion' | 'parallel' | 'subprotocol'
  - stepNumber: number (added by debugger)
  - timestamp: number
  - Plus event-specific fields (from, to, label, etc.)
```

### **Snapshots Recorded**

```typescript
DebugSnapshot:
  - stepNumber: number (which step)
  - timestamp: number (when)
  - state: CFGExecutionState (complete state snapshot)
```

### **Key Features**

1. **Complete History**: Every step creates a snapshot
2. **Backward Stepping**: Restore any previous state
3. **Redo**: Step forward through recorded history without re-executing
4. **Event Annotation**: Adds step numbers to all events
5. **Branch Truncation**: Stepping new direction truncates future history

---

## 4. DistributedDebugger - Time-Travel Debugging for Choreography

### Purpose
Wraps DistributedSimulator to provide time-travel debugging with role-aware event tracking and state snapshots for distributed executions.

### **Operations/Methods**

#### Stepping & Navigation
- `async stepForward()` → Execute next role step and record history
  - Returns: `DistributedDebugStepResult`
  - Annotates with role and step numbers

- `async stepBackward()` → Undo last step across all roles
  - Restores distributed state snapshot

- `async jumpToStep(stepNumber: number)` → Jump to specific step

#### Control & Query
- `reset()` → Reset to initial distributed state

- `getState()` → Get current `DistributedExecutionState`

- `getCurrentPosition()` → Get current step in history

- `getTotalSteps()` → Get total steps (snapshots - 1)

- `canStepBack()` / `canStepForward()` → Stepping capability

- `getVisibleEvents()` → Get events up to current position

- `getAllEvents()` → Get all events

- `getAllSnapshots()` → Get all snapshots

- `getCFSMs()` → Get CFSMs being debugged

### **Events Tracked**

Each distributed event includes:
```typescript
DistributedDebugEvent:
  - stepNumber: number (added by debugger)
  - timestamp: number
  - role: string (which role executed)
  - action?: CFSMAction (the transition taken)
  - globalStep: number
  - roleStep: number (steps for this role)
```

### **Snapshots Recorded**

```typescript
DistributedDebugSnapshot:
  - stepNumber: number
  - timestamp: number
  - state: DistributedExecutionState (all roles + transport)
```

### **Key Features**

1. **Async Support**: All stepping methods are async
2. **Role-Aware Events**: Tracks which role executed
3. **Dual Numbering**: Both global and per-role step counts
4. **Complete Restoration**: Restores all role states and message transport

---

## 5. BisimulationValidator - Behavioral Equivalence Verification

### Purpose
Coordinates CFGDebugger and DistributedDebugger to verify that global orchestration (CFG) and distributed choreography are behaviorally equivalent.

### **Operations/Methods**

#### Dual Execution
- `async stepBoth()` → Step both debuggers forward in parallel
  - Returns: Results from both CFG and distributed steps
  - Compares events for equivalence

- `async stepBackBoth()` → Step backward in both debuggers

- `resetBoth()` → Reset both debuggers to initial state

#### Equivalence Analysis
- `checkEquivalence()` → Analyze current execution for equivalence
  - Returns: `BisimulationResult`
  - Identifies divergence points

- `getTrace()` → Get combined trace from both executions
  - Returns: `BisimulationTrace`

#### State & Navigation
- `getCurrentPosition()` → Get position in both debuggers
  - Returns: `{ cfg: number, distributed: number }`

- `canStepBack()` / `canStepForward()` → Joint stepping capability

### **Equivalence Results**

```typescript
BisimulationResult:
  - equivalent: boolean (so far equivalent?)
  - divergencePoint?: number (step where they differ)
  - divergenceReason?: string (why they differ)
  - stepsCompared: number (how many steps analyzed)
```

```typescript
BisimulationTrace:
  - cfgTrace: DebugEvent[]
  - distributedTrace: DistributedDebugEvent[]
  - equivalent: boolean
  - divergencePoint?: number
```

### **Comparison Strategy**

- Compares visible events at each step
- Detects:
  - Event mismatch (different actions)
  - Trace length mismatch (different completion)
  - State divergence

### **Limitations & Future Work**

- Current comparison is simplified
- TODO: Implement full bisimulation equivalence checking
- Handles message ordering and role-based interleaving considerations
- Does not yet account for all complex equivalence rules

---

## Capability Summary Table

| Capability | CFGSimulator | DistributedSimulator | CFGDebugger | DistributedDebugger | BisimulationValidator |
|---|---|---|---|---|---|
| **Execution** | ✓ Global | ✓ Distributed | ✓ Via CFGSim | ✓ Via DistSim | ✓ Both in parallel |
| **Stepping** | ✓ Forward | ✓ Async forward | ✓ Backward/forward/jump | ✓ Async backward/forward/jump | ✓ Dual control |
| **Choice Management** | ✓ Manual/auto | ✗ (per-role) | ✓ Manual | ✓ Via DistSim | ✓ Both |
| **Sub-protocols** | ✓ Call stack | ✗ | ✓ Via CFGSim | ✗ | ✗ |
| **History** | ✓ Optional | ✗ | ✓ Full snapshots | ✓ Full snapshots | ✓ Both histories |
| **Time-Travel** | ✓ Via history | ✗ | ✓ Snapshots | ✓ Snapshots | ✓ Both |
| **Event Tracing** | ✓ Recordable | ✓ Per-role | ✓ Annotated | ✓ Annotated | ✓ Both traces |
| **Recursion** | ✓ Tracked | ✗ (in CFSM) | ✓ Full stack | ✓ Via CFSM | ✓ Both |
| **Parallel** | ✓ Interleaved | ✗ (n/a) | ✓ Via CFGSim | ✗ (n/a) | ✓ CFG side |
| **Deadlock Detection** | ✗ (verified) | ✓ Runtime | ✗ | ✗ (Via DistSim) | ✓ Distributed |
| **Equivalence Check** | ✗ | ✗ | ✗ | ✗ | ✓ Primary feature |

---

## Async Patterns

- **CFGSimulator**: Synchronous (global orchestration is deterministic once choices made)
- **DistributedSimulator**: `async step()` and `async run()` (distributed coordination is asynchronous)
- **CFGDebugger**: Synchronous (wraps sync CFGSimulator)
- **DistributedDebugger**: `async stepForward()`, `async stepBackward()`, `async jumpToStep()` (async due to wrapped simulator)
- **BisimulationValidator**: All methods `async` (due to distributed side)

---

## Error Handling

### CFGSimulator Error Types
- `'choice-required'`: At choice point but auto-strategy is 'manual'
- `'max-steps-reached'`: Exceeded step limit
- `'already-completed'`: Attempting step after completion
- `'invalid-node'`: Node not found in CFG

### DistributedSimulator Error Types
- `'deadlock'`: No role can progress, but not all completed
- `'no-progress'`: Role failed to execute transition
- `'max-steps'`: Global step limit exceeded

### Debugger Errors
- History exhaustion (step back at position 0)
- Jump to invalid step number
- Restore state failures

---

## Integration Points

1. **CFGSimulator → CFGDebugger**: Wrapping for history/time-travel
2. **DistributedSimulator → DistributedDebugger**: Wrapping for distributed history
3. **Both Debuggers → BisimulationValidator**: Parallel execution and comparison
4. **CFGSimulator ↔ Sub-protocol Support**: Via ProtocolRegistry and CallStackManager
5. **DistributedSimulator ↔ Message Transport**: Shared InMemoryTransport

---

## Performance Considerations

- **CFGSimulator**: O(1) per step (no search), unlimited recursion via maxSteps
- **DistributedSimulator**: O(roles) per step for scheduling + message delivery
- **CFGDebugger**: O(snapshots) memory for history
- **DistributedDebugger**: O(roles × snapshots) memory for full state snapshots
- **BisimulationValidator**: O(steps) for trace comparison
