# Scribble MPST IDE - UI Specification v2.0

**Version:** 2.0
**Date:** 2025-01-12
**Status:** Design Specification (Updated for CFG/CFSM Architecture)
**Previous Version:** 1.0 (in main branch)

---

## Document History

**v2.0 Changes:**
- Complete redesign based on CFG/CFSM simulation architecture
- Two top-level tabs: CODE (entry point) vs SIMULATION
- Local Scribble projection (textual) in CODE tab
- Three visualization modes in SIMULATION tab
- Distinction between static CFG structure and dynamic sequence diagram
- Educational focus: teaching MPST formal theory

---

## 1. Overview

The Scribble MPST IDE is a **live tutorial system for teaching Multiparty Session Types (MPST) formal theory in depth** through interactive visualization and simulation.

### 1.1 Educational Goals

The UI enables students to:

1. **Understand textual projection** (CODE tab)
   - See global Scribble transform into local Scribble per role
   - Understand perspective transformation: `A -> B: Msg` becomes `B!Msg` (A's view) and `A?Msg` (B's view)
   - Compare global (perspective-independent) vs local (perspective-dependent) protocols

2. **Understand execution semantics** (SIMULATION tab)
   - Observe distributed execution (CFSM network with state machines + message buffers)
   - See execution trace (sequence diagram growing during simulation)
   - Explore control flow structure (static CFG graph with cycles and branches)

3. **Compare synchronous vs asynchronous** (SIMULATION tab)
   - CFG Simulation: Synchronous (global choreography, total order)
   - CFSM Simulation: Asynchronous (distributed execution, partial order, message buffers)

4. **Verify protocol correctness** (CODE tab)
   - Static verification (deadlock, liveness, choice determinism, etc.)
   - Inline error feedback
   - Understanding why protocols fail verification

### 1.2 Core Design Principles

1. **Two-Tab Architecture**: CODE (authoring) vs SIMULATION (execution)
2. **Point of Entry is CODE**: Natural workflow starts with writing/viewing protocols
3. **Educational Clarity**: Each view teaches a specific MPST concept
4. **Real-time Feedback**: Immediate parse/verify results
5. **Interactive Exploration**: Step-through execution, make choices, observe outcomes
6. **Progressive Disclosure**: Simple by default, complexity on demand

### 1.3 User Workflow

```
Write/Load Protocol (CODE tab)
    ↓
Parse & Verify
    ↓
Review Local Projections (CODE tab, right pane)
    ↓
Switch to SIMULATION tab
    ↓
Step through execution / Observe visualizations
    ↓
Iterate back to CODE tab to fix issues
```

---

## 2. Top-Level Architecture

### 2.1 Two Main Tabs

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER: [Logo] [File] [Examples] [Help] [Documentation]   │
├─────────────────────────────────────────────────────────────┤
│  Main Tabs:   [ CODE ]  [ SIMULATION ]                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tab Content Area (see below)                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Tab 1: CODE (Entry Point)
- **Purpose**: Protocol authoring and projection understanding
- **Left Pane**: Global Scribble (read/write)
- **Right Pane**: Local Scribble (read-only, tabbed by role)
- **Bottom Panel**: Verification Results
- **Educational Value**: See textual projection (perspective transformation)

#### Tab 2: SIMULATION
- **Purpose**: Execution visualization and exploration
- **Main Area**: Configurable visualizations (1-3 panes)
- **Bottom Panel**: Event Log / Execution Trace
- **Educational Value**: See distributed execution semantics

### 2.2 Why This Structure?

**Previous Design (v1.0):**
- Workspace tabs: [Global Protocol] [Alice] [Bob] [Carol]
- Mixed code editing + visualization in single context
- **Problem**: Confusing mental model - sometimes authoring, sometimes viewing simulation

**New Design (v2.0):**
- Top-level tabs separate authoring (CODE) from execution (SIMULATION)
- Clear mental model: "Edit" vs "Watch it run"
- **Benefit**: Aligns with educational flow and user intent

---

## 3. Tab 1: CODE

### 3.1 Layout Overview

