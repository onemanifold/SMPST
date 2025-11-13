# Simulation Engine Design

**Date:** 2025-11-13
**Status:** Design Phase
**Goal:** Implement interactive protocol execution engine using pure LTS

## Overview

The simulation engine allows **step-by-step execution** of multiparty protocols, enabling:
- Interactive protocol testing
- Deadlock detection at runtime
- Trace visualization
- Debugging communication patterns
- Verification of implementation behavior

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────┐
│                   Simulation Engine                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ LTS         │  │ Message      │  │ Trace          │ │
│  │ Simulator   │◄─┤ Queue        │◄─┤ Recorder       │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
│         ▲                 ▲                  ▲           │
│         │                 │                  │           │
│  ┌──────┴────────┐ ┌─────┴──────┐  ┌────────┴────────┐ │
│  │ State         │ │ Deadlock   │  │ Violation       │ │
│  │ Manager       │ │ Detector   │  │ Checker         │ │
│  └───────────────┘ └────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
                        ▲
                        │
                        │ Uses pure LTS (CFSM)
                        │
        ┌───────────────┴───────────────┐
        │  CFSM = (Q, q₀, A, →)         │
        │  - states: Q                   │
        │  - transitions: →              │
        │  - initialState: q₀            │
        │  - terminalStates: Q_term      │
        └────────────────────────────────┘
