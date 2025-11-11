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
    if (!step1.success) {
      console.log('[TEST] step1 failed:', step1.error);
    }
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
