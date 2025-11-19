# Backend Contract Checklist

**Purpose:** Ensure frontend achieves 100% parity with backend capabilities

**Applies To:** ANY feature that integrates with backend modules

---

## When to Use This Checklist

- User requests new frontend feature
- You notice frontend missing backend capabilities
- Adding UI for existing backend functionality
- Refactoring frontend stores

**Rule:** Complete ALL phases before marking feature "done"

---

## Phase 1: Discovery & Cataloging

### 1.1 Find Backend Type Definitions

```bash
# Find type files for the module
find src/core -name "types.ts" -o -name "*-types.ts" | grep [module-name]
```

**Example:**
```bash
# For simulation:
find src/core -name "*types.ts" | grep simulation
# Returns: src/core/simulation/types.ts, etc.
```

### 1.2 Read ALL Interfaces

For each type file:
- [ ] Read every interface
- [ ] Read every type alias
- [ ] Read all configuration interfaces
- [ ] Read all result types
- [ ] Read all event types

**Document:**
```markdown
## [ModuleName] Backend Capabilities

### Configuration Options
- property1: type (description)
- property2: type (description)

### Return Types
- ResultType1 { ... }
- ResultType2 { ... }

### Events/Callbacks
- EventType1 { ... }
```

### 1.3 Read Implementation Classes

```bash
# Find main implementation files
find src/core -name "*.ts" | grep -v test | grep [module-name]
```

For each class:
- [ ] Read constructor parameters
- [ ] Read public methods
- [ ] Read event emitters
- [ ] Note configuration options

---

## Phase 2: Frontend Analysis

### 2.1 Find Related Stores

```bash
# Find store files
find src/lib/stores -name "*.ts" | grep -v __tests__ | grep [feature-name]
```

### 2.2 Catalog Current Exposure

For each store:
- [ ] List all exposed stores (writable/readable/derived)
- [ ] List all exposed actions/functions
- [ ] List all properties from backend types used
- [ ] List all properties from backend types IGNORED

**Document:**
```markdown
## Current Frontend Implementation

### Exposed Stores
- storeName1: Type (from backend: ...)
- storeName2: Type (derived from: ...)

### Exposed Actions
- actionName1(params) → result
- actionName2(params) → result

### Backend Properties Used
- ✅ property1
- ✅ property2

### Backend Properties IGNORED
- ❌ property3
- ❌ property4
```

### 2.3 Find Related Components

```bash
# Find UI components
find src/lib/components -name "*.svelte" | grep [feature-name]
```

For each component:
- [ ] Check which stores it consumes
- [ ] Check which backend data it displays
- [ ] Note missing visualizations

---

## Phase 3: Gap Analysis

### 3.1 Compare Backend vs Frontend

Create comparison table:

| Backend Capability | Status | Impact |
|-------------------|--------|---------|
| property1 | ✅ USED | Fully exposed |
| property2 | ⚠️ PARTIAL | Missing X and Y |
| property3 | ❌ IGNORED | Users can't see Z |

### 3.2 Categorize Missing Features

For EACH missing/partial feature:

**Priority Classification:**
- **CRITICAL**: Core functionality, users completely blocked
- **HIGH**: Important feature, significant UX impact
- **MEDIUM**: Useful feature, moderate UX impact
- **LOW**: Nice-to-have, minimal UX impact

**Impact Assessment:**
- What can users NOT do without this?
- What errors/confusion will this cause?
- What backend capability is wasted?

### 3.3 Create Gap Analysis Document

**Template:** `docs/[MODULE]_BACKEND_CONTRACT_GAPS.md`

```markdown
# [Module] - Backend Contract Gaps

## Executive Summary
- Backend provides: [list]
- Frontend exposes: [%]
- Impact: [description]

## Missing Features

### 1. [Feature Name] - [PRIORITY]

**What Backend Provides:**
```typescript
// Type definition
```

**Current UI Behavior:** [What happens now]

**Why It Matters:** [Impact explanation]

**Example:** [Concrete example]

**UI Gap:** [What's missing in UI]

---

## Implementation Plan

### Phase 1: [Name] ([PRIORITY])
**Goal:** [One sentence]
**Steps:** [List]
**Estimated Effort:** X hours

[... more phases]
```

