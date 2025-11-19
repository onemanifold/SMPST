# Backend Simulation Engines & Debuggers - Documentation Index

This directory contains complete documentation of the SMPST backend simulation and debugging capabilities.

## Documents

### 1. **quick-reference.md** - START HERE
Quick overview of all five components with:
- High-level purpose for each component
- Key methods and features
- Configuration presets
- Error scenarios
- Usage examples
- When to use each component

**Best for**: Getting oriented, finding which component to use, quick examples

### 2. **capabilities-detailed.md** - COMPREHENSIVE GUIDE
In-depth documentation covering:
- Complete method signatures and return types
- All configuration options with defaults
- Full state models (TypeScript interfaces)
- All events and their meanings
- Architecture and guarantees
- Integration points
- Performance characteristics
- Async patterns

**Best for**: Deep understanding, API reference, integration planning

## The Five Components

```
┌─────────────────────────────────────────────────────────────────┐
│                   Backend Simulation Stack                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  BisimulationValidator (Layer 3.5)                             │
│  Verifies CFG ≡ Distributed Equivalence                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CFGDebugger (Layer 3a)                                  │  │
│  │  Time-travel debugging for global orchestration          │  │
│  │  Methods: stepForward, stepBackward, jumpToStep          │  │
│  │  Features: Full history, complete state restoration      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  DistributedDebugger (Layer 3b)                          │  │
│  │  Time-travel debugging for distributed choreography      │  │
│  │  Methods: async stepForward, async stepBackward          │  │
│  │  Features: Role-aware, dual numbering, full snapshots    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────┬──────────────────────────────────┐   │
│  │  CFGSimulator        │  DistributedSimulator            │   │
│  │  (Layer 2a)          │  (Layer 2b)                      │   │
│  │  Global execution    │  Distributed execution           │   │
│  │  Sync                │  Async                           │   │
│  │  Verified CFG        │  Multiple CFSMs + transport      │   │
│  │  Features:           │  Features:                       │   │
│  │  - Choices/branching │  - Scheduling strategies         │   │
│  │  - Sub-protocols     │  - Deadlock detection            │   │
│  │  - Recursion         │  - Message FIFO ordering         │   │
│  │  - Parallel sections │  - Per-role state tracking       │   │
│  └──────────────────────┴──────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CFG (Control Flow Graph) / CFSM (State Machines)       │   │
│  │  (Layer 1)                                              │   │
│  │  Protocol representation                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Component Reference

| Component | File | Purpose | Key Methods | Async |
|-----------|------|---------|-------------|-------|
| **CFGSimulator** | `src/core/simulation/cfg-simulator.ts` | Execute global protocol | step(), run(), choose() | No |
| **DistributedSimulator** | `src/core/simulation/distributed-simulator.ts` | Coordinate multi-role execution | async step(), async run() | Yes |
| **CFGDebugger** | `src/core/simulation/cfg-debugger.ts` | Time-travel for global | stepForward(), stepBackward() | No |
| **DistributedDebugger** | `src/core/simulation/distributed-debugger.ts` | Time-travel for distributed | async stepForward(), async stepBackward() | Yes |
| **BisimulationValidator** | `src/core/simulation/bisimulation-validator.ts` | Check equivalence | async stepBoth(), checkEquivalence() | Yes |

## Typical Usage Patterns

### Pattern 1: Test Global Protocol
```typescript
import { CFGSimulator } from './cfg-simulator';

const sim = new CFGSimulator(cfg, { 
  maxSteps: 1000, 
  choiceStrategy: 'random',
  recordTrace: true 
});

const result = await sim.run();
// Check if protocol completed successfully
console.log(`Success: ${result.success}, Steps: ${result.steps}`);
```

**Use this for**: Automated testing, stress testing, verifying protocol correctness

---

### Pattern 2: Interactive Debugging
```typescript
import { CFGDebugger } from './cfg-debugger';

const debug = new CFGDebugger(cfg, CFGSimulator);

// Step through protocol interactively
debug.stepForward();
debug.stepForward();

// Oops, want to go back?
debug.stepBackward();

// Jump to specific step
debug.jumpToStep(5);
```

**Use this for**: Understanding protocol flow, finding bugs, interactive exploration

---

### Pattern 3: Distributed Network Simulation
```typescript
import { DistributedSimulator } from './distributed-simulator';

const distSim = new DistributedSimulator(cfsms, { 
  schedulingStrategy: 'fair',
  recordTrace: true 
});

const result = await distSim.run();

if (result.success) {
  console.log('All roles completed successfully');
} else if (result.error?.type === 'deadlock') {
  console.log(`Deadlock in roles: ${result.error.roles}`);
}
```

**Use this for**: Distributed execution testing, deadlock detection, role interaction analysis

---

### Pattern 4: Equivalence Verification
```typescript
import { BisimulationValidator } from './bisimulation-validator';

const cfgDebug = new CFGDebugger(cfg, CFGSimulator);
const distDebug = new DistributedDebugger(cfsms, DistributedSimulator);
const validator = new BisimulationValidator(cfgDebug, distDebug);

