# Sprint 1 Handover: DMst Simulator Parity Implementation

**Sprint**: 1 of 3
**Goal**: Bring DMst simulator to feature parity with classic MPST simulator
**Duration**: 1 week (5-7 days)
**Priority**: P0 - Critical (blocks code generation for production use)
**Status**: Ready to begin

---

## Executive Summary

The DMst simulator currently has **4 critical gaps (P0)** preventing production use:

1. **Sub-protocol call stack** - Currently stubbed, breaks protocol composition
2. **Fair scheduling** - Steps all roles per step(), violates MPST semantics
3. **Epsilon auto-advance** - Single transition only, breaks structural states
4. **Executor pattern** - Monolithic architecture, hard to extend

**Critical insight**: The simulator is not a debugging tool - it's the **MPST VM runtime**. Generated code will wrap/extend these simulators, so correctness is paramount.

---

## Context & Background

### What is DMst?

**DMst** (Dynamically Updatable Multiparty Session Types) extends classic MPST with:
- Dynamic participant creation during execution
- Invitation protocol for synchronization
- Protocol composition (Pabble-style calls)
- **Updatable recursion** - protocols can evolve at runtime

**Paper**: Castro-Perez & Yoshida, "Dynamically Updatable Multiparty Session Protocols" (ECOOP 2023)
**DOI**: https://doi.org/10.4230/LIPIcs.ECOOP.2023.* (exact number TBD)

### Current State

**Verification**: ✅ Complete (76/76 tests passing)
- ✅ Definition 15 (Well-Formed Global Types) - Implemented
- ✅ Definition 14 (Safe Protocol Update) - Implemented
- ✅ Theorem 20 (Trace Equivalence) - Relied upon (proven by induction)
- ✅ All DMst examples parse, verify, and project correctly

**Runtime Execution**: ❌ Incomplete (4 P0 gaps)
- ❌ Sub-protocol calls stubbed
- ❌ Fair scheduling missing
- ❌ Epsilon auto-advance missing
- ⚠️ Monolithic architecture (hard to extend)

### Why This Matters

**Code generation** depends on simulator parity:
```typescript
// Generated code pattern:
class WorkerRole extends DMstExecutor {
  constructor(transport: MessageTransport) {
    super(WorkerCFSM, 'Worker', transport);
  }

  // User code implements action handlers
  async onTaskMessage(task: Task): Promise<Result> {
    // Process task...
  }
}

// Multi-role orchestration:
const simulator = new DMstSimulator(
  new Map([
    ['Coordinator', new CoordinatorRole(transport)],
    ['Worker', new WorkerRole(transport)],
  ])
);

await simulator.run();
```

**Without parity**:
- Sub-protocol calls will silently fail
- Debugging will be non-deterministic (all roles step together)
- Structural states (branch, merge, fork, join) won't execute
- Updatable recursion cannot be implemented (Sprint 3)

---

## Sprint 1 Tasks

### Task 1: Refactor to Executor Pattern (2-3 days)

**Goal**: Separate concerns - Simulator orchestrates, Executor executes.

**Current Architecture** (DMst):
```
┌─────────────────┐
│ DMstSimulator   │
│  - All logic    │
│  - stepRole()   │
│  - No delegation│
└─────────────────┘
```

