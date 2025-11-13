/**
 * CFG Simulator Tests (Orchestration-based)
 *
 * Tests centralized execution from global CFG.
 * This validates CFG structure correctness before projection.
 *
 * Following TDD: write tests FIRST, then implement.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '../parser/parser';
import { buildCFG } from '../cfg/builder';
import { CFGSimulator } from './cfg-simulator';
import type { CFGExecutionEvent } from './types';

// ============================================================================
// Basic Sequential Protocols
// ============================================================================

describe('CFG Simulator - Basic Sequential Protocols', () => {
  it('[Request-Response] should execute two-message protocol', () => {
    const source = `
      protocol RequestResponse(role Client, role Server) {
        Client -> Server: Request();
        Server -> Client: Response();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    expect(simulator.isComplete()).toBe(false);

    // Step 1: Client sends Request
    const step1 = simulator.step();
    expect(step1.success).toBe(true);
    expect(step1.event?.type).toBe('message');
    if (step1.event?.type === 'message') {
      expect(step1.event.from).toBe('Client');
      expect(step1.event.to).toBe('Server');
      expect(step1.event.label).toBe('Request');
    }

    // Step 2: Server sends Response
    const step2 = simulator.step();
    expect(step2.success).toBe(true);
    expect(step2.event?.type).toBe('message');
    if (step2.event?.type === 'message') {
      expect(step2.event.from).toBe('Server');
      expect(step2.event.to).toBe('Client');
      expect(step2.event.label).toBe('Response');
    }

    // Should be complete
    expect(simulator.isComplete()).toBe(true);

    // No more steps
    const step3 = simulator.step();
    expect(step3.success).toBe(false);
  });

  it('[Ping-Pong] should execute back-and-forth messages', () => {
    const source = `
      protocol PingPong(role A, role B) {
        A -> B: Ping();
        B -> A: Pong();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    simulator.step(); // A -> B: Ping
    simulator.step(); // B -> A: Pong

    expect(simulator.isComplete()).toBe(true);
  });

  it('[Three-Party] should handle three-role protocol', () => {
    const source = `
      protocol ThreeParty(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    const step1 = simulator.step();
    const step2 = simulator.step();
    const step3 = simulator.step();

    expect(step1.success).toBe(true);
    expect(step2.success).toBe(true);
    expect(step3.success).toBe(true);
    expect(simulator.isComplete()).toBe(true);
  });
});

// ============================================================================
// Choice Tests
// ============================================================================

describe('CFG Simulator - Choice', () => {
  it('[Internal Choice] should allow picking a branch', () => {
    const source = `
      protocol Choice(role A, role B) {
        choice at A {
          A -> B: Option1();
        } or {
          A -> B: Option2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    // Should be at choice point
    const state = simulator.getState();
    expect(state.atChoice).toBe(true);
    expect(state.availableChoices).toBeDefined();
    expect(state.availableChoices!.length).toBe(2);

    // Pick first option
    simulator.choose(0);
    const step1 = simulator.step();

    expect(step1.success).toBe(true);
    expect(step1.event?.type).toBe('message');
    if (step1.event?.type === 'message') {
      expect(['Option1', 'Option2']).toContain(step1.event.label);
    }

    expect(simulator.isComplete()).toBe(true);
  });

  it('[Nested Choice] should handle choice within choice', () => {
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
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    // First choice
    expect(simulator.getState().atChoice).toBe(true);
    simulator.choose(0); // Pick Opt1 branch

    simulator.step(); // A -> B: Opt1

    // Second choice
    expect(simulator.getState().atChoice).toBe(true);
    simulator.choose(1); // Pick Opt1B

    simulator.step(); // B -> A: Opt1B

    expect(simulator.isComplete()).toBe(true);
  });

  it('[External Choice] should treat as internal choice in orchestration', () => {
    const source = `
      protocol ExternalChoice(role Client, role Server) {
        choice at Client {
          Client -> Server: Login();
        } or {
          Client -> Server: Register();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    // In orchestration, we explicitly choose
    expect(simulator.getState().atChoice).toBe(true);
    simulator.choose(0);
    simulator.step();

    expect(simulator.isComplete()).toBe(true);
  });
});

// ============================================================================
// Parallel Composition Tests
// ============================================================================

describe('CFG Simulator - Parallel Composition', () => {
  it('[Independent Parallel] should execute branches in any order', () => {
    const source = `
      protocol IndependentParallel(role A, role B, role C) {
        par {
          A -> B: M1();
        } and {
          C -> B: M2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    // Should be at fork (parallel entry)
    const state1 = simulator.getState();
    expect(state1.inParallel).toBe(true);

    // Execute both branches (order may vary)
    const step1 = simulator.step();
    const step2 = simulator.step();

    expect(step1.success).toBe(true);
    expect(step2.success).toBe(true);

    // Collect the messages
    const labels = [
      step1.event?.type === 'message' ? step1.event.label : null,
      step2.event?.type === 'message' ? step2.event.label : null,
    ].filter(Boolean);

    expect(labels).toContain('M1');
    expect(labels).toContain('M2');

    expect(simulator.isComplete()).toBe(true);
  });

  it('[Two-Phase Commit] should handle coordinator pattern', () => {
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
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    // Phase 1: Send vote requests
    simulator.step(); // Coordinator -> P1
    simulator.step(); // Coordinator -> P2

    // Phase 2: Receive votes (parallel)
    simulator.step(); // P1 -> Coordinator
    simulator.step(); // P2 -> Coordinator

    // Phase 3: Decision
    expect(simulator.getState().atChoice).toBe(true);
    simulator.choose(0); // Commit

    simulator.step(); // Coordinator -> P1: Commit
    simulator.step(); // Coordinator -> P2: Commit

    expect(simulator.isComplete()).toBe(true);
  });

  it('[Nested Parallel] should handle parallel within parallel', () => {
    const source = `
      protocol NestedParallel(role A, role B, role C, role D) {
        par {
          A -> B: M1();
        } and {
          par {
            C -> D: M2();
          } and {
            D -> C: M3();
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    // Execute all three messages (order may vary)
    const step1 = simulator.step();
    const step2 = simulator.step();
    const step3 = simulator.step();

    expect(step1.success).toBe(true);
    expect(step2.success).toBe(true);
    expect(step3.success).toBe(true);

    expect(simulator.isComplete()).toBe(true);
  });
});

// ============================================================================
// Recursion Tests
// ============================================================================

describe('CFG Simulator - Recursion', () => {
  it('[Simple Loop] should handle continue statement', () => {
    const source = `
      protocol SimpleLoop(role A, role B) {
        rec Loop {
          A -> B: Data();
          continue Loop;
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { maxSteps: 5 });

    // Execute 5 iterations
    for (let i = 0; i < 5; i++) {
      const step = simulator.step();
      expect(step.success).toBe(true);
      if (step.event?.type === 'message') {
        expect(step.event.label).toBe('Data');
      }
    }

    // Should hit max steps
    expect(simulator.getState().reachedMaxSteps).toBe(true);
  });

  it('[Conditional Recursion] should allow exit from loop', () => {
    const source = `
      protocol ConditionalLoop(role Producer, role Consumer) {
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
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    // Loop a few times
    for (let i = 0; i < 3; i++) {
      expect(simulator.getState().atChoice).toBe(true);
      simulator.choose(0); // Continue
      simulator.step(); // Send Data
    }

    // Exit loop
    expect(simulator.getState().atChoice).toBe(true);
    simulator.choose(1); // End
    simulator.step(); // Send End

    expect(simulator.isComplete()).toBe(true);
  });

  it('[Nested Recursion] should handle recursion within recursion', () => {
    const source = `
      protocol NestedRecursion(role A, role B) {
        rec Outer {
          A -> B: Start();
          rec Inner {
            choice at A {
              A -> B: InnerData();
              continue Inner;
            } or {
              A -> B: InnerEnd();
            }
          }
          choice at A {
            continue Outer;
          } or {
            A -> B: OuterEnd();
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { maxSteps: 20 });

    // Start outer loop
    simulator.step(); // Start

    // Inner loop (2 iterations)
    simulator.choose(0); // Continue inner
    simulator.step(); // InnerData
    simulator.choose(0); // Continue inner
    simulator.step(); // InnerData
    simulator.choose(1); // Exit inner
    simulator.step(); // InnerEnd

    // Exit outer
    simulator.choose(1); // Exit outer
    simulator.step(); // OuterEnd

    expect(simulator.isComplete()).toBe(true);
  });
});

// ============================================================================
// Execution State and Trace Tests
// ============================================================================

describe('CFG Simulator - Execution State', () => {
  it('should track current node position', () => {
    const source = `
      protocol Tracking(role A, role B) {
        A -> B: M1();
        B -> A: M2();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    const state1 = simulator.getState();
    expect(state1.currentNode).toBeDefined();
    expect(state1.stepCount).toBe(0);

    simulator.step();

    const state2 = simulator.getState();
    expect(state2.stepCount).toBe(1);
    expect(state2.currentNode).not.toBe(state1.currentNode);
  });

  it('should record execution trace', () => {
    const source = `
      protocol TraceTest(role A, role B) {
        A -> B: Request();
        B -> A: Response();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { recordTrace: true });

    simulator.step();
    simulator.step();

    const trace = simulator.getTrace();
    expect(trace.events.length).toBe(2);
    expect(trace.events[0].type).toBe('message');
    expect(trace.events[1].type).toBe('message');

    if (trace.events[0].type === 'message') {
      expect(trace.events[0].label).toBe('Request');
    }
    if (trace.events[1].type === 'message') {
      expect(trace.events[1].label).toBe('Response');
    }
  });

  it('should track visited nodes', () => {
    const source = `
      protocol VisitedTest(role A, role B) {
        A -> B: M1();
        B -> A: M2();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    simulator.step();
    simulator.step();

    const state = simulator.getState();
    expect(state.visitedNodes.length).toBeGreaterThan(2);
  });
});

// ============================================================================
// Reset and Control Tests
// ============================================================================

describe('CFG Simulator - Control Operations', () => {
  it('should support reset to initial state', () => {
    const source = `
      protocol ResetTest(role A, role B) {
        A -> B: M1();
        B -> A: M2();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { recordTrace: true });

    simulator.step();
    simulator.step();

    expect(simulator.isComplete()).toBe(true);

    // Reset
    simulator.reset();

    const state = simulator.getState();
    expect(state.stepCount).toBe(0);
    expect(simulator.isComplete()).toBe(false);
    expect(simulator.getTrace().events.length).toBe(0);
  });

  it('should support run to completion', () => {
    const source = `
      protocol RunTest(role A, role B) {
        A -> B: M1();
        B -> A: M2();
        A -> B: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    // Run to completion
    const result = simulator.run();

    expect(result.success).toBe(true);
    expect(simulator.isComplete()).toBe(true);
    expect(simulator.getState().stepCount).toBe(3);
  });

  it('should respect maxSteps limit in run', () => {
    const source = `
      protocol InfiniteLoop(role A, role B) {
        rec Loop {
          A -> B: Ping();
          continue Loop;
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { maxSteps: 10 });

    const result = simulator.run();

    expect(result.success).toBe(false);
    expect(simulator.getState().reachedMaxSteps).toBe(true);
    expect(simulator.getState().stepCount).toBe(10);
  });
});

// ============================================================================
// Error Detection Tests
// ============================================================================

describe('CFG Simulator - Error Detection', () => {
  it('should detect when no choice is made at choice point', () => {
    const source = `
      protocol ChoiceRequired(role A, role B) {
        choice at A {
          A -> B: Opt1();
        } or {
          A -> B: Opt2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    // At choice point, try to step without choosing
    const state = simulator.getState();
    expect(state.atChoice).toBe(true);

    const result = simulator.step();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should detect invalid choice index', () => {
    const source = `
      protocol InvalidChoice(role A, role B) {
        choice at A {
          A -> B: Opt1();
        } or {
          A -> B: Opt2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    // Try to pick invalid choice
    expect(() => simulator.choose(5)).toThrow();
  });

  it('should prevent steps after completion', () => {
    const source = `
      protocol Simple(role A, role B) {
        A -> B: Message();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    simulator.step();
    expect(simulator.isComplete()).toBe(true);

    const result = simulator.step();
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Known Complex Protocols
// ============================================================================

describe('CFG Simulator - Known Complex Protocols', () => {
  it('[OAuth Flow] should handle multi-party authentication', () => {
    const source = `
      protocol OAuth(role Client, role AuthServer, role ResourceServer) {
        Client -> AuthServer: AuthRequest();
        AuthServer -> Client: AuthToken();
        Client -> ResourceServer: AccessRequest(AuthToken);
        ResourceServer -> AuthServer: ValidateToken();
        AuthServer -> ResourceServer: TokenValid();
        ResourceServer -> Client: Resource();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    const result = simulator.run();
    expect(result.success).toBe(true);
    expect(simulator.getState().stepCount).toBe(6);
  });

  it('[Streaming with Control] should handle producer-consumer with flow control', () => {
    const source = `
      protocol StreamingWithControl(role Producer, role Consumer) {
        rec Stream {
          choice at Producer {
            Producer -> Consumer: Data();
            Consumer -> Producer: Ack();
            continue Stream;
          } or {
            Producer -> Consumer: End();
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { maxSteps: 20 });

    // Stream 3 data items
    for (let i = 0; i < 3; i++) {
      simulator.choose(0); // Continue
      simulator.step(); // Data
      simulator.step(); // Ack
    }

    // End stream
    simulator.choose(1); // End
    simulator.step();

    expect(simulator.isComplete()).toBe(true);
  });
});

// ============================================================================
// Event System Tests
// ============================================================================

describe('CFG Simulator - Event System', () => {
  it('should emit step-start and step-end events', () => {
    const source = `
      protocol Simple(role A, role B) {
        A -> B: Msg();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    const events: string[] = [];
    simulator.on('step-start', () => events.push('step-start'));
    simulator.on('step-end', () => events.push('step-end'));

    simulator.step();

    expect(events).toEqual(['step-start', 'step-end']);
  });

  it('should emit node-enter and node-exit events', () => {
    const source = `
      protocol Simple(role A, role B) {
        A -> B: Msg();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    const nodeEvents: Array<{type: string; nodeId: string}> = [];
    simulator.on('node-enter', (data) => nodeEvents.push({ type: 'enter', nodeId: data.nodeId }));
    simulator.on('node-exit', (data) => nodeEvents.push({ type: 'exit', nodeId: data.nodeId }));

    simulator.step();

    // Should have multiple node-enter/exit pairs (initial->action->terminal)
    expect(nodeEvents.length).toBeGreaterThan(0);
    expect(nodeEvents.some(e => e.type === 'enter')).toBe(true);
    expect(nodeEvents.some(e => e.type === 'exit')).toBe(true);
  });

  it('should emit message events', () => {
    const source = `
      protocol TwoMessages(role A, role B) {
        A -> B: M1();
        B -> A: M2();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    const messages: Array<{from: string; to: string; label: string}> = [];
    simulator.on('message', (data) => {
      messages.push({ from: data.from, to: data.to, label: data.label });
    });

    simulator.run();

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ from: 'A', to: 'B', label: 'M1' });
    expect(messages[1]).toEqual({ from: 'B', to: 'A', label: 'M2' });
  });

  it('should emit choice-selected event when choice is made', () => {
    const source = `
      protocol Choice(role Server, role Client) {
        choice at Server {
          Server -> Client: Success();
        } or {
          Server -> Client: Failure();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { choiceStrategy: 'manual' });

    const events: string[] = [];
    simulator.on('choice-selected', () => events.push('choice-selected'));

    // Choice point is already set during initialization (check via state)
    expect(simulator.getState().atChoice).toBe(true);

    // Make choice and step to execute it
    simulator.choose(0);
    simulator.step(); // This emits choice-selected

    expect(events).toContain('choice-selected');
  });

  it('should emit fork and join events', () => {
    const source = `
      protocol Parallel(role A, role B, role C) {
        par {
          A -> B: M1();
        } and {
          C -> B: M2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    const events: string[] = [];
    simulator.on('fork', () => events.push('fork'));
    simulator.on('join', () => events.push('join'));

    simulator.run();

    expect(events).toContain('fork');
    expect(events).toContain('join');
  });

  it('should emit recursion events', () => {
    const source = `
      protocol Loop(role A, role B) {
        rec X {
          A -> B: Data();
          continue X;
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { maxSteps: 10 });

    const events: string[] = [];
    simulator.on('recursion-enter', () => events.push('recursion-enter'));
    simulator.on('recursion-continue', () => events.push('recursion-continue'));
    simulator.on('recursion-exit', () => events.push('recursion-exit'));

    simulator.run();

    expect(events).toContain('recursion-enter');
    expect(events).toContain('recursion-continue');
    expect(events).toContain('recursion-exit');
  });

  it('should emit complete event', () => {
    const source = `
      protocol Simple(role A, role B) {
        A -> B: Msg();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    let completed = false;
    simulator.on('complete', () => { completed = true; });

    simulator.run();

    expect(completed).toBe(true);
  });

  it('should emit error event on failures', () => {
    const source = `
      protocol Choice(role Server, role Client) {
        choice at Server {
          Server -> Client: Success();
        } or {
          Server -> Client: Failure();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { choiceStrategy: 'manual' });

    let errorEmitted = false;
    simulator.on('error', () => { errorEmitted = true; });

    simulator.step(); // Hit choice point
    const result = simulator.step(); // Try to step without choosing - should error

    expect(result.success).toBe(false);
    expect(errorEmitted).toBe(true);
  });

  it('should support unsubscribe via returned function', () => {
    const source = `
      protocol Simple(role A, role B) {
        A -> B: Msg();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    let count = 0;
    const unsubscribe = simulator.on('message', () => count++);

    simulator.step(); // count = 1
    unsubscribe();

    // Reset and try again
    simulator.reset();
    simulator.step(); // count should still be 1 (not incremented)

    expect(count).toBe(1);
  });

  it('should support off() method for unsubscribe', () => {
    const source = `
      protocol TwoMessages(role A, role B) {
        A -> B: M1();
        B -> A: M2();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    let count = 0;
    const callback = () => count++;

    simulator.on('message', callback);
    simulator.step(); // count = 1

    simulator.off('message', callback);
    simulator.step(); // count should still be 1

    expect(count).toBe(1);
  });

  it('should handle callback errors gracefully', () => {
    const source = `
      protocol Simple(role A, role B) {
        A -> B: Msg();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg);

    // Add a callback that throws
    simulator.on('message', () => {
      throw new Error('Callback error');
    });

    // Should not crash the simulator
    expect(() => simulator.step()).not.toThrow();
    expect(simulator.isComplete()).toBe(true);
  });
});

// ============================================================================
// Enhanced Choice Previewing
// ============================================================================

describe('CFG Simulator - Enhanced Choice Previewing', () => {
  it('should provide preview of actions in each choice branch', () => {
    const source = `
      protocol ChoiceWithPreview(role Client, role Server) {
        choice at Client {
          Client -> Server: Option1();
          Server -> Client: Ack1();
        } or {
          Client -> Server: Option2();
          Server -> Client: Ack2();
          Client -> Server: Confirm();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { choiceStrategy: 'manual' });

    // Should be at choice point with enhanced options
    const state = simulator.getState();
    expect(state.atChoice).toBe(true);
    expect(state.availableChoices).toBeDefined();
    expect(state.availableChoices).toHaveLength(2);

    // Check first branch preview
    const option1 = state.availableChoices![0];
    expect(option1.preview).toBeDefined();
    expect(option1.preview.length).toBeGreaterThan(0);
    expect(option1.preview[0]).toMatchObject({
      type: 'message',
      from: 'Client',
      to: 'Server',
      label: 'Option1',
    });
    expect(option1.preview[1]).toMatchObject({
      type: 'message',
      from: 'Server',
      to: 'Client',
      label: 'Ack1',
    });
    expect(option1.participatingRoles).toContain('Client');
    expect(option1.participatingRoles).toContain('Server');
    expect(option1.estimatedSteps).toBeGreaterThan(0);

    // Check second branch preview
    const option2 = state.availableChoices![1];
    expect(option2.preview).toBeDefined();
    expect(option2.preview.length).toBeGreaterThan(0);
    expect(option2.preview[0].label).toBe('Option2');
    expect(option2.preview[1].label).toBe('Ack2');
    expect(option2.preview[2].label).toBe('Confirm');
  });

  it('should respect previewLimit configuration', () => {
    const source = `
      protocol LongSequence(role A, role B) {
        choice at A {
          A -> B: M1();
          B -> A: M2();
          A -> B: M3();
          B -> A: M4();
          A -> B: M5();
          B -> A: M6();
          A -> B: M7();
        } or {
          A -> B: Alt();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, {
      choiceStrategy: 'manual',
      previewLimit: 3, // Limit to 3 actions
    });

    const state = simulator.getState();
    const option1 = state.availableChoices![0];

    // Should only preview 3 actions (up to limit)
    expect(option1.preview.length).toBeLessThanOrEqual(3);
  });

  it('should stop preview at nested choice', () => {
    const source = `
      protocol NestedChoice(role A, role B) {
        choice at A {
          A -> B: Option1();
          choice at B {
            B -> A: SubOption1();
          } or {
            B -> A: SubOption2();
          }
        } or {
          A -> B: Option2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { choiceStrategy: 'manual' });

    const state = simulator.getState();
    const option1 = state.availableChoices![0];

    // Preview should include message then stop at nested choice
    expect(option1.preview[0]).toMatchObject({
      type: 'message',
      label: 'Option1',
    });
    expect(option1.preview[1]).toMatchObject({
      type: 'choice',
    });
    expect(option1.preview.length).toBe(2); // M1 + choice indicator
  });

  it('should stop preview at parallel composition', () => {
    const source = `
      protocol ChoiceWithParallel(role A, role B, role C) {
        choice at A {
          A -> B: Option1();
          par {
            B -> A: M1();
          } and {
            C -> A: M2();
          }
        } or {
          A -> B: Option2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { choiceStrategy: 'manual' });

    const state = simulator.getState();
    const option1 = state.availableChoices![0];

    // Preview should include message then stop at parallel
    expect(option1.preview[0]).toMatchObject({
      type: 'message',
      label: 'Option1',
    });
    expect(option1.preview[1]).toMatchObject({
      type: 'parallel',
    });
  });

  it('should stop preview at recursion', () => {
    const source = `
      protocol ChoiceWithRecursion(role A, role B) {
        choice at A {
          A -> B: StartLoop();
          rec Loop {
            A -> B: LoopMsg();
            continue Loop;
          }
        } or {
          A -> B: NoLoop();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { choiceStrategy: 'manual' });

    const state = simulator.getState();
    const option1 = state.availableChoices![0];

    // Preview should include message then stop at recursion
    expect(option1.preview[0]).toMatchObject({
      type: 'message',
      label: 'StartLoop',
    });
    expect(option1.preview[1]).toMatchObject({
      type: 'recursion',
    });
  });

  it('should extract participating roles from preview', () => {
    const source = `
      protocol ThreePartyChoice(role A, role B, role C) {
        choice at A {
          A -> B: ToB();
          B -> C: ForwardToC();
          C -> A: BackToA();
        } or {
          A -> C: DirectToC();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const simulator = new CFGSimulator(cfg, { choiceStrategy: 'manual' });

    const state = simulator.getState();
    const option1 = state.availableChoices![0];
    const option2 = state.availableChoices![1];

    // First branch involves all three roles
    expect(option1.participatingRoles).toContain('A');
    expect(option1.participatingRoles).toContain('B');
    expect(option1.participatingRoles).toContain('C');
    expect(option1.participatingRoles.length).toBe(3);

    // Second branch involves only A and C
    expect(option2.participatingRoles).toContain('A');
    expect(option2.participatingRoles).toContain('C');
    expect(option2.participatingRoles.length).toBe(2);
  });
});

// ============================================================================
// Formal Guarantees (Documented Contract Tests)
// ============================================================================

describe('CFG Simulator - Formal Guarantees', () => {
  describe('Guarantee 1: Faithful Execution', () => {
    it('should execute exactly one protocol action per step', () => {
      const source = `
        protocol ThreeActions(role A, role B) {
          A -> B: M1();
          B -> A: M2();
          A -> B: M3();
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg, { recordTrace: true });

      // Each step should produce exactly one action
      const result1 = simulator.step();
      expect(result1.success).toBe(true);
      expect(result1.event?.type).toBe('message');

      const result2 = simulator.step();
      expect(result2.success).toBe(true);
      expect(result2.event?.type).toBe('message');

      const result3 = simulator.step();
      expect(result3.success).toBe(true);
      expect(result3.event?.type).toBe('message');

      expect(simulator.isComplete()).toBe(true);

      // Trace should have exactly 3 message events
      const trace = simulator.getTrace();
      expect(trace.events.filter(e => e.type === 'message')).toHaveLength(3);
    });

    it('should maintain total order of events (causal order)', () => {
      const source = `
        protocol CausalOrder(role A, role B, role C) {
          A -> B: M1();
          B -> C: M2();
          C -> A: M3();
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg, { recordTrace: true });

      const events: Array<{type: string; label?: string; timestamp: number}> = [];
      simulator.on('message', (data) => {
        events.push({ type: 'message', label: data.label, timestamp: Date.now() });
      });

      simulator.run();

      // Events should be in causal order
      expect(events[0].label).toBe('M1');
      expect(events[1].label).toBe('M2');
      expect(events[2].label).toBe('M3');

      // Timestamps should be monotonically increasing (or equal if very fast)
      expect(events[1].timestamp).toBeGreaterThanOrEqual(events[0].timestamp);
      expect(events[2].timestamp).toBeGreaterThanOrEqual(events[1].timestamp);
    });
  });

  describe('Guarantee 2: Complete State Tracking', () => {
    it('should maintain valid currentNode at all times', () => {
      const source = `
        protocol StateTracking(role A, role B) {
          A -> B: M1();
          choice at A {
            A -> B: Option1();
          } or {
            A -> B: Option2();
          }
          B -> A: Final();
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg, { choiceStrategy: 'first' });

      const nodeIds = cfg.nodes.map(n => n.id);

      // Check currentNode is valid after each step
      while (!simulator.isComplete()) {
        const state = simulator.getState();
        const currentNodes = Array.isArray(state.currentNode)
          ? state.currentNode
          : [state.currentNode];

        // All current nodes must exist in CFG
        for (const nodeId of currentNodes) {
          expect(nodeIds).toContain(nodeId);
        }

        simulator.step();
      }
    });

    it('should maintain monotonically increasing visitedNodes', () => {
      const source = `
        protocol VisitedTracking(role A, role B) {
          A -> B: M1();
          B -> A: M2();
          A -> B: M3();
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg);

      let previousVisitedCount = 0;

      while (!simulator.isComplete()) {
        const state = simulator.getState();
        const currentVisitedCount = state.visitedNodes.length;

        // visitedNodes should only grow (monotonic)
        expect(currentVisitedCount).toBeGreaterThanOrEqual(previousVisitedCount);

        previousVisitedCount = currentVisitedCount;
        simulator.step();
      }

      // After completion, visited count should be even larger
      const finalState = simulator.getState();
      expect(finalState.visitedNodes.length).toBeGreaterThanOrEqual(previousVisitedCount);
    });

    it('should properly maintain recursion stack', () => {
      const source = `
        protocol RecursionStack(role A, role B) {
          rec Loop {
            A -> B: Msg();
            continue Loop;
          }
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg, { maxSteps: 5 });

      // Auto-advance enters recursion during construction, so stack already has entry
      let state = simulator.getState();
      expect(state.recursionStack.length).toBeGreaterThan(0);
      expect(state.recursionStack[0].label).toBe('Loop');

      // Execute a step
      simulator.step();
      state = simulator.getState();
      expect(state.recursionStack.length).toBeGreaterThan(0);

      // Run to completion (will hit maxSteps)
      simulator.run();
      state = simulator.getState();

      // Recursion stack should still be valid (non-empty since we hit maxSteps)
      expect(Array.isArray(state.recursionStack)).toBe(true);
      expect(state.recursionStack.length).toBeGreaterThan(0);
    });
  });

  describe('Guarantee 3: Termination', () => {
    it('should complete successfully when reaching terminal', () => {
      const source = `
        protocol SimpleCompletion(role A, role B) {
          A -> B: M1();
          B -> A: M2();
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg);

      const result = simulator.run();

      expect(result.success).toBe(true);
      expect(simulator.isComplete()).toBe(true);
      expect(simulator.getState().completed).toBe(true);
      expect(simulator.getState().reachedMaxSteps).toBe(false);
    });

    it('should stop at maxSteps limit for infinite loops', () => {
      const source = `
        protocol InfiniteLoop(role A, role B) {
          rec Loop {
            A -> B: Msg();
            continue Loop;
          }
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg, { maxSteps: 10 });

      const result = simulator.run();

      // Should NOT complete successfully (hit maxSteps)
      expect(result.success).toBe(false);
      expect(simulator.isComplete()).toBe(false);
      expect(simulator.getState().reachedMaxSteps).toBe(true);
      expect(result.steps).toBe(10);
    });

    it('should never infinite loop without recursion', () => {
      const source = `
        protocol NoRecursion(role A, role B) {
          A -> B: M1();
          choice at A {
            A -> B: Option1();
            B -> A: Ack1();
          } or {
            A -> B: Option2();
            B -> A: Ack2();
          }
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg, { choiceStrategy: 'first', maxSteps: 1000 });

      const result = simulator.run();

      // Should complete well before maxSteps
      expect(result.success).toBe(true);
      expect(result.steps).toBeLessThan(100);
      expect(simulator.isComplete()).toBe(true);
    });
  });

  describe('Guarantee 4: Event Emission', () => {
    it('should emit event for every protocol action', () => {
      const source = `
        protocol AllActions(role A, role B) {
          A -> B: M1();
          B -> A: M2();
          A -> B: M3();
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg);

      const messageEvents: any[] = [];
      simulator.on('message', (data) => messageEvents.push(data));

      simulator.run();

      // Should have emitted 3 message events
      expect(messageEvents).toHaveLength(3);
      expect(messageEvents[0].label).toBe('M1');
      expect(messageEvents[1].label).toBe('M2');
      expect(messageEvents[2].label).toBe('M3');
    });

    it('should emit events in causal order with no duplicates', () => {
      const source = `
        protocol CausalEvents(role A, role B, role C) {
          A -> B: First();
          B -> C: Second();
          C -> A: Third();
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg);

      const events: string[] = [];
      simulator.on('message', (data) => events.push(data.label));

      simulator.run();

      // Events should be in order with no duplicates
      expect(events).toEqual(['First', 'Second', 'Third']);
      expect(new Set(events).size).toBe(3); // No duplicates
    });

    it('should emit all event types for complex protocols', () => {
      const source = `
        protocol ComplexEvents(role A, role B) {
          A -> B: Start();
          choice at A {
            A -> B: ChoiceA();
          } or {
            A -> B: ChoiceB();
          }
          par {
            A -> B: ParallelA();
          } and {
            B -> A: ParallelB();
          }
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg, { choiceStrategy: 'first' });

      const eventTypes = new Set<string>();
      simulator.on('message', () => eventTypes.add('message'));
      simulator.on('choice-selected', () => eventTypes.add('choice'));
      simulator.on('fork', () => eventTypes.add('fork'));
      simulator.on('join', () => eventTypes.add('join'));
      simulator.on('complete', () => eventTypes.add('complete'));

      simulator.run();

      // Should have emitted all expected event types
      expect(eventTypes.has('message')).toBe(true);
      expect(eventTypes.has('choice')).toBe(true);
      expect(eventTypes.has('fork')).toBe(true);
      expect(eventTypes.has('join')).toBe(true);
      expect(eventTypes.has('complete')).toBe(true);
    });
  });

  describe('Guarantee 5: Execution Model', () => {
    it('should provide total order for parallel branches (orchestration)', () => {
      const source = `
        protocol TotalOrder(role A, role B, role C) {
          par {
            A -> B: M1();
          } and {
            C -> B: M2();
          }
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg);

      const events: string[] = [];
      simulator.on('message', (data) => events.push(data.label));

      simulator.run();

      // Should execute branches in SOME total order (orchestrated)
      // Either [M1, M2] or [M2, M1] depending on interleaving, but always total order
      expect(events).toHaveLength(2);
      expect(events).toContain('M1');
      expect(events).toContain('M2');
    });

    it('should execute synchronously with no message buffers', () => {
      const source = `
        protocol Synchronous(role A, role B) {
          A -> B: M1();
          B -> A: M2();
        }
      `;
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const simulator = new CFGSimulator(cfg);

      // Messages should be delivered atomically (no buffering)
      // In orchestrated model, step() should complete the entire action
      let m1Seen = false;
      let m2Seen = false;

      simulator.on('message', (data) => {
        if (data.label === 'M1') m1Seen = true;
        if (data.label === 'M2') {
          // When M2 executes, M1 should already be complete
          expect(m1Seen).toBe(true);
          m2Seen = true;
        }
      });

      simulator.run();

      expect(m1Seen).toBe(true);
      expect(m2Seen).toBe(true);
    });
  });
});