```
┌──────────────────────────────────────────────────────────────┐
│  [ CODE ] [ Simulation ]     [Parse] [Verify] [Project]  ✓✗ │
├───────────────────────────┬──────────────────────────────────┤
│  Global Scribble          │  Local Scribble                  │
│  (Read/Write)             │  [Client] [Server] [DB]          │
│                           │  ┌────────────────────────────┐  │
│  protocol ThreeParty(     │  │ [Scribble] [TypeScript]    │  │
│    role Client,           │  ├────────────────────────────┤  │
│    role Server,           │  │ // Client local protocol   │  │
│    role DB                │  │ Server!Request<Int>;       │  │
│  ) {                      │  │ Server?Response<String>;   │  │
│    Client -> Server:      │  │                            │  │
│      Request<Int>;        │  │                            │  │
│    Server -> DB:          │  │                            │  │
│      Query<Int>;          │  │                            │  │
│    DB -> Server:          │  │                            │  │
│      Data<String>;        │  │                            │  │
│    Server -> Client:      │  │                            │  │
│      Response<String>;    │  │                            │  │
│  }                        │  └────────────────────────────┘  │
│                           │                                  │
│  ~~~~ (error squiggles)   │                                  │
└───────────────────────────┴──────────────────────────────────┘
├──────────────────────────────────────────────────────────────┤
│ Verification Results:                        [▼ Collapse]    │
│ ✓ Deadlock freedom: PASSED                                   │
│ ✓ Liveness: PASSED                                           │
│ ✗ Choice determinism: FAILED (line 15)                       │
│   └─ External choice has duplicate labels "accept"           │
│ Parse Errors: (1)  Line 12: Unexpected token 'from'          │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Component Specifications

#### 3.2.1 Toolbar

**Location**: Top of CODE tab

**Components**:

1. **Parse Button**
   - Label: "Parse"
   - Action: Parse Scribble → AST → CFG
   - Disabled when: Currently parsing
   - Keyboard shortcut: Ctrl/Cmd+Enter

2. **Verify Button**
   - Label: "Verify"
   - Action: Run all 20 verification checks (P0-P3)
   - Disabled when: Parse failed or currently verifying
   - Keyboard shortcut: Ctrl/Cmd+Shift+V

3. **Project Button**
   - Label: "Project"
   - Action: Generate CFSMs for all roles
   - Disabled when: Verification failed or currently projecting
   - Auto-triggers after successful verify (optional)

4. **Status Indicator**
   - Icons: ✓ (success), ✗ (error), ⚠ (warning), ○ (idle)
   - Tooltip: "3 checks passed, 1 failed"
   - Clickable: Jump to verification results panel

**Workflow**:
```
Parse → Verify → Project → Ready to Simulate
```

---

#### 3.2.2 Left Pane: Global Scribble Editor

**Type**: Code editor with Scribble syntax highlighting

**Features**:
- **Monaco Editor** (VS Code editor component) preferred
- Syntax highlighting for Scribble
- Line numbers enabled
- Error squiggles (inline error indicators)
- Auto-indentation (2 spaces)
- Dark theme (educational preference)
- Font: Monospace (Fira Code, JetBrains Mono, Monaco)

**Behavior**:
- Read/Write: Full editing capabilities
- Auto-save to localStorage (debounced 1s)
- Ctrl/Cmd+S: Trigger parse & verify

**Error Highlighting**:
- Red squiggles under parse errors
- Yellow squiggles under verification warnings
- Tooltip on hover with error message
- Click error → show details in bottom panel

**Content**: Full global protocol source code

---

#### 3.2.3 Right Pane: Local Scribble Projections

**Structure**: Role tabs + Editor tabs

```
┌────────────────────────────────────────────┐
│ Role Tabs: [Client] [Server] [DB]         │
├────────────────────────────────────────────┤
│ Editor Tabs: [Scribble] [TypeScript]      │
├────────────────────────────────────────────┤
│                                            │
│  Content Area (shows selected role/type)  │
│                                            │
└────────────────────────────────────────────┘
```

**Role Tabs**:
- Dynamically generated from parsed protocol roles
- Click to switch between roles
- Active tab highlighted
- Example: [Client] [Server] [DB]

**Editor Tabs (per role)**:

1. **Scribble Tab** (Default)
   - Shows local Scribble projection for selected role
   - Read-only (generated from global protocol)
   - Syntax highlighted
   - Example content:
     ```scribble
     // Client local protocol (projected from ThreeParty)
     Server!Request<Int>;      // Send Request to Server
     Server?Response<String>;  // Receive Response from Server
     ```
   - Format options:
     - Pure syntax (just the projection)
     - Annotated (with comments explaining each action)
     - Interactive highlighting (hover global line → highlight local line)

2. **TypeScript Tab**
   - Shows generated TypeScript code for selected role
   - **Status**: Disabled/hidden until Layer 6 (Code Generation) is implemented
   - Once implemented: Read-only, copy button, syntax highlighted
   - Example content (future):
     ```typescript
     // Generated TypeScript for Client
     export class ClientSession {
       async sendRequest(msg: Request<number>): Promise<void> { ... }
       async receiveResponse(): Promise<Response<string>> { ... }
     }
     ```

**Empty State**:
- Before projection: "Parse and verify protocol to see local projections"
- After projection: Show role tabs + content

**Educational Value**:
- **Perspective Transformation**: See how `A -> B: Msg` becomes:
  - A's view: `B!Msg` (I send to B)
  - B's view: `A?Msg` (I receive from A)
- **Choice Transformation**: See how choices become `⊕` (internal) or `&` (external)
- **Same Language**: Everything in Scribble, easier to understand than CFG or CFSM structures

---

#### 3.2.4 Bottom Panel: Verification Results

**Type**: Collapsible tabbed panel

**Tabs**:

1. **Verification Tab** (Default)
   - Shows results of all 20 verification checks
   - Grouped by priority: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
   - Each check: Icon (✓/✗/⚠) + description + status
   - Failed checks show error details with line numbers

2. **Parse Errors Tab**
   - Shows parser errors
   - Badge on tab: "Errors (N)" when N > 0
   - Each error: Line/column, message, code context
   - Click error → jump to line in editor

3. **Projection Summary Tab**
   - Shows projection statistics per role
   - Example:
     ```
     Available roles: 3

     ✓ Client: 5 states, 4 transitions
     ✓ Server: 8 states, 6 transitions
     ✓ DB: 3 states, 2 transitions
     ```

**Behavior**:
- Collapsed by default (maximize editor space)
- Expand when errors/warnings detected
- Click error → jump to line + highlight in editor
- Persist collapse state across sessions

**Visual Design**:
- Success: Green checkmark
- Error: Red X
- Warning: Yellow exclamation
- Info: Blue info icon

---

### 3.3 Interaction Patterns (CODE Tab)

**Workflow 1: Load and Verify Protocol**
```
1. User clicks "Examples" → "Two Buyer Protocol"
2. System loads protocol into global editor
3. User clicks "Parse" (or Ctrl+Enter)
4. System parses → generates CFG → shows role tabs
5. User clicks "Verify"
6. System runs verification → shows results in bottom panel
7. If errors: User clicks error → jumps to line → fixes
8. User re-parses and re-verifies
9. Once verified: User clicks "Project"
10. System generates CFSMs → populates local Scribble tabs
```

**Workflow 2: Explore Textual Projection**
```
1. User ensures protocol is projected
2. User clicks "Client" role tab
3. System shows Client's local Scribble
4. User sees: Server!Request<Int>; Server?Response<String>;
5. User hovers over global line: Client -> Server: Request<Int>
6. System highlights corresponding lines in Client and Server local tabs
7. User understands: Client sends (!), Server receives (?)
8. User clicks "Server" role tab
9. User sees: Client?Request<Int>; (same message, different perspective)
```

**Workflow 3: Fix Verification Errors**
```
1. User parses and verifies protocol
2. System detects choice determinism error
3. Bottom panel shows: "✗ Choice determinism: FAILED (line 15)"
4. User clicks error entry
5. System jumps to line 15 in global editor
6. System highlights problematic choice block
7. User sees: Two branches with same label "accept"
8. User fixes: Renames one branch to "accept_early"
9. User re-verifies
10. System shows: "✓ Choice determinism: PASSED"
```

---

## 4. Tab 2: SIMULATION

### 4.1 Layout Overview

```
┌──────────────────────────────────────────────────────────────┐
│  [ Code ] [ SIMULATION ]                                     │
│  Controls: [▶] [⏸] [⏭] [⏮] Speed: ●●●○○  Step: 5/100       │
│  Mode: ◉ CFSM (Async)  ○ CFG (Sync)                         │
│  Schedule: [Round-robin ▼]  Max Steps: [100]                │
│  Views: ☑ CFSM Network  ☑ Sequence  ☐ CFG Structure         │
├──────────────────────────────┬───────────────────────────────┤
│  CFSM Network (LEFT)         │  CFG Sequence (RIGHT)         │
│  (State Machines + Messages) │  (Execution Log, Dynamic)     │
│                              │                               │
│   ┌────────┐  ┌────────┐    │  Client  Server  DB           │
│   │ Client │  │ Server │    │    │      │      │            │
│   │  ●[S0] │  │  [S0]  │    │    ├─Req──>      │            │
│   │   │!   │  │   │?   │    │    │      ├─Qry──>            │
│   │  [S1]  │  │ ●[S1]  │    │  ▶ │      │<─Data─┘            │
│   │   │?   │  │   │!   │    │    │<─Res─┤      │            │
│   │  [S2]■ │  │  [S2]  │    │    │      │      │            │
│   └────────┘  └────────┘    │    (grows as simulation runs) │
│                              │                               │
│  ┌────────┐                 │                               │
│  │   DB   │                 │                               │
│  │  [S0]  │                 │                               │
│  │   │?   │                 │                               │
│  │  [S1]  │                 │                               │
│  │   │!   │                 │                               │
│  │  [S2]■ │                 │                               │
│  └────────┘                 │                               │
│                              │                               │
│  Messages in flight:         │                               │
│  Client ──[Req]──> Server    │                               │
│                              │                               │
│  Message Buffers:            │                               │
│  Server: [Req] ← from Client │                               │
└──────────────────────────────┴───────────────────────────────┘
├──────────────────────────────────────────────────────────────┤
│ Event Log:  Step 5: Server receives Request from Client      │
│ [Filter: All ▼] [Export: JSON ⬇]              [▼ Collapse]  │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Component Specifications

#### 4.2.1 Simulation Controls

**Location**: Top of SIMULATION tab

**Playback Controls**:
- **Play ▶**: Start auto-advance simulation
  - Disabled when: Protocol invalid, simulation complete, simulation running
- **Pause ⏸**: Pause auto-advance
  - Disabled when: Simulation not running
- **Step ⏭**: Advance one step manually
  - Disabled when: Simulation running, simulation complete
- **Reset ⏮**: Reset to initial state
  - Always enabled when protocol is valid

**Speed Control**:
- Slider: ●●●○○ (5 levels)
- Very Slow (1 step/2s), Slow (1 step/1s), Medium (1 step/500ms), Fast (1 step/250ms), Very Fast (1 step/100ms)

**Step Counter**:
- Format: "Step 5/100"
- Shows: Current step / Max steps
- Pulsing indicator when running

**Execution Mode**:
- ◉ CFSM (Async): Distributed simulation with message buffers
- ○ CFG (Sync): Synchronous global choreography

**Scheduling Strategy** (CFSM mode only):
- Dropdown: [Round-robin ▼] [Fair] [Random] [Manual]
- Round-robin: Rotate through roles
- Fair: Least-scheduled role goes next
- Random: Random role selection
- Manual: User selects which role executes next (requires pause)

**Max Steps**:
- Input field: [100]
- Prevents infinite loops in recursive protocols

**Choice Selector**:
- Appears when simulation reaches choice point
- Dropdown showing available branches
- User selects which branch to take
- Hidden when no choice pending

**Call Stack Display** (Sub-Protocol Support):
- Shows current protocol invocation hierarchy during simulation
- Appears when simulating protocols with `do` statements
- Updates in real-time as simulation enters/exits sub-protocols

