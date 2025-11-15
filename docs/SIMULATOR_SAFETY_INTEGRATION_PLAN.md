# Simulator Safety Integration Plan

## Status: READY TO IMPLEMENT ✅

**Date**: 2025-11-15
**Context**: Safety checker (Definition 4.1) is complete with 100% test pass rate. This plan integrates it into simulators.

---

## 1. Current State Analysis

### What Works ✅
- **Safety Checker**: `src/core/safety/` - 144/144 tests passing (100%)
- **Safety API**: `src/core/safety-api.ts` - High-level interface ready
- **CFG Simulator**: `src/core/simulation/cfg-simulator.ts` - Simulates global protocol
- **CFSM Simulator**: `src/core/simulation/cfsm-simulator.ts` - Simulates individual roles
- **Distributed Simulator**: `src/core/simulation/distributed-simulator.ts` - Multi-role coordination
- **UI Store**: `src/lib/stores/simulation.ts` - State management for simulations
- **UI Components**: Simulation tab with CFSM network and CFG sequence visualization

### What's Missing ❌
1. **No safety checking during simulation** - User can execute unsafe protocols without warning
2. **No real-time violation detection** - Violations only discovered after execution
3. **No visual safety indicators** - No UI showing when protocol becomes unsafe
4. **No integration with distributed simulator** - Safety checker and distributed simulator are separate
5. **No safety-aware stepping** - Simulator doesn't use safety checker to validate steps

---

## 2. Integration Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Code Editor  │  │ Simulation   │  │ Safety Panel │  │
│  │              │  │ Controls     │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
└─────────┼──────────────────┼──────────────────┼──────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│             Simulation Store (Svelte)                    │
│                                                           │
│  - executionState                                        │
│  - safetyCheckResult  ← NEW                              │
│  - violationsHistory  ← NEW                              │
│  - currentViolation   ← NEW                              │
└─────────┬───────────────────┬─────────────────┬──────────┘
          │                    │                  │
          ▼                    ▼                  ▼
┌──────────────────┐  ┌──────────────────┐  ┌────────────┐
│ CFG Simulator    │  │ Distributed      │  │   Safety   │
│                  │  │ Simulator        │  │  Checker   │
│ - step()         │  │                  │  │            │
│ - getState()     │  │ - step()         │  │ - check()  │
│                  │  │ - getState()     │  │ - reduce() │
└──────────────────┘  └──────────────────┘  └────────────┘
```

### Key Integration Points

1. **DistributedSimulator + BasicSafety**
   - After each distributed step, check safety
   - If violation detected, mark step and continue (for debugging) OR halt
   - Store violation details for UI display

2. **Simulation Store Enhancement**
   - Add `safetyCheckResult` store
   - Add `violationsHistory` store (all violations encountered)
   - Add `currentViolation` for highlighting

3. **Real-Time Safety Checking**
   - Option 1: **Check after every step** (slow but accurate)
   - Option 2: **Check only on user request** (fast, manual)
   - Option 3: **Check at breakpoints** (e.g., before each choice)
   - **Recommended**: Option 3 + on-demand check button

---

## 3. Implementation Plan

### Phase 1: Core Integration (2-3 hours)

#### 1.1 Enhanced Distributed Simulator
**File**: `src/core/simulation/distributed-simulator.ts`

**Changes**:
```typescript
import { BasicSafety } from '../safety/safety-checker';
import { createInitialContext, applyTauTransitions } from '../safety/utils';

export interface DistributedSimulatorConfig {
  // ... existing config
  checkSafetyAfterStep?: boolean;  // NEW: Enable real-time checking
  haltOnViolation?: boolean;        // NEW: Stop on first violation
}

export class DistributedSimulator {
  private safetyChecker: BasicSafety;
  private safetyEnabled: boolean;

  constructor(cfsms: Map<string, CFSM>, config: DistributedSimulatorConfig = {}) {
    // ... existing initialization
    this.safetyChecker = new BasicSafety();
    this.safetyEnabled = config.checkSafetyAfterStep ?? false;
  }

  step(): DistributedStepResult {
    const result = this.executeStep();  // Existing step logic

    // NEW: Safety check after step
    if (this.safetyEnabled) {
      const context = this.createTypingContext();
      const safetyResult = this.safetyChecker.check(context);

      result.safetyCheck = safetyResult;

      if (!safetyResult.safe && this.config.haltOnViolation) {
        result.halted = true;
        result.haltReason = 'safety-violation';
      }
    }

    return result;
  }

  private createTypingContext(): TypingContext {
    // Convert current simulator state to TypingContext
    const instances = new Map();
    for (const [role, sim] of this.simulators) {
      instances.set(role, {
        machine: sim.getCFSM(),
        currentState: sim.getCurrentState(),
      });
    }
    return { session: 'simulation', cfsms: instances };
  }
}
```

**New Types**:
```typescript
export interface DistributedStepResult {
  // ... existing fields
  safetyCheck?: SafetyCheckResult;  // NEW
  halted?: boolean;                  // NEW
  haltReason?: 'safety-violation' | 'deadlock' | 'max-steps';  // NEW
}
```

#### 1.2 Safety-Aware Simulation Store
**File**: `src/lib/stores/simulation.ts`

**Changes**:
```typescript
import type { SafetyCheckResult } from '../../core/safety/types';

