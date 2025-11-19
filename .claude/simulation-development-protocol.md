# Simulation Development Protocol

**Purpose:** Mandatory patterns for implementing simulation features

**Status:** ACTIVE - Follow rigorously

---

## Critical Understanding

### The Simulation System Has 3 Layers

```
┌─────────────────────────────────────────┐
│  1. CFGSimulator (Global Orchestration) │
│     - Centralized execution             │
│     - Global protocol view              │
│     - Event emission system             │
│     - Backward stepping (history)       │
│     - Choice previews                   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  2. CFSMSimulator (Local Choreography)  │
│     - Single role execution             │
│     - Message buffer management         │
│     - Asynchronous semantics            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  3. DistributedSimulator (Multi-Role)   │
│     - Coordinates multiple CFSMs        │
│     - Message delivery between roles    │
│     - Interleaving exploration          │
│     - Distributed deadlock detection    │
└─────────────────────────────────────────┘
```

**CRITICAL:** UI currently only exposes ~15% of Layer 1, ignores Layers 2 & 3 entirely.

---

## Mandatory Gap Analysis

**Before implementing ANY simulation feature:**

1. Read `docs/SIMULATION_BACKEND_CONTRACT_GAPS.md`
2. Identify which backend capability you're implementing
3. Check current implementation status (✅ USED | ⚠️ PARTIAL | ❌ IGNORED)
4. Update status when complete

**Rule:** Never implement a simulation feature without consulting the gap analysis.

---

## Pattern 1: Event Exposure

### Backend Provides Rich Event System

```typescript
type CFGExecutionEvent =
  | MessageEvent        // Communication between roles
  | ChoiceEvent         // Decision made
  | RecursionEvent      // rec enter/continue/exit
  | ParallelEvent       // fork/join
  | SubProtocolEvent    // do SubProtocol
  | StateChangeEvent;   // Node transition
```

### WRONG: Ignore Events

```typescript
// ❌ BAD - Events lost
export function stepSimulation() {
  const result = simulator.step();
  executionState.set(result.state);
  // event is in result.event but never exposed!
}
```

### CORRECT: Expose ALL Events

```typescript
// ✅ GOOD - Events exposed
export const executionEvents = writable<CFGExecutionEvent[]>([]);

export function stepSimulation() {
  const result = simulator.step();
  executionState.set(result.state);

  // Expose event if present
  if (result.event) {
    executionEvents.update(events => [...events, result.event]);
  }
}
```

---

## Pattern 2: Backward Stepping (History)

### Backend Provides Execution History

```typescript
interface IExecutionHistory {
  recordSnapshot(snapshot: CFGExecutionSnapshot): void;
  getPreviousSnapshot(): CFGExecutionSnapshot | undefined;
  getNextSnapshot(): CFGExecutionSnapshot | undefined;
  getCurrentPosition(): number;
}
```

### WRONG: No History Support

```typescript
// ❌ BAD - Can't undo
export function resetSimulation() {
  simulator.reset();  // Only way to go back is full reset!
}
```

### CORRECT: Use Execution History

```typescript
// ✅ GOOD - Debugger-style stepping
import { ExecutionHistory } from '../../core/simulation/execution-history';

const history = new ExecutionHistory({ enabled: true, maxSnapshots: 1000 });

export function stepSimulation() {
  const result = simulator.step();

  // Record snapshot
  history.recordSnapshot(createSnapshot(result.state));

  executionState.set(result.state);
}

export function stepBack() {
  const snapshot = history.getPreviousSnapshot();
  if (snapshot) {
    restoreSnapshot(snapshot);
  }
}

export const canStepBack = derived(
  executionState,
  () => history.getCurrentPosition() > 0
);
```

---

## Pattern 3: Complete State Exposure

### Backend Execution State is Rich

```typescript
interface CFGExecutionState {
  currentNode: string | string[];      // ✅ Exposed
  visitedNodes: string[];              // ✅ Exposed
  stepCount: number;                   // ✅ Exposed
  completed: boolean;                  // ✅ Exposed
  atChoice: boolean;                   // ✅ Exposed
  availableChoices?: EnhancedChoiceOption[];  // ⚠️ PARTIAL (no previews)
  inParallel: boolean;                 // ❌ NOT EXPOSED
  activeBranches?: string[][];         // ❌ NOT EXPOSED
  reachedMaxSteps: boolean;            // ❌ NOT EXPOSED
  recursionStack: RecursionContext[];  // ❌ NOT EXPOSED
}
```

### WRONG: Expose Partial State

```typescript
// ❌ BAD - Missing properties
export const executionState = writable<CFGExecutionState | null>(null);
// Users can't access inParallel, activeBranches, recursionStack!
```

### CORRECT: Expose ALL Properties

