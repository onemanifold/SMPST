# Frontend-Backend Feature Parity Methodology

**Purpose:** Ensure frontend FULLY implements backend capabilities across all sessions

**Created:** 2025-11-18

---

## The Problem

Frontend implementations often suffer from **partial implementation syndrome**:

1. **Silent Property Drops**: Backend returns 16 properties, frontend uses 7
2. **Feature Gaps**: Backend has backward stepping, frontend doesn't expose it
3. **Degraded UX**: Users see incomplete features and assume limitations
4. **Knowledge Loss**: Next session doesn't know what's missing

**Root Cause:** No systematic methodology for ensuring frontend-backend parity

---

## The Solution: 4-Step Backend Contract Methodology

### Step 1: Catalog Backend Capabilities

**Goal:** Comprehensive inventory of ALL backend modules and their capabilities

**Process:**
```bash
# 1. Find all backend type definition files
find src/core -name "types.ts" -o -name "*-types.ts"

# 2. Read each type file
# 3. Document interfaces, return types, configuration options
# 4. Group by module/feature area
```

**Output:** Structured catalog of capabilities

**Example (Simulation):**
```markdown
## CFGSimulator

### Configuration Options
- maxSteps: number
- recordTrace: boolean
- choiceStrategy: 'manual' | 'random' | 'first'
- previewLimit: number
- protocolRegistry: IProtocolRegistry
- callStackManager: ICallStackManager
- executionHistory: IExecutionHistory

### Return Types
- CFGStepResult { success, event, error, state }
- CFGRunResult { success, steps, state, error }
- CFGExecutionState { currentNode, visitedNodes, stepCount, ... }
- CFGExecutionTrace { events, startTime, endTime, ... }

### Event Types
- MessageEvent, ChoiceEvent, RecursionEvent, ParallelEvent, SubProtocolEvent, StateChangeEvent
```

---

### Step 2: Analyze Current Frontend Implementation

**Goal:** Document what frontend currently exposes

**Process:**
```bash
# 1. Find relevant store files
find src/lib/stores -name "*.ts" | grep -v __tests__

# 2. Find relevant component files
find src/lib/components -name "*.svelte"

# 3. For each module:
#    - Read store implementation
#    - Read UI components
#    - List exposed properties
#    - List exposed actions
```

**Output:** Current exposure inventory

**Example (Simulation):**
```markdown
## Current UI Implementation

### Exposed Properties
- executionState: CFGExecutionState (PARTIAL - missing recursionStack, activeBranches)
- isPlaying: boolean
- canStep: boolean
- isAtChoice: boolean
- availableChoices: ChoiceOption[] (INCOMPLETE - no previews)

### Exposed Actions
- stepSimulation()
- makeChoice(index)
- resetSimulation()
- startPlaying()
- pauseSimulation()

### Missing
- Execution events (ALL)
- Execution trace
- Backward stepping
- Choice previews
- Parallel state
- Recursion stack
```

---

### Step 3: Create Gap Analysis Document

**Goal:** Systematic identification of missing capabilities

**Process:**
1. Compare Step 1 (backend) with Step 2 (frontend)
2. For each backend capability:
   - Status: ✅ USED | ⚠️ PARTIAL | ❌ IGNORED
   - Current behavior
   - Why it matters
   - Impact on users
3. Categorize by priority: CRITICAL | HIGH | MEDIUM | LOW
4. Estimate implementation effort

**Template:**
```markdown
### Missing: [Feature Name] - [PRIORITY]

**What Backend Provides:**
```typescript
// Type definition
```

**Current UI Behavior:** [What users see now]

**Why It Matters:** [Impact explanation]

**Example Missing Functionality:** [Concrete example]

**UI Gap:** [Mockup or description of missing UI]
```

**Output:** `docs/[MODULE]_BACKEND_CONTRACT_GAPS.md`

**Examples:**
- `docs/EDITOR_BACKEND_CONTRACT_GAPS.md` (completed)
- `docs/SIMULATION_BACKEND_CONTRACT_GAPS.md` (just created)

---

### Step 4: Create Implementation Plan

**Goal:** Phased roadmap to 100% backend parity

**Process:**
1. Group missing features into logical phases
2. Order phases by priority and dependencies
3. For each phase:
   - Clear goal statement
   - Specific steps
   - Store changes required
   - UI changes required
   - Test requirements
   - Time estimate

**Template:**
```markdown
### Phase N: [Phase Name] ([PRIORITY])

**Goal:** [One-sentence description]

**Steps:**
1. [Specific action]
2. [Specific action]

**Store Changes:**
```typescript
// Code showing new stores/actions
```

**UI Changes:**
```svelte
// Mockup showing new UI elements
```

**Tests:**
```typescript
// Test descriptions
```

**Estimated Effort:** X hours
```

**Output:** Implementation plan section in gap analysis document

---

## TypeScript Contract Enforcement

### Purpose
Prevent partial implementations through compile-time checks

### Pattern 1: Contract Handlers

**Problem:** Backend returns 5 properties, frontend uses 2, TypeScript doesn't complain

