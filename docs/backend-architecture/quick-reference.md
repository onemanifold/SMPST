# Backend Capabilities - Quick Reference

## The Five Components at a Glance

### 1. CFGSimulator (Global Orchestration)
**What it does**: Executes global protocol from Control Flow Graph
```
Key Methods: step(), run(), choose(), reset()
Key Features: Choice management, sub-protocols, recursion, parallel sections
State Tracking: Current node, visited nodes, recursion stack
Events: 15+ event types (message, choice, fork, join, recursion, etc.)
```

### 2. DistributedSimulator (Multi-Role Execution)
**What it does**: Coordinates CFSM executors across multiple roles with message passing
```
Key Methods: async step(), async run(), reset()
Key Features: Scheduling (round-robin/fair/random), deadlock detection, FIFO transport
State Tracking: Per-role states, global steps, message buffers, enabled roles
Deadlock: Detects when no role can progress (but protocol not finished)
```

### 3. CFGDebugger (Time-Travel for Global)
**What it does**: Wraps CFGSimulator with snapshots and backward stepping
```
Key Methods: stepForward(), stepBackward(), jumpToStep()
Key Features: Full history, complete state restoration, event annotation
Snapshots: Records complete CFGExecutionState at each step
Navigation: canStepBack(), canStepForward(), getCurrentPosition()
```

### 4. DistributedDebugger (Time-Travel for Distributed)
**What it does**: Wraps DistributedSimulator with role-aware snapshots
```
Key Methods: async stepForward(), async stepBackward(), async jumpToStep()
Key Features: Async support, role tracking, dual numbering (global + per-role)
Snapshots: Records all role states and transport state
Events: Role-aware events with action details
```

### 5. BisimulationValidator (Equivalence Checker)
**What it does**: Verifies CFG and Distributed executions are behaviorally equivalent
```
Key Methods: async stepBoth(), checkEquivalence(), getTrace()
Key Features: Parallel execution of both, divergence detection, trace comparison
Results: Reports equivalence/divergence with step number
Limitations: Simplified comparison (TODO: full bisimulation logic)
```

---

## Quick Comparison Matrix

```
┌─────────────────────┬──────────────┬─────────────────┬────────────┬─────────────┐
│ Feature             │ CFGSimulator │ DistributedSim  │ CFGDebug   │ DistDebug   │
├─────────────────────┼──────────────┼─────────────────┼────────────┼─────────────┤
│ Async               │ Sync         │ Async           │ Sync       │ Async       │
│ Time-travel         │ Via history  │ None            │ Full       │ Full        │
│ Backward stepping   │ Optional     │ No              │ Yes        │ Yes         │
│ Deadlock detection  │ No (verified)│ Yes (runtime)   │ No         │ No (via DS) │
│ Event annotation    │ No           │ No              │ Yes        │ Yes         │
│ Sub-protocols       │ Yes          │ No              │ Yes (CFGSim)│ No         │
│ Choice management   │ Manual/auto  │ Per-role        │ Manual     │ Per-role    │
│ Memory for history  │ Optional     │ None            │ O(steps)   │ O(roles*s)  │
└─────────────────────┴──────────────┴─────────────────┴────────────┴─────────────┘
```

---

## Execution Flows

### Global Execution (CFGSimulator)
```
CFGSimulator.step()
  → advanceToNextMeaningfulState()
    → Skip structural nodes (initial, merge, join)
    → Stop at: action, choice, fork, terminal
  → executeNode()
    → One of: executeAction, executeBranch, executeFork, etc.
  → Emit event + record in trace
  → Update state
```

### Distributed Execution (DistributedSimulator)
```
DistributedSimulator.step()
  → getEnabledRoles()
    → Ask each CFSMSimulator for enabled transitions
  → selectRole()
    → Round-robin / fair / random scheduling
  → simulator.step()
    → Role executes one transition
    → Messages auto-delivered via shared transport
  → return (role, transition, updated state)
```

### Time-Travel Debugging (CFGDebugger)
```
CFGDebugger.stepForward()
  → vm.step() (execute next action)
  → recordSnapshot() (save complete state)
  → annotateEvent() (add stepNumber)
  → return (event, state)

CFGDebugger.stepBackward()
  → previousSnapshot = history.getPrevious()
  → restoreVMState(snapshot.state)
  → return (previous state)

CFGDebugger.jumpToStep(n)
  → snapshot = snapshots[n]
  → restoreVMState(snapshot.state)
```

### Distributed Time-Travel (DistributedDebugger)
```
Similar to CFGDebugger but:
  - Snapshots include ALL role states + transport
  - Events include role + action details
  - Async throughout
```

### Equivalence Checking (BisimulationValidator)
```
BisimulationValidator.stepBoth()
  → cfgResult = cfgDebugger.stepForward() (sync)
  → distResult = await distributedDebugger.stepForward() (async)
  → compareEvents(cfgResult.event, distResult.event)
  → return { cfg, distributed, equivalent }

BisimulationValidator.checkEquivalence()
  → compare all visible events pairwise
  → detect divergence point (first mismatch)
  → report reason (event mismatch, length mismatch, etc.)
```

---

## Configuration Presets

### CFGSimulator
```typescript
// Auto-play with tracing
{ maxSteps: 10000, recordTrace: true, choiceStrategy: 'first' }

// Interactive debugging
{ maxSteps: 1000, recordTrace: false, choiceStrategy: 'manual' }

// Stress test (all random choices)
{ maxSteps: 10000, choiceStrategy: 'random' }
```

