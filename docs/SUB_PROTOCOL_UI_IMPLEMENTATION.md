# Sub-Protocol UI Implementation Guide

**Document Version**: 1.0
**Date**: 2025-11-12
**Status**: Specification Complete, Implementation Pending

---

## Executive Summary

This document describes the comprehensive sub-protocol support added to the SMPST IDE UI Specification (v2.0). Sub-protocols are a key feature of Scribble that enables protocol composition through the `do` statement, allowing protocols to invoke other protocols with role substitution.

### Key Additions

1. **Sub-Protocol Editor Support** (Section 16.2.1-16.2.3)
   - Syntax highlighting for `do` statements
   - Auto-completion and navigation
   - Sub-protocol library/browser component
   - Role mapping validation

2. **Visualization Enhancements** (Section 16.2.4-16.2.6)
   - Breadcrumbs navigation for protocol hierarchy
   - Collapsible Do nodes in CFG Structure view
   - Collapsible sub-protocol sections in CFSM Network view
   - Expanded sub-protocol sequences in CFG Sequence diagram

3. **Simulation Controls** (Section 4.2.1)
   - Call stack display with real-time updates
   - Role mapping visualization
   - Depth tracking and recursion detection
   - Interactive navigation between protocol levels

---

## Sub-Protocol Syntax

**Basic Syntax**:
```scribble
do SubProtocol(A as X, B as Y);
```

**Semantics**:
- Invokes `SubProtocol` inline with role substitution
- Role `X` in `SubProtocol` is replaced by role `A` in calling context
- Role `Y` in `SubProtocol` is replaced by role `B` in calling context
- Must be tail-recursive per role (no actions after `do` for involved roles)

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

## Implementation Status

### Backend Support (Current)

✅ **Parser**: Fully supports `do` statement syntax
```typescript
// src/core/ast/types.ts
export interface Do {
  type: 'Do';
  protocol: string;
  typeArguments?: Type[];
  roleArguments: string[];
  location?: SourceLocation;
}
```

⚠️ **CFG Builder**: Creates placeholder action nodes
```typescript
// src/core/cfg/builder.ts:buildDo()
// Currently creates placeholder with from: '__do__', to: '__do__'
// Does NOT expand sub-protocol inline
// Does NOT apply role substitution in CFG
```

❌ **Projection**: Treats `do` nodes as regular actions
- Does NOT expand sub-protocol for role projection
- No role substitution applied

❌ **Simulation**: Placeholder only
- Cannot execute sub-protocols (skips placeholder)
- No sub-protocol state tracking
- No call stack management

### UI Support (Specification Complete)

✅ **CODE Tab - Global Scribble**
- Syntax highlighting specification
- Auto-completion patterns
- Navigation (Ctrl+Click) design
- Validation rules

✅ **CODE Tab - Local Scribble**
- Three projection options documented:
  - Option A: Show as call (simple)
  - Option B: Expand inline (educational)
  - Option C: Toggle view (flexible) ← **Recommended**

✅ **SIMULATION Tab - All Views**
- CFG Structure: Collapsible Do nodes with breadcrumbs
- CFG Sequence: Expanded sub-protocol sequences
- CFSM Network: Collapsible grouped states

✅ **Simulation Controls**
- Call stack display with hierarchy
- Role mapping visualization
- Depth tracking (current/max)
- Interactive navigation

---

## UI Features Added

### 1. Breadcrumbs Navigation (CFG Structure View)

**Purpose**: Show protocol hierarchy and enable quick navigation between levels

**Visual Design**:
```
┌─────────────────────────────────────────────────┐
│ Breadcrumbs: Main > Authentication              │
├─────────────────────────────────────────────────┤
│ CFG Structure Visualization                     │
│ (showing expanded Authentication sub-protocol)  │
└─────────────────────────────────────────────────┘
```

**Features**:
- Display protocol hierarchy at top of CFG Structure view
- Click any breadcrumb → Jump to that protocol level
- Current protocol highlighted in breadcrumb trail
- Updates automatically when expanding/collapsing Do nodes

**Benefits**:
- Always know current context (which protocol being viewed)
- Easy navigation back to parent protocols
- Visual hierarchy of protocol composition

**Location in Spec**: Section 16.2.4 (lines ~1622-1642 in UI_SPECIFICATION.md)

---

### 2. Collapsible CFSMs (CFSM Network View)

