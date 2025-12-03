# Bisimulation Testing Status

**Date:** 2025-12-03
**Branch:** `claude/document-simulator-architecture-01RvvQuxqzxTBgXY6FybhTYe`

---

## Summary

Created comprehensive test suite for the bisimulation architecture. Tests are structured correctly but reveal a critical bug in the CFSM execution layer.

---

## Test Results

### ✅ CFG Concurrency Analyzer Tests: 9/9 PASS

**File:** `src/core/simulation/__tests__/cfg-concurrency-analyzer.test.ts`

All tests passing! The concurrency analyzer correctly:
- Identifies sequential causal dependencies
- Identifies concurrent actions in parallel branches
- Distinguishes sequential actions within parallel branches
- Handles multiple parallel regions
- Recognizes choice branches as non-concurrent
- Provides correct API responses

### ❌ Bisimulation Coordinator Unit Tests: 0/10 FAIL

**File:** `src/core/simulation/__tests__/bisimulation-coordinator.test.ts`

All tests failing due to underlying execution issue (see "Critical Bug" below).

### ❌ Bisimulation E2E Tests: 2/8 PASS

**File:** `src/__tests__/integration/bisimulation.e2e.test.ts`

Most tests failing due to CFSMs not completing execution.

---

## Bugs Fixed

### 1. Debuggers Map Initialization Order
**Issue:** Channels created before debuggers, causing `onIncoming` handler to reference undefined `cfsmDebuggers` map.

**Fix:** Initialize `this.cfsmDebuggers = new Map()` before creating channels.

**Location:** `bisimulation-coordinator.ts:63`

### 2. Receiver Not Stepped
**Issue:** Only sender was stepped in `handleCFGMessage()`, receiver never executed.

**Fix:** Added receiver stepping after sender in `handleCFGMessage()`.

**Location:** `bisimulation-coordinator.ts:161-168`

### 3. Test Property Names
**Issue:** Tests checked `.complete` but executor returns `.completed`.

**Fix:** Changed all test assertions to use `.completed`.

**Files:**
- `bisimulation.e2e.test.ts`
- `bisimulation-coordinator.test.ts`

### 4. Choice Protocol Syntax
**Issue:** Used incorrect labeled choice syntax `login: { ... }` instead of `} or {`.

**Fix:** Updated to correct syntax: `choice at X { ... } or { ... }`.

**Location:** `bisimulation.e2e.test.ts:222-232`

---

## Critical Bug: CFSM Executors Not Stepping

### Symptom

After calling `coordinator.step()`:
- CFG simulator advances correctly (coordinator.isComplete() = true)
- CFSM debuggers increment `currentStepNumber` but `stepCount` remains 0
- CFSM states don't change (remain in initial state)
- CFSMs report `completed: false`

### Debug Output

```
=== Initial State ===
A: { role: 'A', currentState: 's0', completed: false, stepCount: 0, currentStepNumber: 0 }
B: { role: 'B', currentState: 's0', completed: false, stepCount: 0, currentStepNumber: 0 }

=== After Step 1 ===
A: { role: 'A', currentState: 's0', completed: false, stepCount: 0, currentStepNumber: 1 }
B: { role: 'B', currentState: 's0', completed: false, stepCount: 0, currentStepNumber: 0 }
```

**Analysis:**
- `currentStepNumber` incremented → `CFSMDebugger.stepForward()` called successfully
- `stepCount` unchanged → `CFSMExecutor.step()` didn't execute transitions
- States unchanged → No transitions were taken

### Investigation Points

#### CFSMDebugger.stepForward() (cfsm-debugger.ts:241-247)
```typescript
async stepForward(): Promise<void> {
  await this.waitIfPaused();           // ← Pause mechanism
  this.currentStepNumber++;             // ← This executes (proven by debug output)
  await this.executor.step();           // ← This should execute transitions
  this.recordSnapshot();
  this.emit('step-forward', { stepNumber: this.currentStepNumber });
}
```

