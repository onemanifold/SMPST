# SMPST IDE UI Design Session - Handover Prompt
## Navigation Controls & Sub-Protocol Support

---

## Session Context

You are continuing UI development for the SMPST IDE, a live tutorial system for teaching Multiparty Session Types (MPST). This session will focus on implementing **simulation navigation controls** (step forward/back, in/out) and **sub-protocol visualization support** (call stack, breadcrumbs, do-statement handling).

---

## Current State (After Previous Session)

### ✅ Completed Features

1. **Monaco Editor Integration**
   - Syntax highlighting for local protocol projections
   - Read-only Monaco editor with Scribble language support
   - Files: `src/lib/components/panels/LocalProjectionPanel.svelte`

2. **CFSM Visualization Overhaul**
   - Hierarchical graph layout using BFS algorithm
   - Pan/zoom functionality (D3.js, 0.1x-4x scale)
   - Cross-CFSM message channels with exact transition matching
   - Separate state highlighting (AT, SOURCE/TARGET, VISITED, TRANSITION)
   - Files: `src/lib/components/visualizations/CFSMNetwork.svelte`

3. **Playback Controls**
   - Real-time speed slider (10ms-1000ms, default 300ms)
   - Choice buttons visible in step mode
   - Auto-random selection in play mode
   - Files: `src/lib/stores/simulation.ts`, `src/lib/components/controls/SimulationControls.svelte`

4. **Critical Bugfixes**
   - BFS infinite loop fix for recursive protocols
   - Monaco editor initialization race conditions
   - Local projection role selection auto-reset
   - Exact CFSM channel matching (prevents multiple channels at start)
   - Sequence diagram message label fallback

### Current Branch
- `claude/initial-setup-01Euh34rYNLZGWdLX5B4dJXz`
- 8 commits with comprehensive visualization improvements
- All tests passing, build successful

---

## Goals for This Session

### Primary Objectives

1. **Step Forward/Back Navigation** 🔄
   - Implement history tracking for simulation steps
   - Add "Step Back" button to undo last step
   - Maintain execution trace for replay
   - Show step count (current/total)

2. **Step In/Out for Sub-Protocols** 📥📤
   - "Step In" button when at `do` statement
   - "Step Out" button to exit current sub-protocol
   - Navigate between protocol levels
   - Sync with call stack state

3. **Call Stack Visualization** 📚
   - Display active call stack frames
   - Show current protocol depth
   - Role mapping visualization for each frame
   - Interactive navigation (click frame to jump to that level)

4. **Sub-Protocol UI Support** 🔗
   - Breadcrumbs navigation (Main > Auth > SubProcess)
   - Collapsible `do` nodes in visualizations
   - Sub-protocol expansion in CFG/CFSM views
   - Highlight active frame in breadcrumbs

---

## Technical Infrastructure (Already Exists)

### Backend Support

#### Call Stack Types ✅
**File**: `src/core/simulation/call-stack-types.ts`

Key interfaces:
```typescript
interface ProtocolCallFrame {
  id: string;
  type: 'recursion' | 'subprotocol';
  name: string;
  entryNodeId: string;
  exitNodeId: string;
  currentNode: string;
  subCFG?: CFG;
  roleMapping?: RoleMapping;
  stepCount: number;
  // ...
}

interface ICallStackManager {
  getState(): CallStackState;
  push(frame: ...): ProtocolCallFrame;
  pop(): ProtocolCallFrame | null;
  step(nodeId: string, action?: string): void;
  reset(): void;
  on(eventType: CallStackEventType, handler: ...): void;
}
```

#### Simulator Events ✅
**File**: `src/core/simulation/cfg-simulator.ts`

The CFG simulator already emits events via event subscription:
```typescript
simulator.on('message', ({ from, to, label }) => { /* ... */ });
simulator.on('choice-point', ({ nodeId, role, options }) => { /* ... */ });
simulator.on('recursion-enter', ({ label, nodeId }) => { /* ... */ });
simulator.on('step-start', ({ stepCount, currentNode }) => { /* ... */ });
simulator.on('step-end', ({ stepCount, result, state }) => { /* ... */ });
```

#### Execution State ✅
**File**: `src/lib/stores/simulation.ts`

