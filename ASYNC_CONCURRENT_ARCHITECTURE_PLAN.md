# Async Concurrent Execution Architecture Plan

**Date**: 2025-11-15
**Purpose**: Design proper async/concurrent execution for CFSM runtime
**Key Insight**: Each participant executes autonomously, coordinator observes

---

## Current vs Target Architecture

### Current (Synchronous Scheduled):
```
Coordinator (DistributedSimulator):
  loop:
    1. Pick which role to execute (round-robin/fair/random)
    2. Call simulator.step() synchronously
    3. Continue until all complete or deadlock

Problems:
- Coordinator orchestrates (not just observes)
- Synchronous execution (no true concurrency)
- receiveSync() hack to avoid async
```

### Target (Async Concurrent):
```
Coordinator (DistributedRuntime):
  1. Setup:
     - Create MessageTransport with delay config
     - Create CFSMSimulator for each role
     - Wire all to shared transport

  2. Execute:
     - Launch ALL roles concurrently (Promise.all)
     - Each role runs autonomously: while (!completed) { await step() }
     - Roles emit events (choice-needed, completed, error)

  3. Observe:
     - Listen to events from all roles
     - Detect deadlock (all blocked, no messages in-flight)
     - Aggregate traces
     - Present UI needs (choice selection)

Benefits:
- True concurrency (actor model)
- Async message passing with configurable delays
- Coordinator doesn't orchestrate
- Matches MPST formal semantics
```

---

## Participant (CFSM Simulator) Design

### Autonomous Execution Loop

Each participant runs independently:

```typescript
class CFSMSimulator {
  async runAutonomously(): Promise<void> {
    while (!this.completed && !this.reachedMaxSteps) {
      try {
        const result = await this.step();

        if (!result.success) {
          // Emit error event
          this.emit('error', result.error);

          if (result.error.type === 'message-not-ready') {
            // Blocked waiting for message - yield and retry
            await this.wait(10);  // Small delay before retry
            continue;
          }

          // Other errors: stop execution
          break;
        }
      } catch (err) {
        this.emit('fatal-error', err);
        break;
      }
    }

    this.emit('execution-complete', {
      role: this.rootCFSM.role,
      completed: this.completed,
      steps: this.stepCount
    });
  }
}
```

### Async step() Method

```typescript
async step(): Promise<CFSMStepResult> {
  this.emit('step-start', ...);

  // Check if completed
  if (this.completed) {
    return { success: false, error: {...}, state: this.getState() };
  }

  // Get enabled transitions
  const enabled = this.getEnabledTransitions();

  if (enabled.length === 0) {
    // Terminal state handling (with call stack pop)
    if (this.currentCFSM.terminalStates.includes(this.currentState)) {
      if (this.callStack.length > 0) {
        // Pop and return to parent
        const frame = this.callStack.pop()!;
        this.emit('step-out', {...});
        // ... restore parent context
        return { success: true, state: this.getState() };
      }

      // Root completed
      this.completed = true;
      this.emit('complete', {...});
      return { success: true, state: this.getState() };
    } else {
      // No transitions - blocked or deadlock
      return { success: false, error: { type: 'message-not-ready' }, state: this.getState() };
    }
  }

  // Select transition
  let transitionIndex = this.selectTransition(enabled);

  // If manual selection required, emit event and wait
  if (this.config.transitionStrategy === 'manual' && this.pendingTransitionChoice === null) {
    this.emit('choice-required', {
      role: this.rootCFSM.role,
      options: enabled
    });
    // Block until user selects
    return { success: false, error: { type: 'transition-required' }, state: this.getState() };
  }

  const transition = enabled[transitionIndex];

  // Fire transition (async!)
  const result = await this.fireTransition(transition);

  this.emit('step-end', {...});
  return result;
}
```

### Async Message Operations

```typescript
private async executeSend(transition: CFSMTransition): Promise<CFSMStepResult> {
  const action = transition.action;
  // ... create messages ...

  if (this.transport) {
    // Await send - applies configured delay
    for (const msg of messages) {
      await this.transport.send(msg);  // May delay 0-100ms
    }
  } else {
    // Legacy: outgoing queue
    this.outgoingMessages.push(...messages);
  }

  // ... emit events, update state ...
  return { success: true, ... };
}

private async executeReceive(transition: CFSMTransition): Promise<CFSMStepResult> {
  const action = transition.action;
  let msg: Message | undefined;

  if (this.transport) {
    // Await receive - truly async
    msg = await this.transport.receive(this.rootCFSM.role);

    if (!msg) {
      // No message available - NOT an error, just blocked
      return { success: false, error: { type: 'message-not-ready' }, ... };
    }
  } else {
    // Legacy: buffer
    const queue = this.buffer.channels.get(action.from);
    if (!queue || queue.length === 0) {
      return { success: false, error: { type: 'message-not-ready' }, ... };
    }
    msg = queue.shift()!;
  }

  // ... emit events, update state ...
  return { success: true, ... };
}
```

