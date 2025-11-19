# Frontend-Exposed Backend Functionality - Structured Analysis

## EXECUTIVE SUMMARY
The frontend exposes a **4-execution-mode simulation system** with time-travel debugging, event logging, and dual-visualization (CFSM Network + CFG Sequence Diagram). Backend functionality is controlled through a single simulation store (layer 4) that manages three parallel execution engines (CFGSimulator, DistributedSimulator, BisimulationValidator).

---

## 1. SIMULATION STORE (`src/lib/stores/simulation.ts`)

### 1.1 EXPORTED STORES (Frontend State)

#### Core Execution Stores
- **`executionMode`** - Writable<'cfg' | 'distributed' | 'bisimulation'>
  - Controls which execution engine is active
  - Determines how other store data is interpreted
  - Default: 'cfg'

- **`simulationMode`** - Writable<'idle' | 'stepping' | 'playing'>
  - UI playback state (not running, manual stepping, or auto-play)
  - Independent of execution engine state

- **`playbackSpeed`** - Writable<number>
  - Auto-play interval in milliseconds (default: 300ms)
  - Updates running auto-play interval in real-time

#### Execution State Stores
- **`cfgExecutionState`** - Writable<CFGExecutionState | null>
  - Current state from CFGSimulator
  - Properties: currentNode, stepCount, completed, atChoice, availableChoices, visitedNodes

- **`distributedExecutionState`** - Writable<DistributedExecutionState | null>
  - Current state from DistributedSimulator
  - Different structure from CFG (includes per-CFSM state)

- **`executionState`** (Derived) - Read-only
  - Points to active execution state based on executionMode
  - For cfg/bisimulation modes: returns cfgExecutionState
  - For distributed mode: returns null (different structure)

#### Architecture Stores
- **`currentCFG`** - Writable<CFG | null>
  - The parsed CFG being executed
  - Contains nodes, edges, roles, structure

- **`currentCFSMs`** - Writable<Map<string, CFSM> | null>
  - CFSMs (one per role) for distributed execution
  - Only populated in distributed/bisimulation modes

### 1.2 DERIVED STORES (Computed State)

#### Control Availability
- **`isSimulationActive`** - Boolean: true if CFG or CFSMs are loaded
- **`isPlaying`** - Boolean: true if simulationMode === 'playing'
- **`canStep`** - Boolean: can step forward (not completed, not playing)
- **`isAtChoice`** - Boolean: execution paused at a choice point
- **`availableChoices`** - EnhancedChoiceOption[]: branches available at choice point

#### Timeline Information (Mode-Aware)
- **`currentStepNumber`** - number: current position in execution history
- **`totalStepCount`** - number: total steps recorded
- **`canStepBack`** - Boolean: can undo previous steps
- **`canStepForward`** - Boolean: can redo (after stepping back)

#### Event Streams (Mode-Aware, Filtered by Time-Travel)
- **`executionEvents`** - Array<DebugEvent | DistributedDebugEvent>: all events from active debugger
- **`visibleExecutionEvents`** - Same, but filtered by current step (time-travel aware)

#### Event Type Filters (CFG mode only)
- **`messageEvents`** - Events where type === 'message'
- **`choiceEvents`** - Events where type === 'choice'
- **`recursionEvents`** - Events where type === 'recursion'
- **`parallelEvents`** - Events where type === 'parallel'
- **`subProtocolEvents`** - Events where type === 'subprotocol'
- **`stateChangeEvents`** - Events where type === 'state-change'

#### Bisimulation-Specific
- **`bisimulationTrace`** - BisimulationTrace | null: comparison trace between CFG and distributed execution
- **`bisimulationResult`** - EquivalenceResult | null: whether CFG ≡ Distributed

### 1.3 EXPORTED FUNCTIONS

#### Initialization (Mode-Specific)

