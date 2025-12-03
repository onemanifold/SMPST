# Correct Bisimulation Architecture

**Date:** 2025-12-03
**Based on:** User clarifications on actual requirements

---

## The Correct Flow

### Message Receive with CFG Validation

```
1. A sends message to B
   ↓
2. Message arrives in B's channel queue
   ↓
3. **Mediated Channel intercepts** (BEFORE B processes)
   ↓
4. Emits 'ready' event to B's Debugger: "B has incoming message"
   ↓
5. B's Debugger **pauses** (does not call executor yet)
   ↓
6. CFG Simulator validates: "Is B receiving from A valid now?"
   ↓
   If YES:
7. Coordinator signals B's Debugger: "proceed"
   ↓
8. B's Debugger calls B's Executor
   ↓
9. B's Executor: channel.receive() → atomic processing
   ↓
10. Both CFG and CFSM updated, states match
```

### Key Insight

**hasMessage() is NOT needed** because:
- Mediated channel intercepts incoming messages
- Triggers 'ready' event on debugger
- Debugger pauses, waiting for CFG validation
- CFG determines if receive should happen
- No polling needed - event-driven coordination

---

## Required Implementation Changes

### 1. Mediated Channel Interception on Receive

**Current (WRONG):**
```typescript
class MediatedChannel implements ChannelEnd {
  async receive(): Promise<Message> {
    return this.actualChannel.receive();  // Just delegates, no interception!
  }
}
```

**Correct:**
```typescript
class MediatedChannel implements ChannelEnd {
  constructor(
    private actualChannel: ChannelEnd,
    private onMessageAvailable: (msg: Message) => Promise<void>  // NEW
  ) {}

  async receive(): Promise<Message> {
    // Wait for message to arrive in queue
    const msg = await this.actualChannel.peekNext(); // Non-consuming peek

    // Emit 'ready' event to debugger (PAUSE POINT)
    await this.onMessageAvailable(msg);

    // After validation, actually consume message
    return this.actualChannel.receive();
  }
}
```

### 2. Channel with Peek Support

**Need to add:**
```typescript
export interface ChannelEnd {
  send(message: Message): Promise<void>;
  receive(): Promise<Message>;
  peekNext(): Promise<Message>;  // NEW: non-consuming look at next message
  hasMessage(): boolean;  // Can be removed if peek exists
}
```

### 3. Debugger Pause Mechanism

**Debugger wraps executor step:**
```typescript
class CFSMDebugger {
  private paused: boolean = true;  // Start paused in bisimulation mode
  private resumeResolve: (() => void) | null = null;

  async stepForward(): Promise<void> {
    // If paused, wait for resume signal
    if (this.paused) {
      await new Promise<void>(resolve => {
        this.resumeResolve = resolve;
      });
    }

    // Now actually step executor
    await this.executor.step();
    this.currentStepNumber++;
    this.recordSnapshot();
  }

  resume(): void {
    this.paused = false;
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }
}
```

### 4. Bisimulation Coordinator

**Coordinates CFG and CFSM stepping:**
```typescript
class BisimulationCoordinator {
  async step(): Promise<void> {
    // 1. CFG determines next action
    const cfgAction = this.cfgSimulator.peekNextAction();
    // Example: { type: 'message', from: 'A', to: 'B', label: 'hello' }

    // 2. Signal appropriate CFSM to execute
    if (cfgAction.type === 'message') {
      // a) Signal sender to send
      await this.getDebugger(cfgAction.from).resume();
      // Sender executes, message goes to receiver's queue

      // b) Mediated channel intercepts, emits 'ready' on receiver's debugger
      //    (receiver is paused, waiting)

      // c) Validate with CFG: "Should B receive from A now?"
      if (this.cfgSimulator.validate(cfgAction)) {
        // d) Signal receiver to proceed
        await this.getDebugger(cfgAction.to).resume();
      }
    }

    // 3. Step CFG simulator
    this.cfgSimulator.step();

    // 4. Verify traces match
    this.verifyBisimulation();
  }
}
```