---

## Coordinator Design

### Two Modes of Operation

#### Mode 1: Scheduled Simulation (for testing/debugging)

Current DistributedSimulator - keep for deterministic testing:

```typescript
class DistributedSimulator {
  // Synchronous scheduled execution (for testing)
  async run(): Promise<DistributedRunResult> {
    while (!allComplete && !deadlocked) {
      const enabled = this.getEnabledRoles();

      if (enabled.length === 0) {
        // Check deadlock vs completion
        break;
      }

      const role = this.selectRole(enabled);  // Round-robin/fair/random
      const simulator = this.simulators.get(role)!;

      // Await async step
      const result = await simulator.step();

      this.globalSteps++;
    }

    return { success: !deadlocked, ... };
  }
}
```

**Use Case**: CFG bisimulation testing, deterministic replay, step-by-step debugging

#### Mode 2: Concurrent Runtime (for realistic execution)

New DistributedRuntime - for production/realistic simulation:

```typescript
class DistributedRuntime {
  private executors: Map<string, CFSMSimulator>;
  private transport: InMemoryTransport;
  private eventLog: Event[] = [];

  constructor(cfsms: Map<string, CFSM>, config: RuntimeConfig) {
    // Create transport with delay config
    this.transport = new InMemoryTransport({
      messageDelay: config.messageDelay,      // e.g., [10, 50] for 10-50ms random
      useMicrotaskDelay: config.microtask     // or just microtask for fast async
    });

    // Create simulators
    this.executors = new Map();
    for (const [role, cfsm] of cfsms) {
      const sim = new CFSMSimulator(cfsm, {
        transport: this.transport,
        cfsmRegistry: config.cfsmRegistry,
        transitionStrategy: config.choiceStrategy || 'first'
      });

      // Attach event listeners
      sim.on('choice-required', (event) => this.handleChoiceRequired(event));
      sim.on('error', (event) => this.handleError(event));
      sim.on('complete', (event) => this.handleComplete(event));
      sim.on('step-into', (event) => this.eventLog.push(event));
      sim.on('step-out', (event) => this.eventLog.push(event));

      this.executors.set(role, sim);
    }
  }

  /**
   * Run all roles concurrently (true distributed execution)
   */
  async runConcurrently(options?: ConcurrentOptions): Promise<RuntimeResult> {
    const startTime = Date.now();

    // Launch all roles in parallel
    const executionPromises = Array.from(this.executors.values()).map(executor =>
      this.runExecutor(executor, options)
    );

    // Wait for all to complete OR deadlock detection
    const result = await Promise.race([
      Promise.all(executionPromises),
      this.detectDeadlock()
    ]);

    return {
      success: !result.deadlocked,
      duration: Date.now() - startTime,
      traces: this.getTraces(),
      eventLog: this.eventLog
    };
  }

  /**
   * Run single executor autonomously
   */
  private async runExecutor(executor: CFSMSimulator, options?: ConcurrentOptions): Promise<void> {
    const maxSteps = options?.maxSteps || 10000;
    let steps = 0;

    while (!executor.isComplete() && steps < maxSteps) {
      const result = await executor.step();
      steps++;

      if (!result.success) {
        if (result.error?.type === 'message-not-ready') {
          // Blocked - wait and retry
          await this.delay(options?.retryDelay || 10);
          continue;
        }

        if (result.error?.type === 'transition-required') {
          // Manual choice needed - wait for external selection
          await this.delay(100);
          continue;
        }

        // Other error - stop this executor
        break;
      }
    }
  }

  /**
   * Detect global deadlock
   * All roles blocked AND no messages in-flight
   */
  private async detectDeadlock(): Promise<{ deadlocked: boolean }> {
    while (true) {
      await this.delay(100);  // Check every 100ms

      const allBlocked = Array.from(this.executors.values()).every(e =>
        e.isComplete() || e.isBlocked()
      );

      const anyNotCompleted = Array.from(this.executors.values()).some(e =>
        !e.isComplete()
      );

      const messagesInFlight = this.transport.getTotalPendingMessages();

      if (allBlocked && anyNotCompleted && messagesInFlight === 0) {
        return { deadlocked: true };
      }

      const allComplete = Array.from(this.executors.values()).every(e => e.isComplete());
      if (allComplete) {
        return { deadlocked: false };
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Use Case**: Performance testing, realistic network simulation, actor model runtime

---

## Event-Driven Coordination

### Events Emitted by Participants

```typescript
// Execution lifecycle
'step-start': { stepCount, currentState }
'step-end': { stepCount, result, state }
'complete': { role, steps }
'execution-complete': { role, completed, steps }

// Sub-protocol navigation
'step-into': { protocol, depth, roleMapping }
'step-out': { protocol, depth }

// User interaction needed
'choice-required': { role, options: CFSMTransition[] }
'transition-required': { role, message }