Current stores:
```typescript
export const executionState: Writable<CFGExecutionState | null>;
export const currentCFG: Writable<CFG | null>;
export const simulationMode: Writable<'idle' | 'stepping' | 'playing'>;
export const playbackSpeed: Writable<number>;

// Functions:
export function stepSimulation(): void;
export function resetSimulation(): void;
export function makeChoice(choiceIndex: number): void;
```

### Parser Support ✅
**File**: `src/core/ast/types.ts`

`do` statement AST node:
```typescript
export interface Do {
  type: 'Do';
  protocol: string;
  typeArguments?: Type[];
  roleArguments: string[];
  location?: SourceLocation;
}
```

### CFG Builder ⚠️
**File**: `src/core/cfg/builder.ts`

Currently creates **placeholder nodes** for `do` statements:
```typescript
// buildDo() creates action node with:
// from: '__do__', to: '__do__'
// Does NOT expand sub-protocol inline
// Does NOT apply role substitution
```

**This is a known limitation** - sub-protocol expansion is not yet implemented in CFG builder.

---

## What Needs to Be Implemented

### 1. History Tracking for Step Back/Forward

**New Store**: `src/lib/stores/simulation-history.ts`

```typescript
interface SimulationSnapshot {
  executionState: CFGExecutionState;
  stepNumber: number;
  timestamp: number;
  action?: string; // Description of what happened
}

export const simulationHistory: Writable<SimulationSnapshot[]>;
export const currentStepIndex: Writable<number>;

export function stepForward(): void;
export function stepBackward(): void;
export function canStepBack(): Readable<boolean>;
export function canStepForward(): Readable<boolean>;
```

**Integration**:
- Subscribe to `simulator.on('step-end', ...)` to capture snapshots
- Limit history to last 100 steps (configurable)
- Clear history on reset

### 2. Call Stack UI Component

**New Component**: `src/lib/components/controls/CallStackPanel.svelte`

**Features**:
- Display stack frames (bottom to top)
- Show current frame highlighted
- Display role mappings for sub-protocol frames
- Click frame to navigate to that level
- Show iteration count for recursion frames

**Store Integration**:
```typescript
// New store in simulation.ts
export const callStack: Writable<CallStackState>;
```

Subscribe to `ICallStackManager` events:
- `frame-push`: Add frame to UI
- `frame-pop`: Remove frame from UI
- `frame-step`: Update current frame position

### 3. Navigation Controls Enhancement

**Update**: `src/lib/components/controls/SimulationControls.svelte`

**New Buttons**:
```svelte
<!-- Step Back (only in step mode, disabled if at start) -->
<button on:click={stepBackward} disabled={!$canStepBack || $isPlaying}>
  ⏮ Back
</button>

<!-- Step In (only when at do-statement) -->
<button on:click={stepIn} disabled={!$canStepIn}>
  ⏬ Step In
</button>

<!-- Step Out (only when in sub-protocol) -->
<button on:click={stepOut} disabled={!$canStepOut}>
  ⏫ Step Out
</button>

<!-- Progress indicator -->
<span>{$currentStepIndex + 1} / {$simulationHistory.length}</span>
```

### 4. Breadcrumbs Navigation

**New Component**: `src/lib/components/navigation/ProtocolBreadcrumbs.svelte`

**Display**:
```
Home > Main > do Auth(Client as A, Server as B) > do TwoFactor(A, B)
      [0]    [1]                                  [2]
```

**Features**:
- Show protocol hierarchy from call stack
- Click breadcrumb to jump to that level (step out to target)
- Highlight current active protocol
- Show role mappings on hover

### 5. Do-Statement Visualization

**Update**: `src/lib/components/visualizations/CFGSequence.svelte`

**When rendering `do` nodes**:
- Show collapsed view by default: `▶ do Auth(Client, Server)`
- Click to expand and show sub-protocol inline
- Dim background for sub-protocol section
- Show entry/exit markers

**Update**: `src/lib/components/visualizations/CFSMNetwork.svelte`

**Sub-protocol rendering**:
- Group sub-protocol CFSMs in collapsible container
- Show dashed border around sub-protocol group
- Label with sub-protocol name and role mapping

---

## Relevant Documentation

### Must Read (Ordered by Priority)

1. **Sub-Protocol UI Implementation** 📘
   - File: `docs/SUB_PROTOCOL_UI_IMPLEMENTATION.md`
   - Comprehensive spec for all UI components
   - Sections 16.2.4-16.2.6 cover visualization
   - Section 4.2.1 covers call stack display