```typescript
// Initialize CFG execution (orchestration view)
export async function initializeCFGSimulation(cfg: CFG)
  - Creates CFGDebugger wrapping CFGSimulator
  - Sets executionMode = 'cfg'
  - Choice strategy: 'manual'
  - Max steps: 1000

// Initialize Distributed execution (choreography view)  
export async function initializeDistributedSimulation(cfsms: Map<string, CFSM>)
  - Creates DistributedDebugger wrapping DistributedSimulator
  - Sets executionMode = 'distributed'
  - Scheduling strategy: 'manual'
  - Max steps: 1000

// Initialize Bisimulation comparison
export async function initializeBisimulation(cfg: CFG, cfsms: Map<string, CFSM>)
  - Creates both CFGDebugger and DistributedDebugger
  - Creates BisimulationValidator coordinating both
  - Sets executionMode = 'bisimulation'
  - Runs parallel executions with equivalence checking

// Legacy (defaults to CFG mode)
export async function initializeSimulation(cfg: CFG)
  - Calls initializeCFGSimulation(cfg)
  - Used by editor.ts after parsing
```

#### Step Control (Async, Mode-Aware)

```typescript
// Execute one forward step
export async function stepSimulation()
  - Calls debugger.stepForward() (or stepForward for CFG)
  - Updates appropriate executionState store
  - Auto-stops when completed
  - Handles async DistributedSimulator

// Make a choice at choice point (CFG only)
export function makeChoice(choiceIndex: number)
  - Calls cfgDebugger.choose(choiceIndex)
  - Steps forward with choice made
  - Auto-stops when completed

// Play mode (auto-stepping)
export function startPlaying()
  - Sets simulationMode = 'playing'
  - Starts interval calling stepSimulation() at playbackSpeed ms
  - Error handling: stops on step failure

export function stopPlaying()
  - Stops auto-step interval
  - Sets simulationMode = 'idle'

export function pauseSimulation()
  - Stops playing
  - Sets simulationMode = 'stepping'
```

#### Time-Travel (Async, Mode-Aware)

```typescript
// Step backward (undo)
export async function stepBack()
  - Calls debugger.stepBackward()
  - Updates executionState with previous state
  - Returns success status

// Step forward (redo)
export function stepForward()
  - Calls stepSimulation()
  - Re-executes forward step

// Jump to specific step in history
export async function jumpToStep(stepNumber: number)
  - Calls debugger.jumpToStep(stepNumber)
  - CFG mode: synchronous jump to recorded state
  - Distributed mode: async jump

// Reset to initial state
export function resetSimulation()
  - Calls debugger.reset() on active debugger
  - Restores initial execution state
  - Stops any playing
  - Works for all modes
```

#### Cleanup

```typescript
export function stopSimulation()
  - Clears all debugger instances
  - Nullifies currentCFG/currentCFSMs
  - Sets simulationMode = 'idle'
  - Resets stateVersion to 0
```

---

## 2. SIMULATION CONTROLS COMPONENT

### File: `src/lib/components/controls/SimulationControls.svelte`

### 2.1 USER ACTIONS (Control Buttons)

#### Play/Pause Toggle (▶/⏸)
- **When playing**: Shows pause button, disabled if execution completed
- **When paused/idle**: Shows play button
- **Behavior**: 
  - Clicking play → `startPlaying()` 
  - In play mode: **AUTO-SELECTS RANDOM choice** at choice points (200ms delay)
  - Clicking pause → `pauseSimulation()` 
- **Title**: "Pause (auto-random mode)" or "Play (auto-random mode)"

#### Step Forward (⏭)
- **Enabled if**: `canStep && (!atChoice || selectedChoice !== null)`
- **Behavior**:
  - If at choice: `makeChoice(selectedChoice)` then clear selection
  - Otherwise: `stepSimulation()`
- **Title**: "Step forward"

#### Reset (⏮)
- **Always enabled**
- **Behavior**: `resetSimulation()` + clears choice selection
- **Title**: "Reset simulation"

### 2.2 STATUS DISPLAY

#### Step Counter
- **Label**: "Step: {executionState.stepCount}"
- **Updates**: Real-time from executionState

#### Status Badges
- Completion badge: "✓ Completed" (green) if executionState.completed
- Playing badge: "▶ Playing" (blue) if simulationMode === 'playing'
- Stepping badge: "⏸ Stepping" (yellow) if simulationMode === 'stepping'
- Idle badge: "⏯ Ready" (gray) if simulationMode === 'idle'

### 2.3 PLAYBACK SPEED CONTROL

