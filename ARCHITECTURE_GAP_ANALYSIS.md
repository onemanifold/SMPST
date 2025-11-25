# Architecture Gap Analysis: Current vs Concurrent Execution

## What simulation-v2.ts Implements

**File**: `src/lib/stores/simulation-v2.ts` (UI layer)

### Features:
1. ✅ **Contract Enforcement** - TypeScript-enforced error handling via `handleStepResult()`
2. ✅ **Backend Error Exposure** - `lastError` and `lastEvent` stores for UI
3. ✅ **Playback Controls** - idle/stepping/playing modes with auto-stepping
4. ✅ **Derived Stores** - Reactive UI state (canStep, isAtChoice, etc.)
5. ✅ **Choice Handling** - Manual choice selection with error recovery

### Architecture:
- **Layer**: UI store (Svelte)
- **Wraps**: CFGSimulator directly
- **Pattern**: Sequential stepping with contract-enforced error handling
- **NOT included**: Distributed execution, debugger separation, concurrent execution

---

## Current Architecture (Post Recent Changes)

### What We Have Now:

#### 1. **Async Channels** ✅
- **File**: `src/core/simulation/channel.ts`
- **Features**:
  - FIFO message queues
  - Async send (non-blocking)
  - Blocking receive (awaits on Promise)
  - `hasMessage()` for polling (added today)
- **Status**: ✅ Implemented correctly for MPST semantics

#### 2. **CFSMSimulator** ✅
- **File**: `src/core/simulation/cfsm-simulator.ts`
- **Features**:
  - Single role execution
  - Time-travel (snapshots, stepBackward)
  - Sub-protocol call stack
  - Event emitter (on/emit)
  - Channel-based message passing
- **Architecture**: Combines executor + debugger in one class
- **Status**: ✅ Feature complete BUT lacks separation

#### 3. **DistributedSimulator** ⚠️ SEQUENTIAL
- **File**: `src/core/simulation/distributed-simulator.ts`
- **Current Execution Model**:
  ```typescript
  async run() {
    while (!done) {
      const enabled = this.getEnabledRoles(); // POLLING
      const role = this.selectRole(enabled);  // PICK ONE
      await simulator.step();                 // SEQUENTIAL
      await setTimeout(0);                    // Yield
    }
  }
  ```
- **Issues**:
  - ❌ Sequential (one role at a time)
  - ❌ Polls with `getEnabledRoles()`
  - ❌ Uses `hasMessage()` to avoid blocking
  - ❌ Order is imposed, not emergent
- **Status**: ⚠️ Works but NOT concurrent

#### 4. **UI Stores** ✅
- **File**: `src/lib/stores/simulation.ts`
- **Features**:
  - Dual-execution (CFG + Distributed + Bisimulation modes)
  - Debugger layer separation (wraps simulators)
  - Contract enforcement
  - Single source of truth (no state mirrors)
- **Status**: ✅ Implemented well

---

## Target Architecture: Truly Concurrent Execution

### Your Vision:

#### 1. **Split CFSMSimulator → Executor + Debugger**

```typescript
// NEW: Pure execution engine
class CFSMExecutor {
  async run(): Promise<void> {
    while (!this.completed) {
      const transitions = this.getEnabledTransitions();
      const transition = this.selectTransition(transitions);

      if (transition.action.type === 'receive') {
        // Just await - blocks until message arrives
        const msg = await this.channel.receive();
        // Continue when message received
      }

      await this.executeTransition(transition);
    }
  }
}

// NEW: Wraps executor, adds time-travel
class CFSMDebugger {
  private executor: CFSMExecutor;
  private snapshots: Snapshot[] = [];

  async run(): Promise<void> {
    // Run executor and record snapshots
    this.executor.on('transition', snapshot => {
      this.snapshots.push(snapshot);
      this.emit('ready'); // Notify coordinator
    });

    await this.executor.run();
  }

  stepBack(): void {
    // Time-travel using snapshots
    this.restoreSnapshot(this.snapshots.pop());
  }
}
```

#### 2. **Concurrent DistributedSimulator**

```typescript
class DistributedSimulator {
  private debuggers: Map<string, CFSMDebugger>;

  constructor(cfsms: Map<string, CFSM>) {
    // Setup channels
    this.createChannels(cfsms);

    // Create debuggers (each wraps an executor)
    for (const [role, cfsm] of cfsms) {
      const executor = new CFSMExecutor(cfsm, channels);
      const debugger = new CFSMDebugger(executor);

      // Listen to debugger events (not poll!)
      debugger.on('ready', (transition) => {
        this.emit('transition-available', { role, transition });
      });

      debugger.on('choice-needed', (choices) => {
        this.emit('choice-needed', { role, choices });
      });

      this.debuggers.set(role, debugger);
    }
  }

  // CONCURRENT execution - all run in parallel
  async run(): Promise<void> {
    const promises = Array.from(this.debuggers.values())
      .map(debugger => debugger.run());

    // They coordinate via channels
    // Order emerges from protocol dependencies
    await Promise.all(promises);
  }

  // For testing/debugging: sequential stepping
  async step(): Promise<void> {
    // Wait for any debugger to signal 'ready'
    const role = await this.waitForReady();
    await this.debuggers.get(role).stepForward();
  }
}
```

#### 3. **Key Differences**