2. **Call Stack Test Plan** 📗
   - File: `docs/SUB_PROTOCOL_CALL_STACK_TEST_PLAN.md`
   - Formal semantics for call stack execution
   - Test cases for sub-protocol invocation
   - Current implementation status

3. **Architecture Overview** 📙
   - File: `docs/architecture-overview.md`
   - Pipeline: Scribble → AST → CFG → CFSM → Runtime
   - Educational goals and design philosophy
   - Understanding of CFG vs AST

4. **CFG Design** 📕
   - File: `docs/cfg-design.md`
   - Control flow graph structure
   - Node types and edge semantics
   - Transformation rules from AST

5. **Projection Design** 📔
   - File: `docs/projection-design.md`
   - CFG → CFSM projection algorithm
   - Tau-elimination for non-involved roles
   - Role substitution semantics

### Reference Documentation

- **Scribble 2.0 Syntax**: `docs/scribble-2.0-syntax.md`
- **Development Roadmap**: `docs/development-roadmap.md`
- **Status**: `docs/STATUS.md` (current implementation status)
- **Debug Utilities**: `docs/DEBUG_UTILITIES.md`

---

## Implementation Strategy

### Phase 1: History Tracking (Foundation)

1. Create `simulation-history.ts` store
2. Subscribe to simulator step events
3. Implement snapshot capture
4. Add stepBack/stepForward functions
5. Test with simple protocols

### Phase 2: UI Controls

1. Add step back button to SimulationControls
2. Add step count display (current/total)
3. Test history navigation
4. Handle edge cases (at start, at end)

### Phase 3: Call Stack Integration

1. Create CallStackPanel component
2. Subscribe to call stack manager events
3. Display frame hierarchy
4. Implement frame navigation (click to jump)
5. Show role mappings

### Phase 4: Step In/Out

1. Detect when at `do` statement (check current node type)
2. Enable "Step In" button at do-nodes
3. Implement stepIn() to enter sub-protocol
4. Enable "Step Out" when depth > 0
5. Implement stepOut() to exit current frame

### Phase 5: Breadcrumbs & Visualization

1. Create ProtocolBreadcrumbs component
2. Sync with call stack state
3. Update CFGSequence to show collapsible do-nodes
4. Update CFSMNetwork to group sub-protocol CFSMs
5. Add styling and animations

---

## Known Limitations & Workarounds

### CFG Builder Doesn't Expand Sub-Protocols

**Current State**:
- `buildDo()` creates placeholder action nodes
- Sub-protocol CFG is NOT inlined
- Role substitution NOT applied in CFG

**Workaround for UI**:
- Use simulator's sub-protocol execution (if implemented)
- OR: Show placeholder message "Sub-protocol execution not yet implemented"
- Focus on UI structure first, backend integration later

**Future Backend Work**:
- Protocol registry for sub-protocol lookup
- CFG inlining with role substitution
- Projection integration

### Simulator May Not Support Sub-Protocols Yet

**Check**: `src/core/simulation/cfg-simulator.ts:executeAction()`

Look for handling of `action.kind === 'subprotocol'` (line ~547).

**If not implemented**:
- Build UI components that expect the interface
- Use mock data for testing
- Document what events/state the UI expects
- Backend team can implement to match UI contract

---

## Testing Protocols

### Simple Choice (No Sub-Protocols)
```scribble
protocol TwoBuyer(role Buyer1, role Buyer2, role Seller) {
  choice at Buyer1 {
    Quote() from Buyer1 to Seller;
    Price() from Seller to Buyer2;
  } or {
    Quit() from Buyer1 to Seller;
  }
}
```

### With Sub-Protocol (For Future Testing)
```scribble
protocol Auth(role Client, role Server) {
  Request() from Client to Server;
  Challenge() from Server to Client;
  Response() from Client to Server;
}

protocol Main(role Client, role Server, role Observer) {
  Init() from Client to Observer;
  do Auth(Client, Server);
  Data() from Client to Observer;
}
```

### Nested Sub-Protocols (Advanced)
```scribble
protocol TwoFactor(role User, role System) {
  Code() from System to User;
  Verify() from User to System;
}

protocol Auth(role Client, role Server) {
  Login() from Client to Server;
  do TwoFactor(Client as User, Server as System);
  LoginOk() from Server to Client;
}

protocol Main(role A, role B) {
  do Auth(A as Client, B as Server);
  Request() from A to B;
}
```

