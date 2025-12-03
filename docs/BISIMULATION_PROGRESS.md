# Bisimulation Implementation Progress

**Date:** 2025-12-03
**Branch:** `claude/document-simulator-architecture-01RvvQuxqzxTBgXY6FybhTYe`
**Commit:** e9b51e6

---

## Current Status: Phase 1 Complete ✅

### What's Implemented

**✅ Channel Incoming Message Interception**
- File: `src/core/simulation/channel.ts`
- Added `IncomingMessageHandler` type
- Added `ChannelOptions` with `onIncomingA` and `onIncomingB` handlers
- Modified `createChannel()` to accept optional handlers
- `receive()` now calls handler BEFORE returning message
- Provides pause point for CFG validation
- Backward compatible (handlers optional)
- **All 203 simulation tests pass**

### How It Works

```typescript
// Create channel with interception
const [endA, endB] = createChannel({
  onIncomingB: async (msg) => {
    // B is about to receive message
    // Emit 'incoming' event with message data
    // Pause until CFG validates
    // Then return to allow processing
  }
});

// When A sends to B:
await endA.send(message);  // Message goes to B's queue

// When B receives:
const msg = await endB.receive();
// 1. Message retrieved from queue
// 2. onIncomingB(msg) called → PAUSE POINT
// 3. After validation, message returned
// 4. B processes atomically
```

---

## Architecture Overview

### Always-On Bisimulation

**One simulation, always running both:**
1. **CFG Simulator** - Determines step order (global choreography view)
2. **CFSM Simulators** - Maintain actual state (distributed execution)
3. **Bisimulation Coordinator** - Coordinates CFG + CFSMs

### Step Flow

```
User clicks "Step" (or autoplay timer)
  ↓
CFG determines next action: "A→B: hello"
  ↓
Coordinator signals A to send
  ↓
A sends → message in B's queue
  ↓
B's receive() called
  ↓
Channel intercepts: onIncoming(msg)
  ↓
Emits 'incoming' event to B's debugger
  ↓
B's debugger PAUSES
  ↓
Coordinator + CFG validate: "Should B receive from A now?"
  ↓
If valid: Coordinator signals B to RESUME
  ↓
B's receive() returns message
  ↓
B processes atomically (dequeue + substitute + transition)
  ↓
Both CFG and CFSM updated, states match
```

---

## Next Steps

### Phase 2: Debugger Pause/Resume Mechanism

**File:** `src/core/simulation/cfsm-debugger.ts`

**Need to add:**
```typescript
class CFSMDebugger {
  private paused: boolean = false;
  private resumeResolve: (() => void) | null = null;

  // Pause execution (called when 'incoming' event received)
  pause(): void {
    this.paused = true;
  }

  // Resume execution (called after CFG validation)
  resume(): void {
    this.paused = false;
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }

  // Check if paused, wait for resume
  private async waitIfPaused(): Promise<void> {
    if (this.paused) {
      await new Promise<void>(resolve => {
        this.resumeResolve = resolve;
      });
    }
  }

  // Modified stepForward to wait if paused
  async stepForward(): Promise<void> {
    await this.waitIfPaused();
    await this.executor.step();
    // ... rest of implementation
  }
}
```

### Phase 3: Wire Channels to Debuggers

**File:** `src/core/simulation/distributed-simulator.ts` or new bisimulation coordinator

**Need to:**
1. Create channels with `onIncoming` handlers
2. Handlers emit 'incoming' event to appropriate debugger
3. Debugger pauses when 'incoming' received

```typescript
// When creating channels for role B:
const [endA, endB] = createChannel({
  onIncomingB: async (msg) => {
    // Emit 'incoming' to B's debugger
    const debuggerB = debuggers.get('B');
    debuggerB.pause();

    await debuggerB.emit('incoming', {
      from: msg.from,
      to: msg.to,
      label: msg.label,
      message: msg
    });

    // Wait here until coordinator resumes
  }
});
```

### Phase 4: Bisimulation Coordinator

**New file:** `src/core/simulation/bisimulation-coordinator.ts`

**Responsibilities:**
1. Subscribe to 'incoming' events from all CFSM debuggers
2. When 'incoming' received, ask CFG: "Is this action valid now?"
3. CFG validates based on:
   - Current state
   - Causal dependencies
   - Concurrent events (can be reordered)
4. If valid: call `debugger.resume()`
5. If invalid: error (protocol violation)

### Phase 5: CFG Concurrency Tracking

**File:** `src/core/simulation/cfg-simulator.ts`

**Need to add:**
- Track which events are concurrent vs causally ordered
- Validate actions based on dependencies, not just sequence
- Allow concurrent events to happen in any order

### Phase 6: UI Integration

**File:** `src/lib/stores/simulation.ts`

**Changes needed:**
1. Remove `executionMode` store (always bisimulation)
2. Remove mode switching functions
3. Keep `initializeBisimulation` → rename to `initializeSimulation`
4. Always create both CFG and CFSM debuggers
5. Use BisimulationCoordinator to step both together

### Phase 7: Remove hasMessage()

**After bisimulation coordinator is working:**
1. Remove `hasMessage()` from `ChannelEnd` interface
2. Remove checks from `getEnabledTransitions()`
3. Update tests
4. Document that event-driven coordination replaced polling

---

## Key Decisions Made

### 1. 'incoming' Event (Not 'ready')
- Event includes message data
- No need for separate `peekNext()` call
- Cleaner API with all info in one place

### 2. Interception Only on Receive
- Send side doesn't need interception
- Only receive needs CFG validation pause point

### 3. Optional Handlers (Backward Compatible)
- Existing code continues to work
- Can gradually migrate to bisimulation

### 4. Pause at Debugger Level
- Executor remains pure execution engine
- Debugger handles pause/resume for stepping
- Separation of concerns

---

## Questions Answered

**Q: Why not peekNext()?**
**A:** 'incoming' event with message data is simpler - one event has all information

**Q: What about hasMessage()?**
**A:** Will be removed after bisimulation coordinator is working with event-driven coordination

**Q: Sequential vs concurrent modes?**
**A:** These don't exist - only bisimulation. UI has autoplay (random choices) vs stepped (user choices)

**Q: CFG concurrency metadata?**
**A:** CFG is a Control Flow Graph - parallel branches ARE the concurrency info

---

## Testing Status

✅ All 203 simulation tests pass
✅ Channel API backward compatible
✅ No breaking changes to existing code

---

## Documentation Updates Needed

After implementation complete:
1. Delete incorrect docs about "mode switching"
2. Update architecture docs to reflect bisimulation-only
3. Document CFG→CFSM coordination flow
4. Explain pause/resume mechanism
5. Document 'incoming' event usage

---

## Estimated Remaining Work

- **Phase 2:** Debugger pause/resume - 2-3 hours
- **Phase 3:** Wire channels to debuggers - 1-2 hours
- **Phase 4:** Bisimulation coordinator - 3-4 hours
- **Phase 5:** CFG concurrency tracking - 2-3 hours
- **Phase 6:** UI integration - 2-3 hours
- **Phase 7:** Remove hasMessage() - 1-2 hours
- **Testing & debugging:** 2-4 hours

**Total:** ~15-20 hours remaining

---

## Next Immediate Action

Implement Phase 2: Debugger pause/resume mechanism

This provides the control flow needed for the coordinator to pause CFSM execution at the 'incoming' event and resume after CFG validation.
