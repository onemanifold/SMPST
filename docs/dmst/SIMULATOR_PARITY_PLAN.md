# MPST VM Runtime: Simulator Architecture Analysis

**Date**: 2025-11-15
**Context**: CFSM is the IR for MPST VM runtime. Generated code wraps/extends simulators.
**Goal**: Bring DMst simulator to feature parity with classic MPST simulator.

---

## Executive Summary

The **classic MPST simulator** is more mature and feature-complete than the **DMst simulator**. Since generated code will wrap/extend these simulators, we need to bring DMst to parity and use it as a testbed for updatable CFSM runtime semantics.

**Critical Insight**: Simulator is not a debugging tool - it's the **production VM runtime**.

---

## Feature Comparison Matrix

| Feature | Classic MPST Simulator | DMst Simulator | Priority | Status |
|---------|------------------------|----------------|----------|--------|
| **Core Execution** | | | | |
| Per-role execution | ✅ Via Executor class | ✅ Inline stepRole() | - | Equal |
| Fair scheduling (round-robin) | ✅ Full implementation | ❌ Steps all roles per step() | **P0** | **Gap** |
| Epsilon/tau auto-advance | ✅ Executor loop | ❌ Single transition only | **P0** | **Gap** |
| Terminal state detection | ✅ Via CFSM.terminalStates | ✅ Via CFSM.terminalStates | - | Equal |
| Step counting | ✅ One step = one transition | ⚠️ One step = all roles | **P0** | **Gap** |
| | | | | |
| **Sub-Protocol Support** | | | | |
| Call stack | ✅ Full implementation | ❌ TODO stub | **P0** | **Critical** |
| Push/pop frames | ✅ executor.ts:144-150 | ❌ Not implemented | **P0** | **Critical** |
| Return state tracking | ✅ CallStackFrame type | ⚠️ dmst-runtime has stubs | **P0** | **Critical** |
| CFSM registry lookup | ✅ Full support | ❌ Not integrated | **P0** | **Critical** |
| | | | | |
| **DMst-Specific** | | | | |
| Dynamic participant creation | ❌ N/A | ✅ Full support | - | DMst-only |
| Invitation protocol | ❌ N/A | ✅ Full support | - | DMst-only |
| Growing participant sets | ❌ N/A | ✅ Full support | - | DMst-only |
| Updatable recursion execution | ❌ N/A | ❌ Not implemented | **P1** | **Future** |
| | | | | |
| **Control Flow** | | | | |
| run() to completion | ✅ Full implementation | ✅ Basic implementation | - | Similar |
| pause() / resume() | ✅ Closure-based | ❌ Not implemented | **P1** | Gap |
| reset() | ✅ Full executor reset | ⚠️ Partial (no transport clear) | **P1** | Gap |
| step(role?) | ✅ Optional role parameter | ❌ No role selection | **P1** | Gap |
| | | | | |
| **Observability** | | | | |
| Observer pattern | ✅ Full event system | ❌ Not implemented | **P1** | Gap |
| Trace recording | ✅ Full trace support | ❌ Not implemented | **P1** | Gap |
| Event types | ✅ 4 event types | ❌ None | **P1** | Gap |
| | | | | |
| **Error Handling** | | | | |
| Blocked state | ✅ Executor tracks | ✅ ExecState tracks | - | Equal |
| Deadlock detection | ✅ Global state check | ✅ DMst-aware check | - | Equal |
| Protocol violations | ✅ Strict mode | ✅ Error checking | - | Equal |
| Max steps limit | ✅ Configurable | ✅ Hardcoded 1000 | **P2** | Minor |

---

## Architecture Differences

### Classic MPST Simulator

```
┌─────────────────┐
│   Simulator     │
│  - Orchestrates │
│  - Fair sched   │
│  - Observers    │
└────────┬────────┘
         │ delegates to
         ▼
┌─────────────────┐  (one per role)
│   Executor      │
│  - CFSM exec    │
│  - Call stack   │
│  - State mgmt   │
└────────┬────────┘
         │ uses
         ▼
┌─────────────────┐
│  MessageTransport│
└─────────────────┘
```

**Strengths**:
- ✅ Clean separation: Simulator orchestrates, Executor executes
- ✅ Each role has isolated Executor with own state
- ✅ Call stack in Executor (correct scope)
- ✅ Observer pattern for extensibility
- ✅ Fair scheduling prevents starvation