---

## File Structure Guide

```
src/
├── lib/
│   ├── components/
│   │   ├── controls/
│   │   │   ├── SimulationControls.svelte          [UPDATE: Add step back/in/out]
│   │   │   └── CallStackPanel.svelte              [NEW: Call stack visualization]
│   │   ├── navigation/
│   │   │   └── ProtocolBreadcrumbs.svelte         [NEW: Breadcrumbs]
│   │   ├── visualizations/
│   │   │   ├── CFGSequence.svelte                 [UPDATE: Collapsible do-nodes]
│   │   │   └── CFSMNetwork.svelte                 [UPDATE: Sub-protocol grouping]
│   │   └── panels/
│   │       └── LocalProjectionPanel.svelte        [EXISTING: Shows local protocols]
│   └── stores/
│       ├── simulation.ts                          [UPDATE: Add call stack store]
│       └── simulation-history.ts                  [NEW: History tracking]
└── core/
    ├── simulation/
    │   ├── cfg-simulator.ts                       [READ: Event system]
    │   └── call-stack-types.ts                    [READ: Call stack interfaces]
    └── cfg/
        ├── types.ts                               [READ: CFG node types]
        └── builder.ts                             [READ: Do-statement handling]
```

---

## UI/UX Design Principles

### Step Back/Forward
- **Disabled states**: Gray out when at start/end
- **Keyboard shortcuts**: ← for back, → for forward
- **Visual feedback**: Brief highlight on step
- **History limit**: Show "History limited to 100 steps" tooltip

### Call Stack
- **Bottom-to-top layout**: Root protocol at bottom, current at top
- **Frame highlighting**: Current frame has blue border
- **Hover states**: Show full role mapping on hover
- **Click to navigate**: Click frame to step out to that level

### Breadcrumbs
- **Separator**: Use `>` between levels
- **Truncation**: Show "..." if > 5 levels
- **Active state**: Bold current protocol
- **Clickable**: Click to step out

### Step In/Out
- **Contextual**: Only show when applicable
- **Icon indicators**: ⏬ for in, ⏫ for out
- **Tooltip**: "Step into sub-protocol" / "Step out of sub-protocol"

---

## Success Criteria

By the end of this session, you should have:

1. ✅ Step back button working (undo last step)
2. ✅ Step count display (current/total)
3. ✅ Call stack panel showing frames
4. ✅ Breadcrumbs navigation visible
5. ✅ Step in/out buttons (even if sub-protocols don't execute yet)
6. ✅ UI structure ready for backend integration

**Stretch Goals**:
- Collapsible do-nodes in CFG Sequence
- Sub-protocol grouping in CFSM Network
- Keyboard shortcuts for navigation
- Animation on step back/forward

---

## Questions to Ask User

1. **History Size**: What's the max history size? (Default: 100 steps)
2. **Step In Behavior**: Should "Step In" automatically step once inside sub-protocol?
3. **Step Out Behavior**: Should "Step Out" complete sub-protocol or just exit?
4. **Call Stack Position**: Where should call stack panel appear? (Sidebar, bottom panel, floating?)
5. **Breadcrumbs Position**: Top of visualization area? Part of header?

---

## Starting Point

1. **Read** `docs/SUB_PROTOCOL_UI_IMPLEMENTATION.md` sections 4.2.1 and 16.2.4-16.2.6
2. **Review** current `SimulationControls.svelte` to understand existing button layout
3. **Create** `simulation-history.ts` store as foundation
4. **Test** with "Two Buyer" protocol (has choice, good for testing history)
5. **Build incrementally**: History first, then UI controls, then call stack

---

## Git Workflow

- **Branch**: Continue on `claude/initial-setup-01Euh34rYNLZGWdLX5B4dJXz` OR create new branch
- **Commits**: Small, atomic commits with clear messages
- **Build**: Run `npm run build` frequently to catch errors early
- **Push**: Push regularly to save progress

---

## Final Notes

- **Don't worry about backend sub-protocol execution** - focus on UI structure
- **Use TypeScript strictly** - no `any` types in new code
- **Follow existing patterns** - look at SimulationControls for button styling
- **Ask questions early** - don't guess on UX decisions
- **Test with real protocols** - load examples from sidebar

Good luck! 🚀
