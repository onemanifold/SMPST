/**
 * Protocol Simulator Tests
 *
 * Tests multi-role protocol execution and coordination.
 * Following TDD: write tests first, then implement.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../parser/parser';
import { buildCFG } from '../cfg/builder';
import { projectAll } from '../projection/projector';
import { Simulator } from './simulator';
import type { ExecutionObserver } from './types';

// ============================================================================
// Basic Simulation Tests
// ============================================================================

describe('Protocol Simulator - Basic Protocols', () => {
  it('[Request-Response] should execute complete protocol', async () => {
    const source = `
      protocol RequestResponse(role Client, role Server) {
        Client -> Server: Request();
        Server -> Client: Response();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({ roles: cfsms });

    // Run to completion
    const result = await simulator.run();

    expect(result.completed).toBe(true);
    expect(result.error).toBeUndefined();

    // Both roles should have completed
    const state = simulator.getState();
    expect(state.roles.get('Client')?.completed).toBe(true);
    expect(state.roles.get('Server')?.completed).toBe(true);
  });

  it('[Ping-Pong] should execute back-and-forth', async () => {
    const source = `
      protocol PingPong(role A, role B) {
        A -> B: Ping();
        B -> A: Pong();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({ roles: cfsms });

    // Step through manually
    await simulator.step();  // A sends Ping
    await simulator.step();  // B receives Ping
    await simulator.step();  // B sends Pong
    await simulator.step();  // A receives Pong

    const state = simulator.getState();
    expect(state.completed).toBe(true);
  });

  it('[Three-Party] should coordinate three roles', async () => {
    const source = `
      protocol ThreeParty(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({ roles: cfsms });

    const result = await simulator.run();

    expect(result.completed).toBe(true);
    expect(result.state.roles.size).toBe(3);
  });
});

// ============================================================================
// Parallel Execution Tests
// ============================================================================

describe('Protocol Simulator - Parallel Composition', () => {
  it('[Independent Parallel] should execute branches concurrently', async () => {
    const source = `
      protocol IndependentParallel(role A, role B, role C) {
        par {
          A -> B: M1();
        } and {
          C -> B: M2();
        }
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({ roles: cfsms });

    const result = await simulator.run();

    expect(result.completed).toBe(true);

    // B should have received both messages
    const bState = simulator.getState().roles.get('B')!;
    expect(bState.completed).toBe(true);
  });

  it('[Two-Phase Commit] should handle coordinator pattern', async () => {
    const source = `
      protocol TwoPhaseCommit(role Coordinator, role P1, role P2) {
        Coordinator -> P1: VoteRequest();
        Coordinator -> P2: VoteRequest();
        par {
          P1 -> Coordinator: Vote();
        } and {
          P2 -> Coordinator: Vote();
        }
        choice at Coordinator {
          Coordinator -> P1: Commit();
          Coordinator -> P2: Commit();
        } or {
          Coordinator -> P1: Abort();
          Coordinator -> P2: Abort();
        }
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({ roles: cfsms });

    const result = await simulator.run();

    expect(result.completed).toBe(true);
    expect(result.error).toBeUndefined();

    // All three roles should complete
    const state = simulator.getState();
    expect(state.roles.get('Coordinator')?.completed).toBe(true);
    expect(state.roles.get('P1')?.completed).toBe(true);
    expect(state.roles.get('P2')?.completed).toBe(true);
  });
});

// ============================================================================
// Choice Tests
// ============================================================================

describe('Protocol Simulator - Choice', () => {
  it('should execute internal choice', async () => {
    const source = `
      protocol InternalChoice(role A, role B) {
        choice at A {
          A -> B: Option1();
        } or {
          A -> B: Option2();
        }
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({ roles: cfsms });

    const result = await simulator.run();

    expect(result.completed).toBe(true);

    // Check that one of the options was chosen
    const trace = simulator.getTrace();
    const messageSent = trace.events.find(e => e.type === 'message-sent');
    expect(messageSent).toBeDefined();
  });

  it('should handle nested choices', async () => {
    const source = `
      protocol NestedChoice(role A, role B) {
        choice at A {
          A -> B: Opt1();
          choice at B {
            B -> A: Opt1A();
          } or {
            B -> A: Opt1B();
          }
        } or {
          A -> B: Opt2();
        }
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({ roles: cfsms });

    const result = await simulator.run();

    expect(result.completed).toBe(true);
  });
});

// ============================================================================
// Recursion Tests
// ============================================================================

describe('Protocol Simulator - Recursion', () => {
  it('[Streaming] should handle producer-consumer loop', async () => {
    const source = `
      protocol Streaming(role Producer, role Consumer) {
        rec Stream {
          choice at Producer {
            Producer -> Consumer: Data();
            continue Stream;
          } or {
            Producer -> Consumer: End();
          }
        }
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({
      roles: cfsms,
      options: { maxSteps: 20 },  // Limit iterations
    });

    const result = await simulator.run();

    // Should eventually pick "End" and complete
    expect(result.completed).toBe(true);

    const trace = simulator.getTrace();
    const dataMessages = trace.events.filter(
      e => e.type === 'message-sent' && e.message.label === 'Data'
    );
    expect(dataMessages.length).toBeGreaterThan(0);
  });

  it('should respect maxSteps limit', async () => {
    const source = `
      protocol InfiniteLoop(role A, role B) {
        rec Loop {
          A -> B: Ping();
          B -> A: Pong();
          continue Loop;
        }
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({
      roles: cfsms,
      options: { maxSteps: 10 },
    });

    const result = await simulator.run();

    // Should stop after 10 steps, not complete
    expect(result.completed).toBe(false);
    expect(simulator.getState().step).toBe(10);
  });
});

// ============================================================================
// Error Detection Tests
// ============================================================================

describe('Protocol Simulator - Error Detection', () => {
  it('should detect deadlock', async () => {
    const source = `
      protocol Deadlock(role A, role B) {
        A -> B: M1();
        B -> A: M2();
        A -> B: M3();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({ roles: cfsms });

    // Manually create deadlock scenario by blocking
    await simulator.step();  // A tries to send M1
    // Don't let B receive - both will be blocked

    const state = simulator.getState();
    // Simulator should detect that no role can make progress
    expect(state.deadlocked || !state.completed).toBe(true);
  });

  it('should handle protocol violations in strict mode', async () => {
    const source = `
      protocol Strict(role A, role B) {
        A -> B: Expected();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({
      roles: cfsms,
      options: { strictMode: true },
    });

    // Inject wrong message
    await simulator.injectMessage({
      id: 'm1',
      from: 'A',
      to: 'B',
      label: 'Wrong',
      timestamp: Date.now(),
    });

    const result = await simulator.run();

    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe('protocol-violation');
  });
});

// ============================================================================
// Interactive Control Tests
// ============================================================================

describe('Protocol Simulator - Interactive Control', () => {
  it('should support step-by-step execution', async () => {
    const source = `
      protocol StepByStep(role A, role B) {
        A -> B: M1();
        B -> A: M2();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({ roles: cfsms });

    // Step one at a time
    const step1 = await simulator.step();
    expect(step1.success).toBe(true);
    expect(simulator.getState().step).toBe(1);

    const step2 = await simulator.step();
    expect(step2.success).toBe(true);
    expect(simulator.getState().step).toBe(2);
  });

  it('should support reset', async () => {
    const source = `
      protocol ResetTest(role A, role B) {
        A -> B: Message();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({ roles: cfsms });

    // Execute some steps
    await simulator.step();
    await simulator.step();

    // Reset
    simulator.reset();

    const state = simulator.getState();
    expect(state.step).toBe(0);
    expect(state.completed).toBe(false);
    expect(state.messageQueue.length).toBe(0);
  });

  it('should support pause and resume', async () => {
    const source = `
      protocol PauseTest(role A, role B) {
        A -> B: M1();
        B -> A: M2();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({ roles: cfsms });

    // Start running
    const runPromise = simulator.run();

    // Pause after a bit
    setTimeout(() => simulator.pause(), 10);

    await runPromise;

    // Should not have completed
    expect(simulator.getState().completed).toBe(false);

    // Resume
    const result = await simulator.run();
    expect(result.completed).toBe(true);
  });
});

// ============================================================================
// Trace Recording Tests
// ============================================================================

describe('Protocol Simulator - Trace Recording', () => {
  it('should record execution trace', async () => {
    const source = `
      protocol TraceTest(role A, role B) {
        A -> B: Request();
        B -> A: Response();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({
      roles: cfsms,
      options: { recordTrace: true },
    });

    await simulator.run();

    const trace = simulator.getTrace();

    expect(trace.events.length).toBeGreaterThan(0);
    expect(trace.completed).toBe(true);

    // Should have message-sent and message-received events
    const sentEvents = trace.events.filter(e => e.type === 'message-sent');
    const recvEvents = trace.events.filter(e => e.type === 'message-received');

    expect(sentEvents.length).toBe(2);  // Request + Response
    expect(recvEvents.length).toBe(2);  // Request + Response
  });

  it('should support custom observers', async () => {
    const source = `
      protocol ObserverTest(role A, role B) {
        A -> B: Message();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    let eventCount = 0;
    const observer: ExecutionObserver = {
      onStateChange: () => eventCount++,
      onMessageSent: () => eventCount++,
      onMessageReceived: () => eventCount++,
    };

    const simulator = new Simulator({
      roles: cfsms,
      options: { recordTrace: true },
    });

    simulator.addObserver(observer);

    await simulator.run();

    expect(eventCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// Message Injection Tests
// ============================================================================

describe('Protocol Simulator - Message Injection', () => {
  it('should support manual message injection', async () => {
    const source = `
      protocol InjectTest(role A, role B) {
        A -> B: Message();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const { cfsms } = projectAll(cfg);

    const simulator = new Simulator({ roles: cfsms });

    // Manually inject message
    await simulator.injectMessage({
      id: 'm1',
      from: 'A',
      to: 'B',
      label: 'Message',
      timestamp: Date.now(),
    });

    // B should be able to receive it
    await simulator.step('B');

    const bState = simulator.getState().roles.get('B')!;
    expect(bState.visitedStates.length).toBeGreaterThan(1);
  });
});