#### Speed Slider
- **Range**: 10ms to 1000ms (10ms steps)
- **Binding**: Direct two-way bind to `playbackSpeed` store
- **Real-time Effect**: Updates running auto-play interval immediately
- **Display**: Shows current speed value (e.g., "300ms")

### 2.4 TIMELINE CONTROLS (Nested Child Component)
- See section 3 below

### 2.5 CHOICE PREVIEW PANEL

#### Compact Auto-Play Display
- **Shown when**: `isAtChoice && isPlaying`
- **Display**: "⚡ Auto-selecting:" + choice buttons showing auto-selected choice
- **Styling**: Pulsing animation on auto-selected button
- **No user interaction**: Purely informational

#### Full Choice Preview (When Not Playing)
- **Shown when**: `isAtChoice && !isPlaying`
- **Component**: Nested `ChoicePreview` component (see section 4)
- **Interactivity**: User can select from available branches

### 2.6 STORE DEPENDENCIES
```
Reads:
  - simulationMode, executionState, isSimulationActive, isPlaying
  - canStep, isAtChoice, availableChoices
  - playbackSpeed

Calls:
  - startPlaying(), pauseSimulation(), stepSimulation()
  - makeChoice(index), resetSimulation()
```

---

## 3. TIMELINE CONTROLS COMPONENT

### File: `src/lib/components/controls/TimelineControls.svelte`

### 3.1 USER ACTIONS

#### Step Back Button (⏪)
- **Enabled if**: `canStepBack && !isPlaying`
- **Behavior**: `await stepBack()` 
- **Title**: "Step backward"

#### Timeline Slider
- **Range**: 0 to totalStepCount
- **Current Value**: Synced to currentStepNumber
- **Disabled when**: `isPlaying` (no jumping during auto-play)
- **Behavior on Change**: `await jumpToStep(stepNumber)`
- **Tooltip**: "Jump to step {value}"
- **Visual**: Drag handle shows current position in execution history

#### Step Forward Button (⏩)
- **Enabled if**: `canStepForward && !isPlaying`
- **Behavior**: `await stepForward()` (which calls `stepSimulation()`)
- **Title**: "Step forward"

### 3.2 CONDITIONAL RENDERING
- **Hidden if**: `totalStepCount === 0` (no history yet)
- **Appears after first step**

### 3.3 STORE DEPENDENCIES
```
Reads:
  - canStepBack, canStepForward, currentStepNumber
  - totalStepCount, isPlaying

Calls:
  - stepBack(), stepForward(), jumpToStep(stepNumber)
```

---

## 4. CHOICE PREVIEW COMPONENT

### File: `src/lib/components/panels/ChoicePreview.svelte`

### 4.1 PROPERTIES (Props)
- **choices**: EnhancedChoiceOption[] - Available branches
- **selectedChoice**: number | null - Currently selected index
- **onSelectChoice**: (index: number) => void - Selection callback
- **disabled**: boolean - Disable interaction (e.g., during auto-play)

### 4.2 CHOICE CARD DISPLAY
Each choice shows:
- **Number Badge**: Circled index (1, 2, 3...)
- **Label**: Choice name or "Branch {n}"
- **Description**: Optional descriptive text (if present)

### 4.3 PREVIEW INFORMATION

#### Actions Section (if choice.preview exists)
- **Header**: "📋 Actions"
- **Contents**: List of upcoming actions if this branch is taken
  - Messages: "A → B: message_name"
  - Choices: "choice at label"
  - Parallel: "parallel (label)"
  - Recursion: "rec label"

#### Metadata Section
- **Participating Roles** (if present):
  - Icon: 👥
  - Shows: comma-separated role names
  
- **Estimated Steps** (if present):
  - Icon: 📊
  - Shows: ~{estimatedSteps}

### 4.4 USER INTERACTION