```typescript
// ✅ GOOD - Derived stores for all properties
export const executionState = writable<CFGExecutionState | null>(null);

// Expose all properties individually
export const isInParallel = derived(
  executionState,
  $state => $state?.inParallel ?? false
);

export const activeBranches = derived(
  executionState,
  $state => $state?.activeBranches ?? []
);

export const hasReachedMaxSteps = derived(
  executionState,
  $state => $state?.reachedMaxSteps ?? false
);

export const recursionStack = derived(
  executionState,
  $state => $state?.recursionStack ?? []
);
```

---

## Pattern 4: Choice Previews

### Backend Provides Enhanced Choice Options

```typescript
interface EnhancedChoiceOption {
  index: number;
  label?: string;
  firstNode: string;
  description?: string;

  // RICH DATA:
  preview: ActionPreview[];           // Shows what happens in branch
  participatingRoles: string[];       // Who's involved
  estimatedSteps: number;             // How long
}
```

### WRONG: Display Basic Choices Only

```svelte
<!-- ❌ BAD - No context for user -->
{#each $availableChoices as choice}
  <button on:click={() => makeChoice(choice.index)}>
    {choice.label || `Branch ${choice.index + 1}`}
  </button>
{/each}
```

### CORRECT: Show Full Preview

```svelte
<!-- ✅ GOOD - User sees what each branch does -->
{#each $availableChoices as choice}
  <div class="choice-card">
    <h5>{choice.label || `Branch ${choice.index + 1}`}</h5>

    <!-- Preview of actions -->
    <div class="preview">
      {#each choice.preview as action}
        <div class="action">
          {action.description}
        </div>
      {/each}
    </div>

    <!-- Metadata -->
    <div class="meta">
      <span>Roles: {choice.participatingRoles.join(', ')}</span>
      <span>~{choice.estimatedSteps} steps</span>
    </div>

    <button on:click={() => makeChoice(choice.index)}>
      Select
    </button>
  </div>
{/each}
```

---

## Pattern 5: Event Visualization

### Backend Events Should Drive UI

```typescript
// ✅ GOOD - Subscribe to simulator events
simulator.on('message', (event: MessageEvent) => {
  // Trigger animation
  animateMessage(event.from, event.to, event.label);

  // Add to event log
  executionEvents.update(e => [...e, event]);

  // Update visualization
  highlightNode(event.nodeId);
});

simulator.on('choice-selected', (event: ChoiceEvent) => {
  // Show choice animation
  flashChoiceBranch(event.choiceIndex);
});

simulator.on('recursion-continue', (event: RecursionEvent) => {
  // Highlight recursion loop
  animateRecursionLoop(event.label, event.iteration);
});
```

---

## Pattern 6: Distributed Simulation Support

### Backend Has Full Distributed Simulator

```typescript
class DistributedSimulator {
  getState(): DistributedExecutionState {
    roleStates: Map<string, string>;      // Each role's state
    roleSteps: Map<string, number>;       // Steps per role
    messageBuffers: Map<string, Message[]>;  // Queued messages
    deadlocked: boolean;
    completed: boolean;
  }

  step(role?: string): DistributedStepResult;
}
```

### WRONG: Only Support CFGSimulator

```typescript
// ❌ BAD - Can't show distributed execution
export async function initializeSimulation(cfg: CFG) {
  const { CFGSimulator } = await import('../../core/simulation/cfg-simulator');
  simulator = new CFGSimulator(cfg);
  // Users never see choreography view!
}
```

### CORRECT: Support All Simulator Types

```typescript
// ✅ GOOD - Multiple simulation modes
export type SimulatorType = 'cfg' | 'cfsm' | 'distributed';
export const simulatorType = writable<SimulatorType>('cfg');

export async function initializeSimulation(cfg: CFG, type: SimulatorType) {
  switch (type) {
    case 'cfg': {
      const { CFGSimulator } = await import('../../core/simulation/cfg-simulator');
      simulator = new CFGSimulator(cfg, config);
      break;
    }

    case 'distributed': {
      const { DistributedSimulator } = await import('../../core/simulation/distributed-simulator');
      const { projectAll } = await import('../../core/projection/projector');

      const projection = projectAll(cfg);
      simulator = new DistributedSimulator(projection.cfsms, config);
      break;
    }

    // ... CFSM mode
  }
}
```

---

## Testing Requirements

### For Every Simulation Feature

```typescript
describe('Simulation Store - [Feature Name]', () => {
  // 1. Test that property/action is exposed
  it('should expose [feature] from backend', async () => {
    // Test store exists and has correct type
  });

  // 2. Test that data flows correctly
  it('should update [feature] when stepping', async () => {
    // Test that backend updates reach frontend
  });

  // 3. Test that reset clears properly
  it('should clear [feature] on reset', () => {
    // Test cleanup
  });

  // 4. Test error handling
  it('should handle [feature] errors gracefully', async () => {
    // Test error states
  });
});
```