---

## CFG's Role in Validation

The user explained:
> "CFG should be able to know which events are concurrent, and which ones must be strictly ordered. In an ideal implementation, the CFG should be able to tell the difference and allow the concurrent events to be locally 'disordered', and still validate the bisimulation as correct."

**This means:**

### Concurrent Events (Partial Order)
```
CFG says: A→B and C→D can happen in any order (concurrent)

Valid CFSM traces:
- A→B, then C→D  ✓
- C→D, then A→B  ✓
- Interleaved: A sends, C sends, B receives, D receives  ✓
```

### Strictly Ordered Events
```
CFG says: A→B must happen before B→C (causally dependent)

Valid CFSM traces:
- A→B, then B→C  ✓

Invalid CFSM traces:
- B→C, then A→B  ✗ (violates causality)
```

### Implementation

CFG simulator needs to track:
```typescript
interface CFGAction {
  type: 'message' | 'choice' | 'tau';
  from?: string;
  to?: string;
  label?: string;

  // NEW: Concurrency information
  dependencies: Set<CFGAction>;  // Must happen after these
  concurrentWith: Set<CFGAction>;  // Can happen in any order with these
}
```

Validation checks:
```typescript
validate(cfsmAction: CFSMAction): boolean {
  // Check causal dependencies
  for (const dep of cfsmAction.dependencies) {
    if (!dep.completed) {
      return false;  // Dependency not met
    }
  }

  // Concurrent actions can happen in any order
  return true;
}
```

---

## Removing hasMessage()

With this architecture, `hasMessage()` becomes obsolete:

**Old approach (polling):**
```typescript
if (channel.hasMessage()) {
  await step();  // Safe, won't block
}
```

**New approach (event-driven):**
```typescript
// No hasMessage() check needed!
// 1. Message arrives → mediated channel emits 'ready'
// 2. Debugger pauses
// 3. CFG validates
// 4. Debugger resumes → step proceeds
```

**hasMessage() can be deleted** once:
1. Mediated channel intercepts on receive
2. Debugger pause mechanism exists
3. CFG validation is wired up

---

## Implementation Steps

### Phase 1: Channel Interception
1. Add `peekNext()` to ChannelEnd interface
2. Implement peek in channel.ts
3. Update MediatedChannel to intercept on receive
4. Emit 'ready' event when message available

### Phase 2: Debugger Pause/Resume
1. Add pause/resume mechanism to CFSMDebugger
2. Start paused in bisimulation mode
3. Wait for resume signal before stepping

### Phase 3: Bisimulation Coordinator
1. Create BisimulationCoordinator class
2. Wire CFG→CFSM action mapping
3. Coordinate pause/resume signals
4. Validate with CFG before resuming

### Phase 4: CFG Concurrency Tracking
1. Add dependency/concurrency metadata to CFG
2. Implement validation logic
3. Allow concurrent events to be reordered

### Phase 5: Remove hasMessage()
1. Delete hasMessage() from ChannelEnd
2. Remove checks from getEnabledTransitions()
3. Update tests

---

## Questions for User

1. **peekNext() implementation:**
   - Should peek block until message arrives (like receive)?
   - Or return null if no message?
   - Or return Promise<Message | null>?

2. **Pause granularity:**
   - Pause at executor level or debugger level?
   - Can multiple CFSMs be paused simultaneously?

3. **CFG concurrency metadata:**
   - Is this already in CFG structure?
   - Or needs to be computed from protocol?

4. **Resume signals:**
   - Who calls resume()? BisimulationCoordinator?
   - Can resume happen before CFG validation?

---

## Next Steps

Once user confirms this understanding:
1. Implement Phase 1 (channel interception)
2. Test with simple protocol
3. Proceed with remaining phases
4. Remove hasMessage() last (after everything works)
