# Scribble MPST IDE - UI Specification

**Version:** 1.0
**Date:** 2025-11-12
**Purpose:** Framework-agnostic UI specification for implementing the Scribble Multiparty Session Types IDE

---

## 1. Overview

The Scribble MPST IDE is a web-based integrated development environment for authoring, visualizing, and verifying multiparty session type protocols using the Scribble protocol language.

### 1.1 Core Design Principles

1. **Dual-View Architecture**: Support both global protocol view and per-role local views
2. **Real-time Feedback**: Immediate validation and verification results
3. **Interactive Simulation**: Step-through execution with visual state tracking
4. **Projection Visibility**: Show TypeScript code generation from protocol definitions
5. **Context Preservation**: Maintain editor state when switching between views

### 1.2 User Workflow

```
Load Protocol → Edit → Parse & Verify → Review Projections → Simulate → Generate Code
     ↑______________________________________________________________|
```

---

## 2. Application Layout

### 2.1 Overall Structure

```
┌─────────────────────────────────────────────────────────┐
│                    HEADER (Fixed)                       │
├───────────────────┬─────────────────────────────────────┤
│                   │                                     │
│   WORKSPACE       │         VISUALIZER                  │
│   TABS            │         (Protocol Graph)            │
│                   │                                     │
│   ┌─────────────┐ │                                     │
│   │  EDITOR     │ │                                     │
│   │  TABS       │ │                                     │
│   │             │ │                                     │
│   │  Code       │ │                                     │
│   │  Editor     │ │                                     │
│   └─────────────┘ │                                     │
│                   │                                     │
├───────────────────┴─────────────────────────────────────┤
│              OUTPUT PANEL (Collapsible)                 │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Layout Behavior

- **Resizable**: Horizontal divider between editor and visualizer (adjustable 30-70%)
- **Resizable**: Vertical divider above output panel (adjustable 20-40% height)
- **Responsive**: Minimum widths maintained for usability

---

## 3. Component Specifications

### 3.1 Header Component

**Type:** Fixed navigation bar
**Position:** Top of viewport, always visible

#### 3.1.1 Left Section: Branding & Navigation

**Components:**
1. **Application Title**: "Scribble MPST IDE"
   - Type: Text label with branding
   - Always visible

2. **Version Badge**: "v0.1.0"
   - Type: Static label/badge
   - Optional, informational only

3. **Protocols Dropdown**
   - Type: Dropdown menu
   - Label: "📚 Protocols" or icon with text
   - Purpose: Load example protocols
   - Contents:
     ```
     Example Protocols
     ─────────────────
     ├─ Two Buyer Protocol
     │  Simple two-party buyer protocol
     ├─ Three Buyer Protocol
     │  Multi-party negotiation protocol
     ├─ Streaming Protocol
     │  Producer-consumer streaming
     └─ Recursive Protocol
        Protocol with recursive patterns
     ```
   - Behavior:
     - Click item → Load protocol code into editor
     - Show toast notification: "Loaded: [Protocol Name]"
     - If editor has unsaved changes, show confirmation dialog

4. **New Button**
   - Type: Button
   - Label: "✚ New" or icon with text
   - Action: Clear editor, reset to empty protocol
   - Confirmation: If editor has content, confirm before clearing

#### 3.1.2 Center Section: Simulation Controls

**Purpose:** Control protocol execution simulation

**Layout:** Horizontal button group

**Components:**
1. **Play Button** (▶)
   - Starts continuous simulation
   - Disabled when: simulation running OR protocol invalid
   - Visual state: Highlighted when simulation is running

2. **Pause Button** (⏸)
   - Pauses running simulation
   - Disabled when: simulation not running

3. **Step Button** (⏭)
   - Advances simulation by one step
   - Disabled when: simulation running OR protocol invalid

4. **Reset Button** (↻)
   - Resets simulation to step 0
   - Always enabled when protocol is valid

5. **Step Counter Display**
   - Type: Read-only label
   - Format: "Step X/Y" (e.g., "Step 5/100")
   - Shows: current step / maximum steps
   - Visual indicator: Pulsing dot when simulation running

**Rationale:** Grouped in center for easy access during simulation. Controls follow standard media player conventions for familiarity.

#### 3.1.3 Right Section: Status & Actions

**Components:**
1. **Parse Status Indicator**
   - Type: Status badge with icon
   - States:
     - **Idle**: Gray dot, "Ready"
     - **Parsing**: Yellow/amber dot, "Parsing..."
     - **Success**: Green dot, "Valid Protocol"
     - **Error**: Red dot, "Parse Error"
   - Visual: Colored dot + text label

2. **Parse & Verify Button**
   - Type: Primary action button
   - Label: "▶ Parse & Verify"
   - Action: Triggers protocol parsing and verification
   - Disabled when: currently parsing
   - Visual feedback: Loading state while parsing

**Rationale:** Right-aligned primary action follows common UI patterns. Status always visible for quick feedback.

---

### 3.2 Workspace Tabs Component

**Type:** Tab navigation
**Purpose:** Switch between global protocol and role-specific local views

#### 3.2.1 Tab Structure

```
[ Global Protocol ] [ Alice ] [ Bob ] [ Carol ] ...
```

**Tab Generation:**
- First tab: Always "Global Protocol" (fixed)
- Subsequent tabs: Dynamically generated from parsed protocol roles
- Number of tabs: 1 (global) + N (roles discovered in protocol)

#### 3.2.2 Tab Behavior

**Selection:**
- Single active tab at a time
- Default: "Global Protocol" on load
- Clicking tab switches active view

**State Management:**
- Each tab maintains independent editor content
- Global tab: Contains full Scribble protocol
- Role tabs: Show projected protocol for that role
- Content persists when switching tabs (no data loss)

**Visual States:**
- Active tab: Highlighted, clear indication
- Inactive tabs: Subdued styling
- Hover state: Subtle highlight

#### 3.2.3 Content Coordination

When active tab changes:
1. Editor switches to appropriate protocol view
2. Code editor shows corresponding TypeScript (if available)
3. Visualizer updates to show relevant graph
4. Output panel maintains verification state

**Rationale:** Tab metaphor matches mental model of working on different "files". Dynamic tab generation keeps UI clean - only show roles that exist in the protocol.

---

### 3.3 Editor Component

**Type:** Dual-tab code editor
**Purpose:** Edit Scribble protocol and view generated TypeScript

#### 3.3.1 Editor Tab Structure

```
[ Scribble Protocol ] [ TypeScript (role) ]
      ^active              ^conditional
