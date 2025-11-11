# Mock UI Integration Guide

This document describes the mock UI implementation and provides integration points for connecting real functionality.

## Overview

The mock UI is fully functional with sample data and state management. All components use Svelte stores for state, making integration straightforward.

## Component Structure

```
src/lib/
├── components/
│   ├── Header.svelte           # Top header with actions and status
│   ├── Editor.svelte            # CodeMirror 6 editor
│   ├── ProtocolLibrary.svelte  # Collapsible protocol library sidebar
│   ├── Visualizer.svelte        # D3.js graph visualization
│   └── OutputPanel.svelte       # Tabbed output panel
├── stores/
│   └── editor.ts                # Centralized state management
└── data/
    └── examples.ts              # Protocol library examples
```

## State Management

All state is managed via Svelte stores in `src/lib/stores/editor.ts`:

### Key Stores

- `editorContent`: Current editor content (string)
- `parseStatus`: 'idle' | 'parsing' | 'success' | 'error'
- `parseError`: Error message (string | null)
- `verificationResult`: Verification results object
- `projectionData`: Array of projection data per role
- `simulationState`: Current simulation state
- `activeTab`: Current output tab

### Integration Functions

Replace these mock functions with real implementations:

#### 1. Parser Integration

**Location**: `src/lib/stores/editor.ts:119` - `mockParse()`

Replace with:
```typescript
import { parse } from '../core/parser/parser';
import { buildCFG } from '../core/cfg/builder';
import { verify } from '../core/verification/verifier';
import { project } from '../core/projection/projector';

export function parseProtocol(content: string) {
  parseStatus.set('parsing');
  parseError.set(null);

  try {
    // 1. Parse
    const ast = parse(content);

    // 2. Build CFG
    const cfg = buildCFG(ast);

    // 3. Verify
    const verification = verify(cfg);
    verificationResult.set(verification);

    // 4. Project
    const projections = project(cfg);
    projectionData.set(projections);

    parseStatus.set('success');
  } catch (error) {
    parseStatus.set('error');
    parseError.set(error.message);
  }
}
```

**Component Hook**: `src/lib/components/Header.svelte:8` - Update `handleParse()` to call `parseProtocol()` instead of `mockParse()`

#### 2. Visualization Integration

**Location**: `src/lib/components/Visualizer.svelte:23-54`

Replace `mockCFGData` and `mockCFSMData` with real data from stores:

```typescript
// Add new stores to editor.ts
export const cfgData = writable<CFGData | null>(null);
export const cfsmData = writable<Record<string, CFSMData> | null>(null);

// Update after parsing
function parseProtocol(content: string) {
  // ... existing code ...
  cfgData.set(cfg); // Set real CFG data
  cfsmData.set(projections); // Set real CFSM data
}
```

**Component Update**: `src/lib/components/Visualizer.svelte:122`
```typescript
// Replace
const data = viewMode === 'cfg' ? mockCFGData : mockCFSMData[selectedRole];
// With
const data = viewMode === 'cfg' ? $cfgData : $cfsmData?.[selectedRole];
```

#### 3. Simulation Integration

**Location**: `src/lib/components/OutputPanel.svelte:82-105`

Connect simulation controls to real simulator:

```typescript
import { Simulator } from '../core/runtime/simulator';

let simulator: Simulator | null = null;

function handleStartSimulation() {
  if (!simulator && $projectionData.length > 0) {
    simulator = new Simulator($projectionData);
  }
  simulator?.run();
}

function handleStep() {
  simulator?.step();
}

function handleReset() {
  simulator?.reset();
  simulationState.set({
    running: false,
    step: 0,
    maxSteps: 100,
    currentRoleStates: {},
    messageQueue: []
  });
}
```

## Features Implemented

### ✅ Completed
- Full IDE layout with resizable panels
- CodeMirror 6 editor integration
- Protocol library with 8 example protocols
- Category filtering (All, Basic, Classic, Advanced)
- Mock D3.js CFG and CFSM visualizations
- Interactive graph rendering with force layout
- View toggle (CFG ↔ CFSM)
- Role selector for CFSM views
- Output panel with 4 tabs:
  - Verification results
  - Projection details
  - Simulation controls
  - Error display
- Collapsible library sidebar
- Parse status indicator
- Responsive design

### 🔌 Integration Points

1. **Parser**: Replace `mockParse()` in `stores/editor.ts`
2. **Verification**: Populate `verificationResult` store with real data
3. **Projection**: Populate `projectionData` store with real CFSMs
4. **Visualization**: Replace mock graph data with real CFG/CFSM
5. **Simulation**: Connect controls to real Simulator class

## Data Formats

### Verification Result
```typescript
interface VerificationResult {
  deadlockFree: boolean;
  livenessSatisfied: boolean;
  safetySatisfied: boolean;
  warnings: string[];
  errors: string[];
}
```

### Projection Data
```typescript
interface ProjectionData {
  role: string;
  states: string[];
  transitions: Array<{
    from: string;
    to: string;
    label: string;
  }>;
}
```

### Graph Data (D3.js format)
```typescript
interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: 'start' | 'end' | 'interaction' | 'initial' | 'final' | 'intermediate';
  }>;
  links: Array<{
    source: string;
    target: string;
    label: string;
  }>;
}
```

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Next Steps

1. Review mock UI and gather feedback
2. Implement parser integration (Layer 1)
3. Implement CFG builder integration (Layer 2)
4. Implement verification integration (Layer 3)
5. Implement projection integration (Layer 4)
6. Implement simulation integration (Layer 5)
7. Add persistence (localStorage/IndexedDB)
8. Add export functionality
9. Improve accessibility
10. Add keyboard shortcuts

## Notes

- CodeMirror is using JavaScript syntax highlighting as a placeholder
- Custom Scribble language mode can be added to CodeMirror
- D3.js graphs are fully interactive (drag nodes, zoom, pan)
- All mock data is clearly marked for easy identification
- Resizable panels work smoothly with drag handles
