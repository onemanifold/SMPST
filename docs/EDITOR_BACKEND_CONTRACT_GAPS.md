

# Editor Store - Backend Contract Gaps

**Created:** 2025-11-18
**Status:** DOCUMENTED - Implementation Pending

---

## Executive Summary

The editor store (`src/lib/stores/editor.ts`) integrates 5 backend modules but **ignores significant portions** of their return values:

- **Verifier:** Uses 7 of 16 verification checks (missing 9 critical safety checks)
- **Projector:** Ignores projection errors array
- **Parser:** Discards location information needed for error reporting
- **CFSM:** Doesn't validate parameters and multiple terminals

**Impact:** Protocols with serious issues (recursion scope violations, fork-join mismatches, etc.) appear valid in the UI.

---

## Critical Missing Properties

### 1. Verification Results (9 of 16 checks ignored)

**Location:** `src/lib/stores/editor.ts:152-197`

**Currently Handled (7):**
- ✅ `deadlock` - Deadlock detection
- ✅ `liveness` - Liveness check
- ✅ `parallelDeadlock` - Parallel execution deadlocks
- ✅ `raceConditions` - Race condition warnings
- ✅ `progress` - Progress property
- ✅ `choiceDeterminism` - Choice determinism
- ✅ `multicast` - Multicast warnings

**MISSING (9):**

#### 1.1 `structural` - CRITICAL
```typescript
interface StructuralResult {
  isValid: boolean;
  violations?: StructuralViolation[];
}
```

**What it checks:**
- Orphaned nodes (unreachable from entry)
- Unreachable states
- Missing edges
- Invalid node references

**Why it matters:** Basic CFG validity. If structural check fails, CFG is malformed.

**Current behavior:** Ignored - malformed CFGs appear valid

---

#### 1.2 `choiceMergeability` - CRITICAL
```typescript
interface ChoiceMergeabilityResult {
  isMergeable: boolean;
  violations?: ChoiceMergeViolation[];
}
```

**What it checks:**
- Whether choice branches have consistent role participation
- Whether branches can merge back together
- Divergent communication patterns

**Why it matters:** Ensures choice branches are compatible. If not mergeable, execution can't safely continue after choice.

**Current behavior:** Ignored - inconsistent choice branches appear valid

---

#### 1.3 `connectedness` - CRITICAL
```typescript
interface ConnectednessResult {
  isConnected: boolean;
  disconnectedRoles?: string[];
}
```

**What it checks:**
- All declared roles participate in protocol
- No roles are completely disconnected from communication graph

**Why it matters:** Declared but unused roles indicate design error.

**Current behavior:** Ignored - protocols with orphaned roles appear valid

**Example:**
```scribble
global protocol Orphan(role A, role B, role C) {
  msg(int) from A to B;
  // C never participates - should be flagged
}
```

---

#### 1.4 `nestedRecursion` - CRITICAL (Theorem 5.1)
```typescript
interface NestedRecursionResult {
  isValid: boolean;
  violations?: RecursionViolation[];
}
```

**What it checks:**
- Recursion variable scoping (lexical scoping)
- No continue statements referencing out-of-scope labels
- Sub-protocol recursion doesn't escape to parent

**Why it matters:** **Theorem 5.1 (Demangeon & Honda 2012)** - Recursion Scoping
Violation means recursion semantics are undefined.

**Current behavior:** Ignored - scope violations appear valid

**Example:**
```scribble
global protocol Parent(role A, role B) {
  rec Outer {
    do Child(A, B);
    continue Inner;  // INVALID - Inner not in scope
  }
}

global protocol Child(role A, role B) {
  rec Inner {
    msg(int) from A to B;
    continue Inner;
  }
}
```

---

#### 1.5 `recursionInParallel` - CRITICAL
```typescript
interface RecursionInParallelResult {
  isValid: boolean;
  violations?: RecursionViolation[];
}
```

**What it checks:**
- Recursion doesn't cross parallel boundaries
- continue statements don't jump across parallel forks

**Why it matters:** Parallel branches must be independent. Recursion crossing boundaries creates undefined execution order.

**Current behavior:** Ignored - illegal recursion appears valid

**Example:**
```scribble
global protocol Invalid(role A, role B, role C) {
  rec Loop {
    par {
      msg(int) from A to B;
      continue Loop;  // INVALID - crosses parallel boundary
    } and {
      msg(int) from A to C;
    }
  }
}
```

---

#### 1.6 `forkJoinStructure` - CRITICAL
```typescript
interface ForkJoinStructureResult {
  isValid: boolean;
  violations?: ForkJoinViolation[];
}
```