// NEW: Safety checking state
export const safetyCheckResult = writable<SafetyCheckResult | null>(null);
export const violationsHistory = writable<Array<{
  step: number;
  violations: SafetyViolation[];
}>>([]);
export const safetyEnabled = writable<boolean>(false);

export async function initializeSimulation(cfg: CFG, enableSafety = false) {
  // ... existing initialization

  // NEW: Initialize safety checking if enabled
  if (enableSafety) {
    safetyEnabled.set(true);
    await runInitialSafetyCheck();
  }
}

export async function runInitialSafetyCheck() {
  const cfg = get(currentCFG);
  if (!cfg) return;

  const { checkProtocolSafety } = await import('../../core/safety-api');
  // Need to convert CFG back to protocol code or work with CFSMs
  // For now, run safety check on current distributed state
}

export function stepSimulation() {
  if (!simulator) return;

  const result = simulator.step();
  executionState.set(result.state);

  // NEW: Update safety state if checking enabled
  if (result.safetyCheck) {
    safetyCheckResult.set(result.safetyCheck);

    if (!result.safetyCheck.safe) {
      violationsHistory.update(history => [
        ...history,
        {
          step: result.state.currentStep,
          violations: result.safetyCheck!.violations,
        }
      ]);
    }
  }

  if (result.state.completed || result.halted) {
    simulationMode.set('idle');
  }
}
```

### Phase 2: UI Components (3-4 hours)

#### 2.1 Safety Panel Component
**New File**: `src/lib/components/panels/SafetyPanel.svelte`

```svelte
<script lang="ts">
  import { safetyCheckResult, violationsHistory, safetyEnabled } from '../../stores/simulation';

  $: status = $safetyCheckResult?.safe ? 'safe' : 'unsafe';
  $: violations = $safetyCheckResult?.violations ?? [];
</script>

