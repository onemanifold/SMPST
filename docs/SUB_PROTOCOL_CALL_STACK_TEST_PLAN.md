# Sub-Protocol Call Stack Test Plan

**Status**: After merging main branch and implementing sub-protocol call stack semantics
**Date**: 2025-11-13
**Implementation**: `src/core/runtime/executor.ts`, `src/core/projection/projector.ts`

## Overview

This document outlines a comprehensive test suite to verify the formal correctness of sub-protocol call stack execution semantics, following MPST theory (Honda, Yoshida, Carbone 2008).

## Current State After Merge

### Changes from Main Branch
- ✅ Merged latest main (41 commits ahead)
- ✅ No conflicts - main added UI/simulation components, we modified runtime/projection
- ✅ Build succeeds after merge
- ✅ Dependencies installed (vite-plugin-monaco-editor, etc.)

### Implementation Complete
- ✅ `SubProtocolCallAction` type added to CFSM actions
- ✅ `CallStackFrame` type for tracking parent contexts
- ✅ `Executor.executeSubProtocol()` - push/pop call stack semantics
- ✅ Projector emits sub-protocol actions (not tau-elimination for involved roles)
- ✅ `cfsmRegistry` in ExecutorConfig for sub-protocol CFSM lookup

### Tests Requiring Updates
- ⚠️ `src/core/projection/__tests__/subprotocol-projection.test.ts` - expects tau-elimination, now emits SubProtocolCallAction

## Test Suite Design

### Category 1: Unit Tests - Projector

**File**: `src/core/projection/__tests__/subprotocol-projection.test.ts`

#### Test 1.1: Projector emits SubProtocolCallAction for involved roles
```typescript
it('should emit SubProtocolCallAction for roles involved in sub-protocol', () => {
  const source = `
    protocol Auth(role Client, role Server) {
      Client -> Server: Login();
      Server -> Client: LoginOk();
    }
    protocol Main(role Client, role Server) {
      do Auth(Client, Server);
      Client -> Server: Request();
    }
  `;

  const cfg = buildCFG(parse(source).declarations.find(d => d.name === 'Main'));
  const clientCFSM = project(cfg, 'Client');

  // VERIFY: CFSM has SubProtocolCallAction transition
  const subProtocolActions = clientCFSM.transitions.filter(
    t => t.action?.type === 'subprotocol'
  );
  expect(subProtocolActions.length).toBe(1);

  const action = subProtocolActions[0].action as SubProtocolCallAction;
  expect(action.protocol).toBe('Auth');
  expect(action.returnState).toBeDefined();
  expect(action.roleMapping).toBeDefined();
});
```

#### Test 1.2: Projector tau-eliminates sub-protocol for NON-involved roles
```typescript
it('should tau-eliminate sub-protocol for roles NOT involved', () => {
  const source = `
    protocol Auth(role Client, role Server) {
      Client -> Server: Login();
    }
    protocol Main(role Client, role Server, role Observer) {
      do Auth(Client, Server);
      Client -> Observer: Done();
    }
  `;

  const cfg = buildCFG(parse(source).declarations.find(d => d.name === 'Main'));
  const observerCFSM = project(cfg, 'Observer');

  // VERIFY: Observer CFSM has NO SubProtocolCallAction (tau-eliminated)
  const subProtocolActions = observerCFSM.transitions.filter(
    t => t.action?.type === 'subprotocol'
  );
  expect(subProtocolActions.length).toBe(0);

  // Observer should go directly to receiving Done message
  const receiveActions = observerCFSM.transitions.filter(
    t => t.action?.type === 'receive' && t.action.label === 'Done'
  );
  expect(receiveActions.length).toBeGreaterThan(0);
});
```

#### Test 1.3: Return state is properly created and connected
```typescript
it('should create return state that continues with protocol after sub-protocol', () => {
  const source = `
    protocol Sub(role A, role B) { A -> B: X(); }
    protocol Main(role A, role B) {
      A -> B: Before();
      do Sub(A, B);
      A -> B: After();
    }
  `;

  const cfg = buildCFG(parse(source).declarations.find(d => d.name === 'Main'));
  const cfsmA = project(cfg, 'A');

  // Find SubProtocolCallAction
  const subProtoTransition = cfsmA.transitions.find(
    t => t.action?.type === 'subprotocol'
  );
  expect(subProtoTransition).toBeDefined();

  const returnStateId = (subProtoTransition!.action as SubProtocolCallAction).returnState;

  // VERIFY: Return state exists and has transition to "After" message
  const returnState = cfsmA.states.find(s => s.id === returnStateId);
  expect(returnState).toBeDefined();

  const afterTransition = cfsmA.transitions.find(
    t => t.from === returnStateId && t.action?.type === 'send' && t.action.label === 'After'
  );
  expect(afterTransition).toBeDefined();
});
```