**What it checks:**
- Every fork has matching join
- Join points have correct number of incoming branches
- No unmatched parallel boundaries

**Why it matters:** Parallel composition requires proper synchronization. Mismatched fork/join leads to deadlock or orphaned branches.

**Current behavior:** Ignored - mismatched parallel appears valid

---

#### 1.7 `selfCommunication` - ERROR
```typescript
interface SelfCommunicationResult {
  isValid: boolean;
  violations?: SelfCommunicationViolation[];
}
```

**What it checks:**
- No role sends message to itself
- No self-loops in communication graph

**Why it matters:** Session types assume distinct endpoints. Self-communication violates linearity.

**Current behavior:** Ignored - self-communication appears valid

**Example:**
```scribble
global protocol Invalid(role A) {
  msg(int) from A to A;  // INVALID - self-send
}
```

---

#### 1.8 `emptyChoiceBranch` - WARNING
```typescript
interface EmptyChoiceBranchResult {
  isValid: boolean;
  violations?: EmptyBranchViolation[];
}
```

**What it checks:**
- Choice branches aren't empty (no-op branches)
- All branches have at least one action

**Why it matters:** Empty branches might indicate incomplete protocol design.

**Current behavior:** Ignored - empty branches not flagged

---

#### 1.9 `mergeReachability` - CRITICAL
```typescript
interface MergeReachabilityResult {
  isValid: boolean;
  violations?: MergeViolation[];
}
```

**What it checks:**
- All choice branches reach their merge point
- No divergent branches that never merge
- Merge points are reachable from all branches

**Why it matters:** Choice must eventually merge for protocol to continue. Unreachable merge means stuck execution.

**Current behavior:** Ignored - unreachable merges appear valid

---

## 2. Projection Errors - CRITICAL

**Location:** `src/lib/stores/editor.ts:155`

```typescript
const projectionResult = projectAll(cfg);
// projectionResult.errors is IGNORED
```

**What it contains:**
```typescript
interface ProjectionError {
  role: string;
  message: string;
  nodeId?: string;
  phase?: 'merging' | 'continuation' | 'projection';
}
```

**Why it matters:** Projection can **fail for individual roles** while succeeding for others. These errors are currently invisible.

**Example scenario:**
- Protocol projects successfully for roles A and B
- Projection fails for role C due to unguarded choice
- UI shows C's projection as if it succeeded
- User sees broken/incomplete state machine for C

**Current behavior:** Errors silently dropped - users see corrupted projections

---

## 3. AST Location Information

**Location:** `src/lib/stores/editor.ts:133`

```typescript
const ast = parse(content);
// ast.location is IGNORED
```

**What it contains:**
```typescript
interface Module {
  type: 'Module';
  declarations: ModuleDeclaration[];
  location?: SourceLocation;  // ← IGNORED
}

interface SourceLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}
```

**Why it matters:** Precise error reporting. Can highlight exact line/column of syntax errors.

**Current behavior:** Parse errors show message only, no line/column information

---

## 4. CFSM Properties

**Location:** `src/lib/stores/editor.ts:230-253`

### 4.1 `parameters` - Needed for Sub-Protocols

```typescript
interface CFSM {
  // ...
  parameters?: ProtocolParameter[];  // ← IGNORED
}
```

**Why it matters:** Sub-protocol support requires parameter tracking.

**Current behavior:** Parameters not validated or displayed

---

### 4.2 `terminalStateIds` - Multiple Terminals

```typescript
interface CFSM {
  // ...
  terminalStateIds: string[];  // ← Assumes single terminal
}
```

**Why it matters:** CFSMs can have multiple terminal states (e.g., different choice outcomes).

**Current behavior:** Assumes single terminal state

---

## Implementation Plan

### Phase 1: Expose Missing Verification Checks (High Priority)

**Goal:** Make all 16 verification checks visible in UI

**Steps:**
1. Update `VerificationResult` interface in `editor.ts`:
   ```typescript
   export interface VerificationResult {
     // Existing
     deadlockFree: boolean;
     livenessSatisfied: boolean;
     safetySatisfied: boolean;
     warnings: string[];
     errors: string[];

     // NEW - Add missing checks
     structural: { valid: boolean; issues: string[] };
     choiceMergeability: { valid: boolean; issues: string[] };
     connectedness: { valid: boolean; issues: string[] };
     nestedRecursion: { valid: boolean; issues: string[] };
     recursionInParallel: { valid: boolean; issues: string[] };
     forkJoinStructure: { valid: boolean; issues: string[] };
     selfCommunication: { valid: boolean; issues: string[] };
     emptyChoiceBranch: { valid: boolean; issues: string[] };
     mergeReachability: { valid: boolean; issues: string[] };
   }
   ```