**Solution:** Force handling via explicit contract handlers

```typescript
// Backend type
interface StepResult {
  success: boolean;
  state: ExecutionState;
  event?: Event;
  error?: Error;
}

// Contract handler type
interface StepResultHandler {
  onSuccess: (state: ExecutionState, event?: Event) => void;
  onError: (error: Error, state: ExecutionState) => void;
}

// Contract handler function
export function handleStepResult(
  result: StepResult,
  handler: StepResultHandler
): void {
  if (!result.success || result.error) {
    handler.onError(result.error ?? { type: 'unknown', message: 'Unknown error' }, result.state);
  } else {
    handler.onSuccess(result.state, result.event);
  }
  // ALL properties handled - TypeScript enforces this
}

// WRONG: Direct usage (can ignore properties)
const result = simulator.step();
executionState.set(result.state);  // ❌ Ignored event and error!

// CORRECT: Via contract handler (TypeScript enforces completeness)
const result = simulator.step();
handleStepResult(result, {
  onSuccess: (state, event) => {
    executionState.set(state);        // ✅ State handled
    if (event) {
      executionEvents.update(e => [...e, event]);  // ✅ Event handled
    }
  },
  onError: (error, state) => {
    executionState.set(state);        // ✅ State preserved
    lastError.set(error);             // ✅ Error exposed
  }
});
```

---

### Pattern 2: Exhaustive Type Checking

**Problem:** Backend adds new event type, frontend doesn't handle it

**Solution:** Use exhaustive switch with `never` type

```typescript
function formatEvent(event: CFGExecutionEvent): string {
  switch (event.type) {
    case 'message':
      return `${event.from} → ${event.to}: ${event.label}`;
    case 'choice':
      return `Choice ${event.choiceIndex} selected`;
    case 'recursion':
      return `Recursion ${event.action}: ${event.label}`;
    case 'parallel':
      return `Parallel ${event.action}`;
    case 'subprotocol':
      return `SubProtocol ${event.action}: ${event.protocol}`;
    case 'state-change':
      return `${event.fromNode} → ${event.toNode}`;
    default:
      // TypeScript error if any case not handled!
      const exhaustive: never = event;
      throw new Error(`Unhandled event type: ${exhaustive}`);
  }
}
```

---

### Pattern 3: Interface Completeness Validation

**Problem:** Store exposes partial view of backend state

**Solution:** Type derivation that requires ALL properties

```typescript
// Backend state (complete)
interface CFGExecutionState {
  currentNode: string | string[];
  visitedNodes: string[];
  stepCount: number;
  completed: boolean;
  atChoice: boolean;
  availableChoices?: EnhancedChoiceOption[];
  inParallel: boolean;
  activeBranches?: string[][];
  reachedMaxSteps: boolean;
  recursionStack: RecursionContext[];
}

// Frontend exposure - MUST include ALL properties
export interface SimulationStateExposure {
  // Direct mappings
  currentNode: Writable<string | string[]>;
  visitedNodes: Writable<string[]>;
  stepCount: Readable<number>;
  completed: Readable<boolean>;

  // Derived stores
  isAtChoice: Readable<boolean>;
  availableChoices: Readable<EnhancedChoiceOption[]>;
  isInParallel: Readable<boolean>;
  activeBranches: Readable<string[][]>;

  // Flags
  hasReachedMaxSteps: Readable<boolean>;
  recursionStack: Readable<RecursionContext[]>;
}

// Validation: TypeScript ensures we handle ALL properties
type ValidateExposure<T extends CFGExecutionState> = {
  [K in keyof T]: Writable<T[K]> | Readable<T[K]>;
};

// If any property missing, TypeScript error!
const _validate: ValidateExposure<CFGExecutionState> = {} as any as SimulationStateExposure;
```

---

## Test-Driven Feature Exposure

### Purpose
Document missing capabilities through tests BEFORE implementation

### Pattern: Todo Tests as Specification

**Process:**
1. For each backend capability, write a `.todo()` test
2. Test describes WHAT should be exposed and HOW
3. Implement feature
4. Convert `.todo()` to passing test
5. Commit with test results in message

**Example:**
```typescript
describe('Simulation Store - Execution Events', () => {
  it.todo('should expose message events', async () => {
    // TODO: Message events are emitted by simulator but not exposed
    // Expected: executionEvents store contains MessageEvent objects
    // Current: No store for events

    // await stepSimulation();
    // const events = get(executionEvents);
    // expect(events).toContainEqual({
    //   type: 'message',
    //   from: 'Client',
    //   to: 'Server',
    //   label: 'login',
    //   // ...
    // });
  });

  it.todo('should filter events by type', async () => {
    // TODO: Users need to filter event log
    // Expected: Derived stores for each event type
    // Current: No event stores at all
  });

  it.todo('should clear events on reset', async () => {
    // TODO: Events should reset with simulation
    // Expected: executionEvents.set([]) on reset
    // Current: No events to clear
  });
});

describe('Simulation Store - Backward Stepping', () => {
  it.todo('should enable step back button when history available', async () => {
    // TODO: Execution history not implemented
    // Expected: canStepBack derived store
    // Current: No history system
  });

  it.todo('should restore previous state when stepping back', async () => {
    // TODO: Backward stepping not implemented
    // Expected: stepBack() restores snapshot
    // Current: No history
  });
});
```

