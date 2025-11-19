# Simulation Engine Usage Examples

Complete guide to using the SMPST simulation engine for testing and debugging multiparty session type protocols.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Basic Single-Role Simulation](#basic-single-role-simulation)
3. [Distributed Multi-Role Simulation](#distributed-multi-role-simulation)
4. [Message Passing](#message-passing)
5. [Deadlock Detection](#deadlock-detection)
6. [Execution Traces](#execution-traces)
7. [Event-Driven Monitoring](#event-driven-monitoring)
8. [Interactive Step-by-Step Execution](#interactive-step-by-step-execution)
9. [Advanced: Scheduling Strategies](#advanced-scheduling-strategies)
10. [Advanced: FIFO Verification](#advanced-fifo-verification)
11. [End-to-End: Parse, Project, Simulate](#end-to-end-parse-project-simulate)

---

## Quick Start

```typescript
import { CFSMSimulator } from './src/core/simulation/cfsm-simulator';
import type { CFSM } from './src/core/projection/types';

// 1. Create CFSM (or get from projector)
const cfsm: CFSM = {
  role: 'Alice',
  states: [
    { id: 's0' },
    { id: 's1' },
  ],
  transitions: [
    {
      id: 't0',
      from: 's0',
      to: 's1',
      action: { type: 'send', to: 'Bob', label: 'Hello' },
    },
  ],
  initialState: 's0',
  terminalStates: ['s1'],
};

// 2. Create simulator
const sim = new CFSMSimulator(cfsm);

// 3. Run to completion
const result = sim.run();

console.log('Success:', result.success);
console.log('Steps:', result.steps);
```

---

## Basic Single-Role Simulation

### Example: Simple Request-Response Protocol

```typescript
import { CFSMSimulator } from './src/core/simulation/cfsm-simulator';
import type { CFSM, SendAction, ReceiveAction } from './src/core/projection/types';

// Client role: Send request, receive response
const clientCFSM: CFSM = {
  role: 'Client',
  states: [
    { id: 's0', label: 'initial' },
    { id: 's1', label: 'waiting' },
    { id: 's2', label: 'done' },
  ],
  transitions: [
    {
      id: 't0',
      from: 's0',
      to: 's1',
      action: {
        type: 'send',
        to: 'Server',
        label: 'Request',
        payloadType: 'string',
      } as SendAction,
    },
    {
      id: 't1',
      from: 's1',
      to: 's2',
      action: {
        type: 'receive',
        from: 'Server',
        label: 'Response',
        payloadType: 'string',
      } as ReceiveAction,
    },
  ],
  initialState: 's0',
  terminalStates: ['s2'],
};

// Create simulator
const sim = new CFSMSimulator(clientCFSM, {
  recordTrace: true,
  maxSteps: 100,
});

// Execute send (always enabled)
console.log('=== Step 1: Send Request ===');
let result = sim.step();
console.log('Success:', result.success);
console.log('Action:', result.action);
console.log('Current state:', sim.getState().currentState); // 's1'

// Get outgoing message
const messages = sim.getOutgoingMessages();
console.log('Outgoing message:', messages[0]);
// { from: 'Client', to: 'Server', label: 'Request', ... }

// Check enabled transitions (should be waiting for response)
console.log('\n=== Waiting for Response ===');
const enabled = sim.getEnabledTransitions();
console.log('Enabled transitions:', enabled.length); // 0 - blocked on receive

// Simulate receiving response from server
console.log('\n=== Step 2: Receive Response ===');
sim.deliverMessage({
  id: 'msg-response',
  from: 'Server',
  to: 'Client',
  label: 'Response',
  payloadType: 'string',
  timestamp: Date.now(),
});

// Now receive is enabled
result = sim.step();
console.log('Success:', result.success);
console.log('Complete:', sim.isComplete()); // true

// Get execution trace
const trace = sim.getTrace();
console.log('\n=== Execution Trace ===');
trace.events.forEach((event, i) => {
  console.log(`${i + 1}. ${event.type}: ${JSON.stringify(event)}`);
});
```

**Output:**
```
=== Step 1: Send Request ===
Success: true
Action: { type: 'send', to: 'Server', label: 'Request' }
Current state: s1

=== Waiting for Response ===
Enabled transitions: 0

=== Step 2: Receive Response ===
Success: true
Complete: true

=== Execution Trace ===
1. send: {"type":"send","to":"Server","label":"Request",...}
2. receive: {"type":"receive","from":"Server","label":"Response",...}
```

---

## Distributed Multi-Role Simulation

### Example: Three-Party Protocol (Buyer, Seller, Shipper)

```typescript
import { DistributedSimulator } from './src/core/simulation/distributed-simulator';
import type { CFSM } from './src/core/projection/types';

// Define CFSMs for each role
const buyerCFSM: CFSM = {
  role: 'Buyer',
  states: [
    { id: 's0', label: 'initial' },
    { id: 's1', label: 'ordered' },
    { id: 's2', label: 'confirmed' },
  ],
  transitions: [
    {
      id: 't0',
      from: 's0',
      to: 's1',
      action: { type: 'send', to: 'Seller', label: 'Order' },
    },
    {
      id: 't1',
      from: 's1',
      to: 's2',
      action: { type: 'receive', from: 'Shipper', label: 'Confirmation' },
    },
  ],
  initialState: 's0',
  terminalStates: ['s2'],
};

const sellerCFSM: CFSM = {
  role: 'Seller',
  states: [
    { id: 's0', label: 'initial' },
    { id: 's1', label: 'processing' },
    { id: 's2', label: 'done' },
  ],
  transitions: [
    {
      id: 't0',
      from: 's0',
      to: 's1',
      action: { type: 'receive', from: 'Buyer', label: 'Order' },
    },
    {
      id: 't1',
      from: 's1',
      to: 's2',
      action: { type: 'send', to: 'Shipper', label: 'Ship' },
    },
  ],
  initialState: 's0',
  terminalStates: ['s2'],
};

const shipperCFSM: CFSM = {
  role: 'Shipper',
  states: [
    { id: 's0', label: 'initial' },
    { id: 's1', label: 'shipping' },
    { id: 's2', label: 'done' },
  ],
  transitions: [
    {
      id: 't0',
      from: 's0',
      to: 's1',
      action: { type: 'receive', from: 'Seller', label: 'Ship' },
    },
    {
      id: 't1',
      from: 's1',
      to: 's2',
      action: { type: 'send', to: 'Buyer', label: 'Confirmation' },
    },
  ],
  initialState: 's0',
  terminalStates: ['s2'],
};

// Create distributed simulator
const cfsms = new Map<string, CFSM>([
  ['Buyer', buyerCFSM],
  ['Seller', sellerCFSM],
  ['Shipper', shipperCFSM],
]);

const sim = new DistributedSimulator(cfsms, {
  schedulingStrategy: 'round-robin',
  recordTrace: true,
  maxSteps: 100,
});

// Run to completion
console.log('=== Running Distributed Simulation ===');
const result = sim.run();

if (result.success) {
  console.log('✓ Protocol completed successfully!');
  console.log('Total global steps:', result.globalSteps);

  // Get state for each role
  const state = result.state;
  console.log('\nFinal States:');
  for (const [role, stateId] of state.roleStates) {
    console.log(`  ${role}: ${stateId}`);
  }

  // Get traces for each role
  console.log('\nExecution Traces:');
  for (const [role, trace] of result.traces) {
    console.log(`\n${role} (${trace.events.length} events):`);
    trace.events.forEach((event, i) => {
      if (event.type === 'send') {
        console.log(`  ${i + 1}. SEND ${event.label} → ${event.to}`);
      } else if (event.type === 'receive') {
        console.log(`  ${i + 1}. RECV ${event.label} ← ${event.from}`);
      }
    });
  }
} else {
  console.error('✗ Protocol failed:', result.error?.message);
}
```

**Output:**
```
=== Running Distributed Simulation ===
✓ Protocol completed successfully!
Total global steps: 4

Final States:
  Buyer: s2
  Seller: s2
  Shipper: s2

Execution Traces:

Buyer (2 events):
  1. SEND Order → Seller
  2. RECV Confirmation ← Shipper

Seller (2 events):
  1. RECV Order ← Buyer
  2. SEND Ship → Shipper

Shipper (2 events):
  1. RECV Ship ← Seller
  2. SEND Confirmation → Buyer
```

---

## Message Passing

### Example: Buffered Message Delivery

```typescript
import { CFSMSimulator } from './src/core/simulation/cfsm-simulator';
import type { Message } from './src/core/simulation/cfsm-simulator-types';

const cfsm: CFSM = {
  role: 'Receiver',
  states: [
    { id: 's0' },
    { id: 's1' },
    { id: 's2' },
    { id: 's3' },
  ],
  transitions: [
    { id: 't0', from: 's0', to: 's1', action: { type: 'receive', from: 'Alice', label: 'M1' } },
    { id: 't1', from: 's1', to: 's2', action: { type: 'receive', from: 'Alice', label: 'M2' } },
    { id: 't2', from: 's2', to: 's3', action: { type: 'receive', from: 'Bob', label: 'M3' } },
  ],
  initialState: 's0',
  terminalStates: ['s3'],
};

const sim = new CFSMSimulator(cfsm);

// Deliver messages out of order (from different senders)
console.log('=== Delivering Messages ===');

// Message from Bob (will be buffered)
sim.deliverMessage({
  id: 'msg3',
  from: 'Bob',
  to: 'Receiver',
  label: 'M3',
  timestamp: Date.now(),
});

// Messages from Alice
sim.deliverMessage({
  id: 'msg1',
  from: 'Alice',
  to: 'Receiver',
  label: 'M1',
  timestamp: Date.now() + 1,
});

sim.deliverMessage({
  id: 'msg2',
  from: 'Alice',
  to: 'Receiver',
  label: 'M2',
  timestamp: Date.now() + 2,
});

// Check buffer state
const state = sim.getState();
console.log('Buffer contents:');
console.log('  Alice queue:', state.buffer.channels.get('Alice')?.map(m => m.label));
console.log('  Bob queue:', state.buffer.channels.get('Bob')?.map(m => m.label));

// Execute receives in order
console.log('\n=== Executing Receives ===');

// Receive M1 from Alice
let result = sim.step();
console.log('1. Received:', result.action?.label); // M1

// Receive M2 from Alice
result = sim.step();
console.log('2. Received:', result.action?.label); // M2

// Receive M3 from Bob (was buffered)
result = sim.step();
console.log('3. Received:', result.action?.label); // M3

console.log('\nComplete:', sim.isComplete()); // true
```

**Output:**
```
=== Delivering Messages ===
Buffer contents:
  Alice queue: [ 'M1', 'M2' ]
  Bob queue: [ 'M3' ]

=== Executing Receives ===
1. Received: M1
2. Received: M2
3. Received: M3

Complete: true
```

---

## Deadlock Detection

### Example: Detecting Circular Wait

```typescript
import { DistributedSimulator } from './src/core/simulation/distributed-simulator';

// Deadlock scenario: Alice waits for Bob, Bob waits for Alice
const aliceCFSM: CFSM = {
  role: 'Alice',
  states: [{ id: 's0' }, { id: 's1' }],
  transitions: [
    {
      id: 't0',
      from: 's0',
      to: 's1',
      action: { type: 'receive', from: 'Bob', label: 'Start' }, // Waits for Bob
    },
  ],
  initialState: 's0',
  terminalStates: ['s1'],
};

const bobCFSM: CFSM = {
  role: 'Bob',
  states: [{ id: 's0' }, { id: 's1' }],
  transitions: [
    {
      id: 't0',
      from: 's0',
      to: 's1',
      action: { type: 'receive', from: 'Alice', label: 'Init' }, // Waits for Alice
    },
  ],
  initialState: 's0',
  terminalStates: ['s1'],
};

const cfsms = new Map([
  ['Alice', aliceCFSM],
  ['Bob', bobCFSM],
]);

const sim = new DistributedSimulator(cfsms);

console.log('=== Running Deadlocked Protocol ===');
const result = sim.run();

if (result.success) {
  console.log('✓ Completed');
} else {
  console.error('✗ Failed:', result.error?.type);

  if (result.error?.type === 'deadlock') {
    console.error('Deadlock detected!');
    console.error('Stuck roles:', result.error.roles);

    // Show state of each role
    const state = result.state;
    console.log('\nRole States:');
    for (const [role, stateId] of state.roleStates) {
      const sim = result.state;
      console.log(`  ${role}: state=${stateId}, completed=false`);
    }

    // Show what each role is waiting for
    console.log('\nEnabled Transitions:');
    for (const role of result.error.roles || []) {
      console.log(`  ${role}: no enabled transitions (waiting for message)`);
    }
  }
}
```

**Output:**
```
=== Running Deadlocked Protocol ===
✗ Failed: deadlock
Deadlock detected!
Stuck roles: [ 'Alice', 'Bob' ]

Role States:
  Alice: state=s0, completed=false
  Bob: state=s0, completed=false

Enabled Transitions:
  Alice: no enabled transitions (waiting for message)
  Bob: no enabled transitions (waiting for message)
```

---

## Execution Traces

### Example: Recording and Analyzing Traces

```typescript
import { CFSMSimulator } from './src/core/simulation/cfsm-simulator';

const cfsm: CFSM = {
  role: 'Client',
  states: [
    { id: 's0' },
    { id: 's1' },
    { id: 's2' },
    { id: 's3' },
  ],
  transitions: [
    { id: 't0', from: 's0', to: 's1', action: { type: 'send', to: 'Server', label: 'Login' } },
    { id: 't1', from: 's1', to: 's2', action: { type: 'receive', from: 'Server', label: 'Welcome' } },
    { id: 't2', from: 's2', to: 's3', action: { type: 'send', to: 'Server', label: 'Logout' } },
  ],
  initialState: 's0',
  terminalStates: ['s3'],
};

// Enable trace recording
const sim = new CFSMSimulator(cfsm, {
  recordTrace: true,
});

// Execute protocol
sim.step(); // Send Login

sim.deliverMessage({
  id: 'msg1',
  from: 'Server',
  to: 'Client',
  label: 'Welcome',
  timestamp: Date.now(),
});

sim.step(); // Receive Welcome
sim.step(); // Send Logout

// Get trace
const trace = sim.getTrace();

console.log('=== Execution Trace ===');
console.log('Role:', trace.role);
console.log('Duration:', (trace.endTime! - trace.startTime), 'ms');
console.log('Total steps:', trace.totalSteps);
console.log('Completed:', trace.completed);

console.log('\nEvents:');
trace.events.forEach((event, i) => {
  const timestamp = new Date(event.timestamp).toISOString();
  if (event.type === 'send') {
    console.log(`${i + 1}. [${timestamp}] SEND ${event.label} → ${event.to}`);
    console.log(`   State: ${event.stateId}, Message ID: ${event.messageId}`);
  } else if (event.type === 'receive') {
    console.log(`${i + 1}. [${timestamp}] RECV ${event.label} ← ${event.from}`);
    console.log(`   State: ${event.stateId}, Message ID: ${event.messageId}`);
  }
});

// Analyze trace
console.log('\n=== Trace Analysis ===');
const sends = trace.events.filter(e => e.type === 'send');
const receives = trace.events.filter(e => e.type === 'receive');
console.log('Total sends:', sends.length);
console.log('Total receives:', receives.length);

// Message latency (time between send and receive)
const sendTimes = new Map(sends.map(e => [e.label, e.timestamp]));
const receiveTimes = new Map(receives.map(e => [e.label, e.timestamp]));

console.log('\nMessage Latencies:');
for (const [label, sendTime] of sendTimes) {
  const receiveTime = receiveTimes.get(label);
  if (receiveTime) {
    console.log(`  ${label}: ${receiveTime - sendTime}ms`);
  }
}
```

---

## Event-Driven Monitoring

### Example: Real-Time Event Logging

```typescript
import { CFSMSimulator } from './src/core/simulation/cfsm-simulator';

const cfsm: CFSM = {
  role: 'Monitor',
  states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
  transitions: [
    { id: 't0', from: 's0', to: 's1', action: { type: 'send', to: 'Other', label: 'Ping' } },
    { id: 't1', from: 's1', to: 's2', action: { type: 'receive', from: 'Other', label: 'Pong' } },
  ],
  initialState: 's0',
  terminalStates: ['s2'],
};

const sim = new CFSMSimulator(cfsm);

// Subscribe to all events
console.log('=== Event Monitoring ===\n');

sim.on('step-start', (data) => {
  console.log(`▶ Step ${data.stepCount + 1} starting at state ${data.currentState}`);
});

sim.on('transition-fired', (data) => {
  console.log(`  → Transition: ${data.from} → ${data.to}`);
  console.log(`     Action: ${data.action.type}`);
});

sim.on('send', (data) => {
  console.log(`  📤 SEND: ${data.label} → ${data.to} (${data.messageId})`);
});

sim.on('receive', (data) => {
  console.log(`  📥 RECV: ${data.label} ← ${data.from} (${data.messageId})`);
});

sim.on('buffer-enqueue', (data) => {
  console.log(`  📨 Buffer: Enqueued message from ${data.from} (queue=${data.queueLength})`);
});

sim.on('buffer-dequeue', (data) => {
  console.log(`  📭 Buffer: Dequeued message from ${data.from} (remaining=${data.remainingInQueue})`);
});

sim.on('step-end', (data) => {
  console.log(`◀ Step ${data.stepCount} complete\n`);
});

sim.on('complete', (data) => {
  console.log(`✓ COMPLETE: ${data.role} finished after ${data.steps} steps\n`);
});

sim.on('deadlock', (data) => {
  console.error(`✗ DEADLOCK: ${data.role} stuck at state ${data.state}\n`);
});

// Run simulation (events will fire)
sim.step(); // Send

sim.deliverMessage({
  id: 'msg-pong',
  from: 'Other',
  to: 'Monitor',
  label: 'Pong',
  timestamp: Date.now(),
});

sim.step(); // Receive
```

**Output:**
```
=== Event Monitoring ===

▶ Step 1 starting at state s0
  → Transition: s0 → s1
     Action: send
  📤 SEND: Ping → Other (Monitor-msg-0)
◀ Step 1 complete

  📨 Buffer: Enqueued message from Other (queue=1)

▶ Step 2 starting at state s1
  → Transition: s1 → s2
     Action: receive
  📥 RECV: Pong ← Other (msg-pong)
  📭 Buffer: Dequeued message from Other (remaining=0)
✓ COMPLETE: Monitor finished after 2 steps
◀ Step 2 complete
```

---

## Interactive Step-by-Step Execution

### Example: Manual Control with State Inspection

```typescript
import { CFSMSimulator } from './src/core/simulation/cfsm-simulator';

const cfsm: CFSM = {
  role: 'Interactive',
  states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
  transitions: [
    {
      id: 't0',
      from: 's0',
      to: 's1',
      action: { type: 'tau' }, // Internal choice
    },
    {
      id: 't1',
      from: 's1',
      to: 's2',
      action: { type: 'choice', branch: 'A' },
    },
  ],
  initialState: 's0',
  terminalStates: ['s2'],
};

const sim = new CFSMSimulator(cfsm, {
  transitionStrategy: 'manual', // Require explicit selection
});

// Helper function to display state
function displayState() {
  const state = sim.getState();
  console.log('\n=== Current State ===');
  console.log('State:', state.currentState);
  console.log('Steps:', state.stepCount);
  console.log('Complete:', state.completed);
  console.log('Visited:', state.visitedStates.join(' → '));

  const enabled = state.enabledTransitions;
  console.log(`\nEnabled Transitions (${enabled.length}):`);
  enabled.forEach((t, i) => {
    console.log(`  [${i}] ${t.from} → ${t.to} (${t.action.type})`);
  });
}

// Interactive simulation
console.log('=== Interactive Simulation ===');

// Initial state
displayState();

// User selects transition 0
console.log('\n> Selecting transition 0...');
sim.selectTransition(0);
sim.step();
displayState();

// User selects transition 0 again
console.log('\n> Selecting transition 0...');
sim.selectTransition(0);
sim.step();
displayState();

console.log('\n✓ Protocol complete!');
```

**Output:**
```
=== Interactive Simulation ===

=== Current State ===
State: s0
Steps: 0
Complete: false
Visited: s0

Enabled Transitions (1):
  [0] s0 → s1 (tau)

> Selecting transition 0...

=== Current State ===
State: s1
Steps: 1
Complete: false
Visited: s0 → s1

Enabled Transitions (1):
  [0] s1 → s2 (choice)

> Selecting transition 0...

=== Current State ===
State: s2
Steps: 2
Complete: true
Visited: s0 → s1 → s2

Enabled Transitions (0):

✓ Protocol complete!
```

---

## Advanced: Scheduling Strategies

### Example: Comparing Schedulers

```typescript
import { DistributedSimulator } from './src/core/simulation/distributed-simulator';

// Create protocol with non-deterministic execution
const cfsms = new Map<string, CFSM>([
  ['Alice', aliceCFSM],
  ['Bob', bobCFSM],
  ['Carol', carolCFSM],
]);

// Test different scheduling strategies
const strategies = ['round-robin', 'random', 'fair'] as const;

for (const strategy of strategies) {
  console.log(`\n=== Strategy: ${strategy} ===`);

  const sim = new DistributedSimulator(cfsms, {
    schedulingStrategy: strategy,
    recordTrace: true,
  });

  const result = sim.run();

  if (result.success) {
    console.log('✓ Completed in', result.globalSteps, 'steps');

    // Show execution order
    const state = result.state;
    console.log('Role steps:');
    for (const [role, steps] of state.roleSteps) {
      console.log(`  ${role}: ${steps} steps`);
    }

    // With round-robin: balanced
    // With random: variable
    // With fair: always balanced
  }
}
```

---

## Advanced: FIFO Verification

### Example: Detecting FIFO Violations

```typescript
import { CFSMSimulator } from './src/core/simulation/cfsm-simulator';

const cfsm: CFSM = {
  role: 'Receiver',
  states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
  transitions: [
    { id: 't0', from: 's0', to: 's1', action: { type: 'receive', from: 'Sender', label: 'M1' } },
    { id: 't1', from: 's1', to: 's2', action: { type: 'receive', from: 'Sender', label: 'M2' } },
  ],
  initialState: 's0',
  terminalStates: ['s2'],
};

// Enable FIFO verification (Theorem 5.3, Honda et al. 2016)
const sim = new CFSMSimulator(cfsm, {
  verifyFIFO: true, // Runtime verification
});

// Deliver messages in order
console.log('=== Valid FIFO Order ===');
sim.deliverMessage({
  id: 'msg1',
  from: 'Sender',
  to: 'Receiver',
  label: 'M1',
  timestamp: 100,
});

sim.deliverMessage({
  id: 'msg2',
  from: 'Sender',
  to: 'Receiver',
  label: 'M2',
  timestamp: 200,
});

let result = sim.step();
console.log('Received M1:', result.success); // true

result = sim.step();
console.log('Received M2:', result.success); // true

// Test FIFO violation (for demonstration)
console.log('\n=== FIFO Violation Test ===');
sim.reset();

// Deliver M2 with earlier timestamp than M1 (FIFO violation)
sim.deliverMessage({
  id: 'msg2-early',
  from: 'Sender',
  to: 'Receiver',
  label: 'M2',
  timestamp: 50, // Earlier!
});

sim.deliverMessage({
  id: 'msg1-late',
  from: 'Sender',
  to: 'Receiver',
  label: 'M1',
  timestamp: 100,
});

// Attempt to receive (FIFO property will be checked)
result = sim.step();
if (!result.success && result.error?.type === 'fifo-violation') {
  console.error('✗ FIFO violation detected!');
  console.error('Message:', result.error.message);
  console.error('Details:', result.error.details);
}
```

---

## End-to-End: Parse, Project, Simulate

### Example: Complete Pipeline

```typescript
import { parse } from './src/core/parser';
import { project } from './src/core/projection/projector';
import { DistributedSimulator } from './src/core/simulation/distributed-simulator';

async function simulateProtocol(protocolFile: string) {
  console.log('=== End-to-End Simulation ===\n');

  // Step 1: Parse protocol
  console.log('1. Parsing protocol...');
  const ast = await parse(protocolFile);
  console.log('   ✓ Parsed successfully');

  // Step 2: Extract global type
  console.log('2. Extracting global type...');
  const globalType = ast.declarations.find(d => d.type === 'GlobalProtocol');
  if (!globalType) {
    throw new Error('No global protocol found');
  }
  console.log(`   ✓ Found protocol: ${globalType.name}`);

  // Step 3: Project to CFSMs
  console.log('3. Projecting to CFSMs...');
  const cfsms = project(globalType);
  console.log(`   ✓ Projected ${cfsms.size} roles:`, Array.from(cfsms.keys()).join(', '));

  // Step 4: Simulate
  console.log('4. Running simulation...');
  const sim = new DistributedSimulator(cfsms, {
    schedulingStrategy: 'round-robin',
    recordTrace: true,
  });

  const result = sim.run();

  if (result.success) {
    console.log('   ✓ Simulation completed successfully!');
    console.log(`   Total steps: ${result.globalSteps}`);

    // Show results
    console.log('\n=== Results ===');
    for (const [role, trace] of result.traces) {
      console.log(`${role}:`);
      console.log(`  Steps: ${trace.totalSteps}`);
      console.log(`  Events: ${trace.events.length}`);
      console.log(`  Completed: ${trace.completed}`);
    }

    return { success: true, result };
  } else {
    console.error('   ✗ Simulation failed:', result.error?.message);

    if (result.error?.type === 'deadlock') {
      console.error('\nDeadlock Analysis:');
      console.error('Stuck roles:', result.error.roles);

      // Show traces up to deadlock
      console.error('\nTraces at deadlock:');
      for (const [role, trace] of result.traces) {
        console.error(`${role}: ${trace.events.length} events`);
      }
    }

    return { success: false, error: result.error };
  }
}

// Usage
simulateProtocol('examples/buyer-seller.smp').then(result => {
  if (result.success) {
    console.log('\n✓ Protocol is valid and deadlock-free!');
  } else {
    console.error('\n✗ Protocol has issues that need fixing.');
  }
});
```

---

## Summary

The SMPST simulation engine provides:

✅ **Single-role execution** (`CFSMSimulator`)
✅ **Multi-role coordination** (`DistributedSimulator`)
✅ **Message buffering** (FIFO channels)
✅ **Deadlock detection** (local and global)
✅ **Execution traces** (recording and analysis)
✅ **Event system** (real-time monitoring)
✅ **Interactive control** (step-by-step, manual selection)
✅ **Scheduling strategies** (round-robin, random, fair)
✅ **FIFO verification** (Theorem 5.3 from Honda et al. 2016)

For more information:
- Implementation: `/src/core/simulation/`
- Types: `/src/core/simulation/cfsm-simulator-types.ts`
- Tests: `/src/core/simulation/*.test.ts`
- Status: `/docs/implementation/simulation-status.md`