<div class="safety-panel">
  <div class="header">
    <h3>Safety Verification</h3>
    <label class="toggle">
      <input type="checkbox" bind:checked={$safetyEnabled} />
      <span>Enable real-time checking</span>
    </label>
  </div>

  {#if $safetyCheckResult}
    <div class="status status-{status}">
      {#if status === 'safe'}
        <span class="icon">✓</span>
        <span class="label">SAFE</span>
      {:else}
        <span class="icon">✗</span>
        <span class="label">UNSAFE</span>
      {/if}
    </div>

    {#if violations.length > 0}
      <div class="violations">
        <h4>Violations ({violations.length})</h4>
        {#each violations as violation}
          <div class="violation">
            <div class="violation-type">{violation.type}</div>
            <div class="violation-message">{violation.message}</div>
            {#if violation.context}
              <div class="violation-context">
                <strong>Roles involved:</strong>
                <ul>
                  {#each Object.entries(violation.context.roleStates) as [role, state]}
                    <li>{role}: {state}</li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if $violationsHistory.length > 0}
      <div class="history">
        <h4>Violation History</h4>
        <div class="timeline">
          {#each $violationsHistory as entry}
            <div class="history-entry">
              Step {entry.step}: {entry.violations.length} violation(s)
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <p>No safety check results yet</p>
      <p class="hint">Step through the simulation to see safety status</p>
    </div>
  {/if}
</div>

<style>
  .safety-panel {
    padding: 16px;
    background: #2d2d2d;
    border-radius: 8px;
    color: #d4d4d4;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    cursor: pointer;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 16px;
  }

  .status-safe {
    background: rgba(22, 163, 74, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .status-unsafe {
    background: rgba(220, 38, 38, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .status .icon {
    font-size: 24px;
  }

  .status-safe .icon {
    color: #22c55e;
  }

  .status-unsafe .icon {
    color: #ef4444;
  }

  .status .label {
    font-weight: 600;
    font-size: 16px;
  }

  .violations {
    margin-top: 16px;
  }

  .violations h4 {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: #ef4444;
  }

  .violation {
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 8px;
  }

  .violation-type {
    font-weight: 600;
    color: #ef4444;
    margin-bottom: 4px;
    font-size: 12px;
  }

  .violation-message {
    font-size: 13px;
    margin-bottom: 8px;
  }

  .violation-context {
    font-size: 11px;
    color: #9ca3af;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(239, 68, 68, 0.2);
  }

  .violation-context ul {
    margin: 4px 0 0 0;
    padding-left: 20px;
  }

  .violation-context li {
    margin: 2px 0;
    font-family: 'Courier New', monospace;
  }

  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: #9ca3af;
  }

  .empty-state p {
    margin: 8px 0;
  }

  .hint {
    font-size: 12px;
    font-style: italic;
  }
</style>
```

#### 2.2 Update SimulationTab
**File**: `src/lib/components/tabs/SimulationTab.svelte`

```svelte
<script lang="ts">
  import CFSMNetwork from '../visualizations/CFSMNetwork.svelte';
  import CFGSequence from '../visualizations/CFGSequence.svelte';
  import SimulationControls from '../controls/SimulationControls.svelte';
  import SafetyPanel from '../panels/SafetyPanel.svelte';  // NEW

  let splitPos = 50;
</script>

<div class="simulation-tab">
  <SimulationControls />

  <div class="split-container" style="--split-pos: {splitPos}%">
    <div class="left-pane">
      <div class="pane-header">CFSM Network</div>
      <CFSMNetwork />
    </div>

    <div class="resize-handle" />

    <div class="right-pane">
      <div class="top-section">
        <div class="pane-header">CFG Sequence</div>
        <CFGSequence />
      </div>

      <!-- NEW: Safety Panel -->
      <div class="bottom-section">
        <div class="pane-header">Safety Status</div>
        <SafetyPanel />
      </div>
    </div>
  </div>
</div>

<style>
  /* ... existing styles */

  .right-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    gap: 8px;
  }

  .top-section {
    flex: 2;
    position: relative;
    min-height: 300px;
  }

  .bottom-section {
    flex: 1;
    position: relative;
    min-height: 200px;
    border-top: 1px solid #333;
  }
</style>
```

### Phase 3: Enhanced Features (2-3 hours)

#### 3.1 Safety-Aware Stepping
Add ability to auto-pause when violations detected:

```typescript
// In simulation.ts
export const autoHaltOnViolation = writable<boolean>(true);

export function stepSimulation() {
  if (!simulator) return;

  const result = simulator.step();
  executionState.set(result.state);

  if (result.safetyCheck && !result.safetyCheck.safe) {
    safetyCheckResult.set(result.safetyCheck);

    if (get(autoHaltOnViolation)) {
      pauseSimulation();
      // Show notification to user
    }
  }
}
```

#### 3.2 Violation Highlighting in CFSM Visualization
Highlight violating transitions in the CFSM network when violation detected.

#### 3.3 Safety Metrics Dashboard
Show:
- Total states explored
- Number of safe states
- Number of unsafe states
- Percentage of safe executions

---

## 4. Testing Strategy

### Unit Tests
```typescript
// src/core/simulation/__tests__/distributed-simulator-safety.test.ts
describe('DistributedSimulator with Safety Checking', () => {
  it('should detect send-receive mismatches', () => {
    // Create CFSMs with known violation
    // Step through simulation
    // Assert violation detected
  });

  it('should halt on violation when configured', () => {
    // Enable haltOnViolation
    // Step to violation
    // Assert halted
  });

  it('should continue past violations when not halting', () => {
    // Disable haltOnViolation
    // Step through violations
    // Assert continues
  });
});
```

### Integration Tests
- Test safety panel renders correctly
- Test violation display
- Test auto-halt functionality
- Test safety toggle on/off

---

## 5. Implementation Timeline

| Phase | Task | Time | Priority |
|-------|------|------|----------|
| 1.1 | Enhanced DistributedSimulator | 1-2h | **P0** |
| 1.2 | Safety-Aware Simulation Store | 1h | **P0** |
| 2.1 | SafetyPanel Component | 2h | **P0** |
| 2.2 | Update SimulationTab | 1h | **P0** |
| 3.1 | Safety-Aware Stepping | 1h | P1 |
| 3.2 | Violation Highlighting | 1h | P1 |
| 3.3 | Safety Metrics Dashboard | 1h | P2 |
| Testing | Unit + Integration Tests | 2h | **P0** |

**Total Estimated Time**: 7-10 hours

**Minimum Viable**: Phases 1.1, 1.2, 2.1, 2.2 (5-6 hours)

---

## 6. Success Criteria

✅ User can enable/disable real-time safety checking
✅ Safety violations are detected and displayed during simulation
✅ Violations show which roles and states are involved
✅ User can auto-halt on violations or continue
✅ Violation history is tracked
✅ All tests pass (unit + integration)
✅ Performance: Safety checking adds <100ms overhead per step

---

## 7. Future Enhancements

1. **Reachability Tree Visualization** - Show full state space explored
2. **Violation Explanation** - Suggest fixes for violations
3. **Safety Property Selection** - Choose different safety levels (BasicSafety, DeadlockFree, Live)
4. **Trace Export** - Export violation traces for debugging
5. **Counterexample Generation** - Show minimal trace leading to violation

---

## 8. References

- **Safety Implementation**: `src/core/safety/`
- **Safety API**: `src/core/safety-api.ts`
- **API Guide**: `docs/SAFETY_API_GUIDE.md`
- **Distributed Simulator**: `src/core/simulation/distributed-simulator.ts`
- **UI Plan**: `docs/UI_AND_TESTING_PLAN.md`
- **Formal Correctness**: `docs/FORMAL_CORRECTNESS_ACHIEVEMENT.md`

---

**Created**: 2025-11-15
**Status**: READY TO IMPLEMENT
**Next Step**: Begin Phase 1.1 - Enhanced DistributedSimulator
