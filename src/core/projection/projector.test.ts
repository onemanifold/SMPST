/**
 * CFSM Projection Tests
 *
 * Tests the projection algorithm that extracts role-specific CFSMs from a global CFG.
 * Following TDD: write tests first, then implement.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../parser/parser';
import { buildCFG } from '../cfg/builder';
import { project, projectAll } from './projector';
import type { CFSM } from './types';

// ============================================================================
// Basic Projection Tests
// ============================================================================

describe('CFSM Projection - Basic Message Passing', () => {
  it('should project simple send action for sender role', () => {
    const source = `
      protocol SimpleSend(role A, role B) {
        A -> B: Message();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const cfsm = project(cfg, 'A');

    // A's CFSM should have: initial -> send -> terminal
    expect(cfsm.role).toBe('A');
    expect(cfsm.states.length).toBe(3);
    expect(cfsm.states.some(s => s.type === 'send')).toBe(true);
    expect(cfsm.transitions.length).toBe(2);
  });

  it('should project simple receive action for receiver role', () => {
    const source = `
      protocol SimpleReceive(role A, role B) {
        A -> B: Message();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const cfsm = project(cfg, 'B');

    // B's CFSM should have: initial -> receive -> terminal
    expect(cfsm.role).toBe('B');
    expect(cfsm.states.length).toBe(3);
    expect(cfsm.states.some(s => s.type === 'receive')).toBe(true);
    expect(cfsm.transitions.length).toBe(2);
  });

  it('should project sequence of messages', () => {
    const source = `
      protocol RequestResponse(role Client, role Server) {
        Client -> Server: Request();
        Server -> Client: Response();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const clientCFSM = project(cfg, 'Client');
    const serverCFSM = project(cfg, 'Server');

    // Client: initial -> send Request -> receive Response -> terminal
    expect(clientCFSM.states.length).toBe(4);
    expect(clientCFSM.transitions.length).toBe(3);

    // Server: initial -> receive Request -> send Response -> terminal
    expect(serverCFSM.states.length).toBe(4);
    expect(serverCFSM.transitions.length).toBe(3);
  });

  it('should exclude irrelevant actions', () => {
    const source = `
      protocol ThreeRoles(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const aCFSM = project(cfg, 'A');

    // A is involved in M1 (sender) and M3 (receiver), but NOT M2
    const sendStates = aCFSM.states.filter(s => s.type === 'send');
    const recvStates = aCFSM.states.filter(s => s.type === 'receive');

    expect(sendStates.length).toBe(1);  // M1
    expect(recvStates.length).toBe(1);  // M3
  });
});

// ============================================================================
// Choice Projection Tests
// ============================================================================

describe('CFSM Projection - Choice', () => {
  it('should project choice where role is sender', () => {
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
    const cfsm = project(cfg, 'A');

    // A's CFSM should have choice state with two branches
    const choiceStates = cfsm.states.filter(s => s.type === 'choice');
    expect(choiceStates.length).toBeGreaterThan(0);

    // Should have two send states (one per branch)
    const sendStates = cfsm.states.filter(s => s.type === 'send');
    expect(sendStates.length).toBe(2);
  });

  it('should project choice where role is receiver', () => {
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
    const cfsm = project(cfg, 'B');

    // B's CFSM should have branching receive (external choice)
    const recvStates = cfsm.states.filter(s => s.type === 'receive');
    expect(recvStates.length).toBe(2);  // Two possible receives
  });

  it('should handle nested choices', () => {
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
    const cfsm = project(cfg, 'A');

    // A's CFSM should reflect the nested structure
    expect(cfsm.states.length).toBeGreaterThan(3);
  });
});

// ============================================================================
// Parallel Projection Tests
// ============================================================================

describe('CFSM Projection - Parallel Composition', () => {
  it('should project role in single parallel branch as sequential', () => {
    const source = `
      protocol ParallelSingle(role A, role B, role C) {
        par {
          A -> B: M1();
        } and {
          C -> C: M2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const cfsm = project(cfg, 'A');

    // A only appears in first branch, so projection is sequential
    const sendStates = cfsm.states.filter(s => s.type === 'send');
    expect(sendStates.length).toBe(1);

    // No fork/join needed for A
    const forkStates = cfsm.states.filter(s => s.type === 'fork');
    const joinStates = cfsm.states.filter(s => s.type === 'join');
    expect(forkStates.length).toBe(0);
    expect(joinStates.length).toBe(0);
  });

  it('should preserve fork-join when role appears in multiple branches', () => {
    const source = `
      protocol ParallelMultiple(role A, role B, role C) {
        par {
          A -> B: M1();
        } and {
          A -> C: M2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const cfsm = project(cfg, 'A');

    // A appears in both branches, so fork-join must be preserved
    const forkStates = cfsm.states.filter(s => s.type === 'fork');
    const joinStates = cfsm.states.filter(s => s.type === 'join');

    expect(forkStates.length).toBe(1);
    expect(joinStates.length).toBe(1);

    // Two send states, one per branch
    const sendStates = cfsm.states.filter(s => s.type === 'send');
    expect(sendStates.length).toBe(2);
  });

  it('should project independent parallel branches correctly', () => {
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

    // B receives from both branches - should have fork-join
    const bCFSM = project(cfg, 'B');
    const recvStates = bCFSM.states.filter(s => s.type === 'receive');
    expect(recvStates.length).toBe(2);

    // A only in first branch - sequential
    const aCFSM = project(cfg, 'A');
    const aForks = aCFSM.states.filter(s => s.type === 'fork');
    expect(aForks.length).toBe(0);
  });

  it('should handle three-way parallel', () => {
    const source = `
      protocol ThreeWayParallel(role A, role B, role C, role D) {
        par {
          A -> B: M1();
        } and {
          A -> C: M2();
        } and {
          A -> D: M3();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const cfsm = project(cfg, 'A');

    // A appears in all three branches
    const sendStates = cfsm.states.filter(s => s.type === 'send');
    expect(sendStates.length).toBe(3);

    // Should have fork with three outgoing transitions
    const forkStates = cfsm.states.filter(s => s.type === 'fork');
    expect(forkStates.length).toBe(1);
  });
});

// ============================================================================
// Recursion Projection Tests
// ============================================================================

describe('CFSM Projection - Recursion', () => {
  it('should project simple recursion', () => {
    const source = `
      protocol Loop(role A, role B) {
        rec Loop {
          A -> B: Data();
          continue Loop;
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const cfsm = project(cfg, 'A');

    // Should have a cycle in the CFSM
    expect(cfsm.states.length).toBeGreaterThan(0);
    expect(cfsm.transitions.length).toBeGreaterThan(0);

    // Check for back edge (continue)
    const backEdges = cfsm.transitions.filter(t => {
      const fromIdx = cfsm.states.findIndex(s => s.id === t.from);
      const toIdx = cfsm.states.findIndex(s => s.id === t.to);
      return toIdx <= fromIdx;
    });
    expect(backEdges.length).toBeGreaterThan(0);
  });

  it('should project recursion with choice', () => {
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
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const cfsm = project(cfg, 'A');

    // Should have choice with one branch looping back
    const choiceStates = cfsm.states.filter(s => s.type === 'choice');
    expect(choiceStates.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Known Protocol Tests
// ============================================================================

describe('CFSM Projection - Known Protocols', () => {
  it('[Request-Response] should project correctly for both roles', () => {
    const source = `
      protocol RequestResponse(role Client, role Server) {
        Client -> Server: Request();
        Server -> Client: Response();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const clientCFSM = project(cfg, 'Client');
    const serverCFSM = project(cfg, 'Server');

    // Client: send then receive
    const clientSends = clientCFSM.states.filter(s => s.type === 'send');
    const clientRecvs = clientCFSM.states.filter(s => s.type === 'receive');
    expect(clientSends.length).toBe(1);
    expect(clientRecvs.length).toBe(1);

    // Server: receive then send
    const serverRecvs = serverCFSM.states.filter(s => s.type === 'receive');
    const serverSends = serverCFSM.states.filter(s => s.type === 'send');
    expect(serverRecvs.length).toBe(1);
    expect(serverSends.length).toBe(1);
  });

  it('[Two-Phase Commit] should project coordinator correctly', () => {
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
    const coordCFSM = project(cfg, 'Coordinator');

    // Coordinator sends 2 VoteRequests, receives 2 Votes, then makes choice
    const sends = coordCFSM.states.filter(s => s.type === 'send');
    const recvs = coordCFSM.states.filter(s => s.type === 'receive');

    expect(sends.length).toBeGreaterThan(2);  // At least 2 VoteRequests + decision messages
    expect(recvs.length).toBe(2);  // 2 Votes
  });

  it('[Streaming] should project producer and consumer', () => {
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
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const producerCFSM = project(cfg, 'Producer');
    const consumerCFSM = project(cfg, 'Consumer');

    // Producer makes choice, Consumer receives
    const producerChoices = producerCFSM.states.filter(s => s.type === 'choice');
    const consumerRecvs = consumerCFSM.states.filter(s => s.type === 'receive');

    expect(producerChoices.length).toBeGreaterThan(0);
    expect(consumerRecvs.length).toBe(2);  // Data or End
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('CFSM Projection - Edge Cases', () => {
  it('should handle empty protocol', () => {
    const source = `
      protocol Empty(role A, role B) {
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const cfsm = project(cfg, 'A');

    // Should have initial and terminal only
    expect(cfsm.states.length).toBe(2);
    expect(cfsm.transitions.length).toBe(1);
  });

  it('should handle role not in protocol', () => {
    const source = `
      protocol TwoRoles(role A, role B) {
        A -> B: Message();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // Projecting for non-existent role should throw or return error
    expect(() => project(cfg, 'C')).toThrow();
  });

  it('should project all roles at once', () => {
    const source = `
      protocol Multi(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    expect(result.cfsms.size).toBe(3);
    expect(result.roles).toEqual(['A', 'B', 'C']);
    expect(result.errors.length).toBe(0);

    // Each role should have their specific actions
    const aCFSM = result.cfsms.get('A')!;
    const bCFSM = result.cfsms.get('B')!;
    const cCFSM = result.cfsms.get('C')!;

    expect(aCFSM.role).toBe('A');
    expect(bCFSM.role).toBe('B');
    expect(cCFSM.role).toBe('C');
  });
});

// ============================================================================
// Completeness Tests
// ============================================================================

describe('CFSM Projection - Completeness', () => {
  it('should preserve all protocol interactions across all CFSMs', () => {
    const source = `
      protocol Complete(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    // Collect all send/receive actions across all CFSMs
    const allActions: string[] = [];

    for (const cfsm of result.cfsms.values()) {
      for (const state of cfsm.states) {
        if (state.action) {
          const actionDesc = `${state.action.from}->${state.action.to}:${state.action.label}`;
          allActions.push(actionDesc);
        }
      }
    }

    // Should have each message appearing exactly twice (once as send, once as receive)
    expect(allActions.filter(a => a.includes('M1')).length).toBe(2);
    expect(allActions.filter(a => a.includes('M2')).length).toBe(2);
    expect(allActions.filter(a => a.includes('M3')).length).toBe(2);
  });

  it('should maintain terminal state reachability', () => {
    const source = `
      protocol Reachable(role A, role B) {
        A -> B: Start();
        B -> A: Done();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    // Every CFSM should have reachable terminal states
    for (const cfsm of result.cfsms.values()) {
      expect(cfsm.terminalStates.length).toBeGreaterThan(0);

      // Initial state should have outgoing transitions
      const initialTransitions = cfsm.transitions.filter(
        t => t.from === cfsm.initialState
      );
      expect(initialTransitions.length).toBeGreaterThan(0);
    }
  });
});