| Aspect | Current (Sequential) | Target (Concurrent) |
|--------|---------------------|---------------------|
| Execution | `while() { await step(); }` | `Promise.all(roles.map(r => r.run()))` |
| Coordination | Coordinator polls | Roles emit events |
| Ordering | Imposed by scheduler | Emerges from protocol |
| Blocking | Avoided with `hasMessage()` | Natural with `await receive()` |
| Deadlocks | Detected by polling | Surface naturally |
| Architecture | CFSMSimulator (combined) | Executor + Debugger (split) |

---

## Implementation Plan

### Phase 1: Split CFSMSimulator ✅ (Partially Done)

**Current State**: CFSMSimulator combines execution + debugging

**Tasks**:
- [ ] Extract `CFSMExecutor` class (pure execution, no history)
- [ ] Create `CFSMDebugger` class (wraps executor, adds snapshots)
- [ ] Make CFSMSimulator a compatibility wrapper (delegates to debugger)
- [ ] Update tests to work with both APIs

**Files to modify**:
- `src/core/simulation/cfsm-executor.ts` (NEW)
- `src/core/simulation/cfsm-debugger.ts` (NEW)
- `src/core/simulation/cfsm-simulator.ts` (wrapper)

### Phase 2: Event-Driven Coordination ❌ (Not Started)

**Current State**: DistributedSimulator polls with `getEnabledRoles()`

**Tasks**:
- [ ] CFSMDebugger emits 'ready' when transitions available
- [ ] CFSMDebugger emits 'choice-needed' when at choice point
- [ ] DistributedSimulator listens to events (not polls)
- [ ] Maintain ready queue for sequential stepping mode

**Files to modify**:
- `src/core/simulation/cfsm-debugger.ts` (add event emitters)
- `src/core/simulation/distributed-simulator.ts` (remove polling)

### Phase 3: Concurrent Execution ❌ (Not Started)

**Current State**: DistributedSimulator steps one role at a time

**Tasks**:
- [ ] Add `runConcurrent()` method using `Promise.all()`
- [ ] CFSMExecutor runs autonomously via `async run()`
- [ ] Channels coordinate naturally (no scheduler needed)
- [ ] Keep sequential `step()` for testing/debugging

**Files to modify**:
- `src/core/simulation/cfsm-executor.ts` (add run() method)
- `src/core/simulation/distributed-simulator.ts` (add runConcurrent())

### Phase 4: Remove `hasMessage()` Workaround ❌ (Not Started)

**Current State**: Added today to avoid blocking in sequential stepping

**Tasks**:
- [ ] In concurrent mode: remove `hasMessage()` checks
- [ ] CFSMExecutor just awaits `receive()` - blocks naturally
- [ ] In sequential mode: keep `hasMessage()` for enabling logic
- [ ] Make it mode-dependent

**Files to modify**:
- `src/core/simulation/channel.ts` (mark hasMessage() as optional)
- `src/core/simulation/cfsm-executor.ts` (don't use in concurrent mode)

### Phase 5: Update UI Stores ❌ (Not Started)

**Tasks**:
- [ ] Merge simulation-v2.ts improvements into simulation.ts
- [ ] Add concurrent execution mode to UI
- [ ] Expose event streams from debuggers
- [ ] Add visualization of concurrent execution

**Files to modify**:
- `src/lib/stores/simulation.ts`
- UI components (visualize concurrency)

---

## Backward Compatibility Strategy

### Keep Both Modes:

1. **Sequential Mode** (current):
   - Use `step()` for deterministic testing
   - Scheduler controls order
   - `hasMessage()` prevents blocking
   - Good for debugging

2. **Concurrent Mode** (new):
   - Use `runConcurrent()` for true distributed execution
   - Order emerges from protocol
   - Natural blocking on `receive()`
   - Surfaces deadlocks/liveness issues

### Migration Path:
1. Implement concurrent mode alongside sequential
2. Tests run both modes
3. UI can switch between modes
4. Eventually deprecate sequential (or keep for debugging)

---

## Critical Questions

1. **simulation-v2.ts purpose**: Is this just contract enforcement? Or was there concurrent architecture code lost?

2. **Priority**: Should we implement concurrent execution now? Or focus on other features?

3. **Testing**: How to test concurrent execution deterministically?

4. **UI**: How should UI visualize concurrent execution? (Multiple threads running in parallel)

---

## Summary

### What We Have:
- ✅ Async channels (MPST semantics)
- ✅ CFSMSimulator (execution + debugging combined)
- ⚠️ Sequential DistributedSimulator (works but not concurrent)
- ✅ UI stores with contract enforcement

### What We Need:
- ❌ Executor/Debugger separation
- ❌ Event-driven coordination
- ❌ Concurrent execution mode
- ❌ Natural blocking (remove hasMessage workaround)

### Effort Estimate:
- **Phase 1**: 4-6 hours (split executor/debugger)
- **Phase 2**: 2-3 hours (event-driven coordination)
- **Phase 3**: 3-4 hours (concurrent execution)
- **Phase 4**: 1-2 hours (cleanup hasMessage)
- **Phase 5**: 2-3 hours (UI updates)
- **Total**: ~15-20 hours for full implementation

### Next Step:
**User decision needed**: Should we proceed with implementing the concurrent architecture? Or is there missing work from simulation-v2.ts that we need to recover first?