### DMst Simulator

```
┌─────────────────┐
│ DMstSimulator   │
│  - All logic    │
│  - stepRole()   │
│  - No delegation│
└────────┬────────┘
         │ manages
         ▼
┌─────────────────┐
│ DMstSimulation  │
│     State       │
│  - Static roles │
│  - Dynamic parts│
│  - Events       │
└─────────────────┘
```

**Strengths**:
- ✅ Handles dynamic participant creation
- ✅ Invitation protocol synchronization
- ✅ Growing participant sets
- ✅ DMst-specific event tracking

**Weaknesses**:
- ❌ Monolithic (all logic in one class)
- ❌ No Executor abstraction (harder to extend)
- ❌ Steps ALL roles per step() (not fair scheduling)
- ❌ No observer pattern
- ❌ Sub-protocol calls stubbed

---

## Critical Gaps (P0 - Must Fix)

### 1. **Sub-Protocol Call Stack** ⚠️ CRITICAL

**Problem**:
```typescript
// dmst-simulator.ts:338
private async executeProtocolCall(...): Promise<ExecutionResult> {
  // TODO: Implement protocol call stack semantics
  return { success: true }; // ← STUB!
}
```

**Impact**: Generated code for protocols with sub-protocol calls will fail at runtime.

**Classic implementation** (executor.ts:403-460):
```typescript
private async executeSubProtocol(transition: CFSMTransition): Promise<ExecutionResult> {
  const subProtocolAction = action as SubProtocolCallAction;

  // Look up sub-protocol CFSM from registry
  const protocolCFSMs = this.cfsmRegistry.get(subProtocolAction.protocol);
  const subCFSM = protocolCFSMs.get(mappedRole);

  // Push parent context onto call stack
  this.callStack.push({
    parentCFSM: this.currentCFSM,
    returnState: subProtocolAction.returnState,
  });

  // Switch to sub-protocol CFSM
  this.currentCFSM = subCFSM;
  this.currentState = subCFSM.initialState;

  return { success: true };
}
```

**Why it matters**: Pabble (Hu et al. 2015) protocol calls are **fundamental** for composition.

---

### 2. **Fair Scheduling** ⚠️ CRITICAL

**Problem**: DMst simulator steps ALL roles in one step():
```typescript
// dmst-simulator.ts:97
for (const [role, execState] of allParticipants) {
  const result = await this.stepRole(role, cfsm, execState);
  updates.set(role, result);
}
```

**Expected**: ONE role executes ONE transition per step() (Honda et al. 2008 semantics).

**Impact**:
- Breaks step-in/step-out debugging
- Can't reproduce race conditions
- Non-deterministic execution order

**Fix**: Use round-robin scheduler like classic simulator:
```typescript
// simulator.ts:145-169
while (attempts < this.roleNames.length) {
  const candidateRole = this.roleNames[this.nextRoleIndex];
  this.nextRoleIndex = (this.nextRoleIndex + 1) % this.roleNames.length;

  if (!executor.getState().completed) {
    const result = await executor.step();
    break; // Stepped ONE role - done
  }
}
```

---

### 3. **Epsilon Auto-Advance** ⚠️ CRITICAL

**Problem**: DMst simulator executes one transition per stepRole():
```typescript
// dmst-simulator.ts:209
const transition = transitions[0];
const result = await this.executeAction(role, action, execState);
return result; // ← Stops after ONE transition
```

**Expected**: Auto-advance through epsilon (tau) transitions until hitting action or terminal.

**Classic implementation** (executor.ts:136-195):
```typescript
while (true) {
  // Check terminal
  if (terminalStates.includes(this.currentState)) {
    return { success: true };
  }

  const action = firstTransition.action;

  // No action = epsilon - auto-advance
  if (!action) {
    this.transitionTo(firstTransition.to);
    continue; // ← Keep looping
  }

  // Execute action and return
  const result = await this.executeSend(firstTransition);
  return result;
}
```

**Impact**: CFSMs with structural states (branch, merge, fork, join) won't execute correctly.

---

## Path Forward

### Phase 1: Bring DMst to Parity (P0 - Critical)

**Goal**: Make DMst simulator production-ready for code generation.

