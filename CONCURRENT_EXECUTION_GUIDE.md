# Concurrent Execution Architecture - Usage Guide

## Overview

The simulator now supports **true concurrent execution** where all roles run in parallel, coordinating via channels. This is the intended execution model for distributed simulation.

## Quick Start

```typescript
import { DistributedSimulator } from './core/simulation/distributed-simulator';
import { projectAll } from './core/projection/projector';

// 1. Project protocol to CFSMs
const { cfsms } = projectAll(cfg);

// 2. Create distributed simulator
const simulator = new DistributedSimulator(cfsms);

// 3. Run concurrently (NEW!)
const result = await simulator.runConcurrent();

if (result.success) {
  console.log('✅ Protocol completed successfully');
  console.log('Global steps:', result.globalSteps);
} else {
  console.log('❌ Execution failed:', result.error);
}
```

## Execution Modes

### Concurrent Mode (NEW) - True Distributed Execution

```typescript
// All CFSMs run in parallel
await simulator.runConcurrent();
```

**Characteristics:**
- ✅ All roles execute concurrently via `Promise.all()`
- ✅ Natural blocking on `receive()` - no polling
- ✅ Order emerges from protocol dependencies
- ✅ Deadlocks surface naturally (from bad protocols)
- ✅ Validates liveness properties
- ✅ Matches MPST formal semantics

**Use When:**
- Testing for concurrency bugs
- Validating deadlock-freedom
- Testing liveness properties
- Production distributed execution

### Sequential Mode (Existing) - Deterministic Testing

```typescript
// One role at a time
while (!simulator.isComplete()) {
  await simulator.step();
}
```

**Characteristics:**
- One role executes per step
- Scheduler controls order
- Deterministic (same input → same order)
- Uses `hasMessage()` to avoid blocking

**Use When:**
- Debugging specific execution paths
- Writing deterministic tests
- Interactive stepping through execution

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│  UI Layer (Svelte Stores)                      │
│  - simulation.ts                                │
│  - Playback controls, mode switching            │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Coordinator Layer                              │
│  - DistributedSimulator                         │
│  - Creates channels, wires CFSMs                │
│  - runConcurrent() or step()                    │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Debugging Layer (Optional)                     │
│  - CFSMDebugger (wraps executor)                │
│  - Time-travel, snapshots, history              │
│  - Event annotation with step numbers           │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Execution Layer                                │
│  - CFSMExecutor (pure runtime)                  │
│  - Autonomous execution via run()               │
│  - Event-driven (emits ready/send/receive)      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Channel Layer                                  │
│  - Async FIFO channels                          │
│  - Send (async, non-blocking)                   │
│  - Receive (blocks until available)             │
└─────────────────────────────────────────────────┘
```

## Using CFSMExecutor Directly

For custom scenarios, use the pure executor:

```typescript
import { CFSMExecutor } from './core/simulation/cfsm-executor';

const executor = new CFSMExecutor(cfsm, {
  channels: channelMap,
  maxSteps: 1000,
});

// Listen to events
executor.on('send', (event) => {
  console.log(`${event.from} → ${event.to}: ${event.label}`);
});

executor.on('receive', (event) => {
  console.log(`${event.from} received from ${event.to}`);
});

executor.on('complete', () => {
  console.log('Role completed!');
});

// Run autonomously
await executor.run();
```

## Using CFSMDebugger

Add time-travel debugging to executor:

```typescript
import { CFSMDebugger } from './core/simulation/cfsm-debugger';

const debugger = new CFSMDebugger(cfsm, {
  channels: channelMap,
  maxSnapshots: 1000,
  recordTrace: true,
});

// Step forward
await debugger.stepForward();
console.log('Step:', debugger.getCurrentStepNumber());

// Step backward (time-travel)
debugger.stepBackward();

// Get execution events
const events = debugger.getEvents();
console.log('Event history:', events);

// Or run to completion (with history recording)
await debugger.run();
```

## Event-Driven Coordination

Roles emit events that the coordinator observes:

```typescript
const simulator = new DistributedSimulator(cfsms);

// Get individual simulators
for (const [role, sim] of simulator.getSimulators()) {
  // Listen to role events
  sim.on('send', (event) => {
    console.log(`[${role}] Send:`, event);
  });

  sim.on('receive', (event) => {
    console.log(`[${role}] Receive:`, event);
  });

  sim.on('complete', () => {
    console.log(`[${role}] Completed!`);
  });
}

// Run concurrently - roles coordinate via channels
await simulator.runConcurrent();
```

## Deadlock Detection

Concurrent mode naturally surfaces deadlocks:

```typescript
// Bad protocol with circular wait:
// A waits for B, B waits for C, C waits for A

const result = await simulator.runConcurrent();

if (!result.success && result.error?.type === 'deadlock') {
  console.log('Deadlock detected!');
  console.log('Stuck roles:', result.error.roles);
  console.log('This is a protocol bug, not implementation bug');
}
```

## Testing Concurrent Execution

```typescript
import { describe, it, expect } from 'vitest';