// Step both simultaneously and check equivalence
while (validator.canStepForward()) {
  const result = await validator.stepBoth();
  if (!result.equivalent) {
    const analysis = validator.checkEquivalence();
    console.log(`Divergence at step ${analysis.divergencePoint}`);
    break;
  }
}
```

**Use this for**: Verifying CFG and distributed implementations match, protocol correctness proof

## Key Capabilities by Component

### CFGSimulator
- **Operations**: step(), run(), reset(), choose()
- **State Control**: Manual choice selection with preview
- **Advanced**: Sub-protocol calls (with call stack), recursion, parallel branches
- **Events**: 15+ event types (message, choice, fork, join, recursion, etc.)
- **Configuration**: maxSteps, recordTrace, choiceStrategy, previewLimit

### DistributedSimulator  
- **Operations**: async step(), async run(), reset()
- **State Control**: Multiple CFSMs with shared message transport
- **Advanced**: Scheduling strategies (round-robin, fair, random), deadlock detection
- **Events**: Per-role transitions with message delivery
- **Configuration**: maxSteps, deliveryModel, schedulingStrategy, recordTrace

### CFGDebugger
- **Operations**: stepForward(), stepBackward(), jumpToStep(), reset()
- **History**: Complete snapshots at each step
- **Navigation**: getCurrentPosition(), getTotalSteps(), canStepBack(), canStepForward()
- **Events**: All events from CFGSimulator plus stepNumber annotation
- **State**: Full CFGExecutionState restoration

### DistributedDebugger
- **Operations**: async stepForward(), async stepBackward(), async jumpToStep()
- **History**: Complete distributed snapshots (all roles + transport)
- **Navigation**: Async versions of CFGDebugger methods
- **Events**: Role-aware events with global + per-role step counts
- **State**: Full DistributedExecutionState restoration

### BisimulationValidator
- **Operations**: async stepBoth(), resetBoth()
- **Analysis**: checkEquivalence(), getTrace()
- **Navigation**: getCurrentPosition() for both debuggers
- **Results**: Reports equivalence/divergence with step number and reason
- **Limitations**: Simplified event comparison (TODO: full bisimulation logic)

## State Models

### CFGExecutionState
Tracks global orchestration state:
```
currentNode, visitedNodes, stepCount, completed,
atChoice, availableChoices,
inParallel, activeBranches,
recursionStack, reachedMaxSteps
```

### DistributedExecutionState
Tracks distributed execution state:
```
roleStates (per-role), roleSteps (per-role), globalSteps,
inFlightMessages, roleBuffers,
anyCompleted, allCompleted, deadlocked,
enabledRoles
```

## Error Types

### CFGSimulator Errors
- `choice-required`: Manual strategy but no choice made
- `max-steps-reached`: Exceeded maxSteps limit
- `already-completed`: Step after completion
- `invalid-node`: Node not found in CFG

### DistributedSimulator Errors
- `deadlock`: No role enabled, but not all complete
- `no-progress`: Role failed to transition
- `max-steps`: Global step limit exceeded

## Performance Profile

| Component | Per-Step Complexity | Memory (History) |
|-----------|-------------------|-----------------|
| CFGSimulator | O(1) | Optional |
| DistributedSimulator | O(roles) | None |
| CFGDebugger | O(1) | O(snapshots) |
| DistributedDebugger | O(roles) | O(roles × snapshots) |
| BisimulationValidator | O(steps) | O(steps × roles) |

## Async Considerations

- **CFGSimulator**: Synchronous (global orchestration)
- **DistributedSimulator**: Async (`step()`, `run()`)
- **CFGDebugger**: Synchronous (wraps sync simulator)
- **DistributedDebugger**: Async (wraps async simulator)
- **BisimulationValidator**: Async (coordinates both)

All async methods return Promises that resolve to results.

## Integration Guide

1. **For UI Components**: Use CFGDebugger and DistributedDebugger for time-travel features
2. **For Testing**: Use CFGSimulator with different choice strategies
3. **For Analysis**: Use BisimulationValidator to verify equivalence
4. **For Deadlock Detection**: Use DistributedSimulator with fair scheduling
5. **For Sub-protocols**: Use CFGSimulator with ProtocolRegistry

## Next Steps

1. **For overview**: Read quick-reference.md
2. **For details**: Read capabilities-detailed.md
3. **For source code**: See files in src/core/simulation/
4. **For tests**: See __tests__/ directory
5. **For integration**: Check UI layer integration points

## File Locations

- **CFGSimulator**: `/home/user/SMPST/src/core/simulation/cfg-simulator.ts` (1714 lines)
- **DistributedSimulator**: `/home/user/SMPST/src/core/simulation/distributed-simulator.ts` (405 lines)
- **CFGDebugger**: `/home/user/SMPST/src/core/simulation/cfg-debugger.ts` (369 lines)
- **DistributedDebugger**: `/home/user/SMPST/src/core/simulation/distributed-debugger.ts` (347 lines)
- **BisimulationValidator**: `/home/user/SMPST/src/core/simulation/bisimulation-validator.ts` (233 lines)

**Total**: ~3,000 lines of core simulation and debugging logic

## Questions?

Refer to the appropriate documentation:
- **"How do I...?"** → quick-reference.md (Usage Examples section)
- **"What methods does X have?"** → capabilities-detailed.md (Component section)
- **"What are the error types?"** → Both documents (Error Handling section)
- **"How does X work internally?"** → Source files or capabilities-detailed.md (Architecture)
