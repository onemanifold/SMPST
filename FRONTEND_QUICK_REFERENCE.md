# Frontend UI to Backend Mapping - Quick Reference

## Key Entry Points

### 1. Simulation Store Imports
```typescript
import {
  // Execution Modes
  executionMode,
  simulationMode,
  playbackSpeed,
  
  // State Stores
  cfgExecutionState,
  distributedExecutionState,
  executionState,
  currentCFG,
  currentCFSMs,
  
  // Control Functions
  initializeCFGSimulation,
  initializeDistributedSimulation,
  initializeBisimulation,
  stepSimulation,
  makeChoice,
  startPlaying,
  stopPlaying,
  pauseSimulation,
  stepBack,
  stepForward,
  jumpToStep,
  resetSimulation,
  stopSimulation,
  
  // Derived Stores
  isSimulationActive,
  isPlaying,
  canStep,
  isAtChoice,
  availableChoices,
  currentStepNumber,
  totalStepCount,
  canStepBack,
  canStepForward,
  executionEvents,
  visibleExecutionEvents,
  messageEvents,
  choiceEvents,
  recursionEvents,
  parallelEvents,
  bisimulationTrace,
  bisimulationResult,
} from '$lib/stores/simulation';
```

### 2. Component Hierarchy
```
IDE
├── Header (shows parse status + verification summary)
├── Tab Bar
│  ├── Code Tab
│  │  ├── GlobalEditor (editable Scribble)
│  │  ├── LocalProjectionPanel (role projections)
│  │  └── VerificationPanel (results)
│  └── Simulation Tab
│     ├── SimulationControls (play/step/reset)
│     │  ├── TimelineControls (jump/back/forward)
│     │  └── ChoicePreview (branch selection)
│     └── Main Content
│        ├── Left: CFSMNetwork (visualization)
│        ├── Right: CFGSequence (visualization)
│        └── Bottom: EventLog (event list + filters)
└── Sidebar (examples + saved protocols)
```

---

## Control Flow: User Action → Store → Backend

### Play Button (▶)
```
User clicks Play
  ↓
SimulationControls.handlePlay()
  ↓
startPlaying()
  - Sets simulationMode = 'playing'
  - Starts interval: setInterval(() => stepSimulation(), playbackSpeed)
  ↓
stepSimulation() [every 300ms default]
  - Calls cfgDebugger.stepForward()
  - At choice points: auto-selects random, waits 200ms, continues
  ↓
cfgExecutionState updated
  ↓
All subscribers re-render
  - Visualizations update
  - Status badges update
  - Event log updates
```

### Step Button (⏭) - At Choice Point
```
User selects branch in ChoicePreview
  - selectedChoice = index
User clicks Step
  ↓
SimulationControls.handleStep()
  - if (atChoice && selectedChoice !== null)
      makeChoice(selectedChoice)
  ↓
makeChoice(choiceIndex)
  - cfgDebugger.choose(choiceIndex)
  - cfgDebugger.stepForward()
  ↓
cfgExecutionState updated
  ↓
Re-render + clear selection
```

### Timeline Jump
```
User drags timeline slider
  ↓
TimelineControls.handleSliderChange()
  ↓
await jumpToStep(stepNumber)
  - cfgDebugger.jumpToStep(stepNumber)
  ↓
cfgExecutionState updated to prior state
  ↓
Visualizations show execution at that step
  - visibleExecutionEvents filters to that step
  - Visited nodes retained from entire history
```

### Parse & Initialize
```
User edits code in GlobalEditor
  ↓
Editor (debounced 1s)
  ↓
parseProtocol(content)
  - Parses Scribble → AST
  - Builds CFG
  - Runs verification
  - Projects CFSMs
  ↓
verificationResult store set
  ↓
projectionData store set
  ↓
initializeSimulation(cfg)
  - Creates CFGDebugger
  - Sets executionMode = 'cfg'
  - cfgExecutionState set to initial
  ↓
SimulationTab now active, ready for play
```

---

## Store Access Patterns

### Reading Stores
```typescript
// In components: use Svelte store prefix ($)
{#if $isPlaying}
  <button on:click={pauseSimulation}>Pause</button>
{/if}

// In TypeScript: subscribe or use get()
import { get } from 'svelte/store';
const mode = get(simulationMode);

// Derived stores auto-subscribe
$: isReadyToStep = $canStep && !$isAtChoice;
```

### Updating Stores (Control Functions)
```typescript
// Frontend controls these store updates
await stepSimulation();     // Updates cfgExecutionState
makeChoice(0);              // Updates cfgExecutionState + simulationMode
startPlaying();             // Updates simulationMode + starts interval
playbackSpeed.set(500);     // Direct write (reactive)
resetSimulation();          // Resets cfgExecutionState to initial
```

---

## Component-Store Mappings

