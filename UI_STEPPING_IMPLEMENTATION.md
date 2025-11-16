# UI Stepping Debugger Implementation

This document describes the UI implementation for the CFSM/CFG stepping debugger with call stack support.

## Overview

The UI now supports full stepping debugger functionality for both CFSM and CFG simulators, including:
- Step forward/backward/into/out/over controls
- Real-time bisimulation (CFG and CFSM execute in sync)
- Call stack visualization for sub-protocols
- Execution history with time-travel debugging
- Visual highlighting of current execution state

## Components Added

### 1. SimulatorControls (`components/SimulatorControls.tsx`)

Interactive control panel with:
- **Play/Pause**: Run simulation to completion or pause execution
- **Reset**: Reset simulation to initial state
- **Step Forward**: Execute one step forward
- **Step Backward**: Undo last step (time-travel)
- **Step Into**: Enter sub-protocol context
- **Step Out**: Exit current sub-protocol
- **Step Over**: Execute sub-protocol atomically (CFG only)
- **Status Display**: Shows current step count and execution status

### 2. CallStackDisplay (`components/CallStackDisplay.tsx`)

Visual call stack with:
- **Breadcrumb Navigation**: Shows protocol hierarchy
- **Frame Details**: Displays frame type (recursion/subprotocol), current node, step count
- **Role Mapping**: Shows formal→actual role substitution for sub-protocols
- **Active Frame Highlighting**: Current frame highlighted in amber
- **Verified Badge**: Shows verification status

### 3. CfgVisualizer (`components/CfgVisualizer.tsx`)

D3-based CFG visualization with:
- **Node Types**: Color-coded by type (initial=green, terminal=red, branch=purple, etc.)
- **Current Node Highlighting**: Amber pulse animation
- **Execution Path**: Blue highlighting for visited nodes
- **Dimming**: Unvisited nodes dimmed during execution
- **Interactive**: Pan, zoom, drag nodes
- **Smart Labels**: Shows action details (e.g., "A→B" for messages)

### 4. Updated FsmVisualizer (`components/FsmVisualizer.tsx`)

Enhanced CFSM visualization with:
- **Current State Highlighting**: Amber pulse animation
- **Execution Path**: Blue highlighting for visited states
- **Dimming**: Unvisited states dimmed during execution
- **Synchronized State**: Updates in real-time with CFSM simulator

### 5. Updated App (`App.tsx`)

Complete rewrite with:
- **Dual Simulator Integration**: Both CFG and CFSM simulators running in sync
- **Call Stack Manager**: Tracks sub-protocol invocations
- **Execution History**: Enables backward stepping
- **Event-Driven Updates**: Listens to simulator events and updates UI
- **View Modes**: Switch between CFG, FSM (CFSM), and API views
- **Auto-Reset**: Reset simulators when loading new protocols

## Architecture

```
App.tsx (State Management)
├── CFGSimulator (Global choreography)
│   ├── ExecutionHistory (for backward stepping)
│   └── CallStackManager (for sub-protocols)
├── CFSMSimulator (Local role view)
│   └── ExecutionHistory (for backward stepping)
├── SimulatorControls (User interaction)
├── CfgVisualizer (CFG view)
├── FsmVisualizer (CFSM view)
└── CallStackDisplay (Call stack view)
```

## Event Flow

1. **User Action** → SimulatorControls button click
2. **Handler Execution** → App calls simulator method (e.g., `stepForward()`)
3. **Simulator Updates** → Both CFG and CFSM simulators execute step
4. **Event Emission** → Simulators emit events (step-forward, frame-push, etc.)
5. **State Update** → Event listeners update React state
6. **Re-render** → Components re-render with updated state
7. **Visual Update** → D3 visualizations update to highlight current state

## Real-Time Bisimulation

The CFG and CFSM simulators execute in **real-time bisimulation**:

- **CFG Simulator**: Executes global choreography (orchestration view)
- **CFSM Simulator**: Executes local role automaton (participant view)
- **Synchronization**: Both step forward/backward together
- **Consistency**: The user can verify that the global and local views match

Example:
```
CFG: A→B (message node)  ⟷  CFSM: !B⟨msg⟩ (send transition)
```

## Call Stack Support

Sub-protocols are tracked via the CallStackManager:

1. **Entry**: `do SubProtocol(...)` pushes frame onto stack
2. **Execution**: Steps within sub-protocol update frame's current node
3. **Exit**: Terminal state pops frame from stack
4. **Display**: CallStackDisplay shows full hierarchy

Frame Types:
- **Recursion**: `rec X { ... continue X; }`
- **SubProtocol**: `do SubProtocol(role1, role2)`

## Execution History

Both simulators maintain execution history for time-travel debugging:

- **Snapshots**: Deep copies of execution state after each step
- **Undo**: `stepBackward()` restores previous snapshot
- **Capacity**: Configurable max snapshots (default 1000)
- **Performance**: Disabled by default in production

## Visual Design

### Color Scheme

**CFG Nodes:**
- Green: Initial node
- Red: Terminal node
- Purple: Branch/Merge nodes
- Cyan: Fork/Join nodes
- Orange: Recursion nodes
- Amber: Current node (with pulse)
- Blue: Visited nodes
- Gray: Unvisited nodes

**CFSM States:**
- Green: Start state
- Red: End state
- Amber: Current state (with pulse)
- Blue: Visited states
- Gray: Unvisited states

**Call Stack:**
- Blue background: Active frame
- Gray background: Inactive frames
- Yellow badge: Recursion frame
- Purple badge: SubProtocol frame

## Usage

1. **Load Protocol**: Select example or write custom protocol
2. **Select Role**: Choose role for CFSM projection (CFG is global)
3. **View Mode**: Switch between CFG, FSM, or API view
4. **Step Through**: Use stepping controls to execute protocol
5. **Observe**: Watch current state highlighted in both views
6. **Time Travel**: Use step backward to undo actions
7. **Sub-Protocols**: Step into/out of sub-protocol contexts

## Integration Points

### Required Imports

```typescript
// Simulators
import { CFGSimulator } from './src/core/simulation/cfg-simulator';
import { CFSMSimulator } from './src/core/simulation/cfsm-simulator';

// CFG Builder
import { buildCFG } from './src/core/cfg/cfg-builder';

// Projection
import { projectProtocol } from './src/core/projection/projection';

// Call Stack
import { CallStackManager } from './src/core/simulation/call-stack-manager';

// Types
import type { CFG } from './src/core/cfg/types';
import type { CFSM } from './src/core/projection/types';
import type { CFGExecutionState } from './src/core/simulation/types';
import type { CFSMExecutionState } from './src/core/simulation/cfsm-simulator-types';
import type { ProtocolCallFrame } from './src/core/simulation/call-stack-types';
```

### Event Subscriptions

```typescript
// CFG Simulator Events
cfgSimulator.on('step-forward', handler);
cfgSimulator.on('step-back', handler);
cfgSimulator.on('complete', handler);

// CFSM Simulator Events
cfsmSimulator.on('step-forward', handler);
cfsmSimulator.on('step-back', handler);
cfsmSimulator.on('complete', handler);

// Call Stack Events
callStackManager.on('frame-push', handler);
callStackManager.on('frame-pop', handler);
callStackManager.on('frame-step', handler);
```

## Testing

To test the stepping functionality:

1. Load a protocol with sub-protocols (e.g., from examples)
2. Click "Step Forward" repeatedly and observe:
   - Current node highlights in amber with pulse
   - Visited nodes turn blue
   - Call stack updates when entering sub-protocols
   - Step count increments
3. Click "Step Backward" and observe:
   - Previous state restored
   - Current node moves back
   - Step count decrements
4. Use "Step Into" at a sub-protocol call:
   - Call stack shows new frame
   - Current node enters sub-protocol CFG
5. Use "Step Out" to exit sub-protocol:
   - Call stack pops frame
   - Returns to caller context
6. Use "Run" to execute to completion:
   - Automatic stepping with visual feedback
   - Pause button available during execution

## Known Limitations

1. **Performance**: Execution history uses deep copying (configurable)
2. **View Sync**: CFG and CFSM views don't switch automatically (manual toggle)
3. **Error Handling**: Some edge cases may need additional validation
4. **Subprotocol Registry**: Requires protocol registry for sub-protocol resolution

## Future Enhancements

1. **Breakpoints**: Set breakpoints on specific nodes
2. **Watch Variables**: Track message payloads and state variables
3. **Conditional Stepping**: Step until condition met
4. **Export Trace**: Export execution trace for analysis
5. **Compare Views**: Side-by-side CFG and CFSM view
6. **Animation Speed**: Configurable step delay during run
7. **Message Queue Visualization**: Show message buffers in CFSM view

## Files Changed/Added

### Added:
- `components/SimulatorControls.tsx`
- `components/CallStackDisplay.tsx`
- `components/CfgVisualizer.tsx`
- `UI_STEPPING_IMPLEMENTATION.md`

### Modified:
- `App.tsx` (complete rewrite with simulator integration)
- `components/FsmVisualizer.tsx` (added current state highlighting)

### Backup:
- `App-old.tsx` (original version preserved)

## Dependencies

All required simulators and types are available in `src/core/`:
- ✅ CFG Simulator with stepping support
- ✅ CFSM Simulator with stepping support
- ✅ Call Stack Manager
- ✅ Execution History
- ✅ CFG Builder
- ✅ Projection

No additional npm packages required beyond existing dependencies (d3, react).