### DistributedSimulator
```typescript
// Fair scheduling
{ maxSteps: 1000, schedulingStrategy: 'fair', recordTrace: true }

// Stress test interleaving
{ maxSteps: 10000, schedulingStrategy: 'random', exploreAllInterleavings: true }

// Deadlock detection
{ maxSteps: 1000, schedulingStrategy: 'round-robin', recordTrace: true }
```

---

## State Models

### CFGExecutionState
```typescript
{
  currentNode: string | string[],      // Single or parallel nodes
  visitedNodes: string[],              // Full path
  stepCount: number,
  completed: boolean,
  atChoice: boolean,
  availableChoices: ChoiceOption[],
  inParallel: boolean,
  activeBranches: string[][],
  recursionStack: RecursionContext[],
  reachedMaxSteps: boolean
}
```

### DistributedExecutionState
```typescript
{
  roleStates: Map<role, state>,        // Per-role local state
  roleSteps: Map<role, stepCount>,     // Per-role step count
  globalSteps: number,                 // Coordination steps
  inFlightMessages: Message[],         // Messages in transit
  roleBuffers: Map<role, MessageBuffer>, // Buffered messages
  anyCompleted: boolean,
  allCompleted: boolean,
  deadlocked: boolean,
  enabledRoles: string[]               // Which roles can act now
}
```

---

## Event Annotation by Component

### CFGSimulator (raw events)
```typescript
{
  type: 'message' | 'choice' | 'recursion' | 'parallel' | ...
  timestamp: number,
  // Event-specific fields (from, to, label, etc.)
}
```

### CFGDebugger (annotated)
```typescript
{
  // All fields from CFGSimulator event
  stepNumber: number  // <- Added by debugger!
}
```

### DistributedDebugger (annotated)
```typescript
{
  stepNumber: number,
  timestamp: number,
  role: string,                // <- Which role executed
  action: CFSMAction,          // <- The transition taken
  globalStep: number,          // <- Coordination step
  roleStep: number             // <- Role's local step count
}
```

---

## Error Scenarios

### CFGSimulator
```
At choice but choiceStrategy='manual' 
  → Error: 'choice-required'
  → Solution: Call choose() before step()

Exceeded maxSteps
  → Error: 'max-steps-reached'
  → State: reachedMaxSteps = true

Already at terminal
  → Error: 'already-completed'
  → Solution: Call reset()

Node not in CFG
  → Error: 'invalid-node'
  → Indicates CFG corruption
```

### DistributedSimulator
```
Circular wait on messages
  → Error: 'deadlock'
  → Reason: No role has enabled transitions
  → State: deadlocked = true, which roles stuck?

Role transition fails
  → Error: 'no-progress'
  → Details: Which role, what error?

Global step limit
  → Error: 'max-steps'
  → State: reachedMaxSteps = true
```

### Debuggers
```
Try stepBack() at position 0
  → Returns: success: false

Try jumpToStep(n) with n >= snapshots.length
  → Returns: success: false

Trace mismatch in BisimulationValidator
  → Returns: equivalent: false, divergencePoint: n
```

---

## Usage Examples

### Basic CFGSimulation
```typescript
const simulator = new CFGSimulator(cfg, { 
  maxSteps: 1000, 
  choiceStrategy: 'first' 
});

const result = simulator.run();
console.log(`Completed: ${result.success}, Steps: ${result.steps}`);
```

### Interactive Debugging
```typescript
const debugger = new CFGDebugger(cfg, CFGSimulator);

while (debugger.canStepForward()) {
  const result = debugger.stepForward();
  console.log(`Step ${result.event?.stepNumber}: ${result.event?.type}`);
  
  if (debugger.canStepBack()) {
    debugger.stepBackward(); // Time-travel!
  }
}
```

### Distributed Execution with Deadlock Detection
```typescript
const distSim = new DistributedSimulator(cfsms, { 
  schedulingStrategy: 'fair' 
});

const result = await distSim.run();
if (!result.success && result.error?.type === 'deadlock') {
  console.log(`Deadlock in roles: ${result.error.roles}`);
}
```

### Equivalence Checking
```typescript
const validator = new BisimulationValidator(
  cfgDebugger, 
  distributedDebugger
);

while (validator.canStepForward()) {
  const { cfg, distributed, equivalent } = await validator.stepBoth();
  if (!equivalent) {
    const result = validator.checkEquivalence();
    console.log(`Diverged at step ${result.divergencePoint}`);
    break;
  }
}
```

---

## Performance Notes

| Component | Operation | Complexity | Memory |
|-----------|-----------|-----------|--------|
| CFGSimulator.step() | O(1) | Per step | Low |
| DistributedSimulator.step() | O(roles) | Per step | Medium (message transport) |
| CFGDebugger.stepForward() | O(1) | Per snapshot | O(snapshots) |
| DistributedDebugger.stepForward() | O(roles) | Per snapshot | O(roles × snapshots) |
| BisimulationValidator.checkEquivalence() | O(steps) | Trace comparison | O(steps) |

---

## When to Use Each Component

| Goal | Use | Config |
|------|-----|--------|
| Test global protocol | CFGSimulator | `{ maxSteps: 10000, recordTrace: true }` |
| Interactive protocol study | CFGDebugger | `{ choiceStrategy: 'manual' }` |
| Simulate distributed network | DistributedSimulator | `{ schedulingStrategy: 'fair' }` |
| Debug role interactions | DistributedDebugger | With breakpoint UI |
| Verify CFG ≡ Distributed | BisimulationValidator | Run both in parallel |