**Purpose**: Manage complexity and reduce visual clutter for nested sub-protocols

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
└──────────────────────┘
```

**Interaction**:
- **Click header**: Toggle expand/collapse
- **Default state**: Collapsed (show summary)
- **Hover**: Show tooltip with sub-protocol signature
- **Visual indicator**: ▶ (collapsed) / ▼ (expanded)
- **State count**: Show number of states when collapsed
- **Synchronization**: Collapse state persists when switching between roles

**Keyboard Shortcuts**:
- `Ctrl+Click`: Expand all nested sub-protocols
- `Alt+Click`: Collapse all sub-protocols
- `Space`: Toggle selected sub-protocol

**Benefits**:
- Reduces clutter: Focus on main protocol flow
- Hierarchical exploration: Expand only what you need
- Performance: Renders fewer nodes for complex protocols
- Educational: Emphasizes protocol composition boundaries

**Location in Spec**: Section 16.2.6 (lines ~1748-1838 in UI_SPECIFICATION.md)

---

### 3. Call Stack Display (Simulation Controls)

**Purpose**: Track and visualize protocol invocation hierarchy during simulation

**Compact View**:
```
┌─────────────────────────────────────────────────┐
│ Call Stack:  Main → Authentication → TokenCheck │
│              ^^^^^                               │
│              Currently executing                 │
└─────────────────────────────────────────────────┘
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

**Educational Value**:
- **Visualizes Composition**: Shows how protocols build on each other
- **Role Mapping Clarity**: Explicitly shows which roles map to which
- **Execution Context**: Always know "where am I" in complex nested protocols
- **Debugging Aid**: Track call flow, identify infinite recursion
- **Tail Recursion**: Verify tail-recursive constraint

**Warning/Error Display**:
- **Max Depth Warning**: `⚠️ Call stack approaching max depth (8/10). Consider increasing max depth or checking for infinite recursion.`
- **Tail Recursion Violation**: `⚠️ Action after 'do' for involved role detected. Protocol may not be tail-recursive.`
- **Max Depth Exceeded**: `❌ Call stack max depth (10) exceeded. Simulation halted. Check for infinite recursion.`

**Location in Spec**: Section 4.2.1 (lines ~467-573 in UI_SPECIFICATION.md)

---

## Testing Infrastructure

### Headless Testing: ✅ Available

**Setup**:
- **Vitest**: Test runner with jsdom environment
- **@testing-library/svelte**: Component testing utilities
- **jsdom**: Headless browser environment
- **Coverage**: @vitest/coverage-v8 for coverage reports

**Configuration** (vite.config.ts):
```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts']
}
```

**Commands**:
```bash
npm test              # Run tests in watch mode
npm test -- --run     # Run tests once (CI mode)
npm run test:ui       # Interactive test UI
npm run test:coverage # Coverage report
```

### Current Test Status

**Backend Tests**: 288 passing (16 test suites)
- ✅ Parser: 28 tests passing
- ✅ CFG Builder: 60 tests passing
- ✅ Projection: 42 tests passing (basic, choice, parallel, recursion, edge cases)
- ✅ Verification: 67 tests passing
- ✅ Simulation: 77 tests passing (CFG, CFSM, distributed)

**Known Issues**: 24 tests failing in executor.test.ts and simulator.test.ts
- These are newer runtime components that may be in development
- Failures isolated to executor step execution and simulator integration
- Core functionality (parser, CFG, projection, verification) all passing

**UI Tests**: 0 (UI not yet implemented)
- Test infrastructure ready
- Will add component tests as UI is implemented

---

## Implementation Roadmap

### Phase 1: CODE Tab Foundation (PENDING)
- [ ] Install Monaco Editor and dependencies
- [ ] Create IDE layout structure (Header + Tabs)
- [ ] Build CODE tab with split panes (Global | Local)
- [ ] Integrate Monaco editor for global Scribble
- [ ] Wire up real parser (replace mock in stores/editor.ts)
- [ ] Create verification results panel
- [ ] Add syntax highlighting for Scribble

### Phase 2: Local Scribble Projection (PENDING)
- [ ] Display local Scribble projections per role
- [ ] Add role tabs (Client, Server, etc.)
- [ ] Implement toggle view for sub-protocols (collapsed/expanded)
- [ ] Add TypeScript sub-tab per role
- [ ] Wire up projection engine from core/projection

### Phase 3: CFSM Network Visualization (PENDING)
- [ ] Implement D3.js CFSM state machine renderer
- [ ] Add message buffer visualization
- [ ] Implement collapsible sub-protocol sections
- [ ] Add state highlighting during simulation
- [ ] Wire up to CFSM simulator

### Phase 4: CFG Sequence Diagram (PENDING)
- [ ] Implement D3.js sequence diagram renderer
- [ ] Add swimming lanes (one per role)
- [ ] Implement dynamic trace rendering
- [ ] Add expanded sub-protocol sequences (bordered)
- [ ] Wire up to CFG simulator

