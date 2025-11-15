# GitHub Issues: DMst Simulator Parity

**Context**: These issues track bringing DMst simulator to feature parity with classic MPST simulator for production VM runtime.

---

## Issue 1: Implement Sub-Protocol Call Stack in DMst Simulator

**Priority**: P0 - Critical
**Labels**: `enhancement`, `dmst`, `runtime`, `P0`

### Description

The DMst simulator currently has a stub for sub-protocol calls:

```typescript
// src/core/runtime/dmst-simulator.ts:338
private async executeProtocolCall(...): Promise<ExecutionResult> {
  // TODO: Implement protocol call stack semantics
  return { success: true };
}
```

This prevents execution of protocols with sub-protocol invocations (Pabble composition).

### Requirements

1. Port call stack implementation from `Executor` class
2. Support push/pop of CallStackFrame
3. Integrate with CFSM registry for sub-protocol lookup
4. Handle role mapping (formal parameters → actual arguments)
5. Maintain return state across call/return

### Reference Implementation

See `src/core/runtime/executor.ts:403-460` for working implementation.

### Acceptance Criteria

- [ ] DMst protocols with sub-protocol calls execute correctly
- [ ] Call stack depth tracked
- [ ] Return states handled properly
- [ ] All sub-protocol tests pass

### Estimated Effort

1-2 days

---

## Issue 2: Implement Fair Scheduling in DMst Simulator

**Priority**: P0 - Critical
**Labels**: `enhancement`, `dmst`, `runtime`, `P0`

### Description

DMst simulator currently steps ALL roles per `step()` call:

```typescript
for (const [role, execState] of allParticipants) {
  const result = await this.stepRole(role, cfsm, execState);
}
```

This violates MPST semantics where one step = one role executes one transition.

### Requirements

1. Implement round-robin fair scheduling
2. Step ONE role per `step()` call
3. Track `nextRoleIndex` across static + dynamic participants
4. Support optional `step(role)` parameter for targeted stepping

### Reference Implementation

See `src/core/runtime/simulator.ts:145-169` for round-robin scheduler.

### Acceptance Criteria

- [ ] `step()` executes one role, one transition
- [ ] Round-robin prevents starvation
- [ ] `step(role)` allows targeted stepping
- [ ] Step count = transition count

### Estimated Effort

1 day

---

## Issue 3: Implement Epsilon Auto-Advance in DMst Simulator

**Priority**: P0 - Critical
**Labels**: `enhancement`, `dmst`, `runtime`, `P0`

### Description

DMst simulator executes one transition per `stepRole()` and stops:

```typescript
const transition = transitions[0];
const result = await this.executeAction(role, action, execState);
return result; // Stops here
```

Expected: Auto-advance through epsilon (tau) transitions until hitting an action or terminal state.

### Requirements

1. Loop through transitions while current transition is epsilon
2. Only stop at:
   - Terminal state
   - Action transition (send, receive, subprotocol)
   - Error/blocked state
3. Maintain visited state tracking

### Reference Implementation

See `src/core/runtime/executor.ts:136-195` for epsilon loop.

### Acceptance Criteria

- [ ] Structural states (branch, merge, fork, join) transparent
- [ ] Execution stops at actions
- [ ] Terminal states detected correctly
- [ ] No infinite loops on malformed CFSMs

### Estimated Effort

1 day

---

## Issue 4: Refactor DMstSimulator to Use Executor Pattern

**Priority**: P0 - Critical
**Labels**: `refactor`, `dmst`, `runtime`, `P0`

### Description

DMst simulator is monolithic - all logic in one class. This makes it harder to extend and doesn't reuse battle-tested `Executor` logic.

### Requirements

1. Create `DMstExecutor` extending `Executor`
2. Move `stepRole()` logic into `DMstExecutor`
3. Add DMst-specific actions (create, invite) to executor
4. Keep `DMstSimulator` for orchestration only
5. Maintain backward compatibility

### Benefits

- Reuses call stack, epsilon advance, observer pattern
- Separation of concerns
- Easier to extend for updatable CFSMs

### Acceptance Criteria

- [ ] `DMstExecutor` class created
- [ ] DMst simulator delegates to executors
- [ ] All DMst tests pass
- [ ] No regressions

### Estimated Effort

2-3 days

---

## Issue 5: Add Observer Pattern to DMst Simulator

**Priority**: P1 - High
**Labels**: `enhancement`, `dmst`, `runtime`, `observability`

### Description

DMst simulator lacks observer pattern for debugging, visualization, and monitoring.