**Target Architecture** (Classic MPST):
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
└─────────────────┘
```

**Implementation Steps**:

1. **Create `src/core/runtime/dmst-executor.ts`**:
   ```typescript
   import { Executor } from './executor';
   import type { CFSM, CFSMAction } from '../projection/types';
   import type { MessageTransport } from './types';

   export class DMstExecutor extends Executor {
     constructor(
       cfsm: CFSM,
       role: string,
       transport: MessageTransport,
       cfsmRegistry?: Map<string, Map<string, CFSM>>
     ) {
       super(cfsm, role, transport, cfsmRegistry);
     }

     // Override executeAction to handle DMst-specific actions
     protected async executeAction(action: CFSMAction): Promise<ExecutionResult> {
       switch (action.type) {
         case 'create':
           return this.executeCreate(action);
         case 'invite':
           return this.executeInvite(action);
         default:
           return super.executeAction(action); // Delegate to parent
       }
     }

     private async executeCreate(action: CreateAction): Promise<ExecutionResult> {
       // TODO: Implement creation logic
     }

     private async executeInvite(action: InviteAction): Promise<ExecutionResult> {
       // TODO: Implement invitation logic
     }
   }
   ```

2. **Refactor `src/core/runtime/dmst-simulator.ts`**:
   - Remove `stepRole()` logic (move to DMstExecutor)
   - Create one DMstExecutor per role (static + dynamic)
   - Delegate `step()` to executors
   - Keep orchestration logic (dynamic participant creation, fair scheduling)

3. **Update types in `src/core/projection/types.ts`**:
   ```typescript
   export interface CreateAction extends CFSMAction {
     type: 'create';
     role: string;        // Dynamic role name (e.g., 'Worker')
     instance: string;    // Instance ID (e.g., 'Worker_1')
   }

   export interface InviteAction extends CFSMAction {
     type: 'invite';
     target: string;      // Instance ID to invite
   }
   ```

**Reference Implementation**:
- Classic Executor: `src/core/runtime/executor.ts`
- Classic Simulator: `src/core/runtime/simulator.ts:40-110`

**Acceptance Criteria**:
- ✅ DMstExecutor class created and extends Executor
- ✅ DMstSimulator delegates to executors
- ✅ All existing DMst tests still pass (76/76)
- ✅ No regressions in classic simulator

---

### Task 2: Implement Sub-Protocol Call Stack (1-2 days)

**Goal**: Enable protocol composition (Pabble-style calls).

**Current State** (dmst-simulator.ts:361-387):
```typescript
private async executeProtocolCall(...): Promise<ExecutionResult> {
  // TODO: Implement protocol call stack semantics
  console.warn(`[DMstSimulator] Sub-protocol call not implemented - stubbed: ${role}`);
  return { success: true };
}
```

**Target Semantics**:
```typescript
// When executing: calls SubProtocol(A, B);

// 1. Look up sub-protocol CFSM from registry
const subCFSMs = this.cfsmRegistry.get('SubProtocol');
const subCFSM = subCFSMs.get(this.role); // Map formal role → actual role

// 2. Push current context onto call stack
this.callStack.push({
  parentCFSM: this.currentCFSM,
  returnState: transition.to,
});

// 3. Switch to sub-protocol CFSM
this.currentCFSM = subCFSM;
this.currentState = subCFSM.initialState;

// 4. Continue execution in sub-protocol