#### CFSMExecutor.step() (cfsm-executor.ts:187-209)
```typescript
async step(): Promise<void> {
  if (this.completed) {
    throw new Error('Already completed');
  }

  const transitions = this.getEnabledTransitions();  // ← Check enabled transitions
  if (transitions.length === 0) {
    // Check if terminal
    if (this.currentCFSM.terminalStates.includes(this.currentState)) {
      await this.handleTerminal();
      return;
    }
    throw new Error('No enabled transitions');  // ← Would throw if no enabled transitions
  }

  await this.executeTransition(transitions[0]);  // ← Should execute and change state
  this.stepCount++;  // ← Should increment (but doesn't)
}
```

#### getEnabledTransitions() (cfsm-executor.ts:128-145)
```typescript
getEnabledTransitions(): CFSMTransition[] {
  const transitions = this.currentCFSM.transitions.filter(t => t.from === this.currentState);

  // In channel mode, filter by message availability for receive transitions
  if (this.channels) {
    return transitions.filter(t => {
      if (t.action.type === 'receive') {
        const channel = this.channels!.get(t.action.from);
        if (!channel) return false;
        return channel.hasMessage();  // ← Blocks receive until message available
      }
      return true;  // ← Send transitions always enabled
    });
  }

  return transitions;
}
```

### Hypotheses

1. **waitIfPaused() blocking:** Pause/resume mechanism might be causing deadlock
2. **Channels not wired correctly:** Despite fix, channels might not be correctly connected to executors
3. **Silent error swallowing:** Exception thrown but caught somewhere
4. **Transition execution failing silently:** `executeTransition()` failing without throwing
5. **Event loop/async issue:** Promise chain not resolving correctly

### Next Steps to Debug

1. **Add logging to CFSMExecutor.step():**
   - Log at entry: "Entering step()"
   - Log enabled transitions count
   - Log before/after executeTransition()
   - Log before stepCount increment

2. **Add logging to executeTransition():**
   - Log action type being executed
   - Log state before/after transition

3. **Check waitIfPaused():**
   - Verify it resolves correctly
   - Add timeout to detect deadlock

4. **Verify channel wiring:**
   - Log channel map in debugger constructor
   - Verify executor receives same channel references

5. **Test executor in isolation:**
   - Create unit test that directly calls executor.step()
   - Bypass debugger/coordinator layers
   - Verify basic CFSM execution works

---

## Files Created

1. `src/core/simulation/__tests__/cfg-concurrency-analyzer.test.ts` - Unit tests for concurrency analyzer (✅ ALL PASS)
2. `src/core/simulation/__tests__/bisimulation-coordinator.test.ts` - Unit tests for coordinator (❌ blocked by bug)
3. `src/__tests__/integration/bisimulation.e2e.test.ts` - End-to-end tests (❌ blocked by bug)
4. `src/__tests__/integration/bisim-debug.test.ts` - Debug test to investigate execution issue

---

## Commits

1. `4b5e56b` - feat: add comprehensive tests for bisimulation architecture
2. `dfca5a9` - fix: initialize debuggers map before channels, step both sender and receiver, fix test property names

---

## Remaining Work

### Immediate: Fix CFSM Execution Bug

**Priority:** CRITICAL
**Estimated Time:** 2-4 hours

This is blocking all bisimulation tests. Must resolve before proceeding.

### After Bug Fix:

1. **Verify All Tests Pass** (30 min)
   - Run full test suite
   - Fix any remaining test issues

2. **UI Integration Testing** (2-3 hours)
   - Integrate BisimulationCoordinator into UI stores
   - Remove mode switching as per original requirements
   - Test UI with bisimulation

3. **Remove hasMessage()** (1-2 hours)
   - Per original plan in `IMPLEMENTATION_FIX_PLAN.md`
   - Update channel interface
   - Update executor to use event-driven readiness

---

## Notes

The architecture is sound - the CFG concurrency analyzer works perfectly, and the coordinator structure is correct. The issue is isolated to the CFSM execution layer, specifically in how the executor's `step()` method executes (or fails to execute) transitions.

The pause/resume mechanism might be involved, but the debug output shows `currentStepNumber` incrementing, which means `waitIfPaused()` is resolving and execution is continuing past that point. The issue is somewhere between calling `executor.step()` and the actual state transition.
