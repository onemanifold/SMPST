/**
 * CFSM Executor Tests
 *
 * Tests single-role state machine execution.
 * Following TDD: write tests first, then implement.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '../parser/parser';
import { buildCFG } from '../cfg/builder';
import { project } from '../projection/projector';
import { Executor } from './executor';
import { createInMemoryTransport } from './transport';
import type { Message, ExecutionState, ExecutionObserver } from './types';

// ============================================================================
// Basic Execution Tests
// ============================================================================

describe('CFSM Executor - Basic Execution', () => {
  it('should initialize at initial state', () => {
    const source = `
      protocol Simple(role A, role B) {
        A -> B: Message();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'A');
    const transport = createInMemoryTransport();

    const executor = new Executor({ role: 'A', cfsm, transport });
    const state = executor.getState();

    expect(state.role).toBe('A');
    expect(state.currentState).toBe(cfsm.initialState);
    expect(state.completed).toBe(false);
    expect(state.blocked).toBe(false);
  });

  it('should execute send action', async () => {
    const source = `
      protocol SimpleSend(role A, role B) {
        A -> B: Request();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'A');
    const transport = createInMemoryTransport();

    const executor = new Executor({ role: 'A', cfsm, transport });

    // Execute one step (should send message)
    const result = await executor.step();

    expect(result.success).toBe(true);
    expect(result.messagesSent).toBeDefined();
    expect(result.messagesSent!.length).toBe(1);
    expect(result.messagesSent![0].label).toBe('Request');
    expect(result.messagesSent![0].from).toBe('A');
    expect(result.messagesSent![0].to).toBe('B');
  });

  it('should execute receive action', async () => {
    const source = `
      protocol SimpleReceive(role A, role B) {
        A -> B: Message();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'B');
    const transport = createInMemoryTransport();

    // Pre-deliver message
    await transport.send({
      id: 'm1',
      from: 'A',
      to: 'B',
      label: 'Message',
      timestamp: Date.now(),
    });

    const executor = new Executor({ role: 'B', cfsm, transport });

    // Execute one step (should receive message)
    const result = await executor.step();

    expect(result.success).toBe(true);
    expect(result.messagesConsumed).toBeDefined();
    expect(result.messagesConsumed!.length).toBe(1);
    expect(result.messagesConsumed![0].label).toBe('Message');
  });

  it('should reach terminal state', async () => {
    const source = `
      protocol RequestResponse(role Client, role Server) {
        Client -> Server: Request();
        Server -> Client: Response();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'Client');
    const transport = createInMemoryTransport();

    const executor = new Executor({ role: 'Client', cfsm, transport });

    // Step 1: Send request
    await executor.step();

    // Pre-deliver response
    await transport.send({
      id: 'm2',
      from: 'Server',
      to: 'Client',
      label: 'Response',
      timestamp: Date.now(),
    });

    // Step 2: Receive response
    await executor.step();

    const state = executor.getState();
    expect(state.completed).toBe(true);
    expect(cfsm.terminalStates).toContain(state.currentState);
  });
});

// ============================================================================
// Choice Execution Tests
// ============================================================================

describe('CFSM Executor - Choice', () => {
  it('should execute internal choice (sender decides)', async () => {
    const source = `
      protocol Choice(role A, role B) {
        choice at A {
          A -> B: Option1();
        } or {
          A -> B: Option2();
        }
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'A');
    const transport = createInMemoryTransport();

    const executor = new Executor({ role: 'A', cfsm, transport });

    // Execute - should pick one of the branches
    const result = await executor.step();

    expect(result.success).toBe(true);
    expect(result.messagesSent).toBeDefined();
    expect(result.messagesSent!.length).toBe(1);

    const label = result.messagesSent![0].label;
    expect(['Option1', 'Option2']).toContain(label);
  });

  it('should execute external choice (receiver reacts)', async () => {
    const source = `
      protocol Choice(role A, role B) {
        choice at A {
          A -> B: Option1();
        } or {
          A -> B: Option2();
        }
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'B');
    const transport = createInMemoryTransport();

    // Pre-deliver Option1
    await transport.send({
      id: 'm1',
      from: 'A',
      to: 'B',
      label: 'Option1',
      timestamp: Date.now(),
    });

    const executor = new Executor({ role: 'B', cfsm, transport });

    // Should receive Option1 and follow that branch
    const result = await executor.step();

    expect(result.success).toBe(true);
    expect(result.messagesConsumed![0].label).toBe('Option1');
  });
});

// ============================================================================
// Parallel Execution Tests
// ============================================================================

describe('CFSM Executor - Parallel', () => {
  it('should handle role in single branch (sequential)', async () => {
    const source = `
      protocol ParallelSingle(role A, role B, role C) {
        par {
          A -> B: M1();
        } and {
          C -> C: M2();
        }
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'A');
    const transport = createInMemoryTransport();

    const executor = new Executor({ role: 'A', cfsm, transport });

    // A only in one branch, so execution is sequential
    const result = await executor.step();

    expect(result.success).toBe(true);
    expect(result.messagesSent!.length).toBe(1);
  });

  it('should handle role in multiple branches (concurrent)', async () => {
    const source = `
      protocol ParallelMultiple(role A, role B, role C) {
        par {
          A -> B: M1();
        } and {
          A -> C: M2();
        }
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'A');
    const transport = createInMemoryTransport();

    const executor = new Executor({ role: 'A', cfsm, transport });

    // Should enter fork
    await executor.step();

    // Should send both messages (in some order)
    const result1 = await executor.step();
    const result2 = await executor.step();

    const labels = [
      result1.messagesSent![0]?.label,
      result2.messagesSent![0]?.label,
    ];

    expect(labels).toContain('M1');
    expect(labels).toContain('M2');
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('CFSM Executor - Error Handling', () => {
  it('should detect protocol violation (wrong message)', async () => {
    const source = `
      protocol Strict(role A, role B) {
        A -> B: Expected();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'B');
    const transport = createInMemoryTransport();

    // Deliver WRONG message
    await transport.send({
      id: 'm1',
      from: 'A',
      to: 'B',
      label: 'WrongMessage',
      timestamp: Date.now(),
    });

    const executor = new Executor({
      role: 'B',
      cfsm,
      transport,
      options: { strictMode: true },
    });

    const result = await executor.step();

    expect(result.success).toBe(false);
    expect(result.error?.type).toBe('protocol-violation');
  });

  it('should block when message not ready', async () => {
    const source = `
      protocol BlockTest(role A, role B) {
        A -> B: Message();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'B');
    const transport = createInMemoryTransport();

    const executor = new Executor({ role: 'B', cfsm, transport });

    // Try to step without message available
    const result = await executor.step();

    expect(result.success).toBe(false);
    expect(result.error?.type).toBe('message-not-ready');

    const state = executor.getState();
    expect(state.blocked).toBe(true);
  });

  it('should prevent execution after terminal', async () => {
    const source = `
      protocol Simple(role A, role B) {
        A -> B: Message();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'A');
    const transport = createInMemoryTransport();

    const executor = new Executor({ role: 'A', cfsm, transport });

    // Execute to completion
    await executor.step();  // Send message
    await executor.step();  // Reach terminal

    // Try to step again
    const result = await executor.step();

    expect(result.success).toBe(false);
    expect(result.error?.type).toBe('already-completed');
  });
});

// ============================================================================
// Observer Pattern Tests
// ============================================================================

describe('CFSM Executor - Observers', () => {
  it('should notify observer on state change', async () => {
    const source = `
      protocol ObserverTest(role A, role B) {
        A -> B: Message();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'A');
    const transport = createInMemoryTransport();

    let stateChanges = 0;
    let lastEvent: any = null;

    const observer: ExecutionObserver = {
      onStateChange: (event) => {
        stateChanges++;
        lastEvent = event;
      },
    };

    const executor = new Executor({
      role: 'A',
      cfsm,
      transport,
      observers: [observer],
    });

    await executor.step();

    expect(stateChanges).toBeGreaterThan(0);
    expect(lastEvent).toBeDefined();
    expect(lastEvent.role).toBe('A');
  });

  it('should notify observer on message sent', async () => {
    const source = `
      protocol MessageTest(role A, role B) {
        A -> B: Request();
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'A');
    const transport = createInMemoryTransport();

    let messagesSent = 0;
    let lastMessage: any = null;

    const observer: ExecutionObserver = {
      onMessageSent: (event) => {
        messagesSent++;
        lastMessage = event.message;
      },
    };

    const executor = new Executor({
      role: 'A',
      cfsm,
      transport,
      observers: [observer],
    });

    await executor.step();

    expect(messagesSent).toBe(1);
    expect(lastMessage.label).toBe('Request');
  });
});

// ============================================================================
// Recursion Tests
// ============================================================================

describe('CFSM Executor - Recursion', () => {
  it('should execute simple recursion loop', async () => {
    const source = `
      protocol Loop(role A, role B) {
        rec Loop {
          A -> B: Data();
          continue Loop;
        }
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'A');
    const transport = createInMemoryTransport();

    const executor = new Executor({
      role: 'A',
      cfsm,
      transport,
      options: { maxSteps: 5 },  // Prevent infinite loop
    });

    // Should execute 5 iterations
    for (let i = 0; i < 5; i++) {
      const result = await executor.step();
      expect(result.success).toBe(true);
      expect(result.messagesSent![0].label).toBe('Data');
    }

    const state = executor.getState();
    expect(state.visitedStates.length).toBeGreaterThan(5);
  });

  it('should execute conditional recursion with exit', async () => {
    const source = `
      protocol ConditionalLoop(role A, role B) {
        rec Loop {
          choice at A {
            A -> B: Continue();
            continue Loop;
          } or {
            A -> B: Stop();
          }
        }
      }
    `;
    const cfg = buildCFG(parse(source).declarations[0]);
    const cfsm = project(cfg, 'A');
    const transport = createInMemoryTransport();

    const executor = new Executor({
      role: 'A',
      cfsm,
      transport,
      options: { maxSteps: 10 },
    });

    // Execute - should eventually pick "Stop" branch
    let steps = 0;
    while (!executor.getState().completed && steps < 10) {
      await executor.step();
      steps++;
    }

    // Should have completed (picked Stop branch at some point)
    expect(steps).toBeLessThan(10);
  });
});