```

**Tab Availability:**
- **Scribble Protocol Tab**: Always present
- **TypeScript Tab**: Only visible in role views (not in Global Protocol view)
  - Label format: "TypeScript ({roleName})"
  - Example: "TypeScript (Alice)"

#### 3.3.2 Scribble Protocol Editor

**Type:** Code editor with syntax highlighting

**Features:**
- Syntax: Scribble protocol language
- Line numbers: Enabled
- Theme: Dark mode preferred for code visibility
- Font: Monospace (e.g., "Fira Code", "Monaco", "Consolas")
- Tab size: 2 spaces
- Auto-indentation: Enabled

**Content by View:**
- **Global Protocol View**: Editable full protocol
- **Role Views**: Read-only projected protocol for that role

**Behavior:**
- Editing allowed only in Global Protocol view
- Changes trigger "unsaved" state
- Syntax errors highlighted inline (if parser supports)

#### 3.3.3 TypeScript Editor

**Type:** Read-only code viewer with syntax highlighting

**Features:**
- Syntax: TypeScript
- Read-only: No editing allowed
- Copy button: Allow copying generated code
- Line numbers: Enabled
- Same theme as Scribble editor for consistency

**Content:**
- Shows TypeScript projection for the active role
- Generated from Scribble protocol after successful parse
- Updates automatically when protocol is re-parsed

**Empty State:**
- If no TypeScript generated: Show message "Parse protocol to generate TypeScript"

**Rationale:** Separation between Scribble and TypeScript emphasizes that TypeScript is generated output, not source. Read-only prevents confusion about editing generated code.

---

### 3.4 Visualizer Component

**Type:** Interactive graph visualization
**Purpose:** Visual representation of protocol structure and flow

#### 3.4.1 Visualization Types

**Global Protocol View:**
- **Graph Type**: Full protocol communication graph
- **Nodes**: Roles (participants)
- **Edges**: Messages exchanged between roles
- **Labels**: Message types and directions

**Role-Specific View:**
- **Graph Type**: Local choreography for selected role
- **Nodes**: States in role's execution
- **Edges**: Transitions (send/receive operations)
- **Labels**: Message names and actions

#### 3.4.2 Graph Features

**Layout:**
- Algorithm: Force-directed or hierarchical (based on protocol complexity)
- Auto-zoom: Fit graph to viewport on render
- Panning: Drag to pan around large graphs
- Zooming: Mouse wheel or pinch gesture

**Interactivity:**
- **Node hover**: Show tooltip with role/state details
- **Edge hover**: Show message signature
- **Node click**: Highlight related edges
- **Selection**: Highlight paths through graph

**Simulation Integration:**
- **Active state highlighting**: Current step in simulation highlighted
- **Path tracing**: Show execution path up to current step
- **Animation**: Smooth transitions between steps

#### 3.4.3 Visual Styling

**Nodes:**
- Shape: Circles for roles, rectangles for states
- Color coding: Distinguish role types or state types
- Size: Proportional to importance or degree

**Edges:**
- Directed arrows showing message flow
- Thickness: Standard, not weighted
- Style: Solid for messages, dashed for choices
- Labels: Message names positioned along edge

**Empty State:**
- When no protocol parsed: Show message "Parse a protocol to visualize"

**Rationale:** Visual representation aids understanding of complex protocols. Interactive features support exploration. Simulation integration shows runtime behavior.

---

### 3.5 Output Panel Component

**Type:** Collapsible tabbed panel
**Purpose:** Display verification results, projections, and errors

#### 3.5.1 Panel Structure

**Layout:**
```
[v] Output Panel                           [Collapse Button]
    ┌───────────────────────────────────────────────────┐
    │ [ Verification ] [ Projection ] [ Errors (N) ]    │
    ├───────────────────────────────────────────────────┤
    │                                                   │
    │          Tab Content Area                         │
    │                                                   │
    └───────────────────────────────────────────────────┘