---

## Cross-Session Persistence

### Purpose
Ensure methodology persists across AI assistant sessions

### Implementation

**1. Document Patterns in `.claude/`**

Create methodology files that AI assistants read on session start:

```
.claude/
├── README.md (updated with simulation patterns)
├── development-philosophy.md
├── store-development-protocol.md (updated)
├── testing-strategy.md
├── backend-contract-checklist.md (NEW)
└── simulation-development-protocol.md (NEW)
```

**2. Backend Contract Checklist**

`.claude/backend-contract-checklist.md`:
```markdown
# Backend Contract Checklist

For ANY feature touching backend:

## Phase 1: Discovery
- [ ] Find backend type definitions
- [ ] Read all interfaces and return types
- [ ] Document configuration options
- [ ] List all properties

## Phase 2: Gap Analysis
- [ ] Compare with current frontend
- [ ] Mark each property: ✅ USED | ⚠️ PARTIAL | ❌ IGNORED
- [ ] Create gap analysis document in docs/
- [ ] Prioritize missing features

## Phase 3: Contract Enforcement
- [ ] Create contract handlers in src/lib/stores/contracts/
- [ ] Use TypeScript exhaustive checks
- [ ] Validate interface completeness

## Phase 4: Test-Driven Exposure
- [ ] Write .todo() tests for ALL missing features
- [ ] Implement features phase-by-phase
- [ ] Convert .todo() to passing tests
- [ ] Update gap analysis document

## Phase 5: Documentation
- [ ] Update gap analysis with "IMPLEMENTED" status
- [ ] Document new stores/components
- [ ] Update user-facing docs
```

---

## Metrics for Success

### Backend Parity Score

**Formula:**
```
Parity Score = (Exposed Properties / Total Backend Properties) × 100%
```

**Calculation Example (Simulation):**
```
CFGSimulator:
- Total capabilities: 40 (config options, events, state properties)
- Currently exposed: 6
- Parity Score: 15%

Target: 100%
```

**Tracking:**
- Maintain in gap analysis document
- Update after each phase
- Never mark complete until 100%

---

### Test Coverage Growth

**Metrics:**
- Tests passing (count)
- Tests todo (count)
- Parity Score: `passing / (passing + todo) × 100%`

**Example:**
```
Editor Store:
- Phase 0: 21 passing, 14 todo → 60% coverage
- Phase 4: 39 passing, 1 todo → 97.5% coverage

Simulation Store:
- Current: ??? (need to establish baseline)
- Target: 100%
```

---

## Real-World Application: Simulation Example

### Before Methodology
```
❌ No gap analysis
❌ No systematic review
❌ Implemented 15% of backend
❌ No idea what's missing
❌ No plan to reach completion
```

### After Methodology
```
✅ Gap analysis created (SIMULATION_BACKEND_CONTRACT_GAPS.md)
✅ Systematic review completed
✅ Identified 15% implementation, 85% missing
✅ Clear understanding of gaps
✅ 6-phase plan to 100%
✅ Estimated effort: 15-22 hours
```

---

## Implementation Workflow

### For Any New Feature

```
┌─────────────────────────────────────┐
│ 1. User Requests Feature           │
│    "Can we add simulation controls?"│
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Catalog Backend Capabilities     │
│    Read: src/core/simulation/*.ts   │
│    Output: Full capability list     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. Analyze Current Frontend         │
│    Read: src/lib/stores/*.ts        │
│    Read: src/lib/components/*.svelte│
│    Output: Current exposure list    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. Create Gap Analysis              │
│    Compare backend vs frontend      │
│    Output: docs/*_GAPS.md           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 5. User Approves Plan               │
│    Review gap analysis              │
│    Approve implementation plan      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 6. Implement Phase by Phase         │
│    For each phase:                  │
│    - Write .todo() tests            │
│    - Implement features             │
│    - Convert to passing tests       │
│    - Commit with results            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 7. Validate 100% Parity             │
│    ✅ All properties exposed        │
│    ✅ All tests passing             │
│    ✅ Documentation complete        │
└─────────────────────────────────────┘
```

---

## Summary

**The methodology works:**
- ✅ Editor store: 60% → 97.5% parity (4 phases)
- ✅ All backend contracts documented
- ✅ Tests enforce completeness
- ✅ Cross-session persistence via `.claude/`

**Apply to simulation:**
- ✅ Backend cataloged (CFGSimulator, CFSMSimulator, DistributedSimulator)
- ✅ Frontend analyzed (15% parity)
- ✅ Gap analysis created (85% missing)
- ⏳ Implementation plan ready (6 phases)

**Key Insight:** Backend defines the contract. Frontend MUST implement 100%. Tests enforce. Documentation persists.