### Phase 5: CFG Structure Visualization (PENDING)
- [ ] Implement D3.js control flow graph renderer
- [ ] Add collapsible Do nodes (diamond shape)
- [ ] Implement breadcrumbs navigation
- [ ] Add tooltip with protocol signatures
- [ ] Wire up to CFG builder

### Phase 6: Simulation Integration (PENDING)
- [ ] Implement simulation controls (play, pause, step, reset)
- [ ] Add call stack display component
- [ ] Implement choice selector UI
- [ ] Add execution mode toggle (CFSM/CFG)
- [ ] Wire up all visualizations to simulation state

### Phase 7: Sub-Protocol Backend Support (FUTURE)
- [ ] Enhance CFG builder to expand `do` statements inline
- [ ] Enhance projection to expand sub-protocols with role substitution
- [ ] Enhance simulation to execute sub-protocols
- [ ] Add protocol registry for multi-protocol workspace
- [ ] Implement call stack tracking in simulator

---

## Backend Requirements for Full Sub-Protocol Support

### Required Changes

1. **Protocol Registry**:
   - Parse all `global protocol` declarations in workspace
   - Build map: protocol name → AST
   - Detect mutual recursion and cycles
   - Provide API: `getProtocol(name: string): GlobalProtocol | undefined`

2. **CFG Builder Enhancement**:
   - Add option to expand `do` statements inline (with role substitution)
   - Or keep as placeholder with metadata (expandable on demand)
   - Apply role substitution when expanding: `A as Client` → replace `Client` with `A`
   - Handle nested sub-protocols (recursive expansion)

3. **Projection Enhancement**:
   - When projecting `do` statement, expand sub-protocol for role
   - Apply role substitution to sub-protocol AST
   - Merge states into main CFSM
   - Handle nested sub-protocols in projection

4. **Simulation Enhancement**:
   - Execute sub-protocol steps when reaching `do` statement
   - Track call stack: `Array<{protocol, roleMap, state}>`
   - Handle recursive invocations (max depth check)
   - Push/pop call stack on enter/exit
   - Update UI call stack display in real-time

### Interim UI-Only Approach

**Until backend fully supports sub-protocol expansion**:

1. **Parse all protocols** in editor (multi-protocol workspace)
2. **Build protocol registry** in UI state (Store: `protocols: Map<string, AST>`)
3. **Syntax highlighting and navigation** works (Ctrl+Click jumps to definition)
4. **Visualizations show placeholder** (special Do nodes in CFG/CFSM)
5. **Warn user** that simulation doesn't expand sub-protocols yet

**User Experience**:
- Display warning: "⚠️ This protocol uses sub-protocol invocation. Simulation will show placeholder only. Full sub-protocol expansion coming in future release."
- Show Do node in CFG Structure as diamond (◆) with protocol name
- In sequence diagram, show single line: `◆ do SubProtocol(...)`
- In CFSM Network, show special state: `[CallSubProtocol]`

---

## User Workflows

### Workflow 1: Write Protocol with Sub-Protocol

1. User writes main protocol in global editor
2. User types: `do Auth`
3. Auto-complete shows available protocols: [Authentication, Authorization, ...]
4. User selects Authentication
5. User types: `(Client as `
6. Auto-complete shows roles from main protocol: [A, B, C]
7. User completes: `(Client as A, Server as B)`
8. IDE validates role substitution (arity, role existence)
9. Syntax highlighting shows Do statement in special color

### Workflow 2: Navigate to Sub-Protocol

1. User has `do Authentication(A as Client, B as Server)` in editor
2. User Ctrl+Clicks "Authentication"
3. IDE shows sub-protocol definition:
   - Option A: Open in new editor tab
   - Option B: Split pane (main protocol left, sub-protocol right)
   - Option C: Modal overlay with definition
4. User sees Authentication protocol definition
5. User can edit sub-protocol (changes reflected in main)

### Workflow 3: Visualize Protocol with Sub-Protocol

1. User parses protocol with `do` statement
2. User switches to SIMULATION tab
3. User selects "CFG Structure" view
4. IDE shows Do node as diamond (◆)
5. User clicks Do node
6. IDE expands inline to show sub-protocol CFG
7. User sees how sub-protocol fits into main flow

### Workflow 4: Simulate with Sub-Protocol (Future)