---

## UI Component Guidelines

### Event Log Component

```svelte
<!-- Event log shows ALL events, not just some -->
<div class="event-log">
  <div class="event-filters">
    <label><input type="checkbox" bind:checked={showMessages}>Messages</label>
    <label><input type="checkbox" bind:checked={showChoices}>Choices</label>
    <label><input type="checkbox" bind:checked={showRecursion}>Recursion</label>
    <label><input type="checkbox" bind:checked={showParallel}>Parallel</label>
  </div>

  <div class="events">
    {#each filteredEvents as event}
      <div class="event" class:type={event.type}>
        <span class="timestamp">{event.timestamp}ms</span>
        <span class="icon">{getEventIcon(event.type)}</span>
        <span class="description">{formatEvent(event)}</span>
      </div>
    {/each}
  </div>
</div>
```

### Timeline Slider Component

```svelte
<!-- Timeline for backward/forward stepping -->
<div class="timeline">
  <button on:click={stepBack} disabled={!$canStepBack}>⏪</button>

  <input type="range"
    min="0"
    max={$totalSteps}
    bind:value={$currentStep}
    on:change={jumpToStep}
    disabled={$totalSteps === 0} />

  <span>{$currentStep} / {$totalSteps}</span>

  <button on:click={stepForward} disabled={!$canStepForward}>⏩</button>
</div>
```

### Recursion Stack Display

```svelte
<!-- Shows recursion depth -->
<div class="recursion-stack">
  <h4>Recursion Stack (depth {$recursionStack.length})</h4>
  {#each $recursionStack as context}
    <div class="recursion-frame">
      <span class="label">{context.label}</span>
      <span class="iteration">iteration {context.iterations}</span>
      <span class="node">@ {context.nodeId}</span>
    </div>
  {/each}
</div>
```

---

## Implementation Checklist

When implementing ANY simulation feature:

- [ ] Read `docs/SIMULATION_BACKEND_CONTRACT_GAPS.md` first
- [ ] Identify which backend capability you're implementing
- [ ] Check what properties/events backend provides
- [ ] Ensure ALL properties are exposed (not partial!)
- [ ] Write .todo() tests FIRST
- [ ] Implement feature with contract handlers
- [ ] Convert .todo() to passing tests
- [ ] Update gap analysis document
- [ ] Update this protocol if new patterns emerge

---

## Common Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Polling Instead of Events

```typescript
// BAD - Inefficient polling
setInterval(() => {
  const state = simulator.getState();
  executionState.set(state);
}, 100);
```

```typescript
// GOOD - Event-driven
simulator.on('step-end', (state) => {
  executionState.set(state);
});
```

### ❌ Anti-Pattern 2: Hardcoded Configuration

```typescript
// BAD - Users can't change settings
const simulator = new CFGSimulator(cfg, {
  choiceStrategy: 'manual',
  maxSteps: 1000,
  recordTrace: true
});
```

```typescript
// GOOD - User-configurable
const config = {
  choiceStrategy: get(userChoiceStrategy),
  maxSteps: get(maxStepsLimit),
  recordTrace: get(enableTracing),
  executionHistory: get(enableHistory) ? history : undefined
};
const simulator = new CFGSimulator(cfg, config);
```

### ❌ Anti-Pattern 3: Silent Property Drops

```typescript
// BAD - Loses information
export function stepSimulation() {
  const result = simulator.step();
  executionState.set(result.state);
  // result.event ignored!
  // result.error ignored!
}
```

```typescript
// GOOD - Handle everything
export function stepSimulation() {
  const result = simulator.step();

  handleStepResult(result, {
    onSuccess: (state, event) => {
      executionState.set(state);
      if (event) executionEvents.update(e => [...e, event]);
    },
    onError: (error, state) => {
      executionState.set(state);
      lastError.set(error);
    }
  });
}
```

---

## Reference Implementations

### Correct: simulation-v2.ts

See `src/lib/stores/simulation-v2.ts` for reference implementation using contract handlers.

### Incorrect: simulation.ts (current)

`src/lib/stores/simulation.ts` is INCOMPLETE - only exposes 15% of backend. Do not copy this pattern.

---

## Summary

**The simulation system is complex.** Three layers, rich events, backward stepping, distributed execution. **The UI must expose ALL of it.**

**Before any simulation work:**
1. Read gap analysis
2. Check implementation status
3. Use contract handlers
4. Write tests first
5. Expose ALL properties

**Never compromise on completeness.** Partial implementations create broken UX.