// 5. On sub-protocol completion (terminal state):
const frame = this.callStack.pop();
this.currentCFSM = frame.parentCFSM;
this.currentState = frame.returnState;
```

**Implementation Steps**:

1. **Port call stack logic from Executor** (`executor.ts:403-460`):
   - Add `callStack: CallStackFrame[]` to DMstExecutor
   - Implement `executeSubProtocol()` method
   - Handle terminal state detection → pop stack

2. **Integrate with CFSM registry**:
   - DMstExecutor constructor takes `cfsmRegistry` parameter
   - Registry structure: `Map<protocolName, Map<roleName, CFSM>>`

3. **Handle role mapping**:
   - Formal parameters: `protocol Foo(role A, role B)`
   - Actual arguments: `calls Foo(Client, Server);`
   - Map: `A → Client`, `B → Server`

**Reference Implementation**:
- `src/core/runtime/executor.ts:403-460` - Full call stack logic
- `src/core/runtime/types.ts:132-137` - CallStackFrame type

**Test Case** (create this):
```typescript
// tests/integration/dmst-subprotocol-calls.test.ts
describe('DMst Sub-Protocol Calls', () => {
  it('should execute nested protocol calls', async () => {
    // Use examples/dmst/protocol-call.smpst
    const module = parse(readFileSync('examples/dmst/protocol-call.smpst', 'utf-8'));
    const protocols = /* parse all protocols */;

    const cfsmRegistry = new Map();
    protocols.forEach(proto => {
      const cfgs = buildCFG(proto);
      const projections = new Map();
      cfg.roles.forEach(role => {
        projections.set(role, project(cfg, role));
      });
      cfsmRegistry.set(proto.name, projections);
    });

    const simulator = new DMstSimulator(
      cfsmRegistry.get('MainProtocol'),
      new Map(), // No dynamic roles
      new InMemoryTransport()
    );

    const result = await simulator.run();
    expect(result.completed).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
```

**Acceptance Criteria**:
- ✅ Sub-protocol calls execute correctly
- ✅ Call stack depth tracked
- ✅ Return states handled properly
- ✅ Protocol composition examples pass (protocol-call.smpst, sequential-calls.smpst)

---

### Task 3: Implement Fair Scheduling (1 day)

**Goal**: Step ONE role per `step()` call (Honda et al. 2008 semantics).

**Current State** (dmst-simulator.ts:100-133):
```typescript
async step(): Promise<SimulationStepResult> {
  // Get all active participants
  const allParticipants = getAllActiveParticipants(this.state);

  // TODO: Implement round-robin fair scheduling here
  // Should select ONE role to step, not all roles

  // Step each participant
  for (const [role, execState] of allParticipants) {
    const result = await this.stepRole(role, cfsm, execState);
    updates.set(role, result);
  }
}
```

**Target Semantics** (simulator.ts:145-169):
```typescript
async step(targetRole?: string): Promise<SimulationStepResult> {
  if (targetRole) {
    // Step specific role
    const executor = this.executors.get(targetRole);
    return executor.step();
  }

  // Round-robin scheduling
  let attempts = 0;
  while (attempts < this.roleNames.length) {
    const candidateRole = this.roleNames[this.nextRoleIndex];
    this.nextRoleIndex = (this.nextRoleIndex + 1) % this.roleNames.length;

    const executor = this.executors.get(candidateRole);
    if (!executor.getState().completed) {
      const result = await executor.step();
      return { role: candidateRole, result };
    }

    attempts++;
  }

  // All roles completed
  return { completed: true };
}
```

**Implementation Steps**:

1. **Add round-robin state to DMstSimulator**:
   ```typescript
   private nextRoleIndex: number = 0;
   private roleNames: string[]; // Sorted list of static + dynamic roles
   ```

2. **Update `step()` method**:
   - Accept optional `targetRole` parameter
   - If provided, step that specific role
   - Otherwise, round-robin through all roles
   - Skip completed roles
   - Return after ONE role steps

3. **Handle dynamic role addition**:
   - When new participant created, insert into `roleNames` (sorted order)
   - Adjust `nextRoleIndex` if insertion before current index

**Why This Matters**:
- Enables step-in/step-out debugging
- Deterministic execution order
- Reproduces race conditions correctly
- Matches MPST semantics (one step = one transition)

**Acceptance Criteria**:
- ✅ `step()` executes one role, one transition
- ✅ Round-robin prevents starvation
- ✅ `step(role)` allows targeted stepping
- ✅ Step count = transition count (verifiable in tests)

---

### Task 4: Implement Epsilon Auto-Advance (1 day)

**Goal**: Auto-advance through epsilon (tau) transitions until hitting action or terminal.

**Current State** (dmst-simulator.ts:203-254):
```typescript
private async stepRole(...): Promise<ExecutionResult> {
  // Find available transitions from current state
  const transitions = cfsm.transitions.filter(t => t.from === execState.currentState);

  // Try first transition (deterministic CFSM assumption)
  const transition = transitions[0];
  const action = transition.action;

  // TODO: If action is null (epsilon), should advance state and continue loop
  // Currently falls through to executeAction

  const result = await this.executeAction(role, action, execState);
  return result; // ← Stops after ONE transition
}
```

**Target Semantics** (executor.ts:136-195):
```typescript
async step(): Promise<ExecutionResult> {
  while (true) {
    // Check terminal state
    if (this.currentCFSM.terminalStates.includes(this.currentState)) {
      this.completed = true;
      return { success: true };
    }

    const transitions = this.currentCFSM.transitions.filter(
      t => t.from === this.currentState
    );

    if (transitions.length === 0) {
      return { success: false, error: 'No transition available' };
    }

    const transition = transitions[0];
    const action = transition.action;

    // Epsilon transition - auto-advance and continue loop
    if (!action || action.type === 'tau') {
      this.transitionTo(transition.to);
      continue; // ← Keep looping
    }

    // Execute action and stop
    const result = await this.executeAction(action);
    if (result.success) {
      this.transitionTo(transition.to);
    }
    return result;
  }
}
```

**Implementation Steps**:

1. **Add epsilon loop to DMstExecutor.step()**:
   - Wrap existing logic in `while(true)` loop
   - Check for epsilon transitions (`action === null` or `action.type === 'tau'`)
   - If epsilon: advance state, continue loop
   - If action: execute and return
   - If terminal: mark completed and return

2. **Handle infinite loop prevention**:
   - Track visited states in loop
   - If revisit same state with same epsilon: error (malformed CFSM)

**Why This Matters**:
- CFSMs have structural states (branch, merge, fork, join) with epsilon transitions
- Without auto-advance, execution stops at every structural state
- User would need to call `step()` multiple times to get through structure
- Violates abstraction: structural states should be transparent

**Example**:
```
State flow with auto-advance:
S0 --[send(A)]-> S1 --[tau]-> S2 --[tau]-> S3 --[receive(B)]-> S4

step() → Executes send(A), auto-advances S1→S2→S3, stops at receive(B)
User sees: S0 --[send(A)]-> S3 --[receive(B)]-> S4
```

**Acceptance Criteria**:
- ✅ Epsilon transitions are transparent
- ✅ Execution stops only at actions or terminals
- ✅ Structural states (branch, merge, fork, join) traversed automatically
- ✅ No infinite loops on malformed CFSMs (test with cycle detection)

---

## Documentation References

### Internal Documentation

**Created in this session**:
- `docs/dmst/FORMAL_CORRECTNESS_REVIEW.md` - Verification against ECOOP 2023
- `docs/dmst/SIMULATOR_PARITY_PLAN.md` - Architecture analysis, feature matrix, roadmap
- `docs/dmst/GITHUB_ISSUES.md` - 9 trackable issues for simulator work

**Existing DMst docs**:
- `docs/dmst/GRAMMAR.md` - DMst syntax extensions
- `examples/dmst/` - 10 validation protocols (all passing)

### External References

**DMst Paper** (ECOOP 2023):
- Castro-Perez, D., & Yoshida, N. (2023). "Dynamically Updatable Multiparty Session Protocols"
- Focus on: Section 3 (Operational Semantics), Section 4 (Type System)

**Classic MPST Foundations**:
- Honda, K., Yoshida, N., & Carbone, M. (2008). "Multiparty Asynchronous Session Types"
  - DOI: 10.1145/1328438.1328472
  - Focus on: Fair scheduling semantics (one step = one transition)

**Protocol Composition** (Pabble):
- Hu, R., Yoshida, N., & Honda, K. (2015). "Session-Based Distributed Programming in Java"
  - DOI: 10.1007/978-3-662-46669-8_4
  - Focus on: Sub-protocol call stack semantics

### Code References

**Reference implementations** (do NOT modify):
- `src/core/runtime/executor.ts` - Classic MPST executor
  - Lines 136-195: Epsilon auto-advance loop
  - Lines 403-460: Sub-protocol call stack
- `src/core/runtime/simulator.ts` - Classic MPST simulator
  - Lines 145-169: Fair scheduling (round-robin)
  - Lines 350-402: Observer pattern

**Files to modify**:
- `src/core/runtime/dmst-executor.ts` (NEW) - DMst executor class
- `src/core/runtime/dmst-simulator.ts` (REFACTOR) - Orchestration only
- `src/core/projection/types.ts` (EXTEND) - Add CreateAction, InviteAction

**Files to create**:
- `tests/integration/dmst-subprotocol-calls.test.ts` (NEW) - Sub-protocol call tests

---

## Success Criteria

### Phase Completion (Sprint 1)

✅ **Must have**:
- All 76/76 DMst validation tests still passing
- Sub-protocol calls execute correctly (protocol-call.smpst, sequential-calls.smpst)
- Fair scheduling implemented (one role per step)
- Epsilon auto-advance working (structural states transparent)
- DMstExecutor class functional
- No regressions in classic simulator

⚠️ **Nice to have** (defer to Sprint 2 if time-constrained):
- Observer pattern for DMst events
- Trace recording
- Pause/resume

### Verification Steps

After completing Sprint 1, run these checks:

1. **All tests pass**:
   ```bash
   npm test -- dmst-examples-validation.test.ts
   # Expected: 76/76 passing

   npm test -- dmst-subprotocol-calls.test.ts
   # Expected: New tests passing
   ```

2. **No regressions**:
   ```bash
   npm test -- tests/integration/
   # Expected: All existing tests still passing
   ```

3. **Architecture verified**:
   ```bash
   # DMstExecutor should extend Executor
   grep -A 5 "class DMstExecutor" src/core/runtime/dmst-executor.ts

   # DMstSimulator should delegate to executors
   grep -A 10 "this.executors.get" src/core/runtime/dmst-simulator.ts
   ```

4. **Fair scheduling verified**:
   ```typescript
   // Test: Step count = transition count
   const simulator = new DMstSimulator(/* ... */);
   let steps = 0;
   while (!simulator.getState().completed) {
     await simulator.step();
     steps++;
   }
   // steps should equal total transitions executed (not roles * transitions)
   ```

---

## Common Pitfalls & Tips

### Pitfall 1: Breaking Existing Tests

**Problem**: Refactoring can break existing verification logic.

**Solution**:
- Run tests after EVERY commit
- Keep classic simulator unchanged
- DMst changes should be additive (extend, don't replace)

### Pitfall 2: Epsilon Infinite Loops

**Problem**: Malformed CFSMs with epsilon cycles cause infinite loops.

**Solution**:
```typescript
const visitedStates = new Set<string>();
while (true) {
  if (visitedStates.has(this.currentState)) {
    throw new Error('Epsilon cycle detected');
  }
  visitedStates.add(this.currentState);

  // ... epsilon advance logic
}
```

### Pitfall 3: Call Stack State Leakage

**Problem**: Call stack not properly restored on pop, causing state corruption.

**Solution**:
```typescript
// Always capture BOTH CFSM and state on push
this.callStack.push({
  parentCFSM: this.currentCFSM,
  returnState: this.currentState, // ← Don't forget current state!
});

// Always restore BOTH on pop
const frame = this.callStack.pop();
this.currentCFSM = frame.parentCFSM;
this.currentState = frame.returnState;
```

### Pitfall 4: Dynamic Role Scheduling

**Problem**: Round-robin index becomes invalid when dynamic roles added mid-execution.

**Solution**:
```typescript
// Always rebuild roleNames array when participants added
private addDynamicParticipant(role: string): void {
  this.state.dynamicParticipants.participants.set(role, /* ... */);

  // Rebuild sorted role list
  this.roleNames = [
    ...this.cfsms.keys(),
    ...this.state.dynamicParticipants.participants.keys(),
  ].sort();

  // Don't reset nextRoleIndex - maintain fairness
}
```

---

## Development Workflow

### Day 1-2: DMstExecutor Refactor

1. Create `src/core/runtime/dmst-executor.ts`
2. Extend Executor, add DMst action types
3. Move `stepRole()` logic from DMstSimulator
4. Run tests: `npm test -- dmst-examples-validation.test.ts`
5. Commit: `feat(dmst): Create DMstExecutor class extending Executor`

### Day 3: Sub-Protocol Call Stack

1. Port call stack from `executor.ts:403-460`
2. Add `executeSubProtocol()` to DMstExecutor
3. Create test: `tests/integration/dmst-subprotocol-calls.test.ts`
4. Run tests: `npm test -- dmst-subprotocol-calls.test.ts`
5. Commit: `feat(dmst): Implement sub-protocol call stack`

### Day 4: Fair Scheduling

1. Add `nextRoleIndex` to DMstSimulator
2. Update `step()` with round-robin logic
3. Handle dynamic role addition
4. Run tests: `npm test`
5. Commit: `feat(dmst): Implement fair scheduling (round-robin)`

### Day 5: Epsilon Auto-Advance

1. Add `while(true)` loop to DMstExecutor.step()
2. Detect epsilon transitions, auto-advance
3. Add cycle detection for safety
4. Run tests: `npm test`
5. Commit: `feat(dmst): Implement epsilon auto-advance`

### Day 6-7: Integration & Testing

1. Run full test suite: `npm test`
2. Fix any regressions
3. Update documentation (add examples to GITHUB_ISSUES.md)
4. Commit: `docs(dmst): Update Sprint 1 completion status`
5. Create PR for review

---

## Next Steps After Sprint 1

Once Sprint 1 is complete and all tests pass:

**Sprint 2** (3-4 days): Observability
- Issue #5: Observer pattern
- Issue #6: Trace recording
- Issue #7: Pause/resume
- Issue #9: Comprehensive DMst simulator tests

**Sprint 3** (1-2 weeks): Updatable CFSM Runtime
- Issue #8: Design versioned CFSM semantics
- Implement `continue X with { ... }` execution
- Add rollback support
- Enable runtime protocol evolution

---

## Questions?

If you encounter issues during Sprint 1:

1. **Check the docs**:
   - `docs/dmst/SIMULATOR_PARITY_PLAN.md` - Detailed analysis
   - `docs/dmst/GITHUB_ISSUES.md` - Issue templates with acceptance criteria

2. **Reference implementations**:
   - Classic Executor: `src/core/runtime/executor.ts`
   - Classic Simulator: `src/core/runtime/simulator.ts`

3. **Test-driven development**:
   - All 76/76 DMst tests must keep passing
   - Add new tests for sub-protocol calls
   - Use `examples/dmst/` protocols for integration testing

**Ready to begin Sprint 1!** 🚀
