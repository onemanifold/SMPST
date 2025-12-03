# Implementation Fix Plan: Remove Mode Switching

**Based on:** `/home/user/SMPST/docs/ACTUAL_SIMULATION_REQUIREMENTS.md`
**Date:** 2025-12-03

---

## Current State Analysis

### What Exists (Incorrectly)

**File:** `src/lib/stores/simulation.ts`

1. **executionMode store** (line 57)
   ```typescript
   export const executionMode = writable<ExecutionMode>('cfg');
   ```
   - Allows switching between 'cfg' | 'distributed' | 'bisimulation'
   - **Should not exist** - always bisimulation

2. **Three initialization functions:**
   - `initializeCFGSimulation()` (line 185) - CFG only
   - `initializeDistributedSimulation()` (line 209) - Distributed only
   - `initializeBisimulation()` (line 230) - Both together
   - **Should only have one** - always both together

3. **switchExecutionMode()** (line 270)
   - Switches between modes
   - **Should not exist** - no modes to switch

4. **Mode-aware functions:**
   - `stepSimulation()` checks mode (line 315)
   - `startPlaying()` checks mode (line 394)
   - `stepBack()` checks mode (line 442)
   - `jumpToStep()` checks mode (line 493)
   - **Should not check mode** - always use both debuggers

---

## Proposed Changes

### Step 1: Remove Mode Switching

**Delete:**
```typescript
export const executionMode = writable<ExecutionMode>('cfg');
export type ExecutionMode = 'cfg' | 'distributed' | 'bisimulation';
```

### Step 2: Consolidate Initialization

**Delete:**
- `initializeCFGSimulation()`
- `initializeDistributedSimulation()`
- `switchExecutionMode()`

**Keep and rename:**
- `initializeBisimulation()` → `initializeSimulation()`

**New signature:**
```typescript
export async function initializeSimulation(cfg: CFG, cfsms: Map<string, CFSM>) {
  // Always initialize BOTH debuggers
  // CFG determines order, CFSMs maintain state
}
```

### Step 3: Remove Mode Checks

**Update all functions to always use bisimulation:**

```typescript
// OLD:
export async function stepSimulation() {
  const mode = get(executionMode);
  if (mode === 'cfg' && cfgDebugger) { ... }
  else if (mode === 'distributed' && distributedDebugger) { ... }
  else if (mode === 'bisimulation' && bisimulationValidator) { ... }
}

// NEW:
export async function stepSimulation() {
  if (!bisimulationValidator) return;
  await bisimulationValidator.stepBoth();
  stateVersion.update(v => v + 1);
}
```

**Functions to update:**
- `stepSimulation()`
- `startPlaying()`
- `stepBack()`
- `jumpToStep()`
- Any other mode-aware functions

### Step 4: Update Derived Stores

**OLD:**
```typescript
export const executionState = derived(
  [executionMode, cfgExecutionState, distributedExecutionState],
  ([$mode, $cfg, $dist]) => {
    if ($mode === 'cfg' || $mode === 'bisimulation') return $cfg;
    return null;
  }
);
```

**NEW:**
```typescript
// Remove executionState entirely or always return CFG state
// Since bisimulation always runs, we can expose both:
export const cfgState = cfgExecutionState;
export const distributedState = distributedExecutionState;
```

---

## Implementation Steps

### Phase 1: Refactor simulation.ts (Core)

1. ✅ Remove `executionMode` and `ExecutionMode` type
2. ✅ Remove `initializeCFGSimulation()` and `initializeDistributedSimulation()`
3. ✅ Rename `initializeBisimulation()` to `initializeSimulation()`
4. ✅ Update signature to require both cfg and cfsms
5. ✅ Remove `switchExecutionMode()`
6. ✅ Update all functions to remove mode checks
7. ✅ Update derived stores

### Phase 2: Update Tests

1. Update tests that call `initializeCFGSimulation()`
2. Update tests that call `switchExecutionMode()`
3. Update tests that check `executionMode`
4. Ensure all tests use bisimulation

### Phase 3: Update UI Components

1. Find UI components that use `executionMode`
2. Remove mode selector UI (if exists)
3. Update to show both views simultaneously

### Phase 4: Update Documentation

1. Delete incorrect documentation about "modes"
2. Update to reflect bisimulation-only architecture
3. Document CFG→CFSM coordination

---

## Questions to Resolve

### 1. hasMessage() Usage

**Current state:**
- Used in `getEnabledTransitions()` with comment "for sequential stepping"
- But sequential mode doesn't exist in bisimulation

**Question:** In bisimulation with CFG determining order:
- Does hasMessage() still serve a purpose?
- Or is it replaced by the pause mechanism in mediated channels?

**My understanding:**
- CFG determines when B should receive
- Coordinator signals B to proceed
- B doesn't need to check hasMessage() - just waits for signal
- **hasMessage() might be obsolete**

### 2. Pause Mechanism Implementation

**From requirements:** Mediated channel pauses BEFORE message interpretation

**Question:** How is this implemented?
- Does receive() return a promise that's held until coordinator signals?
- Is there an explicit pause/resume API?
- Where does this coordination happen?

**Current code:** MediatedChannel emits 'ready' but doesn't show pause mechanism

### 3. BisimulationValidator Role

**Current:** `stepBoth()` tries to match CFG and distributed events

**Question:** Should BisimulationValidator:
- Just coordinate both stepping?
- Or also validate that traces match?
- Or both?

### 4. CFG as Order Source

**Question:** How does CFG determine order for CFSM execution?

**Possible approaches:**
1. CFG steps first, then CFSMs catch up to that step
2. CFG and CFSMs step together, CFG provides ordering signal
3. Something else?

---

## Risk Assessment

### High Risk Changes

1. **Removing mode switching** - many places check mode
   - Impact: Store, UI components, tests
   - Mitigation: Comprehensive grep for `executionMode`

2. **Changing initialization API** - requires both cfg and cfsms
   - Impact: All callers must provide both
   - Mitigation: Update all call sites

### Medium Risk Changes

1. **Removing hasMessage() (if obsolete)** - used in multiple places
   - Impact: getEnabledTransitions(), tests
   - Mitigation: Understand pause mechanism first

### Low Risk Changes

1. **Updating derived stores** - straightforward refactor
2. **Documentation updates** - no code impact

---

## Success Criteria

✅ No `executionMode` store exists
✅ Only one `initializeSimulation()` function
✅ No mode checks in step/play functions
✅ Both CFG and CFSM debuggers always run together
✅ All tests pass
✅ UI shows both views simultaneously

---

## Next Actions

Before implementing, need clarification on:
1. hasMessage() fate in bisimulation
2. How pause mechanism works
3. BisimulationValidator's exact role
4. How CFG determines order for CFSMs

Once clarified, proceed with Phase 1 implementation.
