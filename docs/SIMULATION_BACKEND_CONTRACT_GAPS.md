# Simulation UI - Backend Contract Gaps

**Created:** 2025-11-18
**Status:** DOCUMENTED - Implementation Pending

---

## Executive Summary

The simulation UI (`src/lib/components/tabs/SimulationTab.svelte` + `src/lib/stores/simulation.ts`) exposes **less than 30%** of backend simulation capabilities:

**Backend Has 3 Simulator Types:**
1. **CFGSimulator** - Global protocol orchestration (centralized execution)
2. **CFSMSimulator** - Single-role choreography execution (local view)
3. **DistributedSimulator** - Multi-role coordination (distributed execution)

**UI Currently Only Uses:**
- CFGSimulator with basic step/play/reset
- **CRITICAL**: Ignores 70%+ of CFGSimulator capabilities
- **CRITICAL**: Completely ignores CFSMSimulator (choreography view)
- **CRITICAL**: Completely ignores DistributedSimulator (distributed execution)

**Impact:** Users cannot:
- See execution events (messages, choices, recursion, parallel, sub-protocols)
- Use backward stepping (debugger-style undo)
- Choose execution strategy (random, first, manual)
- See choice branch previews
- Monitor parallel execution state
- Track recursion stack
- View distributed execution (role-by-role)
- Explore different interleavings
- See message buffers and delivery order
- Debug with step-into/step-out/step-over

---

## Part 1: CFGSimulator - Missing Capabilities

### Backend Capabilities (from `src/core/simulation/types.ts`)

```typescript
interface CFGSimulatorConfig {
  maxSteps?: number;                    // ✅ USED (hardcoded to 1000)
  recordTrace?: boolean;                // ✅ USED (hardcoded to true)
  choiceStrategy?: 'manual' | 'random' | 'first';  // ⚠️ PARTIAL (always 'manual')
  previewLimit?: number;                // ❌ IGNORED
  protocolRegistry?: IProtocolRegistry; // ❌ IGNORED (sub-protocols)
  callStackManager?: ICallStackManager; // ❌ IGNORED (sub-protocols)
  executionHistory?: IExecutionHistory; // ❌ IGNORED (backward stepping!)
}
```

### 1.1 Missing: Execution Events - CRITICAL

**What Backend Provides:**
```typescript
type CFGExecutionEvent =
  | MessageEvent        // Message send from role A to role B
  | ChoiceEvent         // Choice decision made
  | RecursionEvent      // rec enter/continue/exit
  | ParallelEvent       // fork/join
  | SubProtocolEvent    // do SubProtocol enter/exit
  | StateChangeEvent;   // Node transition
```

**Each Event Has:**
- Timestamp
- Type-specific data (roles, labels, node IDs)
- Full context for visualization

**Current UI Behavior:** Events completely ignored - users see nothing happening

**Example Missing Functionality:**
```typescript
// Backend emits:
{
  type: 'message',
  timestamp: 12345,
  from: 'Client',
  to: 'Server',
  label: 'login',
  payloadType: 'Credentials',
  nodeId: 'n5'
}

// UI shows: Nothing! Just step count increments
```

**Why It Matters:**
- Can't see what's happening in the protocol
- No visual feedback for communication
- No way to understand execution flow
- Debugging is impossible

---

### 1.2 Missing: Execution Trace - CRITICAL

**What Backend Provides:**
```typescript
interface CFGExecutionTrace {
  events: CFGExecutionEvent[];  // All events in order
  startTime: number;
  endTime?: number;
  completed: boolean;
  totalSteps: number;
}

// Access via: simulator.getTrace()
```

**Current UI Behavior:** `recordTrace: true` but trace never retrieved or displayed

**Why It Matters:**
- Can replay execution
- Can export execution for analysis
- Can visualize message sequence diagrams
- Can debug complex protocols

---

### 1.3 Missing: Backward Stepping (Execution History) - CRITICAL

**What Backend Provides:**
```typescript
interface IExecutionHistory {
  recordSnapshot(snapshot: CFGExecutionSnapshot): void;
  getPreviousSnapshot(): CFGExecutionSnapshot | undefined;
  getNextSnapshot(): CFGExecutionSnapshot | undefined;
  getAllSnapshots(): CFGExecutionSnapshot[];
  getCurrentPosition(): number;
  setCurrentPosition(stepNumber: number): void;
}
```