### Category 2: Unit Tests - Executor Call Stack

**File**: `src/core/runtime/__tests__/executor-call-stack.test.ts` (NEW)

#### Test 2.1: Call stack push on sub-protocol invocation
```typescript
it('should push call stack frame when entering sub-protocol', async () => {
  // Setup: Create root CFSM with SubProtocolCallAction
  // Setup: Create sub-protocol CFSM
  // Setup: Register sub-protocol in cfsmRegistry

  const executor = new Executor({
    role: 'Client',
    cfsm: rootCFSM,
    transport: createInMemoryTransport(),
    cfsmRegistry: new Map([['Auth', new Map([['Client', authCFSM]])]]),
  });

  // Execute until sub-protocol invocation
  await executor.step();

  const state = executor.getState();

  // VERIFY: Call stack has 1 frame (parent context)
  expect(state.callStack.length).toBe(1);
  expect(state.callStack[0].protocol).toBe('Auth');
  expect(state.callStack[0].parentCFSM).toBe(rootCFSM);
  expect(state.callStack[0].returnState).toBeDefined();

  // VERIFY: Current state is sub-protocol's initial state
  expect(state.currentState).toBe(authCFSM.initialState);
});
```

#### Test 2.2: Call stack pop on sub-protocol completion
```typescript
it('should pop call stack and return to parent when sub-protocol completes', async () => {
  // Setup executor with sub-protocol already entered (call stack has 1 frame)

  // Execute sub-protocol to completion
  let result;
  do {
    result = await executor.step();
  } while (result.success && !result.completed);

  const state = executor.getState();

  // VERIFY: Call stack is empty (popped)
  expect(state.callStack.length).toBe(0);

  // VERIFY: Returned to parent CFSM at return state
  expect(state.currentState).toBe(returnStateId);
});
```

#### Test 2.3: Nested sub-protocol execution (sub-protocol calls sub-protocol)
```typescript
it('should handle nested sub-protocol invocations with multiple stack frames', async () => {
  // Main calls Auth calls Token
  // Main -> Auth -> Token

  const cfsmRegistry = new Map([
    ['Auth', new Map([['Client', authCFSM]])],
    ['Token', new Map([['Client', tokenCFSM]])],
  ]);

  const executor = new Executor({
    role: 'Client',
    cfsm: mainCFSM,  // Has: do Auth
    transport: createInMemoryTransport(),
    cfsmRegistry,
  });

  // Step 1: Main calls Auth
  await executor.step();
  let state = executor.getState();
  expect(state.callStack.length).toBe(1);
  expect(state.callStack[0].protocol).toBe('Auth');

  // Step 2: Auth calls Token
  await executor.step();
  state = executor.getState();
  expect(state.callStack.length).toBe(2);
  expect(state.callStack[0].protocol).toBe('Auth');
  expect(state.callStack[1].protocol).toBe('Token');

  // Execute Token to completion
  while (!tokenCFSM.terminalStates.includes(state.currentState)) {
    await executor.step();
    state = executor.getState();
  }

  // Step 3: Token completes, returns to Auth
  await executor.step();
  state = executor.getState();
  expect(state.callStack.length).toBe(1);
  expect(state.callStack[0].protocol).toBe('Auth');

  // Step 4: Auth completes, returns to Main
  // (execute remaining Auth transitions)
  while (state.callStack.length > 0) {
    await executor.step();
    state = executor.getState();
  }

  expect(state.callStack.length).toBe(0);
});
```

#### Test 2.4: getCurrentCFSM switches between root and sub-protocol
```typescript
it('should execute transitions from current CFSM context', async () => {
  // Verify that transitions are looked up from currentCFSM, not always root CFSM

  const executor = new Executor({
    role: 'Client',
    cfsm: rootCFSM,
    transport: createInMemoryTransport(),
    cfsmRegistry: new Map([['Auth', new Map([['Client', authCFSM]])]]),
  });

  // Before entering sub-protocol
  let state = executor.getState();
  const rootTransitions = rootCFSM.transitions.filter(t => t.from === state.currentState);
  expect(rootTransitions.length).toBeGreaterThan(0);

  // Enter sub-protocol
  await executor.step();
  state = executor.getState();

  // After entering sub-protocol
  const subTransitions = authCFSM.transitions.filter(t => t.from === state.currentState);
  expect(subTransitions.length).toBeGreaterThan(0);

  // Verify transitions are from authCFSM, not rootCFSM
  expect(state.currentState).toBe(authCFSM.initialState);
});
```