**Visual Design**:
```
┌─────────────────────────────────────────────────┐
│ Call Stack:  Main → Authentication → TokenCheck │
│              ^^^^^                               │
│              Currently executing                 │
└─────────────────────────────────────────────────┘
```

**Compact View** (Limited Space):
```
┌──────────────────────────────┐
│ 🏷️ Main > Authentication > TokenCheck (depth: 3) │
└──────────────────────────────┘
```

**Detailed View** (Expanded):
```
┌──────────────────────────────────────────────────┐
│ Call Stack (depth: 3/10 max)                     │
├──────────────────────────────────────────────────┤
│ 3. ► TokenCheck(Client, Server)   [S2]  ← Active│
│ 2.   Authentication(A→Client, B→Server)  [S1]    │
│ 1.   Main(A, B, C)                      [S0]     │
└──────────────────────────────────────────────────┘
```

**Features**:
- **Hierarchy Display**: Shows breadcrumb trail of nested sub-protocols
- **Current Protocol**: Highlighted/bold to show which protocol is executing
- **Role Mappings**: Shows role substitution for each sub-protocol call
  - Example: `Authentication(A→Client, B→Server)` shows role `A` from parent mapped to `Client` in sub-protocol
- **Current State**: Shows current state per protocol level (e.g., `[S2]`)
- **Depth Counter**: Shows current depth / max depth (helps prevent infinite recursion)
- **Click to Navigate**: Click any level to jump to that protocol's definition in CODE tab
- **Color Coding**:
  - Active (current): Green background
  - Parent: Gray/dimmed
  - Root: Blue accent

**Interaction**:
- **Hover**: Show full protocol signature and role mappings in tooltip
- **Click**: Jump to that protocol level in CODE tab editor
- **Right-click**: Context menu with options:
  - "View Protocol Definition"
  - "View at This Level" (collapse deeper calls)
  - "Copy Call Stack"

**Behavior During Simulation**:

1. **Entering Sub-Protocol**:
   ```
   Before:  Main [S5]
   After:   Main > Authentication [S0]
   ```
   - Push new level onto call stack
   - Highlight new active protocol
   - Show entry transition in sequence diagram

2. **Exiting Sub-Protocol**:
   ```
   Before:  Main > Authentication [S_End]
   After:   Main [S6]
   ```
   - Pop level from call stack
   - Return to parent protocol
   - Highlight parent as active
   - Show exit transition in sequence diagram

3. **Nested Sub-Protocols** (3+ levels):
   ```
   Main > Auth > TokenValidation > SignatureCheck
   ```
   - Show full hierarchy
   - Truncate with ellipsis if too deep: `Main > ... > SignatureCheck (depth: 5)`
   - Provide scrollable dropdown to see full stack

4. **Recursive Sub-Protocols**:
   ```
   Main > ProcessList > ProcessList > ProcessList (depth: 3)
   ```
   - Show recursion depth explicitly
   - Warn if approaching max depth: ⚠️ `(depth: 8/10)`
   - Error and halt if max depth exceeded

**State Management**:
- **Store**: `callStack: Array<{protocol: string, roleMap: Record<string, string>, state: string}>`
- **Update on**: `do` statement execution (push), sub-protocol completion (pop)
- **Reset on**: Simulation reset

**Educational Value**:
- **Visualizes Composition**: Shows how protocols build on each other
- **Role Mapping Clarity**: Explicitly shows which roles map to which
- **Execution Context**: Always know "where am I" in complex nested protocols
- **Debugging Aid**: Track call flow, identify infinite recursion
- **Tail Recursion**: Verify tail-recursive constraint (no actions after `do` for involved roles)

**Warning/Error Display**:
- **Max Depth Warning**: `⚠️ Call stack approaching max depth (8/10). Consider increasing max depth or checking for infinite recursion.`
- **Tail Recursion Violation**: `⚠️ Action after 'do' for involved role detected. Protocol may not be tail-recursive.`
- **Max Depth Exceeded**: `❌ Call stack max depth (10) exceeded. Simulation halted. Check for infinite recursion.`

---

#### 4.2.2 View Selection

**Purpose**: Let users choose which visualizations to display (1-3)

```
Views: ☑ CFSM Network  ☑ Sequence  ☐ CFG Structure
```

**Three Visualization Options**:

1. **CFSM Network** (Default ✓)
   - Network of state machines
   - All roles visible simultaneously
   - Message buffers and messages in flight
   - Current states highlighted

2. **CFG Sequence** (Default ✓)
   - UML-style sequence diagram
   - Swimming lanes (one per role)
   - Execution trace grows as simulation runs
   - DYNAMIC: Generated during execution

3. **CFG Structure** (Optional ☐)
   - Control flow graph
   - Shows protocol structure (not execution)
   - Nodes: Message, Choice, Parallel, Rec, Continue
   - STATIC: Generated at parse time
   - Shows cycles and branches