| Component | Reads | Writes | Uses |
|-----------|-------|--------|------|
| SimulationControls | executionState, isPlaying, canStep, atChoice, availableChoices, playbackSpeed | playbackSpeed | startPlaying, pauseSimulation, stepSimulation, makeChoice, resetSimulation |
| TimelineControls | currentStepNumber, totalStepCount, canStepBack, canStepForward, isPlaying | - | stepBack, stepForward, jumpToStep |
| ChoicePreview | Local state (selectedChoice) | - | onSelectChoice callback |
| CFSMNetwork | projectionData, currentCFG, executionState | - | D3 visualization |
| CFGSequence | currentCFG, executionState | - | D3 visualization |
| EventLog | executionEvents, messageEvents, etc. | Local filter toggles | - |
| VerificationPanel | verificationResult, parseError | - | Display only |

---

## Execution Modes (Experimental)

All three modes are implemented but only CFG is exposed in UI:

### CFG Mode (Currently Used)
```typescript
// Set in store
executionMode = 'cfg'

// Backend
- Single global CFG execution
- Messages in unified sequence
- Global choice points
- User selects branches

// Store State
cfgExecutionState = active
distributedExecutionState = null
```

### Distributed Mode (Not in UI)
```typescript
// Would set
executionMode = 'distributed'

// Backend
- Per-role CFSM execution
- Independent state machines
- Manual scheduling between roles
- Asynchronous message delivery

// Store State
cfgExecutionState = null
distributedExecutionState = active
```

### Bisimulation Mode (Not in UI)
```typescript
// Would set
executionMode = 'bisimulation'

// Backend
- Both simulators run in parallel
- Equivalence checking
- BisimulationValidator coordinates

// Store State
cfgExecutionState = active
distributedExecutionState = active
bisimulationResult = comparison
```

To add UI mode switching, create component that calls:
```typescript
await initializeDistributedSimulation(cfsms);
// or
await initializeBisimulation(cfg, cfsms);
```

---

## Event Types & Filters

```typescript
// In simulation.ts
export const messageEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter(e => e.type === 'message')
);
// Same pattern for: choiceEvents, recursionEvents, 
// parallelEvents, subProtocolEvents, stateChangeEvents
```

Visible in EventLog:
- **message**: "A → B: label"
- **choice**: "Choice N by Role"
- **recursion**: "rec label (iter N)"
- **parallel**: "par (N branches)"
- **subprotocol**: "action proto(args)"
- **state-change**: "node1 → node2"

---

## Visualizations Data Flow

### CFSM Network
```
projectionData: ProjectionData[]
  └─ role (name)
  └─ states: string[]
  └─ transitions: {from, to, label}

currentCFG: CFG
  └─ nodes (for message lookups)

executionState: CFGExecutionState
  └─ currentNode (which state active)
  └─ visitedNodes (visited history)

→ D3 SVG visualization
```

### CFG Sequence
```
currentCFG.nodes (filter for messages)
  └─ from, to, label

executionState
  └─ currentNode
  └─ visitedNodes

→ D3 SVG swimming lanes
```

Both re-render reactively:
```typescript
$: if ($projectionData || $executionState) {
  renderCFSMNetwork();
}
```

---

## Time-Travel State

```typescript
// In CFGDebugger
recordedStates: CFGExecutionState[] = [initial, step1, step2, ...]
currentPosition: number = 0

// Frontend operations
jumpToStep(2) → currentPosition = 2 → return recordedStates[2]
stepBack() → currentPosition-- → return recordedStates[currentPosition]
stepForward() → currentPosition++ → return recordedStates[currentPosition]

// Visible events are filtered
visibleExecutionEvents = allEvents.filter(e => e.stepNumber <= currentPosition)
```

---

## Key Limitations

1. **Mode Switching Not in UI**
   - Only CFG mode initialized after parse
   - Would need UI toggle to expose distributed/bisimulation

2. **Choice Strategy Fixed**
   - CFG: Manual (user selection)
   - Distributed/Bisim: Manual (no auto in those modes)
   - No stochastic/probabilistic strategies

3. **Step Limit**
   - Hard-coded to 1000 steps
   - Prevents runaway execution
   - Full history kept until reset

4. **Scheduling in Distributed**
   - Manual only (no automatic exploration)
   - No automatic fairness/scheduling algorithms

5. **Visualizations**
   - D3-based, not configurable
   - Fixed layout algorithms
   - No animation between states (just instant update)

---

## Testing the System

Quick test in browser console:
```javascript
// Get current state
const {get} = await import('svelte/store');
const {cfgExecutionState} = await import('./stores/simulation');
console.log(get(cfgExecutionState));

// Trigger step
const {stepSimulation} = await import('./stores/simulation');
await stepSimulation();
```

---

## Future Enhancement Opportunities

1. **Add Mode Switching UI** → Expose distributed/bisimulation
2. **Choice Strategy Configuration** → Probabilistic, greedy, etc.
3. **State Space Export** → Export traces to JSON
4. **Interactive Visualization** → Click on states to jump
5. **Counterexample Display** → Show failed property traces
6. **Sub-protocol Parameters** → Display in UI
7. **Custom Layouts** → Configure visualizations
8. **Breakpoints** → Stop at specific nodes
9. **State Search** → Jump to first state matching predicate
10. **Animation** → Smooth transitions between states