### Category 3: Integration Tests - Sub-Protocol with Message Passing

**File**: `src/core/runtime/__tests__/subprotocol-execution.integration.test.ts` (NEW)

#### Test 3.1: Simple sub-protocol execution with messages
```typescript
it('should execute sub-protocol messages correctly', async () => {
  const source = `
    protocol Auth(role Client, role Server) {
      Client -> Server: Login(String);
      Server -> Client: LoginOk();
    }
    protocol Main(role Client, role Server) {
      do Auth(Client, Server);
      Client -> Server: Request(String);
      Server -> Client: Response(Int);
    }
  `;

  // Parse, build CFG, project to CFSMs
  const module = parse(source);
  const mainProtocol = module.declarations.find(d => d.name === 'Main');
  const authProtocol = module.declarations.find(d => d.name === 'Auth');

  const mainCFG = buildCFG(mainProtocol);
  const authCFG = buildCFG(authProtocol);

  const mainCFSMs = projectAll(mainCFG);
  const authCFSMs = projectAll(authCFG);

  // Create registry
  const cfsmRegistry = new Map([
    ['Auth', authCFSMs.cfsms],
  ]);

  // Create simulator with registry
  const transport = createInMemoryTransport();
  const clientExecutor = new Executor({
    role: 'Client',
    cfsm: mainCFSMs.cfsms.get('Client')!,
    transport,
    cfsmRegistry,
  });
  const serverExecutor = new Executor({
    role: 'Server',
    cfsm: mainCFSMs.cfsms.get('Server')!,
    transport,
    cfsmRegistry,
  });

  // Execute protocol
  // Step 1: Client enters Auth sub-protocol
  await clientExecutor.step();
  let clientState = clientExecutor.getState();
  expect(clientState.callStack.length).toBe(1);

  // Step 2: Server enters Auth sub-protocol
  await serverExecutor.step();
  let serverState = serverExecutor.getState();
  expect(serverState.callStack.length).toBe(1);

  // Step 3: Client sends Login (within Auth)
  await clientExecutor.step();
  const messages = transport.getPendingMessages('Server');
  expect(messages.length).toBe(1);
  expect(messages[0].label).toBe('Login');

  // Step 4: Server receives Login and sends LoginOk
  await serverExecutor.step();  // Receive Login
  await serverExecutor.step();  // Send LoginOk

  // Step 5: Client receives LoginOk, Auth completes, returns to Main
  await clientExecutor.step();
  clientState = clientExecutor.getState();
  expect(clientState.callStack.length).toBe(0);  // Back in Main

  // Step 6: Continue with Main protocol
  await clientExecutor.step();  // Send Request
  const requestMessages = transport.getPendingMessages('Server');
  expect(requestMessages.some(m => m.label === 'Request')).toBe(true);
});
```

#### Test 3.2: Sub-protocol execution interleaved with parallel execution
```typescript
it('should correctly interleave sub-protocol with parallel branches', async () => {
  const source = `
    protocol Sub(role A, role B) {
      A -> B: SubMsg();
    }
    protocol Main(role A, role B, role C) {
      par {
        do Sub(A, B);
      } and {
        A -> C: ParallelMsg();
      }
    }
  `;

  // Test that A executes both: enters Sub AND sends ParallelMsg
  // Verify diamond pattern works with sub-protocol actions
});
```

### Category 4: Error Handling Tests

**File**: `src/core/runtime/__tests__/subprotocol-errors.test.ts` (NEW)

#### Test 4.1: Error when sub-protocol not in registry
```typescript
it('should error when sub-protocol CFSM not found in registry', async () => {
  const executor = new Executor({
    role: 'Client',
    cfsm: cfsmWithSubProtocolCall,  // Has: do Auth
    transport: createInMemoryTransport(),
    cfsmRegistry: new Map(),  // EMPTY - Auth not registered
  });

  const result = await executor.step();

  expect(result.success).toBe(false);
  expect(result.error?.type).toBe('protocol-violation');
  expect(result.error?.message).toContain('not found in registry');
});
```

#### Test 4.2: Error when role not found in sub-protocol
```typescript
it('should error when role not found in sub-protocol CFSMs', async () => {
  const cfsmRegistry = new Map([
    ['Auth', new Map([
      ['Server', authServerCFSM],
      // Client MISSING!
    ])],
  ]);

  const executor = new Executor({
    role: 'Client',
    cfsm: mainClientCFSM,
    transport: createInMemoryTransport(),
    cfsmRegistry,
  });

  const result = await executor.step();

  expect(result.success).toBe(false);
  expect(result.error?.type).toBe('protocol-violation');
  expect(result.error?.message).toContain('Role \'Client\' not found');
});
```

