# Actual Simulation Requirements

**Date:** 2025-12-03
**Purpose:** Document the ACTUAL requirements as explained by the user, not implementation decisions

---

## Core Principle

This is an **INTERACTIVE TUTORIAL** system, not a production runtime.
The simulation is a **TEACHING TOOL** for visual inspection of distributed protocols.

---

## Architecture: Always-On Bisimulation

There is **ONE simulation** that ALWAYS runs BOTH:

### 1. CFG Simulator (Orchestrator/Centralized View)
**Purpose:** Provides step ordering (source of truth for sequence)

**Responsibilities:**
- Determines "what happens next" in the protocol
- Example: CFG says "A→B: hello should happen now"
- Provides the global choreography view for students
- **Does NOT maintain actual runtime state**

**Usage:**
- User clicks "Step" → CFG determines next action
- CFG provides the ORDERING but not the STATE

### 2. CFSM Simulators (Choreography/Distributed View)
**Purpose:** Maintain actual distributed state with full fidelity

**Responsibilities:**
- Each CFSM runs according to its own state graph
- Maintains real state: current node, message queues, local variables
- Run **concurrently** (all roles together, not one-at-a-time)
- "Catch up" with CFG ordering

**Usage:**
- CFSMs execute the actions that CFG orders
- Provide the distributed network view for students
- **This is the actual state of the system**

---

## How Bisimulation Works

### Step Sequence

```
1. User clicks "Step" (or auto-step during play)
   ↓
2. CFG determines next action: "A→B: hello"
   ↓
3. Bisimulation coordinator:
   - Signals CFSM A to execute send
   ↓
4. CFSM A executes send:
   - Message goes into B's queue
   ↓
5. Mediated Channel:
   - B's receive() is called
   - **PAUSES before interpreting message**
   - Emits 'ready' event: "B can interpret message now"
   ↓
6. Coordinator (using CFG as guide):
   - Checks: "Does CFG say B should receive now?"
   - If yes: signals B to proceed
   ↓
7. CFSM B proceeds:
   - Atomic receive: dequeue + substitute + transition
   - Updates B's state according to B's state graph
   ↓
8. Both views updated:
   - CFG view shows: A→B communication completed
   - CFSM view shows: A in new state, B in new state, queues updated
```

### Key Points

- **CFG determines ORDER** (when things happen)
- **CFSMs determine STATE** (what the actual state is)
- **If implementation is correct, traces MUST MATCH**
- **Mediated channel provides pause point** (before message interpretation)

---

## Visual Inspection (Teaching Goal)

Students see **BOTH views simultaneously**:

1. **CFG View:** Global choreography - "A talks to B, then B talks to C"
2. **CFSM Network View:** Distributed state machines + message queues
   - See each role's current state
   - See messages in flight (queues)
   - See how local execution differs from global view

3. **Time-Travel Debugger:**
   - Step forward/backward through execution
   - Inspect state at any point in time
   - Understand how distributed execution unfolds

---

## Concurrent Execution

**CFSMs run concurrently** means:
- All roles execute together (not one-at-a-time)
- Natural message passing via queues
- Pauses happen at receive interpretation points
- Order is determined by CFG stepping

**This is NOT:**
- ❌ Separate "concurrent mode" vs "sequential mode"
- ❌ Switching between CFG-only and CFSM-only
- ❌ Polling with hasMessage() to step one role at a time

---

## What Was Incorrectly Added

### Mode Switching (NEVER REQUESTED)
- ❌ `executionMode` store (cfg/distributed/bisimulation)
- ❌ Switching between "CFG mode" and "Distributed mode"
- ❌ Running CFG alone OR CFSMs alone

**Reality:** Always run BOTH together (bisimulation)

### Sequential Coordinator (NEVER REQUESTED)
- ❌ Step one role at a time
- ❌ Use hasMessage() to avoid blocking
- ❌ Coordinator selects which role goes next

**Reality:** CFG determines order, all CFSMs run concurrently

### Documentation Defending Above (SELF-PERPETUATING)
- ❌ Documentation about "modes"
- ❌ Justification of hasMessage() for "sequential mode"
- ❌ "Necessary compromises" for non-existent requirements

---

## What Should Exist

### Single Bisimulation Coordinator
- Takes step order from CFG
- Triggers corresponding CFSM actions
- Uses mediated channels for pause points
- Allows visual inspection at each step

### Mediated Channel Pause Mechanism
- Message arrives in queue
- CFSM's receive() is called
- **Pauses BEFORE atomic interpretation**
- Waits for coordinator approval (from CFG)
- Proceeds with atomic receive

### Time-Travel for Teaching
- Snapshots at each step
- Can step forward/backward
- Inspect complete state at any point
- Both CFG and CFSM states in sync

---

## Deadlock Detection

Since we can detect deadlocks ahead of time (via CFG analysis):
- Simulation should also demonstrate them when they occur
- Students see HOW deadlock manifests in distributed execution
- Compare: "CFG says deadlock here" vs "CFSMs are actually stuck"

---

## Summary

**ONE simulation:**
- CFG provides ordering
- CFSMs provide state
- Both run together (bisimulation)
- Visual inspection of both views
- Teaching tool, not production runtime

**NO separate modes**
**NO sequential coordinator**
**NO hasMessage() justification**

---

## Open Questions

1. **Pause mechanism implementation:** How exactly does receive() pause before interpretation?
2. **Cascading effects:** If one CFG step triggers multiple CFSM transitions, how are they handled?
3. **hasMessage() fate:** Still needed or replaced entirely by pause mechanism?
4. **Code to delete:** Confirm what should be removed

---

**Next Step:** Get user confirmation on this understanding before implementing