**Backend Features:**
- Snapshots at every step
- Can jump to any previous step
- Can step backward (undo)
- Can step forward (redo)
- Stores complete state (visited nodes, choices, parallel branches, recursion stack)

**Current UI Behavior:** No history system - once you step forward, you can't go back

**Why It Matters:**
- Debugging: "What happened 3 steps ago?"
- Exploration: Try different choice branches
- Understanding: See how recursion unfolded
- Teaching: Show step-by-step execution

**UI Gap:**
```
Missing Buttons:
- ⏪ Step Back
- ⏩ Step Forward (explicit)
- ⏮️ Jump to Beginning (with history)
- ⏭️ Jump to End (replay with history)
- 📍 Jump to Step N (timeline slider)
```

---

### 1.4 Missing: Choice Strategy Configuration - PARTIAL

**What Backend Provides:**
```typescript
choiceStrategy: 'manual' | 'random' | 'first'
```

**Current UI:**
- Always uses `'manual'`
- UI auto-selects random in play mode
- No way to change strategy

**Why It Matters:**
- 'first': Deterministic execution (testing)
- 'random': Explore different paths (fuzzing)
- 'manual': User controls (teaching)

**UI Gap:**
```html
Missing Control:
<select bind:value={choiceStrategy}>
  <option value="manual">Manual Selection</option>
  <option value="random">Random (Fuzzing)</option>
  <option value="first">First Branch (Deterministic)</option>
</select>
```

---

### 1.5 Missing: Choice Branch Previews - CRITICAL

**What Backend Provides:**
```typescript
interface EnhancedChoiceOption extends ChoiceOption {
  preview: ActionPreview[];           // Preview of actions in this branch
  participatingRoles: string[];       // Who's involved?
  estimatedSteps: number;             // How long is this branch?
}

interface ActionPreview {
  type: 'message' | 'choice' | 'parallel' | 'recursion';
  from?: string;
  to?: string;
  label: string;
  description: string;
}
```

**Backend Configuration:**
```typescript
previewLimit: number  // Default: 5 actions per branch
```

**Current UI Behavior:** Only shows branch label (if any), no preview

**Why It Matters:**
- Informed decisions: "This branch sends 3 messages, that one loops"
- Role clarity: "Branch 1 involves Client+Server, Branch 2 adds Database"
- Complexity estimate: "Branch 1 is 10 steps, Branch 2 is 50 steps"

**Example:**
```
Current UI:
┌─────────────┐ ┌─────────────┐
│  Branch 1   │ │  Branch 2   │
└─────────────┘ └─────────────┘

Enhanced UI:
┌─────────────────────────────┐ ┌─────────────────────────────┐
│  Branch 1: Success Path     │ │  Branch 2: Error Path       │
│  ────────────────────────   │ │  ────────────────────────   │
│  1. login from C to S       │ │  1. error from S to C       │
│  2. authenticated from S    │ │  2. retry choice            │
│  3. data from S to C        │ │  3. timeout (10 steps)      │
│  Roles: Client, Server      │ │  Roles: Client, Server      │
│  Est. 8 steps               │ │  Est. 25 steps              │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

### 1.6 Missing: Parallel Execution Visualization - CRITICAL

**What Backend Provides:**
```typescript
interface CFGExecutionState {
  inParallel: boolean;
  activeBranches?: string[][];  // Multiple active node paths
}

interface ParallelEvent {
  type: 'parallel';
  action: 'fork' | 'join';
  branches?: number;
  nodeId: string;
}
```

**Current UI Behavior:** No indication of parallel execution state

**Why It Matters:**
- Shows concurrent execution
- Visualizes synchronization points (joins)
- Displays fork/join structure

**UI Gap:**
```
Missing Visualization:
┌─────────────────────────────┐
│  Parallel Execution (3)     │
│  ─────────────────────────  │
│  Branch 1: [n5 → n6 → n7]   │
│  Branch 2: [n8 → n9]        │
│  Branch 3: [n10 → n11 → …]  │
│  Waiting for join at: n15   │
└─────────────────────────────┘
```

---

### 1.7 Missing: Recursion Stack Display - CRITICAL

**What Backend Provides:**
```typescript
interface RecursionContext {
  label: string;       // Recursion variable name
  nodeId: string;      // rec node ID
  iterations: number;  // How many times continued
}