2. Update `parseProtocol()` to use `extractVerificationIssues()`:
   ```typescript
   import { extractVerificationIssues } from './contracts/editor-contract';

   const result = verifyProtocol(cfg);
   const issues = extractVerificationIssues(result);

   verificationResult.set({
     // ... existing properties
     structural: { valid: issues.allChecks.structural, issues: [...] },
     // ... all 9 missing checks
   });
   ```

3. Update UI to display all checks (VerificationPanel.svelte)

---

### Phase 2: Handle Projection Errors (High Priority)

**Goal:** Expose projection errors to users

**Steps:**
1. Add `projectionErrors` store:
   ```typescript
   export const projectionErrors = writable<ProjectionError[]>([]);
   ```

2. Update `parseProtocol()`:
   ```typescript
   const projectionResult = projectAll(cfg);

   if (projectionResult.errors.length > 0) {
     projectionErrors.set(projectionResult.errors);
     // Show warning in UI
   }
   ```

3. Update UI to show projection errors per role

---

### Phase 3: Preserve Location Info (Medium Priority)

**Goal:** Show line/column for parse errors

**Steps:**
1. Update `parseError` store:
   ```typescript
   export interface ParseErrorInfo {
     message: string;
     location?: SourceLocation;
   }
   export const parseError = writable<ParseErrorInfo | null>(null);
   ```

2. Preserve AST location in `parseProtocol()`

3. Update Monaco Editor to highlight error location

---

### Phase 4: Validate CFSM Properties (Low Priority)

**Goal:** Document and validate CFSM completeness

**Steps:**
1. Log warnings if `parameters` present but not displayed
2. Handle multiple `terminalStateIds` in visualization
3. Validate all CFSM properties are used

---

## Testing Requirements

For each missing property, add tests:

1. **Contract test** - Verifies property is exposed
2. **Integration test** - Verifies UI displays it
3. **Regression test** - Verifies it's not ignored again

**Test location:** `src/lib/stores/__tests__/editor.test.ts` (already created)

**Current status:**
- ✅ Tests created for all missing properties (marked as `.todo()`)
- ⏳ Implementation pending

---

## Impact Assessment

### Current State (Missing 9 Checks)

**Protocols that appear valid but aren't:**
1. ❌ Structurally invalid CFGs (orphaned nodes)
2. ❌ Inconsistent choice branches
3. ❌ Orphaned roles
4. ❌ **Recursion scope violations (Theorem 5.1 violation!)**
5. ❌ Recursion crossing parallel boundaries
6. ❌ Mismatched fork/join pairs
7. ❌ Self-communication
8. ⚠️ Empty choice branches
9. ❌ Unreachable merge points

**User experience:**
- Protocols pass validation incorrectly
- Runtime errors during simulation
- Corrupted state machines
- No indication of what's wrong

---

### After Implementation (All 16 Checks)

**Protocols correctly validated:**
- ✅ All structural issues caught
- ✅ All semantic violations flagged
- ✅ Projection errors visible
- ✅ Precise error locations

**User experience:**
- Clear error messages
- Exact error locations
- No silent failures
- Complete validation feedback

---

## References

### Theorems
- **Theorem 5.1 (Demangeon & Honda 2012):** Recursion Scoping
  - Test: `src/__tests__/theorems/well-formedness/recursion-scoping.test.ts`
  - Doc: `docs/theory/sub-protocol-formal-analysis.md`

### Backend Modules
- Parser: `src/core/parser/parser.ts`
- Builder: `src/core/cfg/builder.ts`
- Verifier: `src/core/verification/verifier.ts` (returns `CompleteVerification`)
- Projector: `src/core/projection/projector.ts`
- Serializer: `src/core/serializer/cfsm-serializer.ts`

### Contracts
- Editor contracts: `src/lib/stores/contracts/editor-contract.ts`
- Editor tests: `src/lib/stores/__tests__/editor.test.ts`

---

## Next Actions

1. **Immediate:** Review this document
2. **Short-term:** Implement Phase 1 (expose missing checks)
3. **Medium-term:** Implement Phase 2 (projection errors)
4. **Long-term:** Implement Phases 3-4

**Estimated effort:**
- Phase 1: 2-3 hours (straightforward property exposure)
- Phase 2: 1-2 hours (error handling)
- Phase 3: 2-3 hours (Monaco integration)
- Phase 4: 1 hour (validation)

**Total: ~6-9 hours to complete contract**

---

**Remember:** This isn't just missing features - it's **missing safety guarantees**. Protocols violating Theorem 5.1 (recursion scoping) are currently marked as valid.