```

## 1. LTS Simulator Core

### Formal Semantics

**CFSM Execution Model:**

A configuration is: `(q, σ)` where:
- `q ∈ Q`: current state
- `σ`: message queue state

**Transition Rules:**

```
Send Rule:
  q --!p⟨m⟩--> q'
  ─────────────────────────────
  (q, σ) → (q', σ ∪ {(p, m)})

Receive Rule:
  q --?p⟨m⟩--> q'    (p, m) ∈ σ
  ─────────────────────────────
  (q, σ) → (q', σ \ {(p, m)})

Tau Rule:
  q --τ--> q'
  ─────────────────────────────
  (q, σ) → (q', σ)
```

### Implementation

**File:** `src/core/simulation/lts-simulator.ts`

```typescript
/**
 * LTS-based CFSM simulator
 *
 * FORMAL MODEL:
 * Configuration: (q, σ) where q ∈ Q, σ is message queue
 *
 * Execution: sequence of transitions q₀ →* qₙ
 *
 * Properties:
 * - Progress: can reach terminal or take next step
 * - Safety: no invalid transitions
 * - Liveness: eventually reaches terminal (if well-formed)
 *
 * @reference Deniélou & Yoshida (2012), §3: CFSM execution semantics
 */
export class LTSSimulator {
  private currentState: string;
  private trace: ExecutionTrace;

  constructor(private cfsm: CFSM) {
    this.currentState = cfsm.initialState;
    this.trace = [];
  }

  /**
   * Execute one transition (if possible)
   *
   * ALGORITHM:
   * 1. Get available transitions from current state
   * 2. Select transition (deterministic or user choice)
   * 3. Update current state
   * 4. Record action in trace
   * 5. Return new configuration
   */
  step(options?: StepOptions): StepResult {
    // Implementation...
  }

  /**
   * Execute until terminal state or blocked
   *
   * ALGORITHM:
   * 1. While not terminal and can progress:
   *    - Execute step()
   * 2. Check final state:
   *    - Terminal: SUCCESS
   *    - Blocked: DEADLOCK
   */
  run(options?: RunOptions): ExecutionResult {
    // Implementation...
  }

  /**
   * Check if can make progress
   *
   * Uses: canReachTerminal() from lts-analysis
   */
  canProgress(): boolean {
    // Implementation...
  }

  /**
   * Get execution trace
   */
  getTrace(): ExecutionTrace {
    return this.trace;
  }
}
```

## 2. Message Queue System

### Asynchronous Semantics

**For multiparty protocols:**
- Each role maintains **local message queue**
- Sends are non-blocking (enqueue)
- Receives block until message available

**Queue State:**
```typescript
interface QueueState {
  // Role → Queue of messages from other roles
  queues: Map<string, Message[]>;
}

interface Message {
  from: string;      // Sender role
  to: string;        // Receiver role
  label: string;     // Message type
  payload?: any;     // Optional data
  timestamp: number; // Ordering
}
```

### Implementation

**File:** `src/core/simulation/message-queue.ts`

```typescript
/**
 * Message queue for asynchronous MPST execution
 *
 * FORMAL MODEL:
 * Each role r has queue Q_r containing messages sent to r
 *
 * Operations:
 * - send(from, to, label): Add message to Q_to
 * - receive(to, from, label): Remove message from Q_to (blocking)
 * - peek(to): View next message without removing
 *
 * Properties:
 * - FIFO ordering per sender-receiver pair
 * - Asynchronous sends (non-blocking)
 * - Synchronous receives (blocking until message available)
 *
 * @reference Honda et al. (2016), §4: Asynchronous semantics
 */
export class MessageQueue {
  private queues: Map<string, Message[]>;

  send(from: string, to: string, label: string, payload?: any): void {
    // Implementation...
  }

  receive(to: string, from: string, label: string): Message | null {
    // Implementation...
  }

  hasMessage(to: string, from: string, label: string): boolean {
    // Implementation...
  }

  isEmpty(): boolean {
    // Implementation...
  }
}
```

## 3. Multiparty Simulator

### Coordinating Multiple CFSMs

**Global Configuration:**
```
(q₁, q₂, ..., qₙ, σ)

Where:
- qᵢ: current state of role i
- σ: global message queue state
```

**Execution Modes:**

1. **Lock-Step (Synchronous):**
   - All roles step together
   - Sends and receives happen atomically
   - Simpler, deterministic

2. **Asynchronous:**
   - Roles step independently
   - Message queues buffer communications
   - More realistic, but non-deterministic

### Implementation

**File:** `src/core/simulation/multiparty-simulator.ts`

```typescript
/**
 * Multiparty protocol simulator
 *
 * FORMAL MODEL:
 * Global configuration: (q₁, ..., qₙ, σ)
 *
 * Global step: one role executes transition
 * - If send: enqueue message
 * - If receive: dequeue message (if available)
 * - If tau: internal transition
 *
 * Execution strategies:
 * 1. Round-robin: fair scheduling
 * 2. Random: non-deterministic
 * 3. Interactive: user chooses
 *
 * @reference Honda et al. (2016), §5: Global execution
 */
export class MultipartySimulator {
  private simulators: Map<string, LTSSimulator>;
  private messageQueue: MessageQueue;
  private globalTrace: GlobalTrace;

  constructor(private cfsms: Map<string, CFSM>) {
    // Create simulator for each role
    // Initialize message queue
  }

  /**
   * Execute one global step
   *
   * ALGORITHM:
   * 1. Select role to execute (scheduling)
   * 2. Get available transitions for that role
   * 3. Execute transition:
   *    - Send: add to message queue
   *    - Receive: check message queue, remove if available
   *    - Tau: just update state
   * 4. Record in global trace
   */
  step(options?: GlobalStepOptions): GlobalStepResult {
    // Implementation...
  }

  /**
   * Run until all roles reach terminal or deadlock
   */
  run(options?: GlobalRunOptions): GlobalExecutionResult {
    // Implementation...
  }

  /**
   * Check for deadlock
   *
   * Deadlock = some role waiting for message that will never arrive
   *
   * ALGORITHM:
   * 1. For each role r:
   *    - Get enabled transitions
   *    - If all are receives and no matching messages in queue:
   *      → r is blocked
   * 2. If all roles blocked → DEADLOCK
   */
  isDeadlocked(): boolean {
    // Implementation...
  }
}
```

## 4. Execution Trace

### Trace Format

**Execution trace = sequence of actions:**

```typescript
interface ExecutionTrace {
  steps: TraceStep[];
  startTime: Date;
  endTime?: Date;
  outcome: 'success' | 'deadlock' | 'violation' | 'running';
}

interface TraceStep {
  stepNumber: number;
  role: string;
  from: string;         // Source state
  to: string;           // Target state
  action: CFSMAction;   // Send/receive/tau
  timestamp: Date;
  queueState?: QueueState; // Snapshot of queues
}

interface GlobalTrace extends ExecutionTrace {
  roles: string[];
  synchronizationPoints: number[]; // Steps where roles synchronized
}
```

### Trace Analysis

**File:** `src/core/simulation/trace-analysis.ts`

```typescript
/**
 * Analyze execution traces
 *
 * Provides:
 * - Causality analysis (which actions caused which)
 * - Message flow visualization
 * - Timing analysis
 * - Violation detection
 */
export class TraceAnalyzer {
  /**
   * Extract message sequence chart
   *
   * Returns: sequence of communications in order
   */
  extractMessageSequenceChart(trace: GlobalTrace): MSC {
    // Implementation...
  }

  /**
   * Detect causality violations
   *
   * Check: happens-before relation is respected
   */
  checkCausality(trace: GlobalTrace): CausalityCheck {
    // Implementation...
  }

  /**
   * Compare trace against expected behavior
   */
  compareWithExpected(actual: GlobalTrace, expected: GlobalTrace): TraceComparison {
    // Implementation...
  }
}
```

## 5. Deadlock Detection

### Runtime Detection

**Using our LTS analysis:**

```typescript
/**
 * Detect deadlock during execution
 *
 * FORMAL DEFINITION:
 * Deadlock = configuration (q, σ) where:
 * - q ∉ Q_term (not terminal)
 * - No enabled transitions
 * - Some roles waiting for messages that won't arrive
 *
 * ALGORITHM:
 * 1. Check if all roles in terminal states → SUCCESS (not deadlock)
 * 2. For each non-terminal role r:
 *    - Get outgoing transitions from current state
 *    - If all are receives:
 *      → Check if any matching message in queue
 *      → If no: r is blocked
 * 3. If all roles blocked → DEADLOCK
 *
 * Uses: canReachTerminal() from lts-analysis.ts
 */
export function detectDeadlock(
  simulators: Map<string, LTSSimulator>,
  messageQueue: MessageQueue
): DeadlockInfo | null {
  // Implementation...
}
```

## 6. Interactive Simulation

### User Interface Integration

**For future UI work:**

```typescript
/**
 * Interactive simulator for UI
 *
 * Provides:
 * - Step-by-step execution with user control
 * - Pause/resume
 * - Breakpoints
 * - State inspection
 * - Message queue visualization
 */
export class InteractiveSimulator extends MultipartySimulator {
  /**
   * Set breakpoint at state or action
   */
  setBreakpoint(condition: BreakpointCondition): void {
    // Implementation...
  }

  /**
   * Execute until breakpoint hit
   */
  runUntilBreakpoint(): BreakpointResult {
    // Implementation...
  }

  /**
   * Get current state snapshot for visualization
   */
  getSnapshot(): SimulationSnapshot {
    return {
      roleStates: this.getCurrentStates(),
      messageQueues: this.messageQueue.getSnapshot(),
      trace: this.globalTrace,
      canProgress: !this.isDeadlocked(),
    };
  }
}
```

## 7. Testing Strategy

### Theorem-Based Simulation Tests

**File:** `src/__tests__/simulation/lts-simulator.test.ts`

```typescript
/**
 * PROPERTY: LTS simulation preserves formal semantics
 *
 * Tests verify:
 * 1. State transitions follow CFSM definition
 * 2. Traces are valid execution sequences
 * 3. Terminal states are reached when expected
 * 4. Deadlocks are detected correctly
 */
describe('LTS Simulator Correctness', () => {
  describe('Property 1: Valid Transitions', () => {
    it('proves: only valid transitions are taken', () => {
      // Test that simulator only follows transitions in CFSM
    });
  });

  describe('Property 2: Trace Validity', () => {
    it('proves: execution trace is valid path in LTS', () => {
      // Test that trace corresponds to valid state sequence
    });
  });

  describe('Property 3: Termination', () => {
    it('proves: terminates when protocol completes', () => {
      // Test that simulator reaches terminal states
    });
  });

  describe('Property 4: Deadlock Detection', () => {
    it('proves: detects deadlock correctly', () => {
      // Test deadlock detection on known-deadlocked protocol
    });
  });
});
```

## Implementation Plan

### Phase 1: Core LTS Simulator (Priority: HIGH)

**Goal:** Single CFSM execution

**Files to create:**
1. `src/core/simulation/types.ts` - Type definitions
2. `src/core/simulation/lts-simulator.ts` - Core simulator
3. `src/__tests__/simulation/lts-simulator.test.ts` - Tests

**Deliverables:**
- ✅ Single role execution
- ✅ Step-by-step control
- ✅ Trace generation
- ✅ Termination detection

### Phase 2: Message Queue (Priority: HIGH)

**Goal:** Asynchronous message passing

**Files to create:**
1. `src/core/simulation/message-queue.ts` - Queue implementation
2. `src/__tests__/simulation/message-queue.test.ts` - Tests

**Deliverables:**
- ✅ FIFO message queues
- ✅ Send/receive operations
- ✅ Queue state tracking

### Phase 3: Multiparty Simulator (Priority: HIGH)

**Goal:** Multiple CFSM coordination

**Files to create:**
1. `src/core/simulation/multiparty-simulator.ts` - Multiparty execution
2. `src/__tests__/simulation/multiparty-simulator.test.ts` - Tests

**Deliverables:**
- ✅ Multi-role execution
- ✅ Message queue integration
- ✅ Deadlock detection
- ✅ Global trace generation

### Phase 4: Trace Analysis (Priority: MEDIUM)

**Goal:** Execution trace analysis

**Files to create:**
1. `src/core/simulation/trace-analysis.ts` - Trace utilities
2. `src/__tests__/simulation/trace-analysis.test.ts` - Tests

**Deliverables:**
- ✅ MSC extraction
- ✅ Causality analysis
- ✅ Trace comparison

### Phase 5: Interactive Features (Priority: LOW)

**Goal:** UI integration features

**Files to create:**
1. `src/core/simulation/interactive-simulator.ts` - Interactive features
2. Breakpoints, pause/resume, etc.

**Deliverables:**
- ✅ Breakpoints
- ✅ State inspection
- ✅ Snapshot API for UI

## Example Usage

### Simple Two-Party Protocol

```typescript
// Parse protocol
const protocol = `
  protocol PingPong(role Client, role Server) {
    Client -> Server: Ping();
    Server -> Client: Pong();
  }
`;

const ast = parse(protocol);
const cfg = buildCFG(ast.declarations[0]);
const projections = projectAll(cfg);

// Create multiparty simulator
const simulator = new MultipartySimulator(projections.cfsms);

// Execute step by step
while (!simulator.isComplete()) {
  const result = simulator.step();
  console.log(`Step ${result.stepNumber}:`, result.action);
}

// Get final trace
const trace = simulator.getTrace();
console.log('Protocol completed:', trace.outcome);
```

### With Deadlock

```typescript
const deadlockProtocol = `
  protocol Deadlock(role A, role B) {
    choice at A {
      A -> B: M1();
      B -> A: M2();  // A waits for M2
    } or {
      B -> A: M3();  // B waits for M3
    }
  }
`;

// ... setup simulator

const result = simulator.run();
if (result.outcome === 'deadlock') {
  console.log('Deadlock detected at:', result.deadlockInfo);
}
```

## Academic References

1. **Deniélou, P.-M., & Yoshida, N. (2012)**
   "Multiparty Session Types Meet Communicating Automata"
   ESOP 2012, §3
   - CFSM execution semantics

2. **Honda, K., Yoshida, N., & Carbone, M. (2016)**
   "Multiparty Asynchronous Session Types"
   JACM, §4-5
   - Asynchronous execution model
   - Message queue semantics

3. **Yoshida, N., et al. (2013)**
   "The Scribble Protocol Language"
   TGC 2013
   - Practical simulation approaches

## Next Steps

1. **Start with Phase 1:** Core LTS simulator
2. **Write tests first:** TDD approach
3. **Leverage pure LTS:** Use our CFSM model directly
4. **Use LTS analysis:** Reuse `canReachTerminal()`, etc.
5. **Document thoroughly:** Formal semantics in every function

---

**Ready to implement!** 🚀