#### Card Selection
- **Click**: Card becomes selected (border + background highlight)
- **Keyboard**: Enter key also selects
- **Visual Feedback**: 
  - Border turns blue (#007acc)
  - Background becomes darker
  - "✓ Selected" indicator appears in top-right

#### Disabled State
- **Styling**: 60% opacity
- **Interaction**: Cursor shows "not-allowed"
- **Used by**: SimulationControls when isPlaying=true

### 4.5 GRID LAYOUT
- Responsive: auto-fit columns, min 280px width
- Gap between cards: 12px
- Scrolls if too many choices

---

## 5. VISUALIZATION COMPONENTS

### 5.1 CFSM NETWORK VISUALIZATION

#### File: `src/lib/components/visualizations/CFSMNetwork.svelte`

##### Visualization Elements
- **Individual CFSMs**: One per role in roles list
  - Title: Role name (teal #4EC9B0)
  - States: Circles with hierarchical layout
  - Transitions: Curved arrows with labels
  - Border: Teal box around each CFSM

##### State Styling (Based on Execution)
- **Current State** (at this state, idle):
  - Fill: Dark green (#2d5f2d)
  - Border: Bright green (#90ee90)
  - Stroke width: 3px
  - Pulse animation

- **Active Transition Source/Target** (executing from/to):
  - Fill: Dark cyan (#2d5f5f)
  - Border: Cyan (#4EC9B0)
  - Stroke width: 3px
  - Pulse animation

- **Visited but Not Active**:
  - Fill: Dark green mix (#2d4d3d)
  - Border: Cyan (#4EC9B0)
  - Stroke width: 2px

- **Initial State** (default):
  - Fill: Dark green (#2d5f2d)
  - Border: Green (#90ee90)

- **Final/Terminal State**:
  - Fill: Dark red (#5f2d2d)
  - Border: Red (#ff6b6b)

- **Unvisited**:
  - Fill: Dark gray (#2d2d2d)
  - Border: Dim gray (#666)

##### Active Transition Display
- **Send Transitions**: Bright green arrow, weight 2.5
- **Receive Transitions**: Bright green arrow, weight 2.5
- **Message Channels Between Roles**: Purple dashed lines with:
  - Label showing message name
  - Circle in middle (message in buffer)
  - Pulsing animation

##### Interaction
- **Pan/Zoom**: D3 zoom behavior (0.1x to 4x)
- **Reset Zoom Button**: (⟲) top-right, smoothly resets to 1x
- **Hover**: Grab cursor on SVG

##### Data Sources
- Uses `projectionData` for role structure
- Uses `currentCFG` for message information  
- Uses `executionState` for current/visited state tracking
- Re-renders on change to either

##### Placeholder
- Shown if parseStatus !== 'success' or no projectionData
- Message: "🔄 CFSM Network" + "Parse a protocol to see the network of Communicating Finite State Machines"

### 5.2 CFG SEQUENCE DIAGRAM VISUALIZATION

#### File: `src/lib/components/visualizations/CFGSequence.svelte`

##### Visualization Elements
- **Swimming Lanes**: One per role (vertical)
  - Label: Role name (teal #4EC9B0)
  - Lifeline: Dashed gray line from top to bottom

- **Message Arrows**: Horizontal arrows from sender to receiver(s)
  - Multiple recipients: Separate arrows per receiver
  - Label: Message name, centered above arrow

##### Message Styling (By State)
- **Current Message** (executing now):
  - Color: Orange (#FFA500)
  - Stroke width: 4px
  - Pulsing animation (opacity 1→0.5→1)
  - Label: Bold, larger font

- **Visited Messages** (already executed):
  - Color: Green/Cyan (#4EC9B0)
  - Stroke width: 3px
  - Label: Bold

- **Unvisited Messages** (pending):
  - Color: Blue (#007acc)
  - Stroke width: 2px
  - Opacity: 0.6
  - Label: Normal font weight

##### Legend
- 🟠 Orange: Current message
- 🟢 Green: Executed
- 🔵 Blue: Pending

##### Interaction
- **Pan/Zoom**: D3 zoom behavior (0.1x to 4x)
- **Reset Zoom Button**: (⟲) top-right
- **Fixed Positioning**: Does NOT auto-fit to viewport (allows discovery of full protocol)

##### Data Sources
- Extracts messages from `currentCFG` action nodes
- Uses `executionState.visitedNodes` and `currentNode` to mark state
- Re-renders on change to either

##### Placeholder
- Message: "📊 CFG Sequence Diagram"
- Help text: "Parse a protocol to see the message sequence diagram"
- Legend: Explains color coding

---

## 6. EVENT LOG PANEL

### File: `src/lib/components/panels/EventLog.svelte`

### 6.1 EVENT TYPES & FILTERING

#### Filterable Event Categories (Checkboxes)
- **Messages** (📨 blue)
  - Type: 'message'
  - Format: "From → To: Label(PayloadType)"
  - Count displayed

- **Choices** (🔀 orange)
  - Type: 'choice'
  - Format: "Choice N (Label) by DecidingRole"
  - Count displayed

- **Recursion** (🔄 purple)
  - Type: 'recursion'
  - Format: "Action Label (iteration N)"
  - Count displayed

- **Parallel** (⚡ yellow)
  - Type: 'parallel'
  - Format: "Action (N branches)"
  - Count displayed

- **Other** Events:
  - Subprotocol (📦 green): "Action protocol(args...)"
  - State-change (➡️ gray): "From → To"

### 6.2 EVENT DISPLAY

Each event row shows:
- **Event Number**: Sequence in timeline (right-aligned, monospace)
- **Icon**: Type-specific emoji
- **Description**: Formatted event details (monospace font)
- **Timestamp**: When event occurred (ms, right-aligned)

### 6.3 VISUAL STYLING BY TYPE
- **Message**: Blue left border (#4a9eff)
- **Choice**: Orange left border (#ffa64a)
- **Recursion**: Purple left border (#9d4aff)
- **Parallel**: Yellow left border (#ffeb3b)
- **Subprotocol**: Teal left border (#4aff9d)
- **State-change**: Gray left border (#666)

### 6.4 INTERACTION
- **Filter Toggles**: Checkboxes to show/hide event types
- **Real-time Filtering**: List updates as you toggle
- **Scrollable**: Overflow handled with scroll if many events

### 6.5 DATA SOURCE
- Reads: `executionEvents` (all events) + individual event type filters
- Filtered by: `visibleExecutionEvents` (time-travel aware)
- Updates: Real-time as simulation steps

### 6.6 PLACEHOLDER STATES
- Empty with events available: "No events match current filters"
- Completely empty: "No events yet. Step through the simulation to see execution events."

---

## 7. VERIFICATION & ERROR DISPLAY

### File: `src/lib/components/panels/VerificationPanel.svelte`

### 7.1 VERIFICATION RESULTS (From Backend)

Displays three main checks (propagated from `verificationResult` store):

#### Deadlock Freedom
- **Icon**: ✓ (green) or ✗ (red)
- **Label**: "Deadlock Free: Yes/No"
- **Source**: `verificationResult.deadlockFree`

#### Liveness
- **Icon**: ✓ (green) or ✗ (red)
- **Label**: "Liveness: Satisfied/Violated"
- **Source**: `verificationResult.livenessSatisfied`

#### Safety
- **Icon**: ✓ (green) or ✗ (red)
- **Label**: "Safety: Satisfied/Violated"
- **Source**: `verificationResult.safetySatisfied`

### 7.2 DETAILED ISSUES

#### Errors List
- **Header**: "Errors"
- **Format**: "✗ {error message}"
- **Styling**: Red background (#5f2d2d), red text
- **Source**: `verificationResult.errors`

#### Warnings List
- **Header**: "Warnings"
- **Format**: "⚠ {warning message}"
- **Styling**: Yellow background (#5f5f2d), yellow text
- **Source**: `verificationResult.warnings`

### 7.3 PARSE ERROR DISPLAY

If `parseError` exists:
- **Header**: "Parse Error (Line X, Column Y)"
- **Content**: Full error message in monospace
- **Styling**: Red background, monospace, scrollable

### 7.4 PANEL CONTROLS
- **Collapse Button**: ▲/▼ to show/hide content
- **Collapsible State**: Controlled via `outputPanelCollapsed` store

### 7.5 EMPTY STATE
- **Message**: "Parse a protocol to see verification results"

---

## 8. SIMULATION TAB LAYOUT

### File: `src/lib/components/tabs/SimulationTab.svelte`

### 8.1 LAYOUT STRUCTURE
```
┌─────────────────────────────────────┐
│  SimulationControls (top bar)        │
├──────────────┬──────────────────────┤
│              │                      │
│  CFSM        │  CFG Sequence        │
│  Network     │  Diagram             │
│              │                      │
├──────────────┴──────────────────────┤
│  Event Log                           │
└─────────────────────────────────────┘
```

### 8.2 COMPONENTS
- **Top**: SimulationControls (includes TimelineControls)
- **Left Pane**: CFSMNetwork visualization (50% width by default)
- **Right Pane**: CFGSequence visualization (50% width)
- **Splitter**: Resizable divider (4px wide, blue on hover)
- **Bottom**: EventLog (200px height by default, scrollable)

### 8.3 PANE HEADERS
- Floating labels: "CFSM Network" and "CFG Sequence"
- Position: Top-right of each pane
- Styling: Semi-transparent background with blur effect

---

## 9. BACKEND FEATURES EXPOSED - COMPREHENSIVE LIST

### 9.1 EXECUTION ENGINES (Hidden Behind Mode Switch)

#### CFG Simulator (Orchestration View)
- **Exposed through**: `executionMode = 'cfg'`
- **Features**:
  - Single global execution trace
  - All messages in unified order
  - Global choice resolution
  - Manual choice points (UI selection required)
  - 1000 step limit

#### Distributed Simulator (Choreography View)
- **Exposed through**: `executionMode = 'distributed'`
- **Features**:
  - Per-role independent state machines
  - Manual scheduling of enabled transitions
  - Local choice resolution per role
  - Asynchronous message delivery
  - 1000 step limit

#### Bisimulation Validator (Comparison Mode)
- **Exposed through**: `executionMode = 'bisimulation'`
- **Features**:
  - Runs both simulators in parallel
  - Equivalence checking (are CFG and distributed traces equivalent?)
  - Comparative visualization
  - Synchronized stepping

### 9.2 DEBUGGING FEATURES

#### Time-Travel Debugging
- Jump to any previously recorded step
- Step backward (undo)
- Step forward (redo)
- Full history preserved until reset
- 1000 step cap

#### Manual Choice Selection
- UI shows all available branches at choice point
- Choose branch before stepping
- Gets preview of what branch does
  - Participating roles
  - Action preview (messages, recursion, parallel, etc.)
  - Estimated step count

#### Auto-Random Mode
- In play mode: automatically selects random branch at choices
- 200ms delay to show selection before proceeding
- Useful for exploring different paths quickly

#### Event Logging
- Complete trace of all events:
  - Message sends/receives
  - Choice selections
  - Recursion entry/exit
  - Parallel fork/join
  - Sub-protocol invocations
  - State transitions
- Time-travel aware (visible events match current step)
- Filterable by type

### 9.3 VERIFICATION FEATURES (Backend Results Display)

#### Property Checking
- Deadlock freedom detection
- Liveness verification  
- Safety verification
- Race condition detection
- Progress guarantee checking
- Choice determinism
- Choice mergeability
- Connectedness
- Nested recursion scope validation
- Recursion in parallel validation
- Fork-join structure validation
- Multicast correctness
- Self-communication detection
- Empty choice branch detection
- Merge reachability analysis

#### Error Reporting
- Parse errors with line/column info
- Verification errors (structured list)
- Warnings (non-fatal issues)
- Projection errors (per-role)

### 9.4 VISUALIZATION FEATURES

#### CFSM Network View
- Role-by-role finite state machine visualization
- Active state highlighting
- Visited state tracking
- Active transition animation
- Message channel rendering (between-role communication)
- Hierarchical layout
- Pan/zoom controls

#### CFG Sequence Diagram
- Swimming lane visualization
- Message sequence display
- Current/visited/pending distinction
- Multicast message support
- Message count per role
- Pan/zoom controls

#### Real-Time Synchronization
- Both visualizations update on every step
- Current execution position visible in both
- Event log aligned with step number

### 9.5 INTERACTION PATTERNS

#### Play/Step/Reset Workflow
- **Play**: Auto-advance with auto-random choices
- **Step**: Manual advance, user selects at choice points
- **Pause**: Stop auto-play, remain at current step
- **Reset**: Go back to initial state

#### Speed Control
- Real-time adjustment while playing
- 10ms to 1000ms range
- Updates running interval immediately

#### Choice Navigation
- Full preview before committing
- Metadata about each branch
- Can change mind (reset and try different path)

---

## 10. FRONTEND TO BACKEND CONTROL FLOW

```
┌─────────────────────────────────────────────────────┐
│ USER INTERACTION (SimulationControls)               │
│ - Click Play/Step/Reset                             │
│ - Adjust Speed                                      │
│ - Select Choice                                     │
│ - Drag Timeline                                     │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ SIMULATION STORE (Layer 4: Frontend)                │
│ - stepSimulation()                                  │
│ - makeChoice(index)                                │
│ - jumpToStep(n)                                    │
│ - startPlaying() / stopPlaying()                   │
│ - resetSimulation()                                │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ DEBUGGER LAYER (Layer 3: Debugging)                │
│ Mode-aware dispatch:                               │
│ - CFGDebugger (if executionMode='cfg')            │
│ - DistributedDebugger (if executionMode='dist')  │
│ - BisimulationValidator (if executionMode='bis')  │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ SIMULATOR LAYER (Layer 2: Execution)               │
│ - CFGSimulator: orchestration VM                   │
│ - DistributedSimulator: choreography VM            │
│ Returns: updated state                             │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ STORES UPDATED                                      │
│ - cfgExecutionState / distributedExecutionState    │
│ - Derived stores recompute reactively              │
│ - UI components re-render                          │
└─────────────────────────────────────────────────────┘
```

---

## 11. KEY PROPERTIES & LIMITATIONS

### 11.1 Design Constraints
- **No State Duplication**: Frontend stores mirror only active debugger's state
- **Manual Execution**: No automatic path exploration (except auto-random in play mode)
- **Step Limit**: 1000 steps maximum (prevents runaway execution)
- **Choice Strategies Fixed**:
  - CFG: Manual (user selection required when paused)
  - Distributed: Manual (user selects scheduling)
  - Bisimulation: Synchronized manual (both step together)

### 11.2 Choice Point Behavior
- **In Step Mode**: User must select a branch, step is blocked until selection made
- **In Play Mode**: Automatically selects random branch, continues with 200ms delay
- **UI Feedback**: Always shows available branches with metadata
- **No Rollback**: Once branch selected (either way), committed to that path

### 11.3 Execution State Tracking
- **History Recorded**: All states from beginning to current step
- **Time-Travel**: Can jump to any prior step, forward redo available
- **Visited Tracking**: Nodes visited during entire execution (not reset on jump)
- **Event Visibility**: Filtered to current step position

### 11.4 Performance Notes
- Visualizations update on every step (reactive)
- Event log grows with execution length
- Pan/zoom state preserved across re-renders
- Debounced auto-parse: 1 second delay on editor input

---

## 12. MISSING/NOT EXPOSED

### 12.1 Not Accessible from Frontend
- Choice point probabilities (no stochastic simulation)
- Custom choice strategies (only manual available)
- Step-through limits > 1000
- Manual visualization configuration (layout, styling via backend)
- Performance profiling
- State space exploration (exhaustive search)
- Counterexample generation
- Witness path extraction (could be added)

### 12.2 Partially Implemented (Phase 4)
- Sub-protocol parameters: preserved but not displayed
- Multiple terminal states: detected but not visualized separately
- Advanced bisimulation analysis: trace available but not interactive UI

---

## SUMMARY TABLE

| Feature | Component | Store | Backend | Status |
|---------|-----------|-------|---------|--------|
| Play/Step/Reset | SimulationControls | simulation | CFGDebugger | Fully exposed |
| Choice Selection | ChoicePreview | simulation | CFGDebugger | Fully exposed |
| Speed Control | SimulationControls | playbackSpeed | - | Frontend only |
| Timeline Jump | TimelineControls | simulation | CFGDebugger | Fully exposed |
| CFSM Visualization | CFSMNetwork | editor + simulation | - | Derived data |
| Sequence Diagram | CFGSequence | editor + simulation | - | Derived data |
| Event Log | EventLog | simulation | CFGDebugger | Fully exposed |
| Verification | VerificationPanel | editor | Verifier | Display only |
| Parsing | GlobalEditor | editor | Parser + Verifier | Triggered |
| Mode Switching | - | executionMode | Debuggers | Programmatic only* |

*Mode switching not exposed in current UI; hardcoded to CFG mode initialization