interface CFGExecutionState {
  recursionStack: RecursionContext[];
}

interface RecursionEvent {
  type: 'recursion';
  action: 'enter' | 'continue' | 'exit';
  label: string;
  iteration?: number;
}
```

**Current UI Behavior:** No recursion stack display

**Why It Matters:**
- Shows recursive call depth
- Displays iteration counts
- Visualizes continue points
- Detects infinite loops

**UI Gap:**
```
Missing Panel:
┌────────────────────────────┐
│  Recursion Stack (depth 2) │
│  ────────────────────────  │
│  Loop (iteration 5)        │
│  └─ Inner (iteration 2)    │
└────────────────────────────┘
```

---

### 1.8 Missing: Sub-Protocol Support - FUTURE

**What Backend Provides:**
```typescript
interface SubProtocolEvent {
  type: 'subprotocol';
  action: 'enter' | 'exit';
  protocol: string;
  roleArguments: string[];
  nodeId: string;
}

interface CFGSimulatorConfig {
  protocolRegistry?: IProtocolRegistry;
  callStackManager?: ICallStackManager;
}
```

**Current UI Behavior:** Not implemented yet

**Why It Matters:**
- Higher-order session types
- Protocol composition
- Call stack visualization

---

### 1.9 Missing: Event Subscription System - CRITICAL

**What Backend Provides:**
```typescript
type SimulatorEventType =
  | 'step-start'
  | 'step-end'
  | 'node-enter'
  | 'node-exit'
  | 'message'
  | 'choice-point'
  | 'choice-selected'
  | 'fork'
  | 'join'
  | 'recursion-enter'
  | 'recursion-continue'
  | 'recursion-exit'
  | 'complete'
  | 'error'
  | 'step-into'       // Sub-protocol
  | 'step-out'        // Sub-protocol
  | 'step-over'       // Sub-protocol
  | 'step-back'       // History
  | 'step-forward';   // History

// Subscribe to events:
simulator.on('message', (event: MessageEvent) => { /* ... */ });
```

**Current UI Behavior:** No event subscriptions - polls state instead

**Why It Matters:**
- Real-time updates
- Animation triggers
- Sound effects
- External integrations

---

## Part 2: CFSMSimulator - Completely Ignored

### What CFSMSimulator Provides

**Choreography Execution (Local View):**
- Executes a single role's CFSM
- Asynchronous message handling with buffers
- Distributed execution semantics
- Message queues per sender

**Key Features:**
```typescript
class CFSMSimulator {
  // Local execution for ONE role
  step(): CFSMStepResult;

  // Message buffer management
  getMessageBuffer(): MessageBuffer;

  // Can block waiting for messages
  canProceed(): boolean;

  // Internal choices
  selectBranch(index: number): void;
}
```

**Current UI:** Not exposed at all!

**Why It Matters:**
- Shows local vs global views
- Demonstrates choreography vs orchestration
- Enables distributed execution teaching
- Shows message buffering/queuing

---

## Part 3: DistributedSimulator - Completely Ignored

### What DistributedSimulator Provides

**Multi-Role Coordination:**
- Runs multiple CFSMs concurrently
- Manages message delivery between roles
- Detects distributed deadlocks
- Explores different interleavings

**Key Features:**
```typescript
interface DistributedSimulatorConfig {
  maxSteps?: number;
  maxBufferSize?: number;
  deliveryModel?: 'fifo' | 'unordered';
  schedulingStrategy?: 'round-robin' | 'random' | 'fairness';
  exploreAllInterleavings?: boolean;  // State space exploration!
}