**Layout Rules**:
- Minimum 1 selected (can't hide all)
- Maximum 3 selected (all visible)
- Arrangement:
  - 1 view: Full width
  - 2 views: 50/50 split (horizontal)
  - 3 views: 33/33/33 split (horizontal) OR 50% top + 25%/25% bottom

**Default**: CFSM Network (left) + CFG Sequence (right)

**Rationale**:
- CFSM Network shows distributed state
- Sequence diagram shows execution history
- Together: "What's happening now" + "What happened so far"

---

#### 4.2.3 CFSM Network Visualization (LEFT Pane)

**Purpose**: Show distributed execution with state machines and message buffers

**Layout**: Grid of state machine diagrams (one per role)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Role: Client │  │ Role: Server │  │ Role: DB     │
│   ●─[S0]     │  │   [S0]       │  │   [S0]       │
│    │ !Req    │  │    │ ?Req    │  │    │ ?Qry    │
│    ↓         │  │    ↓         │  │    ↓         │
│   [S1]       │  │   ●[S1]      │  │   [S1]       │
│    │ ?Resp   │  │    │ !Qry    │  │    │ !Data   │
│    ↓         │  │    ↓         │  │    ↓         │
│   [S2] ■     │  │   [S2]       │  │   [S2] ■     │
│              │  │    │ ?Data   │  │              │
│              │  │    ↓         │  │              │
│              │  │   [S3]       │  │              │
│              │  │    │ !Resp   │  │              │
│              │  │    ↓         │  │              │
│              │  │   [S4] ■     │  │              │
└──────────────┘  └──────────────┘  └──────────────┘

Messages in Flight:  Client ──[Req]──> Server

Message Buffers:
  Server: [Req] ← from Client (FIFO)
  DB: (empty)
```

**Visual Elements**:

**State Machines**:
- Each role in a bordered box
- States: Circles (● = current, ○ = visited, □ = unvisited, ■ = terminal)
- Transitions: Arrows with action labels
  - !Label = Send
  - ?Label = Receive
  - τ = Tau (internal action)
  - ⊕ = Internal choice
  - & = External choice
- Current state: Pulsing bright highlight (#667eea)
- Enabled transitions: Bright green (#10b981)
- Disabled transitions: Dim gray (#4b5563)

**Messages in Flight**:
- Animated arrows between role boxes
- Label shows message name
- Motion blur during animation

**Message Buffers**:
- Queue display under each role box
- Format: "Role: [Msg1] [Msg2] [Msg3] ← from Sender (FIFO)"
- First message is head of queue (will be consumed next)
- Color-coded by sender

**Role Status**:
- ✓ Complete (reached terminal state)
- ▶ Running (has enabled transitions)
- ⏸ Blocked (waiting for message)
- ⚠ Deadlocked (no enabled transitions, not complete)

**Interactions**:
- Hover state: Show state ID, reachable states
- Hover transition: Show full action details (type, from/to, label, payload)
- Click role box: Focus (dim others)
- Click enabled transition (manual mode): Execute that transition

**Data Source**: DistributedSimulator events
**Updates**: Real-time during simulation

---

#### 4.2.4 CFG Sequence Diagram (RIGHT Pane)

**Purpose**: Show execution trace as UML-style sequence diagram

**Layout**: Vertical swimming lanes (one per role)

```
Client    Server    DB
  │         │       │
  ├─Req(id)─>       │     Step 1: Client sends Request
  │         ├─Qry(id)>     Step 2: Server sends Query
  │         │<─Data─┘      Step 3: DB sends Data
▶ │<─Resp───┤       │     Step 4: Server sends Response (CURRENT)
  │         │       │
  ↓         ↓       ↓
(continues as simulation runs)
```

**Visual Elements**:

**Role Lanes**:
- Role names at top
- Vertical dashed lifelines
- Equal width per lane

**Messages**:
- Horizontal arrows between lanes
- Direction shows sender → receiver
- Label shows message name (and payload type)
- Current step: Bright highlight with ▶ marker
- Past steps: Dimmed (#6b7280)
- Future steps: Not shown (diagram grows dynamically!)

**Key Insight**:
- **DYNAMIC**: This diagram is built as simulation runs
- **Grows Incrementally**: Each step adds a new message arrow
- **Execution Log**: Like a visual trace of what happened

**Contrast with CFG Structure**:
- Sequence diagram: Shows actual execution (dynamic)
- CFG Structure: Shows possible paths (static)

**Interactions**:
- Hover message: Show details (payload, timestamp)
- Click message: Jump to that step
- Auto-scroll to current step
- Zoom/pan for large diagrams

**Data Source**:
- CFG mode: CFGSimulator events
- CFSM mode: DistributedSimulator events (converted to sequence view)

**Updates**: Append new message on each step

---

#### 4.2.5 CFG Structure Graph (OPTIONAL Third Pane)

**Purpose**: Show static control flow structure of protocol

**Layout**: Hierarchical or force-directed graph

```
    [Start]
       │
    [Choice]
      /  \
   [A→B] [A→C]
      \  /
    [Merge]
       │
    [Rec X]
       │
    [B→C]
       │
   [Continue X] ──┐  ← Cycle (loop back)
       ↑          │
       └──────────┘
```

**Node Types**:
- **Message**: A → B: Label
- **Choice**: Diamond shape (branching point)
- **Merge**: Join point after choice
- **Fork**: Parallel start
- **Join**: Parallel end
- **Rec**: Recursion label
- **Continue**: Loop back to rec
- **Terminal**: End

**Visual Design**:
- Color-coded by node type
- Edges: Solid arrows for control flow
- Cycles: Clearly visible (rec → continue loops back)
- Current node (during sim): Highlighted

**Key Insight**:
- **STATIC**: Generated at parse time, doesn't change
- Shows ALL possible paths (not just executed path)
- Shows cycles as actual cycles (doesn't unroll)

**Interactions**:
- Hover node: Show details (type, action, line number)
- Click node: Jump to line in code editor
- Expand/collapse recursive blocks
- Zoom/pan

**Data Source**: CFG data structure (built at parse time)
**Updates**: Only when protocol re-parsed

---

#### 4.2.6 Bottom Panel: Event Log

**Purpose**: Show detailed execution trace

**Content**:
```
Event Log:  139 events

Step 1: Client sends Request<Int> to Server
Step 2: Server receives Request<Int> from Client (from buffer)
Step 3: Server sends Query<Int> to DB
Step 4: DB receives Query<Int> from Server
Step 5: ▶ DB sends Data<String> to Server (CURRENT)

[Filter: All ▼] [Export: JSON ⬇] [Copy] [Clear]
```

**Features**:

**Filtering**:
- By role: [All] [Client] [Server] [DB]
- By event type: [All] [Send] [Receive] [Transition] [Buffer] [Deadlock]

**Export**:
- JSON: Full trace with timestamps
- CSV: Tabular format
- Copy to clipboard

**Behavior**:
- Auto-scrolls to current event
- Click event → jump to that step in simulation
- Collapsible to save space

**Data Source**: Simulator trace recording

---

### 4.3 Simulation Modes

#### 4.3.1 CFG Simulation (Synchronous)

**Characteristics**:
- Global coordinator walks through CFG
- Messages delivered synchronously (send = immediate receive)
- Total order of events
- No message buffers

**Use Case**: Teaching global choreography semantics

**Visualizations**:
- CFG Sequence: Shows message flow
- CFG Structure: Current node highlighted

**Event Types**:
- step-start, step-end
- message (send+receive combined)
- choice-selected
- parallel-fork, parallel-join
- recursion-enter, recursion-exit
- complete

#### 4.3.2 CFSM Simulation (Asynchronous)

**Characteristics**:
- Distributed execution (coordinator mediates but each role isolated)
- Messages buffered (FIFO per sender-receiver pair)
- Partial order of events
- Send non-blocking, receive blocks if buffer empty

**Use Case**: Teaching distributed execution semantics

**Visualizations**:
- CFSM Network: Shows state machines + buffers
- CFG Sequence: Shows message flow over time

**Event Types**:
- step-start, step-end (per role)
- send, receive (separate events)
- transition-fired
- buffer-enqueue, buffer-dequeue
- tau (internal transition)
- choice (internal ⊕ or external &)
- deadlock (distributed deadlock detected)
- complete

**Scheduling Strategies**:
- Round-robin: Roles execute in rotation
- Fair: Least-scheduled role goes next
- Random: Random role selection
- Manual: User selects next role

---

### 4.4 Interaction Patterns (SIMULATION Tab)

**Workflow 1: Step Through Execution**
```
1. User switches to SIMULATION tab
2. System loads protocol (already parsed/verified/projected)
3. User clicks "Step" (⏭)
4. System executes one transition (in selected mode)
5. Visualizations update:
   - CFSM Network: Current state changes
   - Sequence Diagram: New message arrow appears
6. Event log shows: "Step 1: Client sends Request to Server"
7. User clicks "Step" again
8. Repeat until protocol completes
```

**Workflow 2: Automatic Execution**
```
1. User sets speed to "Medium" (●●●○○)
2. User clicks "Play" (▶)
3. System starts auto-advance (1 step per 500ms)
4. Visualizations animate
5. User observes distributed execution
6. User clicks "Pause" (⏸) to stop and inspect state
7. User clicks "Reset" (⏮) to start over
```

**Workflow 3: Compare Sync vs Async**
```
1. User sets mode to "CFG (Sync)"
2. User runs simulation to completion
3. User notes: All messages delivered immediately
4. User clicks "Reset"
5. User sets mode to "CFSM (Async)"
6. User runs simulation again
7. User observes: Messages buffered, roles proceed independently
8. User understands: Asynchronous semantics allow more concurrency
```

**Workflow 4: Explore Choice Points**
```
1. User runs simulation
2. System reaches choice point (e.g., accept vs reject)
3. System pauses, shows choice selector dropdown
4. User selects "accept" branch
5. System executes choice, continues simulation
6. Later: User resets and tries "reject" branch
7. User sees different execution path
```

**Workflow 5: Inspect Message Buffers**
```
1. User runs CFSM simulation
2. Client sends multiple messages before Server receives
3. CFSM Network shows: Server buffer: [Req1] [Req2] [Req3]
4. User pauses simulation
5. User hovers over buffer
6. Tooltip shows: "3 messages queued, FIFO order"
7. User steps forward
8. Server receives Req1 (head of queue)
9. Buffer updates: [Req2] [Req3]
```

---

## 5. Common Components

### 5.1 Header

**Location**: Top of all views (fixed)

**Left Section**:
- Logo/Title: "Scribble MPST IDE"
- Version badge: "v2.0"

**Center Section**:
- File menu: [New] [Open] [Save] [Save As]
- Examples menu: Dropdown with example protocols
  - Two Buyer Protocol
  - Three Buyer Protocol
  - Streaming Protocol
  - Recursive Protocol
  - OAuth Flow
  - Two-Phase Commit
  - etc.

**Right Section**:
- Help: [Documentation] [Tutorial] [About]
- Documentation quick links:
  - MPST Theory Primer
  - Scribble Syntax Reference
  - Projection Rules
  - Simulation Guide

**Behavior**:
- Always visible (fixed header)
- Examples: Click → Load into global editor (confirm if unsaved changes)
- Documentation: Opens in new tab or modal

---

### 5.2 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Global** |
| Ctrl/Cmd+N | New protocol |
| Ctrl/Cmd+O | Open file |
| Ctrl/Cmd+S | Save |
| Ctrl/Cmd+1 | Switch to CODE tab |
| Ctrl/Cmd+2 | Switch to SIMULATION tab |
| F1 | Help |
| **CODE Tab** |
| Ctrl/Cmd+Enter | Parse & Verify |
| Ctrl/Cmd+Shift+V | Verify only |
| Ctrl/Cmd+Shift+P | Project |
| Ctrl/Cmd+/ | Toggle verification panel |
| **SIMULATION Tab** |
| Space | Play/Pause |
| → | Step forward |
| ← | Step backward (if history enabled) |
| Ctrl/Cmd+R | Reset simulation |
| Ctrl/Cmd+Shift+/ | Toggle event log |

---

### 5.3 Notification System

**Type**: Toast notifications (top-right corner)

**Types**:
- Success (green): "Protocol parsed successfully"
- Error (red): "Parse failed: 3 errors"
- Warning (yellow): "Unsaved changes will be lost"
- Info (blue): "Simulation started"

**Duration**:
- Success/Info: 3s
- Warning/Error: 5s or manual dismiss

**Behavior**:
- Non-blocking
- Stack vertically (max 3 visible)
- Click to dismiss
- Auto-dismiss after duration

---

## 6. State Management

### 6.1 Application State

```typescript
interface ApplicationState {
  // Editor state
  editor: {
    globalProtocol: string;
    currentTab: 'code' | 'simulation';
    isDirty: boolean;
  };

  // Parse state
  parse: {
    status: 'idle' | 'parsing' | 'success' | 'error';
    errors: ParseError[];
    ast: ProtocolAST | null;
    cfg: CFG | null;
    roles: string[];
  };

  // Verification state
  verification: {
    status: 'idle' | 'running' | 'complete';
    results: VerificationResult[];  // 20 checks (P0-P3)
    overall: 'passed' | 'failed' | 'not_run';
  };

  // Projection state
  projection: {
    status: 'idle' | 'running' | 'complete';
    cfsms: Map<string, CFSM>;  // role → CFSM
    localScribble: Map<string, string>;  // role → local Scribble text
    typescript: Map<string, string>;  // role → TS code (Layer 6)
  };

  // Simulation state
  simulation: {
    mode: 'cfg' | 'cfsm';
    status: 'idle' | 'running' | 'paused' | 'complete';
    step: number;
    maxSteps: number;
    speed: 1 | 2 | 3 | 4 | 5;  // Very Slow to Very Fast
    schedulingStrategy: 'round-robin' | 'fair' | 'random' | 'manual';

    // CFG simulation state
    cfgState: {
      currentNode: string;
      visitedNodes: string[];
      messageTrace: Message[];
    };

    // CFSM simulation state
    cfsmState: {
      roleStates: Map<string, string>;  // role → current state ID
      messageBuffers: Map<string, Message[]>;  // role → buffer
      inFlightMessages: Message[];
      enabledRoles: string[];
    };

    // Trace
    trace: TraceEvent[];
  };

  // UI state
  ui: {
    code: {
      activeRoleTab: string;  // 'Client', 'Server', etc.
      activeEditorTab: 'scribble' | 'typescript';
      verificationPanelCollapsed: boolean;
    };

    simulation: {
      activeViews: Set<'cfsm' | 'sequence' | 'structure'>;  // 1-3 selected
      eventLogCollapsed: boolean;
      eventLogFilter: {
        role: string | 'all';
        type: string | 'all';
      };
    };
  };
}
```

### 6.2 State Flow

```
User Action (e.g., click Parse)
    ↓
Action Dispatched
    ↓
State Updated (parse.status = 'parsing')
    ↓
UI Re-renders (button disabled, loading indicator)
    ↓
Side Effect (run parser)
    ↓
Parser Result
    ↓
State Updated (parse.status = 'success', parse.cfg = ...)
    ↓
UI Re-renders (enable Verify button, show role tabs)
```

---

## 7. Data Flow & Integration

### 7.1 Parser Integration

**Input**: Global Scribble source (string)

**Process**:
1. Lexer → Tokens
2. Parser → AST
3. CFG Builder → CFG

**Output**:
```typescript
interface ParseResult {
  success: boolean;
  ast?: ProtocolAST;
  cfg?: CFG;
  roles?: string[];
  errors?: ParseError[];
}
```

**UI Response**:
- Success: Update status, generate role tabs, enable Verify
- Failure: Show errors in bottom panel, highlight in editor

---

### 7.2 Verification Integration

**Input**: CFG

**Process**: Run 20 verification checks (P0-P3)

**Output**:
```typescript
interface VerificationResult {
  check: string;  // 'deadlock', 'liveness', 'choice-determinism', etc.
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  passed: boolean;
  errors?: VerificationError[];
  warnings?: Warning[];
}
```

**UI Response**:
- Display results in Verification tab (grouped by priority)
- Update header status indicator
- Enable/disable Project button

---

### 7.3 Projection Integration

**Input**: CFG + role names

**Process**:
1. For each role: Project CFG → CFSM
2. Generate local Scribble text (textual representation)
3. (Layer 6) Generate TypeScript code

**Output**:
```typescript
interface ProjectionResult {
  role: string;
  cfsm: CFSM;
  localScribble: string;  // Textual projection
  typescript?: string;  // Layer 6
  stats: {
    stateCount: number;
    transitionCount: number;
  };
}
```

**UI Response**:
- Populate local Scribble tabs
- Enable SIMULATION tab
- Show projection summary

---

### 7.4 Simulation Integration

**CFG Simulation**:
- Input: CFG + config
- Process: CFGSimulator.step()
- Output: CFGStepResult (current node, events, trace)

**CFSM Simulation**:
- Input: Map<role, CFSM> + config
- Process: DistributedSimulator.step()
- Output: DistributedStepResult (role states, messages, trace)

**UI Response**:
- Update visualizations
- Append to event log
- Update step counter
- Highlight current states/nodes

---

## 8. Visual Design Guidelines

### 8.1 Color Semantics

**Status Colors**:
- Success: #10b981 (green)
- Error: #ef4444 (red)
- Warning: #f59e0b (amber)
- Info: #3b82f6 (blue)
- Neutral: #6b7280 (gray)

**Simulation Colors**:
- Current state: #667eea (bright blue, pulsing)
- Enabled: #10b981 (green)
- Disabled: #4b5563 (dim gray)
- Complete: #10b981 (green)
- Deadlocked: #ef4444 (red)

**Role Colors** (consistent across all views):
- Assign each role a distinct color from palette
- Use for: State machine boxes, sequence diagram lanes, event log

### 8.2 Typography

**Font Families**:
- UI: System font stack (SF Pro, Segoe UI, Roboto)
- Code: Monospace (Fira Code, JetBrains Mono, Monaco)

**Hierarchy**:
- H1 (Header): 24px, bold
- H2 (Section): 18px, semi-bold
- H3 (Subsection): 16px, semi-bold
- Body: 14px, regular
- Small: 12px, regular
- Code: 13px, monospace

### 8.3 Spacing

**Base Unit**: 4px (0.25rem)

**Common Spacings**:
- XS: 4px
- S: 8px
- M: 16px
- L: 24px
- XL: 32px

**Component Padding**:
- Buttons: 8px 16px
- Tabs: 12px 16px
- Panels: 16px
- Editor: 16px

### 8.4 Animation

**Principles**:
- Subtle and purposeful
- Duration: 150-300ms
- Easing: ease-in-out

**Use Cases**:
- Tab switch: 200ms fade
- Panel collapse: 300ms slide
- Notification: 200ms fade + slide
- Simulation step: 300ms highlight
- Message animation: 500ms (based on speed setting)
- State transition: 300ms color change

---

## 9. Accessibility

### 9.1 Keyboard Navigation

- All interactive elements keyboard accessible
- Clear focus indicators
- Logical tab order
- Skip links for main sections

### 9.2 Screen Reader Support

- Semantic HTML (button, nav, main, article)
- ARIA labels on icon-only buttons
- ARIA live regions for dynamic content
- Alt text for visual elements

### 9.3 Visual Accessibility

- Contrast ratio: 4.5:1 for text, 3:1 for UI
- Color not sole indicator (use icons + text)
- Resizable text (up to 200%)
- Visible focus indicators

---

## 10. Error States & Empty States

### 10.1 Empty States

**CODE Tab**:
- Before protocol loaded: "Load an example or create a new protocol"
- Before projection: "Parse and verify to see local projections"

**SIMULATION Tab**:
- Before protocol ready: "Parse, verify, and project protocol to simulate"
- Before simulation started: "Click Play to start simulation"

### 10.2 Error States

**Parse Failed**:
- Inline squiggles in editor
- Errors tab shows details
- Status: "Parse Error" (red)

**Verification Failed**:
- Verification tab shows failed checks
- Status: "Verification Failed" (red)
- Simulation disabled

**Simulation Deadlock**:
- Visualizations show deadlock state
- Event log: "Deadlock detected at step N"
- Status: "Deadlocked" (red)

---

## 11. Performance Considerations

### 11.1 Editor Performance

- Large files: Handle up to 10,000 lines
- Syntax highlighting: Async (Web Worker)
- Parse debouncing: 500ms after last edit

### 11.2 Visualization Performance

- Canvas rendering for >100 nodes
- Animation: RequestAnimationFrame
- Lazy rendering for large graphs

### 11.3 Simulation Performance

- Max steps limit (prevent infinite loops)
- Trace recording: Optional (can disable)
- Event log: Virtual scrolling for >1000 events

---

## 12. Implementation Phases

### Phase 1: CODE Tab - Core Editor (4 weeks)
- Global Scribble editor (Monaco integration)
- Parse button + status indicator
- Inline error highlighting
- Bottom panel: Verification results

### Phase 2: CODE Tab - Local Projections (3 weeks)
- Role tabs (dynamic generation)
- Local Scribble display
- Projection summary
- Interactive highlighting (global ↔ local)

### Phase 3: SIMULATION Tab - CFSM Network (4 weeks)
- CFSM state machine rendering (D3.js)
- Message buffers visualization
- Real-time updates from DistributedSimulator
- Simulation controls

### Phase 4: SIMULATION Tab - CFG Sequence (3 weeks)
- Sequence diagram rendering
- Dynamic growth during simulation
- Animation
- Sync with CFSM Network

### Phase 5: SIMULATION Tab - CFG Structure (2 weeks)
- Static CFG graph rendering
- Hierarchical layout
- Node interaction
- Optional third pane

### Phase 6: Polish & Integration (3 weeks)
- Keyboard shortcuts
- Notifications
- Accessibility
- Performance optimization
- User testing
- Bug fixes

### Phase 7: Layer 6 Integration (Future)
- TypeScript generation
- Code preview
- Export functionality

**Total Estimated Timeline**: ~20 weeks for Phases 1-6

---

## 13. Technology Stack

### 13.1 Frontend Framework

- **Svelte 4** (or SvelteKit): Reactive UI
- **TypeScript**: Type safety
- **Vite**: Build tool

### 13.2 Editor

- **Monaco Editor** (preferred): Full VS Code editor
  - Syntax highlighting (custom Scribble language)
  - Error squiggles
  - Go-to-definition
  - Keyboard shortcuts
- **Alternative**: CodeMirror 6 (lighter weight)

### 13.3 Visualization

- **D3.js v7**: Graph rendering, layouts, animations
- **D3-force**: Physics simulation for CFSM layout
- **D3-hierarchy**: Tree layouts for CFG
- **Custom SVG**: State machine diagrams

### 13.4 State Management

- **Svelte Stores**: Reactive state
- **LocalStorage**: Persist user preferences
- **IndexedDB** (optional): Persist protocols

### 13.5 Styling

- **TailwindCSS** (optional): Utility-first CSS
- **CSS Variables**: Theme customization
- **Dark theme**: Default

---

## 14. Open Questions & Future Enhancements

### 14.1 Open Questions

1. Should we support editing local Scribble (round-trip)?
2. How to handle protocols with 10+ roles? (scrolling, zooming, filtering)
3. Should TypeScript tab show skeleton code before Layer 6 is built?
4. Export formats: JSON, PNG, SVG, PDF?

### 14.2 Future Enhancements

1. **Collaborative Editing**: Real-time multi-user editing
2. **Protocol Library**: Community-shared protocols
3. **Version Control**: Git integration
4. **WebRTC Testing**: Run protocols in distributed browser tabs
5. **Performance Profiling**: Identify protocol bottlenecks
6. **Custom Visualizations**: Plugin architecture for custom views
7. **Mobile Support**: Responsive design for tablets/phones

---

## 15. Comparison with v1.0

### Major Changes from v1.0

| Aspect | v1.0 | v2.0 |
|--------|------|------|
| **Top-level tabs** | Workspace tabs (Global, Alice, Bob) | Two tabs (CODE, SIMULATION) |
| **Mental model** | Mixed authoring + visualization | Separate authoring from execution |
| **Local protocols** | Read-only Scribble in workspace tabs | Read-only Scribble in CODE tab right pane |
| **TypeScript** | Sub-tab in editor | Sub-tab in local protocol pane |
| **Visualization** | Single view per workspace tab | 1-3 configurable views |
| **Sequence diagram** | Not specified | Dynamic execution log |
| **CFG structure** | Not specified | Static control flow graph |
| **Simulation mode** | Not specified | CFG (sync) vs CFSM (async) |
| **Educational focus** | Implicit | Explicit (teaching MPST theory) |

### Why v2.0 is Better

1. **Clear Separation**: CODE vs SIMULATION aligns with user intent
2. **Educational Clarity**: Each view teaches a specific concept
3. **Textual Projection**: Local Scribble shows perspective transformation
4. **Dynamic vs Static**: Sequence diagram (execution) vs CFG structure (control flow)
5. **Flexibility**: 1-3 configurable visualization panes

---

## 16. Sub-Protocol Support

### 16.1 Overview

**Sub-protocols** (invoked via `do` statements) are a key feature of Scribble that allows protocol composition and reusability. The UI must support viewing, editing, and simulating protocols that use sub-protocol invocation.

**Syntax**:
```scribble
do SubProtocol(A as X, B as Y);
```

**Semantics**:
- Invokes `SubProtocol` inline with role substitution
- Role `X` in `SubProtocol` is replaced by role `A` in the calling context
- Role `Y` in `SubProtocol` is replaced by role `B` in the calling context
- Must be tail-recursive per role (no actions after `do` for involved roles)

**Current Implementation Status**:
- ✅ Parser: Supports `do` statement syntax
- ✅ AST: Has `Do` node type
- ⚠️ CFG Builder: Creates placeholder action node (not fully expanded)
- ❌ Projection: No special handling (treats as regular action)
- ❌ Simulation: Placeholder only (doesn't execute sub-protocol)

### 16.2 UI Requirements for Sub-Protocols

#### 16.2.1 CODE Tab - Global Scribble Editor

**Syntax Highlighting**:
- Highlight `do` keyword
- Highlight sub-protocol name (different color from role names)
- Highlight role arguments with substitution syntax (`A as X`)

**Auto-Completion**:
- Show available sub-protocols in dropdown when typing `do`
- Show role substitution help: `Protocol(RoleInCurrent as RoleInSub)`

**Navigation**:
- Ctrl+Click on sub-protocol name → Jump to sub-protocol definition
- Breadcrumbs: Show protocol hierarchy (Main → SubProtocol → NestedSubProtocol)

**Validation**:
- Inline error if sub-protocol doesn't exist
- Inline error if role substitution is invalid (wrong arity, undefined roles)
- Inline warning if not tail-recursive (action after `do` for involved role)

**Example**:
```scribble
global protocol Main(role A, role B, role C) {
  Init() from A to B;
  do Authentication(A as Client, B as Server);  // ← Sub-protocol invocation
  Data() from A to C;
}

global protocol Authentication(role Client, role Server) {
  Request() from Client to Server;
  Challenge() from Server to Client;
  Response() from Client to Server;
}
```

---

#### 16.2.2 CODE Tab - Local Scribble Projections

**Projection Strategy**:

When projecting a `do` statement, the UI should show one of these approaches:

**Option A: Show as call (simple)**:
```scribble
// Client local protocol
Server!Init;
do Authentication(A as Client, B as Server);  // Call to sub-protocol
C!Data;
```

**Option B: Expand inline (educational)**:
```scribble
// Client local protocol
Server!Init;
// --- BEGIN Authentication ---
Server!Request;
Server?Challenge;
Server!Response;
// --- END Authentication ---
C!Data;
```

**Option C: Toggle view (flexible)**:
- Default: Show as call
- Click to expand inline
- Annotations show role mappings

**Recommendation**: Option C (toggle) for educational flexibility

---

#### 16.2.3 CODE Tab - Sub-Protocol Library

**New Component**: Sub-Protocol Browser (optional sidebar or modal)

**Features**:
- List all protocols defined in current workspace
- Tree view showing invocation hierarchy:
  ```
  ▼ Main
    ├─ Authentication
    │   └─ TokenValidation
    └─ DataTransfer
  ```
- Click protocol → Show definition in new tab or split pane
- Search/filter by protocol name
- Show which protocols invoke which (dependency graph)

**Integration**:
- Parse all `global protocol` declarations in editor
- Build protocol registry
- Update when editor content changes
- Show errors if protocol is invoked but not defined

---

#### 16.2.4 SIMULATION Tab - CFG Structure Visualization

**Do Nodes**:

Currently, `do` statements create placeholder action nodes in CFG:
```
from: '__do__'
to: '__do__'
label: 'do Authentication(A as Client, B as Server)'
```

**Visualization Options**:

**Option A: Show as special node (current)**:
```
┌──────────────────┐
│  [Init A→B]      │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ ◆ Do:            │
│ Authentication   │
│ (A→Client,       │
│  B→Server)       │
└────────┬─────────┘
         ↓
┌──────────────────┐
│  [Data A→C]      │
└──────────────────┘
```

**Option B: Expand inline (educational)**:
```
┌──────────────────┐
│  [Init A→B]      │
└────────┬─────────┘
         ↓
┌────────────────────────┐
│ ┏━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Authentication:   ┃ │
│ ┃ [Request A→B]     ┃ │
│ ┃      ↓            ┃ │
│ ┃ [Challenge B→A]   ┃ │
│ ┃      ↓            ┃ │
│ ┃ [Response A→B]    ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━┛ │
└────────┬───────────────┘
         ↓
┌──────────────────┐
│  [Data A→C]      │
└──────────────────┘
```

**Option C: Collapsible (flexible)**:
- Default: Show as special node (▶ Do: Authentication)
- Click to expand inline (▼ Do: Authentication with nested nodes)
- Double border or different color for expanded sub-protocol

**Recommendation**: Option C (collapsible) for clarity without clutter

**Visual Design**:
- Do nodes: Diamond shape (◆) to distinguish from regular actions
- Color: Different color (e.g., purple) to stand out
- Label: Show protocol name + role mappings
- Tooltip: Show full sub-protocol definition

**Breadcrumbs Navigation**:
- Display protocol hierarchy at top of CFG Structure view
- Example: `Main → Authentication → TokenValidation`
- Click any breadcrumb → Jump to that protocol level
- Current protocol highlighted in breadcrumb trail
- Updates automatically when expanding/collapsing Do nodes

```
┌─────────────────────────────────────────────────┐
│ Breadcrumbs: Main > Authentication              │
├─────────────────────────────────────────────────┤
│ CFG Structure Visualization                     │
│ (showing expanded Authentication sub-protocol)  │
└─────────────────────────────────────────────────┘
```

**Benefits**:
- Always know current context (which protocol being viewed)
- Easy navigation back to parent protocols
- Visual hierarchy of protocol composition

---

#### 16.2.5 SIMULATION Tab - CFG Sequence Diagram

**During Execution**:

When simulation reaches a `do` statement, show:

**Option A: Single message line**:
```
Client    Server
  │         │
  ├─Init────>
  │◆ do Authentication
  │         │
  ├─Data────>
```

**Option B: Expanded sequence**:
```
Client    Server
  │         │
  ├─Init────>
  ├─┬─────────────────┐
  │ │ Authentication  │
  │ ├─Request────────>│
  │ │<─Challenge──────┤
  │ ├─Response───────>│
  │ └─────────────────┘
  ├─Data────>
```

**Option C: Indented sub-section**:
```
Client    Server
  │         │
  ├─Init────>
  │┌──────┐ │
  ││ Auth.││ │
  │├─Req──>│ │
  ││<─Chal─┤ │
  │├─Resp─>│ │
  │└──────┘ │
  ├─Data────>
```

**Recommendation**: Option B (expanded with border) for clarity

**Visual Design**:
- Border around sub-protocol messages (boxed)
- Label at top: Sub-protocol name
- Indentation or color coding
- Optional: Collapse button to hide/show sub-protocol details

---

#### 16.2.6 SIMULATION Tab - CFSM Network

**Sub-Protocol States**:

When CFSM includes projected sub-protocol, show:

**Option A: Flatten (simple)**:
- All states from sub-protocol merged into main CFSM
- No visual distinction

**Option B: Grouped states (educational)**:
```
┌──────────────────────┐
│  Client CFSM         │
│  [S0]                │
│   │!Init             │
│   ↓                  │
│  ┏━━━━━━━━━━━━━━━┓  │
│  ┃ Authentication  ┃  │
│  ┃  [S_Auth0]      ┃  │
│  ┃   │!Request     ┃  │
│  ┃   ↓             ┃  │
│  ┃  [S_Auth1]      ┃  │
│  ┃   │?Challenge   ┃  │
│  ┃   ↓             ┃  │
│  ┃  [S_Auth2]      ┃  │
│  ┃   │!Response    ┃  │
│  ┃   ↓             ┃  │
│  ┗━━━━━━━━━━━━━━━┛  │
│  [S3]                │
│   │!Data             │
│   ↓                  │
│  [S4]■               │
└──────────────────────┘
```

**Option C: Call/Return (advanced)**:
- Show state with `call Authentication`
- Jump to separate CFSM visualization for Authentication
- Return to main CFSM after completion

**Recommendation**: Option B (grouped) for educational clarity

**Visual Design**:
- Nested box around sub-protocol states
- Different background color
- Label at top
- Clear entry and exit points

**Collapsible Sub-Protocol Sections**:

To manage complexity and reduce visual clutter when protocols have nested sub-protocols, the CFSM Network view supports collapsing/expanding sub-protocol sections:

**Collapsed View** (Default):
```
┌──────────────────────┐
│  Client CFSM         │
│  [S0]                │
│   │!Init             │
│   ↓                  │
│  ┏━━━━━━━━━━━━━━━┓  │
│  ┃ ▶ Authentication┃  │  ← Click to expand
│  ┃ (3 states)      ┃  │
│  ┗━━━━━━━━━━━━━━━┛  │
│  [S3]                │
│   │!Data             │
│   ↓                  │
│  [S4]■               │
└──────────────────────┘
```

**Expanded View**:
```
┌──────────────────────┐
│  Client CFSM         │
│  [S0]                │
│   │!Init             │
│   ↓                  │
│  ┏━━━━━━━━━━━━━━━┓  │
│  ┃ ▼ Authentication┃  │  ← Click to collapse
│  ┃  [S_Auth0]      ┃  │
│  ┃   │!Request     ┃  │
│  ┃   ↓             ┃  │
│  ┃  [S_Auth1]      ┃  │
│  ┃   │?Challenge   ┃  │
│  ┃   ↓             ┃  │
│  ┃  [S_Auth2]      ┃  │
│  ┃   │!Response    ┃  │
│  ┃   ↓             ┃  │
│  ┗━━━━━━━━━━━━━━━┛  │
│  [S3]                │
│   │!Data             │
│   ↓                  │
│  [S4]■               │
└──────────────────────┘
```

**Nested Sub-Protocols** (Multiple Levels):
```
┌──────────────────────┐
│  Client CFSM         │
│  [S0]                │
│   │!Init             │
│   ↓                  │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓
│  ┃ ▼ Authentication         ┃
│  ┃  [S_Auth0]               ┃
│  ┃   │!Request              ┃
│  ┃   ↓                      ┃
│  ┃  ┌─────────────────────┐ ┃
│  ┃  │ ▶ TokenValidation   │ ┃  ← Nested sub-protocol
│  ┃  │ (2 states)          │ ┃
│  ┃  └─────────────────────┘ ┃
│  ┃  [S_Auth2]               ┃
│  ┃   │!Response             ┃
│  ┃   ↓                      ┃
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
│  [S3]                │
└──────────────────────┘
```

**Interaction**:
- **Click header**: Toggle expand/collapse
- **Default state**: Collapsed (show summary)
- **Hover**: Show tooltip with sub-protocol signature
- **Visual indicator**: ▶ (collapsed) / ▼ (expanded)
- **State count**: Show number of states when collapsed
- **Synchronization**: Collapse state persists when switching between roles

**Benefits**:
- **Reduces clutter**: Focus on main protocol flow
- **Hierarchical exploration**: Expand only what you need to see
- **Performance**: Renders fewer nodes for complex protocols
- **Educational**: Emphasizes protocol composition boundaries

**Keyboard Shortcuts**:
- `Ctrl+Click` on sub-protocol header: Expand all nested sub-protocols
- `Alt+Click`: Collapse all sub-protocols
- `Space`: Toggle selected sub-protocol

---

### 16.3 Implementation Considerations

#### 16.3.1 Current Limitations

**CFG Builder**:
- Does NOT expand sub-protocols inline
- Creates placeholder action node with `from: '__do__'`
- No role substitution applied in CFG

**Projection**:
- Treats `do` nodes as regular actions
- Does NOT expand sub-protocol for role

**Simulation**:
- Cannot execute sub-protocols (just skips placeholder)
- No sub-protocol state tracking

#### 16.3.2 Required Backend Changes

To fully support sub-protocols in UI, backend needs:

1. **Protocol Registry**:
   - Parse all `global protocol` declarations
   - Build map: protocol name → AST
   - Detect mutual recursion

2. **CFG Builder Enhancement**:
   - Option to expand `do` statements inline (with role substitution)
   - Or keep as placeholder with metadata (expandable on demand)

3. **Projection Enhancement**:
   - Expand sub-protocol when projecting
   - Apply role substitution
   - Merge states into main CFSM

4. **Simulation Enhancement**:
   - Execute sub-protocol steps
   - Track call stack (for nested sub-protocols)
   - Handle recursive invocations

#### 16.3.3 UI-Only Approach (Interim Solution)

**Until backend fully supports sub-protocol expansion**:

1. **Parse all protocols** in editor
2. **Build protocol registry** in UI state
3. **Syntax highlighting and navigation** works
4. **Visualizations show placeholder** (special Do nodes)
5. **Warn user** that simulation doesn't expand sub-protocols yet

**User Experience**:
- "⚠️ This protocol uses sub-protocol invocation. Simulation will show placeholder only. Full sub-protocol expansion coming in future release."
- Show Do node in CFG Structure as diamond with protocol name
- In sequence diagram, show single line: `◆ do SubProtocol(...)`
- In CFSM Network, show special state: `[CallSubProtocol]`

---

### 16.4 User Workflows with Sub-Protocols

#### Workflow 1: Write Protocol with Sub-Protocol

```
1. User writes main protocol in global editor
2. User types: `do Auth`
3. Auto-complete shows available protocols: [Authentication, Authorization, ...]
4. User selects Authentication
5. User types: `(Client as `
6. Auto-complete shows roles from main protocol: [A, B, C]
7. User completes: `(Client as A, Server as B)`
8. IDE validates role substitution (arity, role existence)
9. Syntax highlighting shows Do statement in special color
```

#### Workflow 2: Navigate to Sub-Protocol

```
1. User has `do Authentication(A as Client, B as Server)` in editor
2. User Ctrl+Clicks "Authentication"
3. IDE shows sub-protocol definition:
   - Option A: Open in new editor tab
   - Option B: Split pane (main protocol left, sub-protocol right)
   - Option C: Modal overlay with definition
4. User sees Authentication protocol definition
5. User can edit sub-protocol (changes reflected in main)
```

#### Workflow 3: Visualize Protocol with Sub-Protocol

```
1. User parses protocol with `do` statement
2. User switches to SIMULATION tab
3. User selects "CFG Structure" view
4. IDE shows Do node as diamond (◆)
5. User clicks Do node
6. IDE expands inline to show sub-protocol CFG
7. User sees how sub-protocol fits into main flow
```

#### Workflow 4: Simulate with Sub-Protocol (Future)

```
1. User runs simulation (when backend supports expansion)
2. Simulation reaches Do node
3. Sequence diagram shows sub-protocol messages in bordered box
4. CFSM Network shows states entering sub-protocol section
5. Event log shows: "Entering sub-protocol: Authentication"
6. Simulation executes sub-protocol steps
7. Event log shows: "Exiting sub-protocol: Authentication"
8. Simulation continues main protocol
```

---

### 16.5 Visual Design Guidelines for Sub-Protocols

**Color Coding**:
- Do nodes: Purple (#9333ea) to stand out
- Sub-protocol borders: Purple border
- Sub-protocol background: Light purple (#f3e8ff)

**Icons**:
- Do nodes: Diamond shape (◆) or call icon (📞)
- Expand/collapse: ▶/▼ triangles

**Annotations**:
- Show role mappings in tooltip or label
- Show protocol name prominently
- Indicate tail-recursive constraint (if violated: show warning)

**Interaction**:
- Click Do node → Toggle expand/collapse
- Ctrl+Click protocol name → Navigate to definition
- Hover → Show full sub-protocol signature

---

### 16.6 Testing Sub-Protocol Support

**Test Cases**:

1. **Simple sub-protocol**:
   ```scribble
   do Auth(A as Client, B as Server);
   ```

2. **Nested sub-protocols**:
   ```scribble
   do Auth(A as User, B as Service);  // Auth calls TokenCheck
   ```

3. **Mutual recursion**:
   ```scribble
   do ProtoA(...);  // ProtoA calls ProtoB, ProtoB calls ProtoA
   ```

4. **Role mismatch error**:
   ```scribble
   do Auth(A as Client);  // Error: Auth expects 2 roles, got 1
   ```

5. **Tail recursion violation**:
   ```scribble
   do Auth(A as Client, B as Server);
   msg() from A to C;  // Warning: Action after do for involved role A
   ```

**UI Testing**:
- Syntax highlighting works for all cases
- Navigation jumps to correct protocol
- Errors shown inline
- Visualizations render correctly
- Simulation handles sub-protocols (when backend ready)

---

## 17. Conclusion

This specification defines a comprehensive UI for the Scribble MPST IDE v2.0 that:

1. **Teaches MPST Theory**: Through interactive visualization and simulation
2. **Separates Concerns**: CODE (authoring) vs SIMULATION (execution)
3. **Shows Textual Projection**: Global Scribble → Local Scribble per role
4. **Enables Exploration**: Step-through execution, choice selection, state inspection
5. **Compares Semantics**: CFG (sync) vs CFSM (async) execution modes
6. **Provides Flexibility**: Configurable visualizations (1-3 panes)

**Core Strengths**:
- Two-tab architecture (clear mental model)
- Local Scribble projections (textual understanding)
- Three visualization options (CFSM Network, Sequence, CFG Structure)
- Dual simulation modes (CFG sync, CFSM async)
- Educational focus (teaching formal theory)

**Next Steps**:
1. Review specification with stakeholders
2. Create UI mockups/wireframes (Figma/Sketch)
3. Implement in phases (see section 12)
4. User testing with students
5. Iterate based on feedback

**Maintenance**:
- Keep specification updated as implementation evolves
- Version alongside codebase
- Document design decisions and rationale

---

**Document Version:** 2.0
**Last Updated:** 2025-01-12
**Status:** Ready for Implementation
**Authors:** Design Team + User Feedback