---

## Phase 4: Contract Enforcement

### 4.1 Create Contract Handlers

**Location:** `src/lib/stores/contracts/[module]-contract.ts`

**Pattern:**
```typescript
// Define handler interface
export interface [Result]Handler {
  onSuccess: (data1, data2, ...) => void;
  onError: (error, context) => void;
  onPartial?: (result, warnings) => void;
}

// Define handler function
export function handle[Result](
  result: [BackendResult],
  handler: [Result]Handler
): void {
  // Force handling of ALL properties
  if (result.success) {
    handler.onSuccess(result.prop1, result.prop2, ...);
  } else {
    handler.onError(result.error, result.context);
  }

  // TypeScript ensures ALL properties handled
}
```

### 4.2 Apply Exhaustive Type Checking

For union types (events, etc.):
```typescript
function handleEvent(event: [EventType]): void {
  switch (event.type) {
    case 'type1': return handleType1(event);
    case 'type2': return handleType2(event);
    // ... all cases
    default:
      // TypeScript error if case missing!
      const exhaustive: never = event;
      throw new Error(`Unhandled: ${exhaustive}`);
  }
}
```

### 4.3 Validate Interface Completeness

```typescript
// Ensure store exposes ALL backend properties
type ValidateExposure<T extends [BackendType]> = {
  [K in keyof T]: Writable<T[K]> | Readable<T[K]>;
};

// TypeScript error if any property missing
const _validate: ValidateExposure<[BackendType]> = {} as [FrontendExposure];
```

---

## Phase 5: Test-Driven Implementation

### 5.1 Write .todo() Tests FIRST

**Location:** `src/lib/stores/__tests__/[module].test.ts`

For EACH missing feature:
```typescript
describe('[Module] Store - [Feature Category]', () => {
  it.todo('should expose [property] from backend', async () => {
    // TODO: [Property] is returned by backend but not exposed
    // Expected: [store/action] exposes it
    // Current: [current behavior]
    //
    // await [action]();
    // const value = get([store]);
    // expect(value.[property]).toBeDefined();
  });

  it.todo('should handle [property] errors', async () => {
    // TODO: Error handling for [property]
  });

  // ... more tests
});
```

### 5.2 Implement Features Phase-by-Phase

For each phase from gap analysis:
1. Pick phase based on priority
2. Implement stores/actions
3. Apply contract handlers
4. Convert .todo() tests to passing tests
5. Verify all tests pass
6. Commit with results

### 5.3 Update Gap Analysis

After each phase:
- [ ] Update implementation status (✅ IMPLEMENTED)
- [ ] Update parity percentage
- [ ] Document any remaining issues

---

## Phase 6: Documentation & Validation

### 6.1 Calculate Parity Score

```
Parity Score = (Exposed Properties / Total Backend Properties) × 100%
```

**Record in gap analysis:**
```markdown
## Current Implementation Status

**Parity Score:** [X]%

**Breakdown:**
- Configuration options: [X/Y] ([%])
- Return properties: [X/Y] ([%])
- Events: [X/Y] ([%])
- Actions: [X/Y] ([%])

**Overall:** [X]%
```

### 6.2 Verify 100% Parity

Checklist:
- [ ] All backend properties exposed
- [ ] All contract handlers implemented
- [ ] All tests passing
- [ ] No .todo() tests remaining (for completed phases)
- [ ] Parity score = 100% (for completed phases)

### 6.3 Update Cross-Session Docs

If new patterns emerged:
- [ ] Update `.claude/[module]-development-protocol.md`
- [ ] Add to `.claude/README.md` if needed
- [ ] Document anti-patterns encountered

---

## Example: Editor Store (Completed)