interface DistributedExecutionState {
  roleStates: Map<string, string>;      // Each role's current state
  roleSteps: Map<string, number>;       // Steps per role
  messageBuffers: Map<string, Message[]>;  // Message queues
  deadlocked: boolean;
  completed: boolean;
}
```

**Current UI:** Not exposed at all!

**Why It Matters:**
- **CRITICAL**: This is the ACTUAL distributed execution model!
- Shows message asynchrony
- Demonstrates race conditions
- Visualizes message queuing
- Explores non-deterministic interleavings
- Detects distributed deadlocks (different from CFG deadlock freedom!)

**Example Missing Features:**
```
Role-by-Role View:
┌────────────────────┬────────────────────┬────────────────────┐
│  Client (Step 5)   │  Server (Step 3)   │  Database (Step 2) │
│  ────────────────  │  ────────────────  │  ────────────────  │
│  State: waiting    │  State: ready      │  State: idle       │
│  Buffer: [msg1]    │  Buffer: []        │  Buffer: [query]   │
│  Next: recv login  │  Next: send auth   │  Next: send result │
└────────────────────┴────────────────────┴────────────────────┘
```

---

## Implementation Plan

### Phase 1: Expose Execution Events (HIGH PRIORITY)

**Goal:** Show users what's happening during execution

**Steps:**
1. Add event log panel to SimulationTab
2. Subscribe to simulator events in simulation store
3. Display events in chronological order with icons/colors
4. Support filtering by event type

**UI Changes:**
```svelte
<div class="event-log">
  <h4>Execution Events</h4>
  {#each $executionEvents as event}
    <div class="event" class:type={event.type}>
      <span class="timestamp">{event.timestamp}ms</span>
      <span class="icon">{getEventIcon(event.type)}</span>
      <span class="description">{formatEvent(event)}</span>
    </div>
  {/each}
</div>
```

**Store Changes:**
```typescript
export const executionEvents = writable<CFGExecutionEvent[]>([]);

// Subscribe to all events
simulator.on('message', (e) => executionEvents.update(events => [...events, e]));
// ... for all event types
```

---

### Phase 2: Add Backward Stepping (HIGH PRIORITY)

**Goal:** Enable debugger-style undo

**Steps:**
1. Create ExecutionHistory instance when initializing simulator
2. Add step-back/step-forward buttons
3. Add timeline slider showing all snapshots
4. Update visualization to reflect historical state

**UI Changes:**
```svelte
<button on:click={stepBack} disabled={!canStepBack}>
  ⏪ Step Back
</button>
<input type="range"
  min="0"
  max={$totalSteps}
  bind:value={$currentStep}
  on:change={jumpToStep} />
```

**Store Changes:**
```typescript
import { ExecutionHistory } from '../../core/simulation/execution-history';

const history = new ExecutionHistory({ enabled: true, maxSnapshots: 1000 });

export function stepBack() {
  const snapshot = history.getPreviousSnapshot();
  if (snapshot) {
    restoreSnapshot(snapshot);
  }
}
```

---

### Phase 3: Enhanced Choice Previews (MEDIUM PRIORITY)

**Goal:** Show what happens in each branch

**Steps:**
1. Retrieve `availableChoices` with previews from state
2. Display preview panel when at choice point
3. Show actions, roles, estimated steps for each branch

**UI Changes:**
```svelte
{#if $isAtChoice}
  <div class="choice-previews">
    {#each $availableChoices as choice}
      <div class="choice-card">
        <h5>{choice.label || `Branch ${choice.index + 1}`}</h5>
        <div class="preview">
          {#each choice.preview as action}
            <div class="action">{formatPreview(action)}</div>
          {/each}
        </div>
        <div class="meta">
          <span>Roles: {choice.participatingRoles.join(', ')}</span>
          <span>~{choice.estimatedSteps} steps</span>
        </div>
      </div>
    {/each}
  </div>
{/if}
```

---

### Phase 4: Recursion Stack Display (MEDIUM PRIORITY)

**Goal:** Visualize recursion depth and iterations

**UI Changes:**
```svelte
<div class="recursion-stack">
  <h4>Recursion Stack (depth {$recursionStack.length})</h4>
  {#each $recursionStack as context}
    <div class="recursion-frame">
      <span class="label">{context.label}</span>
      <span class="iteration">iteration {context.iterations}</span>
    </div>
  {/each}
</div>
```

**Store Changes:**
```typescript
export const recursionStack = derived(
  executionState,
  $state => $state?.recursionStack ?? []
);
```

---

### Phase 5: Parallel Execution Visualization (MEDIUM PRIORITY)

**Goal:** Show concurrent branches

**UI Changes:**
```svelte
{#if $inParallel}
  <div class="parallel-branches">
    <h4>Parallel Execution</h4>
    {#each $activeBranches as branch, index}
      <div class="branch">
        <span>Branch {index + 1}:</span>
        <span>{branch.join(' → ')}</span>
      </div>
    {/each}
  </div>
{/if}
```

---

### Phase 6: Distributed Simulation (LOW PRIORITY - FUTURE)

**Goal:** Show role-by-role execution with message buffers

**Steps:**
1. Add distributed simulation mode toggle
2. Create DistributedSimulator instead of CFGSimulator
3. Display per-role state
4. Show message buffers
5. Add scheduling strategy selector

**UI Changes:**
```svelte
<select bind:value={simulatorType}>
  <option value="cfg">Global (Orchestration)</option>
  <option value="distributed">Distributed (Choreography)</option>
</select>

{#if $simulatorType === 'distributed'}
  <div class="role-views">
    {#each $roles as role}
      <div class="role-panel">
        <h4>{role} (Step {$roleSteps.get(role)})</h4>
        <div>State: {$roleStates.get(role)}</div>
        <div>Buffer: {$messageBuffers.get(role).length} msgs</div>
      </div>
    {/each}
  </div>
{/if}
```

---

## Meta-Level Strategy: Frontend-Backend Feature Parity

### Principle 1: Backend Defines the Contract

**Rule:** Every backend capability MUST have a frontend exposure path

**Implementation:**
1. Create `src/lib/stores/contracts/simulation-contract.ts`
2. Type all simulator capabilities
3. Force handling via TypeScript contracts (like editor store)

**Example:**
```typescript
export interface SimulationContract {
  // REQUIRED: These MUST be exposed
  events: CFGExecutionEvent[];
  trace: CFGExecutionTrace;
  history: IExecutionHistory;
  choiceStrategy: 'manual' | 'random' | 'first';

  // OPTIONAL: Can be null if not supported yet
  distributedState?: DistributedExecutionState;
  parallelState?: ParallelExecutionState;
}

// Contract handler ensures completeness
export function handleSimulatorCapabilities(
  simulator: CFGSimulator,
  handler: SimulationCapabilitiesHandler
): void {
  // TypeScript forces handling ALL properties
}
```

---

### Principle 2: Test-Driven Feature Exposure

**Rule:** Write tests FIRST that document missing capabilities

**Implementation:**
1. Create `src/lib/stores/__tests__/simulation.test.ts`
2. Write `.todo()` tests for ALL backend features
3. Convert to passing tests as features implemented

**Example:**
```typescript
describe('Simulation Store - Backend Contract', () => {
  it.todo('should expose execution events');
  it.todo('should provide execution trace');
  it.todo('should enable backward stepping');
  it.todo('should show choice previews');
  // ... ALL backend features
});
```

---

### Principle 3: Progressive Enhancement

**Rule:** Implement in phases, but DOCUMENT everything upfront

**Implementation:**
1. Create gap analysis (this document)
2. Prioritize phases (high/medium/low)
3. Implement phase-by-phase
4. Never mark "complete" until 100% backend parity

---

### Principle 4: Cross-Session Persistence

**Rule:** Document simulation patterns in `.claude/`

**Implementation:**
1. Create `.claude/simulation-development-protocol.md`
2. Document simulation store patterns
3. Document visualization best practices
4. Ensure future sessions follow same rigor

---

## Current Implementation Status

**CFGSimulator Contract:**
- ✅ Basic step/play/reset (20%)
- ❌ Execution events (0%)
- ❌ Execution trace (0%)
- ❌ Backward stepping (0%)
- ⚠️ Choice handling (50% - no previews)
- ❌ Parallel visualization (0%)
- ❌ Recursion stack (0%)
- ❌ Event subscription (0%)

**CFSMSimulator Contract:**
- ❌ Not exposed (0%)

**DistributedSimulator Contract:**
- ❌ Not exposed (0%)

**Overall Backend Parity: ~15%**

---

## Recommended Next Steps

1. **Immediate**: Read and approve this document
2. **Short-term**: Implement Phase 1 (execution events) - 2-3 hours
3. **Medium-term**: Implement Phase 2 (backward stepping) - 3-4 hours
4. **Long-term**: Complete Phases 3-6 - 10-15 hours total

**Estimated Total Effort:** ~15-22 hours to reach 100% backend parity

---

**Remember:** This isn't just missing features - it's **missing the entire simulation experience**. Users can't see what's happening, can't debug, can't explore different execution paths, and can't understand distributed semantics.