describe('Concurrent Execution', () => {
  it('should handle ping-pong protocol concurrently', async () => {
    const { cfsms } = projectAll(pingPongCFG);
    const simulator = new DistributedSimulator(cfsms);

    // Run all roles in parallel
    const result = await simulator.runConcurrent();

    expect(result.success).toBe(true);
    expect(result.state.allCompleted).toBe(true);
    expect(result.state.deadlocked).toBe(false);
  });

  it('should surface deadlock from bad protocol', async () => {
    const { cfsms } = projectAll(deadlockCFG);
    const simulator = new DistributedSimulator(cfsms);

    // Deadlock will be detected naturally
    const result = await simulator.runConcurrent();

    expect(result.success).toBe(false);
    expect(result.error?.type).toBe('deadlock');
  });
});
```

## Key Differences: Sequential vs Concurrent

| Aspect | Sequential | Concurrent |
|--------|-----------|------------|
| **Method** | `step()` or `run()` | `runConcurrent()` |
| **Parallelism** | One role at a time | All roles in parallel |
| **Blocking** | Avoided with `hasMessage()` | Natural on `receive()` |
| **Order** | Imposed by scheduler | Emerges from protocol |
| **Determinism** | Same input → same order | Emergent (may vary) |
| **Deadlock** | Detected by polling | Surfaces naturally |
| **Use Case** | Testing, debugging | Production, validation |

## Advanced: Custom Schedulers

For sequential mode, customize scheduling:

```typescript
const simulator = new DistributedSimulator(cfsms, {
  schedulingStrategy: 'round-robin',  // or 'fair', 'random'
});

// Sequential stepping with custom scheduler
while (!simulator.isComplete()) {
  await simulator.step();
}
```

## Channel Semantics

Channels implement MPST formal semantics:

```typescript
// Send: ASYNC (non-blocking)
await channel.send(message);  // Returns immediately
console.log('Send completed (queued)');

// Receive: BLOCKING (waits for message)
const msg = await channel.receive();  // Blocks until available
console.log('Message received:', msg);

// Check availability (for sequential mode only)
if (channel.hasMessage()) {
  const msg = await channel.receive();  // Won't block
}
```

## Best Practices

### ✅ DO:
- Use `runConcurrent()` for validating protocols
- Use sequential `step()` for debugging specific paths
- Listen to events for observability
- Let channels coordinate roles (don't mediate)
- Test both modes (concurrent for bugs, sequential for determinism)

### ❌ DON'T:
- Don't poll in concurrent mode (let `receive()` block)
- Don't use `hasMessage()` in concurrent mode (only for sequential)
- Don't try to control order in concurrent mode (let it emerge)
- Don't use concurrent mode for deterministic testing

## Migration from Old API

If you're using the old sequential API, no changes needed!

```typescript
// Old code still works
const simulator = new DistributedSimulator(cfsms);
while (!simulator.isComplete()) {
  await simulator.step();
}
```

To adopt concurrent execution:

```typescript
// New concurrent mode
const simulator = new DistributedSimulator(cfsms);
const result = await simulator.runConcurrent();
```

## Troubleshooting

### "Tests timeout in concurrent mode"

Your protocol has a deadlock! This is detected by the timeout:

```typescript
// Set custom timeout for concurrent execution
const result = await Promise.race([
  simulator.runConcurrent(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), 5000)
  ),
]);
```

### "Results non-deterministic"

This is expected in concurrent mode - order emerges from protocol timing:

```typescript
// For deterministic tests, use sequential mode
while (!simulator.isComplete()) {
  await simulator.step();
}
```

### "hasMessage() not working"

`hasMessage()` is for sequential mode only:

```typescript
// Sequential: check before receive
if (channel.hasMessage()) {
  const msg = await channel.receive();
}

// Concurrent: just await (will block)
const msg = await channel.receive();
```

## Examples

See tests for complete examples:
- `src/core/simulation/distributed-simulator.test.ts` - Sequential mode
- `src/core/__tests__/end-to-end.test.ts` - Full pipeline
- `src/core/__tests__/protocol-examples.test.ts` - Real protocols

## Performance Considerations

**Concurrent Mode:**
- ✅ Faster (roles run in parallel)
- ✅ Better resource utilization
- ❌ Non-deterministic (timing-dependent)
- ❌ Harder to debug specific paths

**Sequential Mode:**
- ✅ Deterministic (reproducible)
- ✅ Easier to debug (controlled order)
- ❌ Slower (one role at a time)
- ❌ Doesn't test true concurrency

## Summary

The concurrent execution architecture enables:
1. **True distributed execution** - roles run in parallel
2. **Protocol validation** - surfaces concurrency bugs
3. **Clean separation** - executor (runtime) vs debugger (history)
4. **Event-driven** - coordinator observes, doesn't control
5. **MPST semantics** - matches formal model correctly

Start with `runConcurrent()` to validate your protocols! 🚀