#### 1.1 Refactor to Use Executor Pattern
- Create DMstExecutor extending Executor
- Move stepRole() logic into DMstExecutor
- Add DMst action types (create, invite) to Executor
- Keep DMstSimulator for orchestration only

**Why**:
- Reuses battle-tested Executor logic (call stack, epsilon advance)
- Maintains separation of concerns
- Easier to extend

**Files to modify**:
- `src/core/runtime/dmst-executor.ts` (NEW)
- `src/core/runtime/dmst-simulator.ts` (REFACTOR)

#### 1.2 Implement Sub-Protocol Call Stack
- Port Executor call stack logic to DMstExecutor
- Integrate with protocol registry
- Handle role mapping (formal → actual parameters)

**Why**: Critical for protocol composition.

#### 1.3 Implement Fair Scheduling
- Use round-robin scheduler from classic simulator
- Step ONE role per step()
- Track nextRoleIndex across static + dynamic participants

**Why**: Enables step-in/step-out debugging, deterministic execution.

#### 1.4 Implement Epsilon Auto-Advance
- Port epsilon loop from Executor
- Handle tau transitions automatically
- Stop only at actions or terminals

**Why**: Correct execution of structured CFSMs.

**Estimated effort**: 2-3 days (reusing existing code)

---

### Phase 2: Observer Pattern & Tooling (P1 - High)

**Goal**: Enable debugging, visualization, and monitoring.

#### 2.1 Observer Pattern
- Port observer system from classic simulator
- Fire events for DMst-specific actions (create, invite)
- Add observers to DMstExecutor

**Files to modify**:
- `src/core/runtime/types.ts` (add DMst event types)
- `src/core/runtime/dmst-executor.ts` (fire events)
- `src/core/runtime/dmst-simulator.ts` (observer management)

#### 2.2 Trace Recording
- Port trace system from classic simulator
- Record DMst events (participant creation, invitations)
- Export traces for analysis

#### 2.3 Pause/Resume
- Port closure-based pause from classic simulator
- Enable interactive debugging

**Estimated effort**: 1-2 days

---

### Phase 3: Updatable CFSM Runtime (P1 - Research)