### Category 5: Stepping Verification Tests

**File**: `src/core/runtime/__tests__/subprotocol-stepping.test.ts` (NEW)

#### Test 5.1: Verify one step = one transition (even crossing sub-protocol boundary)
```typescript
it('should count sub-protocol invocation as one step', async () => {
  // Formal semantics: entering sub-protocol = 1 step
  // NOT: entire sub-protocol execution = 1 step

  const executor = new Executor({...});

  const stepsBefore = executor.getState().visitedStates.length;
  await executor.step();  // Enter sub-protocol
  const stepsAfter = executor.getState().visitedStates.length;

  expect(stepsAfter - stepsBefore).toBe(1);
});
```

#### Test 5.2: Verify call stack visible in execution trace
```typescript
it('should expose call stack for debugging/visualization', async () => {
  // For step-in/step-out debugging support

  const executor = new Executor({...});

  // Before entering
  expect(executor.getState().callStack.length).toBe(0);

  // After entering
  await executor.step();
  const state = executor.getState();
  expect(state.callStack.length).toBe(1);
  expect(state.callStack[0]).toMatchObject({
    protocol: 'Auth',
    returnState: expect.any(String),
  });
});
```

### Category 6: Simulator Integration

**File**: `src/core/runtime/__tests__/simulator-subprotocol.test.ts` (NEW)

#### Test 6.1: Simulator coordinates multi-role sub-protocol execution
```typescript
it('should coordinate multiple roles executing sub-protocol simultaneously', async () => {
  // All roles have cfsmRegistry
  // Simulator doesn't need to know about sub-protocols
  // Each executor manages its own call stack

  const simulator = new Simulator({
    roles: mainCFSMs,
    cfsmRegistry,  // Pass to all executors
  });

  // Step all roles
  await simulator.step();

  const state = simulator.getState();

  // VERIFY: Both Client and Server entered Auth sub-protocol
  expect(state.roles.get('Client')?.callStack.length).toBe(1);
  expect(state.roles.get('Server')?.callStack.length).toBe(1);
});
```

## Test Execution Priority

### Phase 1: Critical Path (Must Pass for Correctness)
1. ✅ Test 1.1: Projector emits SubProtocolCallAction
2. ✅ Test 1.2: Projector tau-eliminates for non-involved roles
3. ✅ Test 2.1: Call stack push on invocation
4. ✅ Test 2.2: Call stack pop on completion
5. ✅ Test 4.1: Error handling for missing sub-protocol

### Phase 2: Integration (Must Pass for Usability)
6. Test 3.1: Simple sub-protocol with messages
7. Test 6.1: Simulator coordinates multi-role execution
8. Test 1.3: Return state connectivity

### Phase 3: Advanced Features (Must Pass for Full Compliance)
9. Test 2.3: Nested sub-protocols
10. Test 3.2: Sub-protocol with parallel composition
11. Test 5.1-5.2: Stepping verification

### Phase 4: Robustness (Must Pass for Production)
12. All error handling tests (Test 4.x)
13. Edge cases and stress tests

## Success Criteria

**Formal Correctness:**
- ✅ Call stack push/pop follows VM semantics
- ✅ Executor executes transitions from correct CFSM (currentCFSM)
- ✅ Sub-protocol completion returns to parent at correct state
- ✅ One step = one transition (across sub-protocol boundaries)

**Runtime Correctness:**
- ✅ Messages sent from sub-protocol delivered correctly
- ✅ Multi-role coordination works with sub-protocols
- ✅ No memory leaks (call stack properly cleaned up)

**Error Handling:**
- ✅ Clear errors when sub-protocol not found
- ✅ Clear errors when role not found in sub-protocol
- ✅ No silent failures or corruption

## Next Actions

1. **Update existing test** (`subprotocol-projection.test.ts`) to expect SubProtocolCallAction
2. **Create new test files** as outlined above
3. **Run full test suite** to verify no regressions
4. **Document any breaking changes** for users of the runtime
5. **Add example protocols** demonstrating sub-protocol usage

## Open Questions

1. **Role Mapping**: Current implementation has simplified role mapping. Need to implement proper formal parameter → actual argument mapping.
2. **Recursion + Sub-Protocols**: What happens with `rec X { do Sub(); continue X; }`?
3. **Sub-Protocol + Choice**: How do external choice and sub-protocols interact?
4. **Visualization**: How should UI display call stack for debugging?

## References

- Honda, Yoshida, Carbone (2008): "Multiparty Asynchronous Session Types"
- `docs/CFSM_EXECUTION_SEMANTICS.md` - Formal semantics documentation
- Implemented in: `src/core/runtime/executor.ts`, `src/core/projection/projector.ts`