// Actions
'send': { messageId, to, label, payloadType }
'receive': { messageId, from, label, payloadType }
'tau': { stateId }
'choice': { branch, stateId }

// Errors
'error': { type, message, state, details }
'deadlock': { role, state }
'fatal-error': { error }
```

### Coordinator Event Handling

```typescript
class DistributedRuntime {
  private handleChoiceRequired(event: ChoiceRequiredEvent): void {
    // Pause execution for this role
    // Present options to UI
    // Wait for user selection via selectTransition()
    this.emit('ui-choice-needed', event);
  }

  private handleError(event: ErrorEvent): void {
    // Log error
    // Decide: continue or abort?
    if (event.type === 'message-not-ready') {
      // Normal blocking - executor will retry
      return;
    }

    // Fatal error - may need to abort
    this.emit('ui-error', event);
  }

  private handleComplete(event: CompleteEvent): void {
    // Role completed
    this.emit('ui-role-complete', event);
  }
}
```

---

## Testing Strategy

### Test 1: Synchronous (No Delay)
```typescript
const transport = new InMemoryTransport({});  // No delay
```
**Expected**: Immediate message delivery, deterministic ordering

### Test 2: Microtask Delay
```typescript
const transport = new InMemoryTransport({ useMicrotaskDelay: true });
```
**Expected**: Async execution via Promise.resolve(), no time delay, tests run fast

### Test 3: Fixed Delay
```typescript
const transport = new InMemoryTransport({ messageDelay: 50 });  // 50ms
```
**Expected**: Every message takes 50ms to deliver

### Test 4: Random Delay (Network Jitter)
```typescript
const transport = new InMemoryTransport({ messageDelay: [10, 100] });  // 10-100ms
```
**Expected**: Messages arrive in variable order due to varying delays

### Test 5: Concurrent vs Scheduled
```typescript
// Scheduled (deterministic)
const scheduledResult = await distributedSimulator.run();

// Concurrent (realistic)
const concurrentResult = await distributedRuntime.runConcurrently();

// Compare traces - should be bisimilar
expect(isBisimilar(scheduledResult.traces, concurrentResult.traces)).toBe(true);
```

---

## Implementation Phases

### Phase 1: Make CFSMSimulator Fully Async ✓ (in progress)
- [x] Add delay config to InMemoryTransport
- [ ] Make step() async
- [ ] Make fireTransition() async
- [ ] Make executeSend()/executeReceive() async
- [ ] Update all stepping methods (stepForward, stepInto, etc.)

### Phase 2: Update DistributedSimulator for Async
- [ ] Make step() async
- [ ] Make run() async
- [ ] Update all tests to await

### Phase 3: Create DistributedRuntime (Concurrent Mode)
- [ ] Create new DistributedRuntime class
- [ ] Implement runConcurrently()
- [ ] Implement runExecutor() (autonomous loop)
- [ ] Implement detectDeadlock()
- [ ] Add event listeners

### Phase 4: Testing
- [ ] Test with sync transport (no delay)
- [ ] Test with microtask delay
- [ ] Test with fixed delay
- [ ] Test with random delay
- [ ] Compare scheduled vs concurrent (bisimulation)

### Phase 5: UI Integration
- [ ] Wire events to UI (choice-required, etc.)
- [ ] Add controls for delay configuration
- [ ] Visualize concurrent execution (timeline)

---

## Key Design Decisions

### 1. Two Execution Modes

**Why**: Different use cases need different guarantees
- **Scheduled**: Deterministic, reproducible, bisimulation testing
- **Concurrent**: Realistic, performance testing, production runtime

### 2. Event-Driven Coordination

**Why**: Coordinator doesn't orchestrate, just observes
- Matches actor model
- Scales to distributed deployment (WebSocket, WebRTC)
- Clean separation of concerns

### 3. Configurable Delays

**Why**: Test at multiple levels of realism
- Sync: Unit testing
- Microtask: Integration testing (fast)
- Timed: Performance testing (realistic)

### 4. Blocked vs Error

**Why**: Waiting for message is normal, not an error
- `message-not-ready`: Normal blocking (retry)
- `deadlock`: All blocked, no messages (fatal)

### 5. isBlocked() Method Needed

Add to CFSMSimulator:
```typescript
isBlocked(): boolean {
  const enabled = this.getEnabledTransitions();
  return enabled.length === 0 && !this.isComplete();
}
```

---

## Summary

**Core Principle**: Each participant executes autonomously, coordinator observes.

**Async Benefits**:
- True concurrency (actor model)
- Realistic network simulation
- Proper async/await patterns
- No receiveSync() hack

**Two Modes**:
- DistributedSimulator: Scheduled, deterministic (keep for testing)
- DistributedRuntime: Concurrent, realistic (new for production)

**Next**: Implement Phase 1 - make CFSMSimulator fully async.

---

*This architecture follows MPST formal semantics where participants execute independently with async message passing.*