### Phase 1: Discovery
- ✅ Found: parser, builder, verifier, projector, serializer types
- ✅ Cataloged: 40+ properties across 5 modules
- ✅ Documented in working notes

### Phase 2: Analysis
- ✅ Current exposure: 60% (21 passing tests)
- ✅ Missing: 9 verification checks, projection errors, AST location, CFSM properties

### Phase 3: Gap Analysis
- ✅ Created: `docs/EDITOR_BACKEND_CONTRACT_GAPS.md`
- ✅ Identified: 4 phases, 14 missing features
- ✅ Prioritized: All CRITICAL

### Phase 4: Contract Enforcement
- ✅ Created: `src/lib/stores/contracts/editor-contract.ts`
- ✅ Handlers: extractVerificationIssues, handleProjectionResult, formatProjectionErrors

### Phase 5: Implementation
- ✅ Phase 1: All 16 verification checks (9 tests)
- ✅ Phase 2: Projection errors (3 tests)
- ✅ Phase 3: AST location (2 tests)
- ✅ Phase 4: CFSM properties (3 tests)
- ✅ Final: 39 passing tests (+86%)

### Phase 6: Validation
- ✅ Parity Score: 97.5% (1 todo remaining for future work)
- ✅ All critical gaps addressed
- ✅ Documentation complete

**Result:** Editor store now fully implements backend contract!

---

## Example: Simulation Store (In Progress)

### Phase 1: Discovery ✅
- Cataloged: CFGSimulator, CFSMSimulator, DistributedSimulator
- Found: 40+ capabilities across 3 simulator types

### Phase 2: Analysis ✅
- Current exposure: ~15%
- Missing: Events, history, previews, parallel state, recursion stack, distributed execution

### Phase 3: Gap Analysis ✅
- Created: `docs/SIMULATION_BACKEND_CONTRACT_GAPS.md`
- Identified: 6 phases, 20+ missing features
- Estimated: 15-22 hours to 100%

### Phase 4: Contract Enforcement ⏳
- TODO: Create `simulation-contract.ts`
- TODO: Implement handlers

### Phase 5: Implementation ⏳
- TODO: 6 phases to complete

### Phase 6: Validation ⏳
- Current: 15% parity
- Target: 100%

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Partial Property Usage

```typescript
// BAD
const result = backend.method();
store.set(result.property1);
// Ignores property2, property3, property4!
```

```typescript
// GOOD
const result = backend.method();
handleResult(result, {
  // TypeScript forces handling ALL properties
  onSuccess: (p1, p2, p3, p4) => { ... }
});
```

### ❌ Mistake 2: No Gap Analysis

Starting implementation without understanding full scope = partial implementation

**Always:** Create gap analysis FIRST, implement SECOND

### ❌ Mistake 3: Hardcoded Assumptions

```typescript
// BAD - Assumes single terminal state
const terminalState = cfsm.terminalStates[0];  // What if multiple?
```

```typescript
// GOOD - Handle all cases
const terminalStates = cfsm.terminalStates;  // Array, can be multiple
```

### ❌ Mistake 4: No Tests for Missing Features

If feature not tested, it will regress or remain incomplete

**Always:** Write .todo() tests documenting gaps

### ❌ Mistake 5: Claiming "Done" at <100%

"Good enough" = technical debt

**Never:** Mark complete until parity = 100%

---

## Summary

**Workflow:**
1. Discovery: Catalog backend (types, classes, methods)
2. Analysis: Document current frontend (stores, components)
3. Gap Analysis: Compare, prioritize, create implementation plan
4. Contract Enforcement: Handlers, exhaustive checks, validation
5. Implementation: Phase-by-phase with tests
6. Validation: Parity = 100%, all tests passing

**Success Criteria:**
- ✅ Gap analysis document created
- ✅ Contract handlers implemented
- ✅ All backend properties exposed
- ✅ All tests passing
- ✅ Parity score = 100%
- ✅ Documentation updated

**This checklist ensures rigorous frontend-backend parity. Follow it for ALL features.**
