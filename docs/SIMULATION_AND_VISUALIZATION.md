# Simulation and Visualization Architecture

**Purpose**: Comprehensive guide to all simulation modes and visualization strategies for MPST live tutorial

**Last Updated**: 2025-01-12

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Layers](#architecture-layers)
3. [Simulation Modes](#simulation-modes)
4. [Visualization Strategies](#visualization-strategies)
5. [Educational Use Cases](#educational-use-cases)
6. [Implementation Guide](#implementation-guide)
7. [API Reference](#api-reference)

---

## Overview

This project implements **three complementary simulators** for teaching Multiparty Session Types (MPST) theory in depth:

### The Three Simulators

| Simulator | Purpose | Semantics | Use Case |
|-----------|---------|-----------|----------|
| **CFG Simulator** | Global choreography | Synchronous, total order | Understand global protocol |
| **CFSM Simulator** | Single role execution | Asynchronous, local view | Understand one role's behavior |
| **Distributed Simulator** | Multi-role coordination | Asynchronous, partial order | Understand distributed execution |

**Key Insight**: Each simulator enables **different visualizations** that teach different aspects of MPST theory.

---

## Architecture Layers

### Layer 4: CFG Simulator (Global Choreography)

**File**: `src/core/simulation/cfg-simulator.ts`

**What it does**:
- Executes global CFG step-by-step
- Represents "choreographer's view" (omniscient coordinator)
- Synchronous semantics (atomic message delivery)
- Total order of events

**Structure**:
```
CFG Nodes = Protocol constructs (messages, choices, parallel, recursion)
CFG Edges = Control flow
Execution = Walk the graph, emit events
```

**Events** (14 types):
```typescript
'step-start' | 'step-end'
'node-enter' | 'node-exit'
'message'
'choice-point' | 'choice-selected'
'fork' | 'join'
'recursion-enter' | 'recursion-continue' | 'recursion-exit'
'complete' | 'error'
```

**Capabilities**:
- Interactive stepping
- Choice preview (enhanced with action sequences)
- Event-based hooks for visualization
- Trace recording
- Formal guarantees tested (5 categories, 13 tests)

---

### Layer 5a: Projection (CFG → CFSM Transformation)

**Files**: `src/core/projection/projector.ts`, `src/core/projection/types.ts`

**What it does**:
- Projects global CFG to local CFSM for each role
- Transforms protocol constructs to LTS semantics
- Generates state machines with actions on transitions

**CFSM Structure** (Formal):
```
CFSM = (Q, q₀, A, →, Q_f)

Q = States (control locations - NO actions here!)
q₀ = Initial state
A = Actions (send !, receive ?, tau τ, choice)
→ = Transitions (state × action × state)
Q_f = Final states

KEY: Actions live on TRANSITIONS, not states!
```

**Transformation Rules**:
- Message `A→B: M` becomes:
  - Role A: `(s0) --[send !B⟨M⟩]--> (s1)`
  - Role B: `(s0) --[receive ?A⟨M⟩]--> (s1)`
  - Other roles: `(s0) --[tau τ]--> (s1)`
- Choice: Internal (⊕) for decider, external (&) for others
- Parallel: Flattened to sequential per role
- Recursion: Back-edges in state machine

**Tests**: 45/45 passing (100% coverage)

---

### Layer 5b: CFSM Simulator (Single Role Execution)

**File**: `src/core/simulation/cfsm-simulator.ts`

**What it does**:
- Executes ONE CFSM (one role's local view)
- Asynchronous message passing with FIFO buffers
- Correct LTS semantics for transition enabling

**Execution Model**:
```
1. Check enabled transitions:
   - Send: Always enabled (async)
   - Receive: Enabled when message in buffer (FIFO head matches)
   - Tau/Choice: Always enabled
2. Fire transition (state change + action)
3. Update message buffers
4. Emit events
```

**Events** (11 types):
```typescript
'step-start' | 'step-end'
'transition-fired'
'send' | 'receive' | 'tau' | 'choice'
'buffer-enqueue' | 'buffer-dequeue'
'complete' | 'error' | 'deadlock'
```

**Key Features**:
- **FIFO message buffers** (per sender channel)
- **Deadlock detection** (blocked on receive)
- **Outgoing message queue** (for coordinator delivery)
- **State inspection** (current state, enabled transitions, buffers)

**Tests**: 13/13 passing (100% coverage)

---

### Layer 5c: Distributed Simulator (Multi-Role Coordination)

**File**: `src/core/simulation/distributed-simulator.ts`

**What it does**:
- Coordinates multiple CFSMs running asynchronously
- Mediates message passing between roles
- Detects distributed deadlock
- Controls execution scheduling

**Execution Model**:
```
1. Select enabled role (scheduling strategy)
2. Execute one transition in that role's CFSM
3. Collect outgoing messages
4. Deliver messages to recipient buffers
5. Check for deadlock/completion
6. Repeat
```

**Why Coordinator Mediates Channels**:
1. ✅ **Deadlock detection** - Global view needed
2. ✅ **CFSM isolation** - CFSMs don't know about each other (formal semantics)
3. ✅ **FIFO enforcement** - Messages from A→B delivered in send order
4. ✅ **Scheduling control** - Enables interleaving exploration
5. ✅ **Observability** - Single point to observe all messages

**Scheduling Strategies**:
- **Round-robin**: Fair rotation through roles
- **Fair**: Minimize step count differences
- **Random**: Non-deterministic exploration

**Deadlock Detection**:
- **Distributed deadlock**: No role has enabled transitions
- **Different from CFG**: Static analysis (verifier) vs dynamic detection (runtime)
- **Example**: Role A waits for B, B waits for A → circular wait → deadlock

**Tests**: 11/11 passing (100% coverage)

---

## Simulation Modes

### Mode 1: Global Choreography (CFG Simulator)

**Purpose**: Understand the global protocol specification

**Code**:
```typescript
const cfgSim = new CFGSimulator(cfg, {
  choiceStrategy: 'manual',  // or 'first', 'random'
  recordTrace: true,
  previewLimit: 5  // Preview 5 actions in each choice branch
});

// Subscribe to events
cfgSim.on('message', ({ from, to, label }) => {
  console.log(`${from} → ${to}: ${label}`);
});

cfgSim.on('choice-point', ({ role, options }) => {
  console.log(`${role} must choose from:`, options);
  // options include preview of each branch!
});

// Execute
cfgSim.step();  // One step
cfgSim.run();   // Run to completion
```

**What you see**:
- Total order of messages
- Global state progression
- Choice points with branch previews
- Synchronous execution (no buffers)

**Teaches**:
- Global choreography
- Scribble protocol structure
- Synchronous semantics

---

### Mode 2: Local Protocol Execution (CFSM Simulator)

**Purpose**: Understand one role's local behavior

**Code**:
```typescript
// Project CFG to CFSMs
const projection = projectAllRoles(cfg);
const cfsmA = projection.cfsms.get('A')!;

// Create CFSM simulator
const sim = new CFSMSimulator(cfsmA, {
  maxBufferSize: 10,  // Optional buffer limit
  recordTrace: true
});

// Subscribe to events
sim.on('transition-fired', ({ from, to, action }) => {
  console.log(`State ${from} → ${to} via ${action.type}`);
});

sim.on('buffer-enqueue', ({ from, message }) => {
  console.log(`Message from ${from} arrived: ${message.label}`);
});

// Manually deliver messages (from coordinator)
sim.deliverMessage({
  id: 'msg1',
  from: 'B',
  to: 'A',
  label: 'Hello',
  timestamp: Date.now()
});

// Execute
sim.step();  // Fire one transition
```

**What you see**:
- CFSM state machine (states + transitions)
- Actions on transitions (not in states!)
- Message buffers per sender
- Blocking on receive

**Teaches**:
- Local protocol view
- State machine structure
- Asynchronous buffering
- LTS semantics

---

### Mode 3: Distributed Execution (Distributed Simulator)

**Purpose**: Understand multi-role coordination and distributed deadlock

**Code**:
```typescript
// Project CFG to CFSMs
const projection = projectAllRoles(cfg);
const cfsms = projection.cfsms;

// Create distributed simulator
const dist = new DistributedSimulator(cfsms, {
  schedulingStrategy: 'round-robin',  // or 'fair', 'random'
  deliveryModel: 'fifo',  // or 'unordered'
  recordTrace: true
});

// Access individual role simulators
const simA = dist.getSimulator('A');
const simB = dist.getSimulator('B');

// Subscribe to role-specific events
simA.on('send', ({ to, label }) => {
  console.log(`A sends ${label} to ${to}`);
});

simB.on('receive', ({ from, label }) => {
  console.log(`B receives ${label} from ${from}`);
});

// Execute
dist.step();  // Execute one transition in one role
dist.run();   // Run to completion or deadlock

// Check for deadlock
if (dist.isDeadlocked()) {
  console.log('Distributed deadlock detected!');
  const state = dist.getState();
  console.log('Blocked roles:', state.enabledRoles);
}
```

**What you see**:
- Multiple CFSMs executing concurrently
- Message passing between roles
- Partial order of events
- Runtime deadlock detection

**Teaches**:
- Distributed execution
- Partial vs total order
- Message buffering
- Dynamic deadlock detection

---

## Visualization Strategies

### 1. CFG Graph View (Flowchart)

**Source**: CFG Simulator events

**Structure**:
```
[Initial] → [A→B:M1] → [Branch] → [A→B:M2] → [Terminal]
                           ↓
                        [A→B:M3] → [Terminal]
```

**Implementation**:
```typescript
cfgSim.on('node-enter', ({ nodeId }) => {
  cfgGraphView.highlightNode(nodeId);
});

cfgSim.on('node-exit', ({ nodeId }) => {
  cfgGraphView.unhighlightNode(nodeId);
});
```

**Teaches**: CFG structure, protocol constructs

---

### 2. Sequence Diagram (UML-style)

**Source**: CFG Simulator events

**Structure**:
```
A         B         C
|         |         |
|---M1--->|         |
|         |---M2--->|
|<--------M3--------|
```

**Implementation**:
```typescript
cfgSim.on('message', ({ from, to, label }) => {
  sequenceDiagram.addMessage(from, to, label);
  sequenceDiagram.animate();
});
```

**Teaches**: Role interactions, message flow, total order

---

### 3. Network of State Machines (THE KEY VIEW!)

**Source**: CFSM Simulators via Distributed Simulator

**Structure**:
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Role A CFSM   │    │   Role B CFSM   │    │   Role C CFSM   │
│                 │    │                 │    │                 │
│   ●─[s0]        │    │   ●─[s0]        │    │   ●─[s0]        │
│    │ !B⟨M1⟩     │───────→│    │ ?A⟨M1⟩  │    │    │            │
│    ↓            │    │    ↓            │    │    │            │
│   [s1]          │    │   [s1]          │    │    │            │
│    │ ?C⟨M3⟩     │←────────────────────────────│    │ !A⟨M3⟩     │
│    ↓            │    │    │            │    │    ↓            │
│   [s2] ■        │    │   [s2] ■        │    │   [s1] ■        │
│                 │    │                 │    │                 │
│  Buffer from C: │    │  Buffer from A: │    │  Buffer from B: │
│  [M3 queued]    │    │  [empty]        │    │  [empty]        │
└─────────────────┘    └─────────────────┘    └─────────────────┘

● = current state    ■ = terminal    → = message in flight
```

**Implementation**:
```typescript
const dist = new DistributedSimulator(cfsms);

// Render each role's CFSM structure
for (const [role, cfsm] of cfsms) {
  networkView.renderStateMachine(role, cfsm);
}

// Animate execution
for (const [role, cfsm] of cfsms) {
  const sim = dist.getSimulator(role);

  // Highlight current state
  sim.on('transition-fired', ({ from, to, action }) => {
    networkView.highlightState(role, to);
    networkView.animateTransition(role, from, to, action);
  });

  // Show message buffers
  sim.on('buffer-enqueue', ({ from, message }) => {
    networkView.addToBuffer(role, from, message);
  });

  sim.on('buffer-dequeue', ({ from }) => {
    networkView.removeFromBuffer(role, from);
  });
}

// Show message arrows
dist.on('step', ({ role, action }) => {
  if (action?.type === 'send') {
    networkView.drawMessageArrow(role, action.to, action.label);
  }
});
```

**Teaches**:
- ✅ Each role has its own state machine (CFSM)
- ✅ States are control locations (NOT actions!)
- ✅ Actions live on transitions
- ✅ Message buffers (asynchronous semantics)
- ✅ Distributed execution (partial order)
- ✅ Projection correctness

**This is the PRIMARY visualization for teaching MPST!**

---

### 4. Side-by-Side Comparison

**Source**: Both CFG and Distributed Simulators

**Purpose**: Show synchronous vs asynchronous semantics

**Structure**:
```
┌──────────────────────┬──────────────────────┐
│  CFG (Synchronous)   │  CFSM (Asynchronous) │
├──────────────────────┼──────────────────────┤
│  Step 1: A→B: M1     │  Step 1: A sends M1  │
│  (atomic delivery)   │  Step 2: B receives  │
│                      │  (buffered)          │
├──────────────────────┼──────────────────────┤
│  Total order         │  Partial order       │
│  No buffers          │  FIFO channels       │
│  No deadlock runtime │  Deadlock detected   │
└──────────────────────┴──────────────────────┘
```

**Implementation**:
```typescript
// Run both simulators simultaneously
const cfgSim = new CFGSimulator(cfg);
const dist = new DistributedSimulator(cfsms);

cfgSim.on('message', data => leftPane.animate(data));
dist.on('step', data => rightPane.animate(data));

// Highlight differences
if (cfgSim.stepCount !== dist.globalSteps) {
  comparisonView.highlightDifference('Step count differs!');
}
```

**Teaches**: Synchronous vs asynchronous semantics

---

### 5. Projection Visualization

**Source**: CFG + CFSM structures

**Purpose**: Show how CFG projects to CFSM

**Structure**:
```
CFG:                          Role A CFSM:
[A→B: M1]      ──project──>   (s0) --[send !B⟨M1⟩]--> (s1)

[B→C: M2]      ──project──>   (s1) --[tau τ]--> (s2)
(A not involved)                   ^
                                silent
```

**Implementation**:
```typescript
function visualizeProjection(cfg: CFG, role: string) {
  const cfsm = project(cfg, role);

  // Show CFG on left
  projectionView.showCFG(cfg);

  // Show CFSM on right
  projectionView.showCFSM(cfsm);

  // Highlight mapping
  for (const node of cfg.nodes) {
    if (nodeInvolvesRole(node, role)) {
      projectionView.drawMapping(node, cfsm);
    } else {
      projectionView.showAsTau(node);  // Becomes tau transition
    }
  }
}
```

**Teaches**: CFG → CFSM transformation, projection rules

---

### 6. Verification Dashboard

**Source**: Verifier + Simulators

**Purpose**: Show static vs dynamic checks

**Structure**:
```
┌─────────────────────────────────────────────┐
│  STATIC VERIFICATION (Verifier)             │
├─────────────────────────────────────────────┤
│  ✅ Deadlock freedom (CFG structure)        │
│  ✅ Choice determinism                      │
│  ✅ Liveness (reachability)                 │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  RUNTIME VALIDATION (Distributed Simulator) │
├─────────────────────────────────────────────┤
│  ? Distributed deadlock (checked at runtime)│
│  ? Buffer overflow (checked at runtime)     │
│  ? Message ordering (validated dynamically) │
└─────────────────────────────────────────────┘
```

**Implementation**:
```typescript
// Run static verification
const verifyResult = verify(cfg);
dashboardView.showStaticChecks(verifyResult);

// Run dynamic simulation
const dist = new DistributedSimulator(cfsms);
const runResult = dist.run();

if (runResult.error?.type === 'deadlock') {
  dashboardView.showRuntimeError('Distributed deadlock detected!');
  dashboardView.highlightBlockedRoles(runResult.state);
}
```

**Teaches**: Static vs dynamic verification, verification limits

---

## Educational Use Cases

### Use Case 1: Teaching Global Choreography

**Goal**: Student understands protocol specification

**Simulator**: CFG Simulator

**Visualization**: Sequence Diagram

**Steps**:
1. Load Scribble protocol
2. Show CFG graph
3. Animate sequence diagram
4. Let student step through execution
5. Show choice points with previews

**Key Concepts**:
- Global view
- Total order
- Synchronous semantics

---

### Use Case 2: Teaching Projection

**Goal**: Student understands CFG → CFSM transformation

**Simulator**: None (static visualization)

**Visualization**: Projection View

**Steps**:
1. Show CFG on left
2. Show each role's CFSM on right
3. Highlight node → transition mappings
4. Show how uninvolved roles get tau
5. Explain action placement (on transitions!)

**Key Concepts**:
- Local view extraction
- Send vs receive
- Tau transitions
- State machine structure

---

### Use Case 3: Teaching Distributed Execution

**Goal**: Student understands async semantics and deadlock

**Simulator**: Distributed Simulator

**Visualization**: Network of State Machines

**Steps**:
1. Show all roles' CFSMs simultaneously
2. Animate one role at a time (scheduling)
3. Show message buffers filling/emptying
4. Run until deadlock (if applicable)
5. Explain why deadlock occurred

**Key Concepts**:
- Asynchronous messaging
- FIFO buffers
- Partial order
- Runtime deadlock

---

### Use Case 4: Comparing Sync vs Async

**Goal**: Student understands semantic differences

**Simulator**: Both CFG and Distributed

**Visualization**: Side-by-Side

**Steps**:
1. Run CFG simulator (left pane)
2. Run distributed simulator (right pane)
3. Pause when they diverge
4. Explain buffering difference
5. Show how async can deadlock

**Key Concepts**:
- Synchronous vs asynchronous
- Buffer impact
- Ordering differences

---

## Implementation Guide

### Setting Up Visualizations

#### 1. Install Dependencies
```bash
npm install d3  # For graph rendering
npm install svelte  # For UI components (if using Svelte)
```

#### 2. Create Visualization Components

**CFG Graph Component**:
```typescript
class CFGGraphView {
  private svg: SVGElement;
  private nodes: Map<string, NodeElement>;

  render(cfg: CFG) {
    // Use D3 to render CFG as directed graph
    this.nodes = new Map();
    for (const node of cfg.nodes) {
      this.nodes.set(node.id, this.createNodeElement(node));
    }
    // Draw edges...
  }

  highlightNode(nodeId: string) {
    this.nodes.get(nodeId)?.classList.add('active');
  }

  unhighlightNode(nodeId: string) {
    this.nodes.get(nodeId)?.classList.remove('active');
  }
}
```

**CFSM State Machine Component**:
```typescript
class CFSMStateMachineView {
  private svg: SVGElement;
  private states: Map<string, StateElement>;

  render(cfsm: CFSM) {
    // Render states as circles
    for (const state of cfsm.states) {
      this.states.set(state.id, this.createStateCircle(state));
    }

    // Render transitions as arrows with action labels
    for (const transition of cfsm.transitions) {
      this.createTransitionArrow(transition);
      this.labelTransition(transition.action);
    }
  }

  highlightState(stateId: string) {
    this.states.get(stateId)?.classList.add('current');
  }

  animateTransition(from: string, to: string) {
    // Animate arrow from → to
  }

  showBuffer(fromRole: string, messages: Message[]) {
    // Show message queue
  }
}
```

#### 3. Wire Up Event Listeners

**CFG Visualization**:
```typescript
const cfgSim = new CFGSimulator(cfg);
const cfgView = new CFGGraphView('#cfg-container');
cfgView.render(cfg);

cfgSim.on('node-enter', ({ nodeId }) => cfgView.highlightNode(nodeId));
cfgSim.on('node-exit', ({ nodeId }) => cfgView.unhighlightNode(nodeId));
cfgSim.on('message', ({ from, to, label }) => {
  cfgView.animateMessage(from, to, label);
});
```

**Network Visualization**:
```typescript
const dist = new DistributedSimulator(cfsms);
const networkView = new NetworkStateMachineView('#network-container');

// Render all CFSMs
for (const [role, cfsm] of cfsms) {
  networkView.renderCFSM(role, cfsm);
}

// Animate execution
for (const [role, cfsm] of cfsms) {
  const sim = dist.getSimulator(role);

  sim.on('transition-fired', ({ from, to, action }) => {
    networkView.highlightState(role, to);
    networkView.animateTransition(role, from, to, action);
  });

  sim.on('buffer-enqueue', ({ from, message }) => {
    networkView.showBuffer(role, from, [message]);
  });
}
```

---

## API Reference

### CFGSimulator

```typescript
class CFGSimulator {
  constructor(cfg: CFG, config?: CFGSimulatorConfig);

  // Execution
  step(): CFGStepResult;
  run(): CFGRunResult;
  reset(): void;

  // State
  getState(): CFGExecutionState;
  isComplete(): boolean;
  getTrace(): CFGExecutionTrace;

  // Choice
  choose(index: number): void;

  // Events
  on(event: SimulatorEventType, callback: EventCallback): () => void;
  off(event: SimulatorEventType, callback: EventCallback): void;
}
```

### CFSMSimulator

```typescript
class CFSMSimulator {
  constructor(cfsm: CFSM, config?: CFSMSimulatorConfig);

  // Execution
  step(): CFSMStepResult;
  run(): CFSMRunResult;
  reset(): void;

  // State
  getState(): CFSMExecutionState;
  getEnabledTransitions(): CFSMTransition[];
  isComplete(): boolean;

  // Messages
  deliverMessage(message: Message): void;
  getOutgoingMessages(): Message[];

  // Events
  on(event: CFSMEventType, callback: CFSMEventCallback): () => void;
  off(event: CFSMEventType, callback: CFSMEventCallback): void;
}
```

### DistributedSimulator

```typescript
class DistributedSimulator {
  constructor(cfsms: Map<string, CFSM>, config?: DistributedSimulatorConfig);

  // Execution
  step(): DistributedStepResult;
  run(): DistributedRunResult;
  reset(): void;

  // State
  getState(): DistributedExecutionState;
  isComplete(): boolean;
  isDeadlocked(): boolean;
  getTraces(): Map<string, CFSMExecutionTrace>;

  // Role access
  getSimulator(role: string): CFSMSimulator | undefined;
}
```

---

## Summary

### What We Built

1. ✅ **CFG Simulator** - Global choreography execution (23 tests)
2. ✅ **Projection** - CFG → CFSM transformation (45 tests)
3. ✅ **CFSM Simulator** - Single role execution (13 tests)
4. ✅ **Distributed Simulator** - Multi-role coordination (11 tests)

**Total: 92 tests, all passing** ✅

### Visualization Matrix

| View | Simulator | Structure | Teaches |
|------|-----------|-----------|---------|
| CFG Graph | CFG | Flowchart of protocol | Global structure |
| Sequence Diagram | CFG | Messages in time | Role interactions |
| **Network of State Machines** | **CFSM/Distributed** | **Multiple CFSMs** | **Distributed execution** |
| Side-by-Side | Both | Sync vs Async | Semantic differences |
| Projection | Static | CFG → CFSM | Transformation rules |
| Verification Dashboard | Verifier + Simulator | Static + Dynamic | Correctness properties |

### Key Takeaways

1. **CFG Simulator ≠ CFSM Simulator**
   - Different structures (CFG nodes ≠ CFSM states)
   - Different semantics (sync vs async)
   - Different visualizations (flowchart vs state machines)

2. **Network View Requires CFSMs**
   - Cannot be derived from CFG filtering
   - Must use projected CFSMs
   - Shows true distributed execution

3. **Both Simulators Are Event-Based**
   - CFG: 14 event types
   - CFSM: 11 event types
   - Ready for reactive visualizations

4. **Educational Architecture**
   - Use CFG for global understanding
   - Use CFSMs for local/distributed understanding
   - Compare both to teach semantic differences

---

## References

1. Honda, Yoshida, Carbone (2008): Multiparty Asynchronous Session Types
2. Brand & Zafiropulo (1983): On Communicating Finite-State Machines
3. Deniélou & Yoshida (2012): Dynamic Multirole Session Types
4. Labeled Transition System (LTS) semantics
5. MPST formal foundations

---

**End of Document**