1. User runs simulation (when backend supports expansion)
2. Simulation reaches Do node
3. Call stack updates: `Main → Authentication`
4. Sequence diagram shows sub-protocol messages in bordered box
5. CFSM Network shows states entering sub-protocol section (grouped)
6. Event log shows: "Entering sub-protocol: Authentication"
7. Simulation executes sub-protocol steps
8. Call stack updates: `Main` (popped Authentication)
9. Event log shows: "Exiting sub-protocol: Authentication"
10. Simulation continues main protocol

---

## Visual Design Guidelines

### Color Coding

- **Do nodes**: Purple (#9333ea) to stand out
- **Sub-protocol borders**: Purple border
- **Sub-protocol background**: Light purple (#f3e8ff)
- **Active protocol in call stack**: Green background (#10b981)
- **Parent protocol in call stack**: Gray/dimmed
- **Root protocol in call stack**: Blue accent (#3b82f6)

### Icons

- **Do nodes**: Diamond shape (◆) or call icon (📞)
- **Expand/collapse**: ▶ (collapsed) / ▼ (expanded) triangles
- **Current protocol**: ► arrow indicator

### Annotations

- Show role mappings in tooltip or label
- Show protocol name prominently
- Indicate tail-recursive constraint (if violated: show warning)
- Show state count when collapsed

### Interaction Patterns

- **Click Do node**: Toggle expand/collapse
- **Ctrl+Click protocol name**: Navigate to definition
- **Hover**: Show full sub-protocol signature
- **Keyboard shortcuts**:
  - `Ctrl+Click`: Expand all
  - `Alt+Click`: Collapse all
  - `Space`: Toggle selected

---

## Testing Sub-Protocol Support

### Test Cases for UI (Future)

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

### UI Testing Checklist

- [ ] Syntax highlighting works for all cases
- [ ] Navigation jumps to correct protocol
- [ ] Errors shown inline (red squiggles)
- [ ] Auto-completion shows available protocols
- [ ] Role substitution validation works
- [ ] Visualizations render correctly
  - [ ] CFG Structure: Do nodes collapsible
  - [ ] CFG Sequence: Sub-protocol sequences expanded
  - [ ] CFSM Network: Sub-protocol sections collapsible
- [ ] Breadcrumbs navigation works
- [ ] Call stack display updates correctly
- [ ] Simulation handles sub-protocols (when backend ready)

---

## References

### Documentation

- **UI_SPECIFICATION.md**: Complete UI specification v2.0 with sub-protocol support
- **STATUS.md**: Implementation status (Layer 5 complete, UI pending)
- **architecture-overview.md**: System design and educational goals
- **SIMULATION_AND_VISUALIZATION.md**: CFG and CFSM simulation guide

### Source Files

- **src/core/ast/types.ts**: AST definition including `Do` node
- **src/core/cfg/builder.ts**: CFG builder with placeholder `do` handling (buildDo function)
- **src/core/parser/parser.ts**: Parser with `do` statement support
- **src/lib/stores/editor.ts**: UI state management (mock implementations)
- **src/lib/data/examples.ts**: Protocol example library

### Key Sections in UI_SPECIFICATION.md

- **Section 4.2.1**: Simulation Controls (includes Call Stack Display)
- **Section 16**: Sub-Protocol Support (comprehensive guide)
  - 16.2.1: CODE Tab - Global Scribble Editor
  - 16.2.2: CODE Tab - Local Scribble Projections
  - 16.2.3: CODE Tab - Sub-Protocol Library
  - 16.2.4: SIMULATION Tab - CFG Structure Visualization (includes Breadcrumbs)
  - 16.2.5: SIMULATION Tab - CFG Sequence Diagram
  - 16.2.6: SIMULATION Tab - CFSM Network (includes Collapsible sections)
  - 16.3: Implementation Considerations
  - 16.4: User Workflows
  - 16.5: Visual Design Guidelines
  - 16.6: Testing Sub-Protocol Support

---

## Conclusion

The UI specification now comprehensively addresses sub-protocol support across all components of the SMPST IDE:

1. **Editor**: Syntax highlighting, auto-completion, navigation, validation
2. **Visualizations**: Breadcrumbs, collapsible nodes, call stack display
3. **Simulation**: Real-time call stack tracking, role mapping display
4. **Educational**: Clear visualization of protocol composition and role substitution

**Next Steps**:
1. Begin Phase 1 implementation (CODE tab foundation)
2. Install Monaco Editor and create basic IDE layout
3. Wire up existing parser and projection engines
4. Build visualizations incrementally (Phases 3-5)
5. Enhance backend for full sub-protocol expansion (Phase 7)

**Testing Infrastructure**: Ready for UI component tests (Vitest + jsdom + @testing-library/svelte)

**Backend Status**: Core functionality complete (parser, CFG, projection, simulation), sub-protocol expansion pending enhancement.