```

**Collapse Behavior:**
- Clickable header or toggle button
- Collapsed: Only header visible, content hidden
- Expanded: Full panel with tabs and content
- State persists across protocol changes

#### 3.5.2 Tabs

**Tab 1: Verification**

**Purpose:** Show protocol correctness verification results

**Content Structure:**
```
Verification Results
────────────────────
✓ Well-formedness check: PASSED
✓ Deadlock freedom: PASSED
✓ Liveness: PASSED
✗ Type safety: FAILED
  └─ Error on line 15: Type mismatch in message 'quote'

Overall: FAILED (1 error)
```

**Display Format:**
- List of verification checks
- Each check: Icon (✓/✗) + description + status
- Nested errors with line numbers and descriptions
- Overall summary at bottom

**States:**
- **Not Run**: "Parse protocol to verify"
- **Running**: Loading indicator
- **Complete**: Show results with visual indicators

**Rationale:** Hierarchical display makes it easy to scan for issues. Line numbers enable quick navigation to errors.

---

**Tab 2: Projection**

**Purpose:** Show role projection summary and availability

**Content Structure:**
```
Role Projections
────────────────
Available roles: 3

✓ Alice
  └─ 15 states, 8 transitions
  └─ TypeScript generated

✓ Bob
  └─ 12 states, 6 transitions
  └─ TypeScript generated

✓ Carol
  └─ 8 states, 4 transitions
  └─ TypeScript generated