### Requirements

1. Port observer system from classic simulator
2. Define DMst-specific event types:
   - `ParticipantCreationEvent`
   - `InvitationCompleteEvent`
   - `ProtocolUpdateEvent` (future)
3. Fire events from DMstExecutor
4. Add `addObserver()`, `removeObserver()` methods

### Reference Implementation

See `src/core/runtime/simulator.ts:350-402` for observer pattern.

### Acceptance Criteria

- [ ] Observer pattern functional
- [ ] DMst events fire correctly
- [ ] Can attach multiple observers
- [ ] No performance degradation

### Estimated Effort

1 day

---

## Issue 6: Add Trace Recording to DMst Simulator

**Priority**: P1 - High
**Labels**: `enhancement`, `dmst`, `runtime`, `observability`

### Description

DMst simulator doesn't record execution traces for debugging and analysis.

### Requirements

1. Port trace recording from classic simulator
2. Record DMst-specific events
3. Export traces in JSON format
4. Add `getTrace()` method

### Reference Implementation

See `src/core/runtime/simulator.ts:384-402` for trace recorder.

### Acceptance Criteria

- [ ] Traces record all execution events
- [ ] DMst events included
- [ ] Trace export works
- [ ] Traces can be visualized

### Estimated Effort

1 day

---

## Issue 7: Add Pause/Resume to DMst Simulator

**Priority**: P1 - High
**Labels**: `enhancement`, `dmst`, `runtime`, `observability`

### Description

DMst simulator lacks pause/resume for interactive debugging.

### Requirements

1. Port closure-based pause from classic simulator
2. Add `pause()` method
3. Support pausing during `run()`
4. Preserve state across pause/resume

### Reference Implementation

See `src/core/runtime/simulator.ts:208-303` for pause/resume.

### Acceptance Criteria

- [ ] `pause()` stops execution
- [ ] State preserved during pause
- [ ] `run()` can resume
- [ ] No race conditions

### Estimated Effort

0.5 days

---

## Issue 8: Design Updatable CFSM Runtime Semantics

**Priority**: P1 - Research
**Labels**: `research`, `dmst`, `runtime`, `updatable-recursion`

### Description

Implement runtime execution of updatable recursion (`continue X with { ... }`).

### Research Questions

1. How to represent CFSM updates?
   - Mutation vs versioning vs lazy update
2. How to handle rollback on update failure?
3. How to maintain state across updates?
4. How to debug step-in/step-out through updates?

### Requirements

1. Define versioned CFSM semantics
2. Implement update points in execution
3. Add rollback support
4. Verify safe updates at runtime (Definition 14)

### Deliverables

- Design document: Updatable CFSM runtime semantics
- Prototype implementation
- Test cases using DMst validation protocols

### Acceptance Criteria

- [ ] Updatable recursion executes correctly
- [ ] Rollback works on update failure
- [ ] Step-in/step-out through updates
- [ ] All updatable recursion tests pass

### Estimated Effort

1-2 weeks (research + implementation)

---

## Issue 9: Add DMst Simulator Tests

**Priority**: P1 - High
**Labels**: `testing`, `dmst`, `runtime`

### Description

DMst simulator lacks comprehensive unit tests.

### Requirements

1. Test sub-protocol calls (when implemented)
2. Test fair scheduling
3. Test epsilon auto-advance
4. Test dynamic participant creation
5. Test invitation protocol
6. Test observer pattern
7. Test trace recording

### Acceptance Criteria

- [ ] >80% code coverage
- [ ] All edge cases tested
- [ ] Integration tests with DMst validation protocols

### Estimated Effort

2-3 days

---

## Roadmap

### Sprint 1: Parity (1 week)
- Issue 4: Refactor to Executor pattern (2-3 days)
- Issue 1: Sub-protocol call stack (1-2 days)
- Issue 2: Fair scheduling (1 day)
- Issue 3: Epsilon auto-advance (1 day)

### Sprint 2: Observability (3-4 days)
- Issue 5: Observer pattern (1 day)
- Issue 6: Trace recording (1 day)
- Issue 7: Pause/resume (0.5 days)
- Issue 9: Tests (2-3 days)

### Sprint 3: Updatable Runtime (1-2 weeks)
- Issue 8: Updatable CFSM semantics (research + implementation)

---

## Notes

- All issues assume DMst verification (Definition 14, 15, Theorem 20) is already implemented ✅
- Focus is on **runtime execution**, not static verification
- Simulator is evolving into **production MPST VM runtime**
- Generated code will wrap/extend executors
