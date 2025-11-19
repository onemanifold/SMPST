# Frontend Documentation Index

This directory contains comprehensive documentation of what backend functionality is exposed through the frontend UI.

## Documents Generated

### 1. **FRONTEND_EXPOSURE_ANALYSIS.md** (Main Document - 871 lines)
Complete structured analysis covering:
- **Simulation Store** (Layer 4): All exported stores and functions
- **SimulationControls**: User actions, control buttons, status display
- **TimelineControls**: Time-travel UI (step back/forward, jump)
- **ChoicePreview**: Choice selection UI with metadata
- **CFSMNetwork Visualization**: Role-by-role state machines with D3
- **CFGSequence Visualization**: Message sequence diagram with D3
- **EventLog Panel**: Event filtering and display
- **Verification Panel**: Backend verification results display
- **Layout & Architecture**: Component hierarchy and interaction flow
- **Backend Features**: Comprehensive list of exposed functionality
- **Control Flow Diagram**: Visual representation of user action flow
- **Key Limitations**: Design constraints and what's not exposed

**Use this for**: Deep understanding of the system, implementation details

### 2. **FRONTEND_QUICK_REFERENCE.md** (Developer Guide - 400 lines)
Practical quick reference covering:
- Key imports and entry points
- Component hierarchy (visual tree)
- Control flow examples (play, step, timeline, parse)
- Store access patterns
- Component-store mapping table
- Execution modes explanation
- Event types and filters
- Data flow for visualizations
- Time-travel state management
- Key limitations summary
- Testing quick commands
- Future enhancement opportunities

**Use this for**: Quick lookups, implementation, development

## Key Findings

### What IS Exposed

**Execution & Control:**
- Play/Step/Reset workflow
- Manual choice selection at branch points
- Auto-random choice mode (during play)
- Time-travel debugging (jump/back/forward through history)
- Speed control (10ms-1000ms playback interval)
- Real-time playback with 1000-step limit

**Visualization:**
- CFSM Network: Role-by-role finite state machines
- CFG Sequence Diagram: Message sequence over time
- Event Log: Complete trace of all execution events (filterable)
- D3-based pan/zoom controls

**Backend Features:**
- CFG Simulator (orchestration view)
- Debuggers for step control and history
- Event recording and filtering
- Verification results display (16 property checks)
- Parsing and projection of Scribble protocols

### What is NOT Exposed

**Not in Current UI:**
- Execution mode switching (Distributed/Bisimulation)
- Custom choice strategies (fixed to manual)
- Step-through limits > 1000
- State space visualization/export
- Stochastic/probabilistic execution
- Counterexample generation

**Partially Implemented (Phase 4):**
- Sub-protocol parameters (detected but not displayed)
- Multiple terminal states (detected but not visualized)

## Architecture Overview

```
┌─────────────────────────────────┐
│ Frontend UI Components           │
│ (SimulationControls, Viz, etc.)  │
└────────────┬────────────────────┘
             │
      ┌──────▼──────────────┐
      │ Simulation Store    │
      │ (Svelte Stores)     │
      └──────┬──────────────┘
             │
      ┌──────▼──────────────┐
      │ Debugger Layer      │
      │ (CFGDebugger, etc.) │
      └──────┬──────────────┘
             │
      ┌──────▼──────────────┐
      │ Simulator Layer     │
      │ (CFGSimulator, etc.)│
      └─────────────────────┘
```

**4-Layer Architecture:**
1. **Layer 4 (Frontend)**: UI state, execution mode switch
2. **Layer 3 (Debugging)**: Debuggers manage history and stepping
3. **Layer 2 (Execution)**: VMs (CFGSimulator, DistributedSimulator)
4. **Layer 1 (Core)**: CFG/CFSM structures, types

## How to Use These Docs

1. **Starting fresh?** → Read `FRONTEND_QUICK_REFERENCE.md` first
2. **Need implementation details?** → Consult `FRONTEND_EXPOSURE_ANALYSIS.md`
3. **Looking for specific component?** → Use quick reference's component table
4. **Want to add features?** → Check "Future Enhancement Opportunities" section

## File Structure Reference

```
src/lib/
├── stores/
│   └── simulation.ts          ← All execution & control
├── components/
│   ├── controls/
│   │   ├── SimulationControls.svelte
│   │   └── TimelineControls.svelte
│   ├── panels/
│   │   ├── ChoicePreview.svelte
│   │   ├── EventLog.svelte
│   │   └── VerificationPanel.svelte
│   ├── visualizations/
│   │   ├── CFSMNetwork.svelte
│   │   └── CFGSequence.svelte
│   └── tabs/
│       └── SimulationTab.svelte
```

## Key Statistics

- **Total Lines of Analysis**: 1,271 lines
- **Components Documented**: 9 main components
- **Store Functions**: 17 exported functions
- **Derived Stores**: 15 computed stores
- **Visualization Types**: 2 (CFSM Network + CFG Sequence)
- **Event Types Supported**: 6 (message, choice, recursion, parallel, subprotocol, state-change)
- **Max Execution Steps**: 1000 (hard limit)
- **Execution Modes**: 3 (CFG, Distributed, Bisimulation) - 1 exposed in UI

## Last Updated

Generated: 2025-11-19

## Related Documentation

- Parser Implementation: `src/core/parser/`
- Verification Engine: `src/core/verification/`
- CFG Builder: `src/core/cfg/`
- Simulator Implementations: `src/core/simulation/`