Actions:
[ View Alice ] [ View Bob ] [ View Carol ]
```

**Display Elements:**
- List of projected roles
- Each role: Success icon + name + statistics
- TypeScript generation status
- Action buttons to switch to role view

**Interaction:**
- Click role name OR action button → Switch to that role's tab in workspace
- Shows overview of what was generated

**Empty State:**
- "No projections available. Parse a valid protocol."

**Rationale:** Provides overview of projection output and quick navigation to role views. Statistics give insight into complexity.

---

**Tab 3: Errors**

**Purpose:** Consolidated error display from parsing and verification

**Tab Label:**
- Shows count: "Errors" (no errors) or "Errors (N)" (N errors)
- Badge/indicator on tab when errors present

**Content Structure:**
```
Parse Errors (2)
────────────────
Line 12, Column 5:
Unexpected token 'from'. Expected 'to' or ';'
  11 | message quote(int) to Seller;
  12 | message accept(int) from Buyer;
     |                     ^
  13 | }

Line 18, Column 1:
Unterminated global protocol block
  17 |   choice at Buyer { ... }
  18 | // Missing closing brace
     | ^

Verification Errors (1)
────────────────────────
Line 15:
Type mismatch in message 'quote'
Expected: string
Received: int
```

**Display Format:**
- Grouped by error type (Parse / Verification)
- Each error:
  - Location: Line, column
  - Message: Clear description
  - Context: Code snippet with error location marked
  - Suggestion: Fix hint (if available)

**Visual Elements:**
- Line highlight in code context
- Monospace font for code snippets
- Color coding: Red for errors, yellow for warnings

**Empty State:**
- "No errors. Protocol is valid! ✓"

**Interaction:**
- Click error → Jump to that line in editor
- Highlight error line in editor when error selected

**Rationale:** Consolidated view of all issues. Code context helps understand errors without switching views. Click-to-navigate speeds up fixing.

---

### 3.6 Notification System

**Type:** Toast/banner notifications
**Purpose:** Transient feedback for user actions

#### 3.6.1 Notification Types

**Success:**
- Color: Green
- Icon: Checkmark
- Examples:
  - "Protocol parsed successfully"
  - "Loaded: Two Buyer Protocol"
  - "Verification passed"

**Error:**
- Color: Red
- Icon: X or exclamation
- Examples:
  - "Parse failed"
  - "Verification failed"
  - "Failed to load protocol"

**Warning:**
- Color: Yellow/amber
- Icon: Exclamation triangle
- Examples:
  - "Unsaved changes will be lost"
  - "Protocol complexity may affect performance"

**Info:**
- Color: Blue
- Icon: Info circle
- Examples:
  - "Simulation started"
  - "Simulation paused"
  - "New protocol created"

#### 3.6.2 Notification Behavior

**Placement:** Top-right corner of viewport (below header)

**Duration:**
- Success/Info: 3 seconds
- Warning: 5 seconds
- Error: 5 seconds or until dismissed

**Dismissal:**
- Auto-dismiss after duration
- Close button for manual dismissal
- Click notification to dismiss

**Stacking:**
- Multiple notifications stack vertically
- Newest on top
- Max 3 visible, older ones queued

**Rationale:** Non-blocking feedback that doesn't interrupt workflow. Positioned away from main content area. Color-coded for quick recognition.

---

## 4. State Management

### 4.1 Application State

**Core State Objects:**

```typescript
interface EditorState {
  globalProtocol: string;           // Full protocol source
  roleProtocols: Map<string, string>; // Role name → projected protocol
  currentView: 'global' | string;    // Active view (global or role name)
  isDirty: boolean;                  // Has unsaved changes
}

interface ParseState {
  status: 'idle' | 'parsing' | 'success' | 'error';
  errors: ParseError[];
  ast: ProtocolAST | null;          // Parsed abstract syntax tree
  roles: string[];                   // Discovered roles
}

interface VerificationState {
  results: VerificationResult[];     // Individual check results
  overall: 'passed' | 'failed' | 'not_run';
}

interface ProjectionState {
  projections: Map<string, RoleProjection>; // Role → projection
  typescriptCode: Map<string, string>;      // Role → generated TS
}

interface SimulationState {
  running: boolean;
  step: number;
  maxSteps: number;
  currentRoleStates: Map<string, any>; // Role → execution state
  messageQueue: Message[];
}