**Goal**: Enable updatable recursion execution (DMst's killer feature).

#### 3.1 Design Updatable CFSM Semantics

**Challenge**: How to update a CFSM during execution?

**Options**:

**Option A: CFSM Mutation** (Simple)
```typescript
// When hitting `continue X with { ... }`:
const updatedCFSM = reproject(globalCFG_withUpdate, role);
this.currentCFSM = updatedCFSM; // ← Replace CFSM
this.currentState = updatedCFSM.initialState; // ← Reset to start
```

**Pros**: Simple, leverages existing projection
**Cons**: Loses current state, no rollback on failure

**Option B: CFSM Versioning** (Robust)
```typescript
interface VersionedCFSM {
  version: number;
  cfsm: CFSM;
  parentVersion?: number;
}

// When hitting update:
const newVersion = this.versionStack.push({
  version: this.version + 1,
  cfsm: reproject(globalCFG_withUpdate, role),
  parentVersion: this.version,
});

// On update failure:
this.versionStack.pop(); // ← Rollback
this.currentCFSM = this.versionStack.top().cfsm;
```

**Pros**: Rollback support, audit trail, step-in/step-out
**Cons**: More complex, memory overhead

**Option C: Lazy Update** (Efficient)
```typescript
// When hitting update recursion node:
// 1. Compute 1-unfolding: G ♢ G_update
// 2. Check safe update (Definition 14)
// 3. If safe, inject update CFG into current execution
// 4. Continue without full re-projection

// Update is "lazy" - only affects next iteration
```

**Pros**: Efficient, minimal overhead
**Cons**: Complex semantics, requires CFG manipulation

**Recommendation**: Start with **Option B** for robustness, optimize to Option C later.

#### 3.2 Implement Update Points

**What**: Identify where updates happen in CFSM.

**Updatable recursion** in CFG:
```
rec X {
  G;
  continue X with { G_update };
}
```

Projected CFSM has special "continue" transitions:
```typescript
{
  type: 'updatable-continue',
  label: 'X',
  updateBody: G_update, // ← CFG fragment for update
}
```

**On execution**:
1. Hit updatable-continue transition
2. Compute 1-unfolding: G ♢ G_update
3. Verify safe (Definition 14)
4. If safe: Update CFSM version
5. If unsafe: Rollback, raise error

#### 3.3 Rollback Semantics

**Requirement**: Step-in/step-out debugging needs undo.

**Implementation**:
```typescript
class DMstExecutor {
  private cfsmVersionStack: VersionedCFSM[] = [];
  private stateSnapshot: ExecutionStateSnapshot[] = [];

  async executeUpdate(updateCFG: CFG): Promise<UpdateResult> {
    // Save snapshot
    this.stateSnapshot.push(this.captureState());

    try {
      // Compute 1-unfolding
      const unfolding = compute1Unfolding(currentCFG, updateCFG);

      // Verify safe (Definition 14)
      const safeCheck = checkSafeProtocolUpdate(unfolding);
      if (!safeCheck.isSafe) {
        throw new UpdateError('Unsafe update');
      }

      // Project updated CFSM
      const updatedCFSM = project(unfolding, this.role);

      // Push new version
      this.cfsmVersionStack.push({
        version: this.version + 1,
        cfsm: updatedCFSM,
      });

      return { success: true };
    } catch (error) {
      // Rollback on failure
      this.rollback();
      return { success: false, error };
    }
  }

  rollback(): void {
    this.cfsmVersionStack.pop();
    this.restoreState(this.stateSnapshot.pop());
  }
}
```

**Estimated effort**: 3-5 days (research + implementation)

---

## Implementation Roadmap

### Sprint 1: Parity (P0) - **1 week**
- [ ] Day 1-2: Create DMstExecutor (refactor from stepRole)
- [ ] Day 3: Implement sub-protocol call stack
- [ ] Day 4: Implement fair scheduling
- [ ] Day 5: Implement epsilon auto-advance
- [ ] Day 6-7: Integration tests, bugfixes

**Deliverable**: DMst simulator at parity with classic MPST simulator.

### Sprint 2: Observability (P1) - **3-4 days**
- [ ] Day 1: Observer pattern + DMst events
- [ ] Day 2: Trace recording
- [ ] Day 3: Pause/resume
- [ ] Day 4: Testing, documentation

**Deliverable**: Production-ready DMst VM with debugging support.

### Sprint 3: Updatable Runtime (P1) - **1-2 weeks**
- [ ] Week 1: Design versioned CFSM semantics
- [ ] Week 2: Implement update points + rollback
- [ ] Week 2: Testing with DMst examples

**Deliverable**: Full DMst runtime with updatable recursion execution.

---

## Success Criteria

### Phase 1 (Parity)
- ✅ All DMst test protocols execute correctly
- ✅ Sub-protocol calls work (nested delegation)
- ✅ Fair scheduling (one role, one transition per step)
- ✅ Epsilon auto-advance (structural states transparent)
- ✅ No regressions in classic simulator

### Phase 2 (Observability)
- ✅ Observer pattern functional
- ✅ Trace export works
- ✅ Pause/resume works
- ✅ Can debug protocol execution step-by-step

### Phase 3 (Updatable Runtime)
- ✅ Updatable recursion executes correctly
- ✅ Rollback works on update failure
- ✅ Safe update verification at runtime
- ✅ Step-in/step-out through updates

---

## Questions for Discussion

1. **Architecture**: Should we merge classic + DMst simulators, or keep separate?
   - **Recommendation**: Keep separate. DMst is superset, but distinct use cases.

2. **Executor inheritance**: Should DMstExecutor extend Executor?
   - **Recommendation**: Yes. Reuse call stack, epsilon advance, observer pattern.

3. **Updatable CFSM**: Which versioning strategy?
   - **Recommendation**: Start with Option B (versioning), optimize later.

4. **Testing**: How to test updatable runtime?
   - **Recommendation**: Use DMst validation protocols (Updatable Pipeline, etc.)

5. **Code generation**: Wrap Executor or Simulator?
   - **Recommendation**: Wrap Executor (one per role), instantiate Simulator for multi-role.

---

## Next Steps

1. **Create GitHub issues** for each phase
2. **Add TODO comments** to DMst simulator marking gaps
3. **Start Sprint 1**: DMstExecutor refactor

**Ready to proceed?**