interface UIState {
  outputPanelCollapsed: boolean;
  editorWidthPercent: number;        // Horizontal split position
  outputHeightPercent: number;       // Vertical split position
  activeOutputTab: 'verification' | 'projection' | 'errors';
}
```

### 4.2 State Flow

```
User Action
    ↓
State Update
    ↓
UI Re-render
    ↓
Side Effects (parse, verify, etc.)
    ↓
State Update
    ↓
UI Re-render
```

### 4.3 Key State Transitions

**Parse Flow:**
```
Edit Protocol
    → status: 'parsing'
    → Run parser
    → status: 'success' or 'error'
    → Update roles, projections
    → Update visualizer
```

**View Switch Flow:**
```
Click Workspace Tab
    → Save current editor content
    → Update currentView
    → Load appropriate protocol
    → Update editor content
    → Update visualizer
    → Update TypeScript editor visibility
```

**Simulation Flow:**
```
Click Play
    → running: true
    → Start interval timer
    → step: increment each tick
    → Update visualizer highlighting
    → If step === maxSteps: stop
```

---

## 5. Data Flow & Integration Points

### 5.1 Parser Integration

**Input:** Scribble protocol source (string)

**Process:**
1. Lexical analysis → tokens
2. Syntax analysis → AST
3. Semantic analysis → validation

**Output:**
```typescript
interface ParseResult {
  success: boolean;
  ast?: ProtocolAST;
  roles?: string[];
  errors?: ParseError[];
}
```

**UI Response:**
- Success: Update parse status, generate tabs for roles, enable verification
- Failure: Show errors in errors tab, highlight in editor

### 5.2 Verification Integration

**Input:** Parsed AST

**Process:**
1. Well-formedness check
2. Deadlock detection
3. Liveness analysis
4. Type checking

**Output:**
```typescript
interface VerificationResult {
  checkName: string;
  passed: boolean;
  errors?: VerificationError[];
  warnings?: Warning[];
}
```

**UI Response:**
- Display results in Verification tab
- Update parse status indicator
- Show error count on Errors tab

### 5.3 Projection Integration

**Input:** Parsed AST + role name

**Process:**
1. Extract role's local view from global protocol
2. Generate CFG (Control Flow Graph)
3. Simplify and optimize
4. Generate TypeScript code

**Output:**
```typescript
interface RoleProjection {
  roleName: string;
  localProtocol: string;      // Projected Scribble
  cfg: ControlFlowGraph;
  typescript: string;         // Generated code
  stats: {
    stateCount: number;
    transitionCount: number;
  };
}
```

**UI Response:**
- Populate role tabs with projected protocols
- Generate TypeScript editors
- Display projection summary
- Update visualizer with role-specific graph

### 5.4 Simulation Integration

**Input:** Projection CFG + simulation step

**Process:**
1. Initialize role states
2. Execute step-by-step through CFG
3. Track message passing
4. Update active states

**Output:**
```typescript
interface SimulationStep {
  step: number;
  activeStates: Map<string, string>; // Role → current state ID
  messages: Message[];               // Messages in flight
  trace: TraceEvent[];              // Execution history
}
```

**UI Response:**
- Highlight active nodes in visualizer
- Update step counter
- Show message queue
- Enable/disable simulation controls

---

## 6. Interaction Patterns

### 6.1 Primary Workflows

**Workflow 1: Load and Verify Protocol**
```
1. User clicks "Protocols" dropdown
2. User selects example (e.g., "Two Buyer Protocol")
3. System loads protocol into global editor
4. System shows success notification
5. User clicks "Parse & Verify"
6. System updates status to "Parsing..."
7. System parses protocol
8. System generates role tabs (Alice, Bob, Seller)
9. System updates status to "Valid Protocol"
10. System shows verification results in Output Panel
```

**Workflow 2: Explore Role Projections**
```
1. User clicks "Alice" workspace tab
2. System switches editor to Alice's local protocol (read-only)
3. System shows TypeScript tab next to Scribble tab
4. System updates visualizer to show Alice's CFG
5. User clicks "TypeScript (Alice)" editor tab
6. System displays generated TypeScript code
7. User copies code for external use
```

**Workflow 3: Simulate Protocol Execution**
```
1. User ensures protocol is parsed and valid
2. User clicks "Play" button
3. System starts simulation (step counter increments)
4. Visualizer animates through states
5. User clicks "Pause" button
6. User clicks "Step" button to advance manually
7. User observes state changes in visualizer
8. User clicks "Reset" to restart
```

**Workflow 4: Fix Parse Errors**
```
1. User edits protocol in global editor
2. User clicks "Parse & Verify"
3. System detects syntax error
4. System updates status to "Parse Error"
5. System shows error in Errors tab with badge "Errors (1)"
6. User clicks Errors tab
7. System displays error with line number and context
8. User clicks error entry
9. System jumps to error line in editor
10. User fixes error and re-parses
```

### 6.2 Keyboard Shortcuts (Recommended)

- `Cmd/Ctrl + S`: Parse & Verify
- `Cmd/Ctrl + N`: New Protocol
- `Cmd/Ctrl + [1-9]`: Switch workspace tabs
- `Space`: Play/Pause simulation
- `→`: Step forward (when simulation paused)
- `Cmd/Ctrl + R`: Reset simulation
- `Cmd/Ctrl + /`: Toggle output panel

---

## 7. Visual Design Guidelines

### 7.1 Color Semantics

**Status Colors:**
- Success/Valid: Green (#10b981)
- Error/Invalid: Red (#ef4444)
- Warning: Amber (#f59e0b)
- Info/Neutral: Blue (#3b82f6)
- Parsing/Loading: Gray (#6b7280)

**Interaction Colors:**
- Primary Action: Blue
- Secondary Action: Gray
- Destructive Action: Red
- Disabled: Light gray with reduced opacity

### 7.2 Typography

**Hierarchy:**
- H1 (App Title): 24px, bold
- H2 (Section Titles): 18px, semi-bold
- H3 (Subsection Titles): 16px, semi-bold
- Body: 14px, regular
- Small/Secondary: 12px, regular
- Code: 13px, monospace

**Font Families:**
- UI Text: System font stack (San Francisco, Segoe UI, Roboto)
- Code: Monospace (Fira Code, JetBrains Mono, Monaco)

### 7.3 Spacing & Rhythm

**Base Unit:** 4px (0.25rem)

**Common Spacings:**
- XS: 4px (0.25rem)
- S: 8px (0.5rem)
- M: 16px (1rem)
- L: 24px (1.5rem)
- XL: 32px (2rem)

**Component Padding:**
- Buttons: 8px 16px
- Tabs: 12px 16px
- Panels: 16px
- Editor: 16px

### 7.4 Motion & Animation

**Principles:**
- Animations should be subtle and purposeful
- Duration: 150-300ms for most transitions
- Easing: ease-in-out for smooth motion

**Use Cases:**
- Tab switching: 200ms fade
- Panel collapse: 300ms slide
- Notification appear/disappear: 200ms fade + slide
- Simulation step: 300ms highlight transition
- Graph node highlight: 150ms color transition

---

## 8. Accessibility Requirements

### 8.1 Keyboard Navigation

- All interactive elements must be keyboard accessible
- Clear focus indicators on all focusable elements
- Logical tab order through interface
- Skip links for quick navigation to main sections

### 8.2 Screen Reader Support

- Semantic HTML elements (button, nav, main, etc.)
- ARIA labels on icon-only buttons
- ARIA live regions for dynamic content (notifications, status updates)
- Alternative text for visual elements

### 8.3 Visual Accessibility

- Minimum contrast ratio: 4.5:1 for text, 3:1 for UI elements
- Color not used as sole indicator (icons/text alongside)
- Resizable text (up to 200%)
- Focus indicators clearly visible

### 8.4 Error Handling

- Clear error messages with actionable guidance
- Error states announced to screen readers
- Errors associated with relevant form fields
- No timeout on error messages (user can dismiss)

---

## 9. Performance Considerations

### 9.1 Editor Performance

- **Large Files**: Efficiently handle protocols up to 10,000 lines
- **Syntax Highlighting**: Async or Web Worker-based to avoid blocking
- **Debouncing**: Debounce parse triggers (500ms after last edit)

### 9.2 Visualization Performance

- **Graph Rendering**: Use canvas for graphs >100 nodes
- **Animation**: RequestAnimationFrame for smooth updates
- **Lazy Rendering**: Render visible portion of large graphs

### 9.3 Data Loading

- **Example Protocols**: Lazy load, cache after first load
- **Generated Code**: Generate on-demand, cache results
- **State Persistence**: Debounce saves to localStorage (1s)

---

## 10. Error States & Empty States

### 10.1 Empty States

**No Protocol Loaded:**
- Editor: "Start by loading an example protocol or create a new one"
- Visualizer: "Parse a protocol to visualize its structure"
- Output Panel: All tabs show "Parse a protocol to see results"

**No Roles Found:**
- Workspace tabs: Only show "Global Protocol"
- Message: "No roles found in protocol. Check protocol syntax."

**No TypeScript Generated:**
- TypeScript editor: "Parse protocol successfully to generate TypeScript code"

### 10.2 Error States

**Parse Failed:**
- Editor: Inline error indicators at error lines
- Status: "Parse Error" in red
- Output Panel: Errors tab active with full details
- Actions: "Parse & Verify" button remains enabled for retry

**Verification Failed:**
- Status: "Verification Failed" in red
- Verification tab: Show which checks failed
- Simulation: Disabled until verification passes

**Network/System Errors:**
- Modal dialog or prominent banner
- Message: Clear explanation of what went wrong
- Actions: Retry button or guidance to resolve

---

## 11. Responsive Behavior

### 11.1 Breakpoints

- **Desktop Large**: >1920px - Full layout, all features visible
- **Desktop**: 1280-1920px - Standard layout
- **Tablet**: 768-1279px - Reduced padding, collapsible panels
- **Mobile**: <768px - Single column, tabs as dropdown, hide visualizer by default

### 11.2 Adaptive Layout

**Tablet (768-1279px):**
- Reduce editor width minimum to 35%
- Collapse output panel by default
- Smaller button sizes
- Condensed header spacing

**Mobile (<768px):**
- Stack editor and visualizer vertically
- Convert workspace tabs to dropdown selector
- Full-width buttons
- Simplified header (hamburger menu for protocols)
- Hide simulation controls in compact mode, show in modal

---

## 12. Extensibility Points

### 12.1 Plugin Architecture (Future)

**Editor Plugins:**
- Custom syntax highlighting themes
- Auto-completion providers
- Linting rules
- Code snippets

**Visualizer Plugins:**
- Alternative graph layouts
- Custom node/edge renderers
- Export formats (SVG, PNG, PDF)

**Protocol Loaders:**
- Import from URL
- Import from file system
- Integration with Git repositories

### 12.2 Customization Options

**User Preferences:**
- Editor theme (light/dark)
- Font size and family
- Key bindings
- Auto-save interval
- Default panel sizes

**Workspace Settings:**
- Default example protocol on load
- Simulation speed
- Graph layout algorithm
- TypeScript generation options

---

## 13. Testing Requirements

### 13.1 Component Testing

- Each UI component tested in isolation
- Verify props, events, and state changes
- Test keyboard interactions
- Test accessibility features

### 13.2 Integration Testing

- Test workflows end-to-end (see section 6.1)
- Verify state management across components
- Test data flow from parser through visualization
- Test error handling and recovery

### 13.3 E2E Testing

- Automate primary user workflows
- Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- Test on different screen sizes
- Test with screen readers (NVDA, JAWS, VoiceOver)

---

## 14. Implementation Notes

### 14.1 Technology Considerations

**Framework Agnostic:**
This specification can be implemented in:
- React + TypeScript
- Vue 3 + TypeScript
- Svelte/SvelteKit
- Angular
- Vanilla Web Components

**Required Capabilities:**
- Component-based architecture
- Reactive state management
- Tab/router state management
- Code editor integration (CodeMirror, Monaco, etc.)
- Graph visualization library (D3.js, Cytoscape.js, vis.js)

### 14.2 Iteration Strategy

**Phase 1: Core Editor**
- Basic layout (header, editor, visualizer)
- Global protocol editing
- Parse integration
- Basic status display

**Phase 2: Multi-View**
- Workspace tabs
- Role projections
- TypeScript generation
- View switching

**Phase 3: Verification & Output**
- Output panel with tabs
- Verification integration
- Error display and navigation
- Projection summary

**Phase 4: Simulation**
- Simulation controls
- Step-through execution
- Visualizer animation
- State tracking

**Phase 5: Polish**
- Notifications
- Keyboard shortcuts
- Accessibility improvements
- Performance optimization
- Responsive design

---

## 15. Rationale Summary

### 15.1 Key Design Decisions

**Dual-View Architecture:**
- **Decision**: Separate global and per-role views with tabs
- **Rationale**: Mirrors the conceptual separation in MPST theory. Users think in terms of "global protocol" vs "what Alice does". Tabs provide clean switching without overwhelming single view.

**Read-Only Role Views:**
- **Decision**: Role protocol editors are read-only, only global is editable
- **Rationale**: Role protocols are derived/projected from global protocol. Making them read-only prevents confusion about source of truth and prevents divergence.

**Embedded TypeScript Tabs:**
- **Decision**: TypeScript shown as additional tab within editor, not separate pane
- **Rationale**: Emphasizes that TypeScript is alternate representation of same protocol, not separate artifact. Reduces visual clutter compared to side-by-side panes.

**Collapsible Output Panel:**
- **Decision**: Output panel can collapse to maximize editor space
- **Rationale**: Once user verifies protocol is correct, they don't need verification results visible. Collapsing maximizes space for editing and visualization.

**Integrated Simulation:**
- **Decision**: Simulation controls in header, visualization inline
- **Rationale**: Keeps simulation as first-class feature, always accessible. Inline visualization avoids modal or separate window, maintains context.

**Error Navigation:**
- **Decision**: Clicking error jumps to line in editor
- **Rationale**: Reduces friction in edit-parse-fix cycle. Common pattern in IDEs increases familiarity.

**Example Protocol Dropdown:**
- **Decision**: Easy access to examples via dropdown
- **Rationale**: Lowers learning barrier for new users. Provides templates for common patterns. Demonstrates tool capabilities quickly.

### 15.2 Tradeoffs

**Tabs vs. Split Panes:**
- **Chosen**: Tabs
- **Alternative**: Side-by-side global/role views
- **Tradeoff**: Tabs save screen space but require switching. Split panes show multiple views but reduce per-view space. Tabs chosen for cleaner layout and most users focus on one view at a time.

**Embedded vs. Separate TypeScript:**
- **Chosen**: Embedded as editor tab
- **Alternative**: Separate panel/pane
- **Tradeoff**: Embedded saves space, separate allows simultaneous viewing. Embedded chosen because TypeScript is output, not requiring constant visibility.

**Auto-Parse vs. Manual:**
- **Chosen**: Manual parse button
- **Alternative**: Auto-parse on edit (debounced)
- **Tradeoff**: Manual gives user control, auto provides instant feedback. Manual chosen because parsing may be expensive for large protocols and user may want to finish edits before parsing.

**Fixed vs. Floating Simulation Controls:**
- **Chosen**: Fixed in header
- **Alternative**: Floating toolbar or contextual controls
- **Tradeoff**: Fixed is always accessible but takes permanent space. Floating can obstruct content. Fixed chosen for consistency and avoiding layout shift.

---

## 16. Conclusion

This specification defines a comprehensive UI for the Scribble MPST IDE that supports the full workflow from protocol authoring through verification and simulation to code generation.

**Core Strengths:**
- Clear separation of concerns (global vs. local views)
- Integrated verification and visualization
- Interactive simulation for understanding behavior
- Code generation visibility

**Next Steps:**
1. Review specification with stakeholders
2. Create UI mockups/wireframes
3. Implement in phases (see section 14.2)
4. User testing and iteration
5. Backend integration (parser, verifier, projector)

**Maintenance:**
- Keep specification updated as features evolve
- Document design decisions and rationale for future reference
- Version specification alongside implementation

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Status:** Ready for Implementation
