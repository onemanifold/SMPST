/**
 * CFSM Projection Tests
 *
 * Tests the projection algorithm that extracts role-specific CFSMs from a global CFG.
 * Following TDD: write tests first, then implement.
 *
 * KEY PRINCIPLE: Actions live on TRANSITIONS, not states!
 * Tests verify that CFSMTransition objects have the correct action field.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../parser/parser';
import { buildCFG } from '../cfg/builder';
import { project, projectAll } from './projector';
import type { CFSM, SendAction, ReceiveAction } from './types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find a transition with a specific action type
 */
function findTransitionWithAction(
  cfsm: CFSM,
  actionType: 'send' | 'receive' | 'tau' | 'choice'
): ReturnType<typeof cfsm.transitions.find> {
  return cfsm.transitions.find(t => t.action && t.action.type === actionType);
}

/**
 * Find all transitions with a specific action type
 */
function findTransitionsWithAction(
  cfsm: CFSM,
  actionType: 'send' | 'receive' | 'tau' | 'choice'
) {
  return cfsm.transitions.filter(t => t.action && t.action.type === actionType);
}

/**
 * Check if transition has send action with specific label
 */
function hasSendAction(cfsm: CFSM, label: string): boolean {
  return cfsm.transitions.some(
    t => t.action && t.action.type === 'send' && t.action.label === label
  );
}

/**
 * Check if transition has receive action with specific label
 */
function hasReceiveAction(cfsm: CFSM, label: string): boolean {
  return cfsm.transitions.some(
    t => t.action && t.action.type === 'receive' && t.action.label === label
  );
}

// ============================================================================
// Basic Message Projection Tests
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

    // Verify CFSM structure
    expect(cfsm.role).toBe('A');
    expect(cfsm.states.length).toBeGreaterThan(0);
    expect(cfsm.initialState).toBeDefined();
    expect(cfsm.terminalStates.length).toBeGreaterThan(0);

    // KEY TEST: Action should be on transition, not state
    const sendTransitions = findTransitionsWithAction(cfsm, 'send');
    expect(sendTransitions.length).toBe(1);

    const sendTransition = sendTransitions[0];
    expect(sendTransition.action).toBeDefined();
    expect(sendTransition.action!.type).toBe('send');

    const sendAction = sendTransition.action as SendAction;
    expect(sendAction.to).toBe('B');
    expect(sendAction.label).toBe('Message');
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

    // Verify CFSM structure
    expect(cfsm.role).toBe('B');
    expect(cfsm.states.length).toBeGreaterThan(0);

    // KEY TEST: Action should be on transition
    const recvTransitions = findTransitionsWithAction(cfsm, 'receive');
    expect(recvTransitions.length).toBe(1);

    const recvTransition = recvTransitions[0];
    expect(recvTransition.action).toBeDefined();
    expect(recvTransition.action!.type).toBe('receive');

    const recvAction = recvTransition.action as ReceiveAction;
    expect(recvAction.from).toBe('A');
    expect(recvAction.label).toBe('Message');
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

    // Test Client projection
    const clientCFSM = project(cfg, 'Client');
    expect(clientCFSM.role).toBe('Client');

    // Client sends Request
    expect(hasSendAction(clientCFSM, 'Request')).toBe(true);
    // Client receives Response
    expect(hasReceiveAction(clientCFSM, 'Response')).toBe(true);

    // Test Server projection
    const serverCFSM = project(cfg, 'Server');
    expect(serverCFSM.role).toBe('Server');

    // Server receives Request
    expect(hasReceiveAction(serverCFSM, 'Request')).toBe(true);
    // Server sends Response
    expect(hasSendAction(serverCFSM, 'Response')).toBe(true);
  });

  it('should handle three-role protocol with role exclusion', () => {
    const source = `
      protocol ThreeRoles(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // Test A's projection
    const aCFSM = project(cfg, 'A');
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);     // A sends M1
    expect(hasReceiveAction(aCFSM, 'M3')).toBe(true);  // A receives M3
    expect(hasReceiveAction(aCFSM, 'M2')).toBe(false); // A NOT involved in M2

    // Test B's projection
    const bCFSM = project(cfg, 'B');
    expect(hasReceiveAction(bCFSM, 'M1')).toBe(true);  // B receives M1
    expect(hasSendAction(bCFSM, 'M2')).toBe(true);     // B sends M2
    expect(hasReceiveAction(bCFSM, 'M3')).toBe(false); // B NOT involved in M3

    // Test C's projection
    const cCFSM = project(cfg, 'C');
    expect(hasReceiveAction(cCFSM, 'M2')).toBe(true);  // C receives M2
    expect(hasSendAction(cCFSM, 'M3')).toBe(true);     // C sends M3
    expect(hasReceiveAction(cCFSM, 'M1')).toBe(false); // C NOT involved in M1
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

    expect(result.cfsms.size).toBe(3);
    expect(result.roles).toEqual(['A', 'B', 'C']);
    expect(result.errors.length).toBe(0);

    // Verify duality: each send has matching receive
    const aCFSM = result.cfsms.get('A')!;
    const bCFSM = result.cfsms.get('B')!;
    const cCFSM = result.cfsms.get('C')!;

    // M1: A sends, B receives
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasReceiveAction(bCFSM, 'M1')).toBe(true);

    // M2: B sends, C receives
    expect(hasSendAction(bCFSM, 'M2')).toBe(true);
    expect(hasReceiveAction(cCFSM, 'M2')).toBe(true);

    // M3: C sends, A receives
    expect(hasSendAction(cCFSM, 'M3')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'M3')).toBe(true);
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
      expect(cfsm.initialState).toBeDefined();

      // Initial state should have outgoing transitions
      const initialTransitions = cfsm.transitions.filter(
        t => t.from === cfsm.initialState
      );
      expect(initialTransitions.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Choice Projection Tests
// ============================================================================

describe('CFSM Projection - Choice (Internal ⊕)', () => {
  it('should project internal choice for decider role', () => {
    const source = `
      protocol InternalChoice(role Client, role Server) {
        choice at Client {
          Client -> Server: Login();
        } or {
          Client -> Server: Register();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const clientCFSM = project(cfg, 'Client');

    // Client makes choice - should have two send transitions from choice point
    expect(hasSendAction(clientCFSM, 'Login')).toBe(true);
    expect(hasSendAction(clientCFSM, 'Register')).toBe(true);

    const sendTransitions = findTransitionsWithAction(clientCFSM, 'send');
    expect(sendTransitions.length).toBe(2);
  });

  it('should project external choice for non-decider role', () => {
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
    const serverCFSM = project(cfg, 'Server');

    // Server reacts to choice - should have two receive transitions
    expect(hasReceiveAction(serverCFSM, 'Login')).toBe(true);
    expect(hasReceiveAction(serverCFSM, 'Register')).toBe(true);

    const recvTransitions = findTransitionsWithAction(serverCFSM, 'receive');
    expect(recvTransitions.length).toBe(2);
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

    const aCFSM = project(cfg, 'A');
    const bCFSM = project(cfg, 'B');

    // A makes outer choice
    expect(hasSendAction(aCFSM, 'Opt1')).toBe(true);
    expect(hasSendAction(aCFSM, 'Opt2')).toBe(true);

    // B receives Opt1, then makes inner choice
    expect(hasReceiveAction(bCFSM, 'Opt1')).toBe(true);
    expect(hasSendAction(bCFSM, 'Opt1A')).toBe(true);
    expect(hasSendAction(bCFSM, 'Opt1B')).toBe(true);

    // B also receives Opt2 from other branch
    expect(hasReceiveAction(bCFSM, 'Opt2')).toBe(true);
  });

  it('should handle three-way choice', () => {
    const source = `
      protocol ThreeWayChoice(role Client, role Server) {
        choice at Client {
          Client -> Server: Option1();
        } or {
          Client -> Server: Option2();
        } or {
          Client -> Server: Option3();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const clientCFSM = project(cfg, 'Client');

    // Three branches
    expect(hasSendAction(clientCFSM, 'Option1')).toBe(true);
    expect(hasSendAction(clientCFSM, 'Option2')).toBe(true);
    expect(hasSendAction(clientCFSM, 'Option3')).toBe(true);
  });

  it('should handle choice with continuation', () => {
    const source = `
      protocol ChoiceWithContinuation(role A, role B) {
        choice at A {
          A -> B: Yes();
          B -> A: Ack1();
        } or {
          A -> B: No();
          B -> A: Ack2();
        }
        A -> B: Final();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const aCFSM = project(cfg, 'A');

    // Choice branches
    expect(hasSendAction(aCFSM, 'Yes')).toBe(true);
    expect(hasSendAction(aCFSM, 'No')).toBe(true);

    // Continuation after both branches
    expect(hasReceiveAction(aCFSM, 'Ack1')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'Ack2')).toBe(true);
    expect(hasSendAction(aCFSM, 'Final')).toBe(true);
  });

  it('should handle choice where one branch is empty', () => {
    const source = `
      protocol EmptyBranchChoice(role A, role B) {
        choice at A {
          A -> B: Something();
        } or {
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // One branch has action, other is empty
    expect(hasSendAction(aCFSM, 'Something')).toBe(true);
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
          C -> B: M2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // A only in first branch
    const aCFSM = project(cfg, 'A');
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'M2')).toBe(false);
  });

  it('should handle role in multiple parallel branches', () => {
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
    const aCFSM = project(cfg, 'A');

    // A appears in both branches
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasSendAction(aCFSM, 'M2')).toBe(true);
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
    const aCFSM = project(cfg, 'A');

    // A in all three branches
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasSendAction(aCFSM, 'M2')).toBe(true);
    expect(hasSendAction(aCFSM, 'M3')).toBe(true);
  });

  it('should handle parallel with sequences in branches', () => {
    const source = `
      protocol ParallelSequences(role A, role B, role C) {
        par {
          A -> B: M1();
          B -> A: M2();
        } and {
          A -> C: M3();
          C -> A: M4();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Both branches have sequences involving A
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'M2')).toBe(true);
    expect(hasSendAction(aCFSM, 'M3')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'M4')).toBe(true);
  });

  it('should handle nested parallel', () => {
    const source = `
      protocol NestedParallel(role A, role B, role C, role D) {
        par {
          par {
            A -> B: M1();
          } and {
            A -> C: M2();
          }
        } and {
          A -> D: M3();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Nested parallel - A in all branches
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasSendAction(aCFSM, 'M2')).toBe(true);
    expect(hasSendAction(aCFSM, 'M3')).toBe(true);
  });

  it('should handle role not involved in any parallel branch', () => {
    const source = `
      protocol ParallelUninvolved(role A, role B, role C, role D) {
        par {
          B -> C: M1();
        } and {
          C -> D: M2();
        }
        A -> B: After();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // A not in parallel, only in continuation
    expect(hasSendAction(aCFSM, 'After')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'M1')).toBe(false);
    expect(hasReceiveAction(aCFSM, 'M2')).toBe(false);
  });
});

// ============================================================================
// Recursion Projection Tests
// ============================================================================

describe('CFSM Projection - Recursion', () => {
  it('should project simple infinite loop', () => {
    const source = `
      protocol InfiniteLoop(role A, role B) {
        rec Loop {
          A -> B: Data();
          continue Loop;
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Should have send action
    expect(hasSendAction(aCFSM, 'Data')).toBe(true);

    // Should have back-edge (cycle)
    const sendTransitions = findTransitionsWithAction(aCFSM, 'send');
    expect(sendTransitions.length).toBeGreaterThan(0);

    // Check for cycle using DFS to detect if any state can reach itself
    function hasCycle(cfsm: CFSM): boolean {
      const adjList = new Map<string, string[]>();
      for (const t of cfsm.transitions) {
        if (!adjList.has(t.from)) adjList.set(t.from, []);
        adjList.get(t.from)!.push(t.to);
      }

      function dfs(state: string, visited: Set<string>, recStack: Set<string>): boolean {
        visited.add(state);
        recStack.add(state);

        const neighbors = adjList.get(state) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor, visited, recStack)) return true;
          } else if (recStack.has(neighbor)) {
            return true; // Back edge found - cycle!
          }
        }

        recStack.delete(state);
        return false;
      }

      const visited = new Set<string>();
      for (const state of cfsm.states) {
        if (!visited.has(state.id)) {
          if (dfs(state.id, visited, new Set())) {
            return true;
          }
        }
      }
      return false;
    }

    expect(hasCycle(aCFSM)).toBe(true);
  });

  it('should project conditional recursion (choice-based loop)', () => {
    const source = `
      protocol ConditionalLoop(role Server, role Client) {
        rec Loop {
          choice at Server {
            Server -> Client: Data();
            continue Loop;
          } or {
            Server -> Client: End();
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const serverCFSM = project(cfg, 'Server');

    // Server makes choice: Data (loops) or End (exits)
    expect(hasSendAction(serverCFSM, 'Data')).toBe(true);
    expect(hasSendAction(serverCFSM, 'End')).toBe(true);
  });

  it('should project nested recursion', () => {
    const source = `
      protocol NestedRecursion(role A, role B) {
        rec Outer {
          A -> B: Start();
          rec Inner {
            A -> B: Data();
            choice at A {
              continue Inner;
            } or {
            }
          }
          choice at A {
            continue Outer;
          } or {
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Should have both messages
    expect(hasSendAction(aCFSM, 'Start')).toBe(true);
    expect(hasSendAction(aCFSM, 'Data')).toBe(true);
  });

  it('should project recursion with continuation after loop', () => {
    const source = `
      protocol RecWithContinuation(role A, role B) {
        rec Loop {
          choice at A {
            A -> B: More();
            continue Loop;
          } or {
            A -> B: Done();
          }
        }
        B -> A: Final();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Loop messages
    expect(hasSendAction(aCFSM, 'More')).toBe(true);
    expect(hasSendAction(aCFSM, 'Done')).toBe(true);

    // Continuation after loop
    expect(hasReceiveAction(aCFSM, 'Final')).toBe(true);
  });

  it('should handle multiple continue points in same recursion', () => {
    const source = `
      protocol MultiContinue(role A, role B) {
        rec Loop {
          choice at A {
            A -> B: Option1();
            continue Loop;
          } or {
            A -> B: Option2();
            continue Loop;
          } or {
            A -> B: Exit();
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // All three options
    expect(hasSendAction(aCFSM, 'Option1')).toBe(true);
    expect(hasSendAction(aCFSM, 'Option2')).toBe(true);
    expect(hasSendAction(aCFSM, 'Exit')).toBe(true);
  });
});

// ============================================================================
// Known Protocol Tests (from literature)
// ============================================================================

describe('CFSM Projection - Known Protocols', () => {
  it('[Request-Response] should project correctly', () => {
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

    // Client: send, receive
    expect(hasSendAction(clientCFSM, 'Request')).toBe(true);
    expect(hasReceiveAction(clientCFSM, 'Response')).toBe(true);

    // Server: receive, send
    expect(hasReceiveAction(serverCFSM, 'Request')).toBe(true);
    expect(hasSendAction(serverCFSM, 'Response')).toBe(true);
  });

  it('[Two-Phase Commit] should project coordinator', () => {
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

    // Coordinator sends vote requests
    const voteRequestSends = findTransitionsWithAction(coordCFSM, 'send').filter(
      t => t.action && (t.action as SendAction).label === 'VoteRequest'
    );
    expect(voteRequestSends.length).toBe(2);

    // Receives votes
    const voteRecvs = findTransitionsWithAction(coordCFSM, 'receive').filter(
      t => t.action && (t.action as ReceiveAction).label === 'Vote'
    );
    expect(voteRecvs.length).toBe(2);

    // Makes decision
    expect(hasSendAction(coordCFSM, 'Commit')).toBe(true);
    expect(hasSendAction(coordCFSM, 'Abort')).toBe(true);
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

    // Producer makes choice
    expect(hasSendAction(producerCFSM, 'Data')).toBe(true);
    expect(hasSendAction(producerCFSM, 'End')).toBe(true);

    // Consumer receives
    expect(hasReceiveAction(consumerCFSM, 'Data')).toBe(true);
    expect(hasReceiveAction(consumerCFSM, 'End')).toBe(true);
  });

  it('[Three-Buyer] should project all roles correctly', () => {
    const source = `
      protocol ThreeBuyer(role Buyer1, role Buyer2, role Seller) {
        Buyer1 -> Seller: Title();
        Seller -> Buyer1: Quote();
        Buyer1 -> Buyer2: Share();
        choice at Buyer2 {
          Buyer2 -> Seller: Accept();
          Buyer2 -> Buyer1: Ok();
        } or {
          Buyer2 -> Seller: Reject();
          Buyer2 -> Buyer1: Quit();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const buyer1CFSM = project(cfg, 'Buyer1');
    const buyer2CFSM = project(cfg, 'Buyer2');
    const sellerCFSM = project(cfg, 'Seller');

    // Buyer1 starts, receives quote, shares with Buyer2
    expect(hasSendAction(buyer1CFSM, 'Title')).toBe(true);
    expect(hasReceiveAction(buyer1CFSM, 'Quote')).toBe(true);
    expect(hasSendAction(buyer1CFSM, 'Share')).toBe(true);

    // Buyer2 receives share, makes decision
    expect(hasReceiveAction(buyer2CFSM, 'Share')).toBe(true);
    expect(hasSendAction(buyer2CFSM, 'Accept')).toBe(true);
    expect(hasSendAction(buyer2CFSM, 'Reject')).toBe(true);

    // Seller receives title, sends quote, receives decision
    expect(hasReceiveAction(sellerCFSM, 'Title')).toBe(true);
    expect(hasSendAction(sellerCFSM, 'Quote')).toBe(true);
    expect(hasReceiveAction(sellerCFSM, 'Accept')).toBe(true);
    expect(hasReceiveAction(sellerCFSM, 'Reject')).toBe(true);
  });

  it('[Ping-Pong] should handle simple alternation', () => {
    const source = `
      protocol PingPong(role A, role B) {
        rec Game {
          choice at A {
            A -> B: Ping();
            B -> A: Pong();
            continue Game;
          } or {
            A -> B: Stop();
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const aCFSM = project(cfg, 'A');
    const bCFSM = project(cfg, 'B');

    // A sends Ping, receives Pong, or sends Stop
    expect(hasSendAction(aCFSM, 'Ping')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'Pong')).toBe(true);
    expect(hasSendAction(aCFSM, 'Stop')).toBe(true);

    // B receives Ping, sends Pong, or receives Stop
    expect(hasReceiveAction(bCFSM, 'Ping')).toBe(true);
    expect(hasSendAction(bCFSM, 'Pong')).toBe(true);
    expect(hasReceiveAction(bCFSM, 'Stop')).toBe(true);
  });
});

// ============================================================================
// Edge Cases and Error Conditions
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

    // Should have initial and terminal states
    expect(cfsm.states.length).toBeGreaterThan(0);
    expect(cfsm.initialState).toBeDefined();
    expect(cfsm.terminalStates.length).toBeGreaterThan(0);

    // Should have at least one transition (initial to terminal)
    expect(cfsm.transitions.length).toBeGreaterThan(0);
  });

  it('should throw error for non-existent role', () => {
    const source = `
      protocol TwoRoles(role A, role B) {
        A -> B: Message();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // Projecting for non-existent role should throw
    expect(() => project(cfg, 'C')).toThrow();
    expect(() => project(cfg, 'C')).toThrow(/Role "C" not found/);
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

    // Each role should have valid CFSM
    for (const [role, cfsm] of result.cfsms) {
      expect(cfsm.role).toBe(role);
      expect(cfsm.states.length).toBeGreaterThan(0);
      expect(cfsm.transitions.length).toBeGreaterThan(0);
    }
  });

  it('should handle single-role protocol', () => {
    const source = `
      protocol SingleRole(role A) {
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    expect(result.cfsms.size).toBe(1);
    expect(result.cfsms.has('A')).toBe(true);
  });

  it('should handle role that never participates', () => {
    const source = `
      protocol UnusedRole(role A, role B, role C) {
        A -> B: Message();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const cCFSM = project(cfg, 'C');

    // C has no actions, just initial -> terminal
    const actionTransitions = cCFSM.transitions.filter(t => t.action);
    expect(actionTransitions.length).toBe(0);
  });

  it('should handle long sequence (stress test)', () => {
    const source = `
      protocol LongSequence(role A, role B) {
        A -> B: M1();
        B -> A: M2();
        A -> B: M3();
        B -> A: M4();
        A -> B: M5();
        B -> A: M6();
        A -> B: M7();
        B -> A: M8();
        A -> B: M9();
        B -> A: M10();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // A should have 5 sends and 5 receives
    const sends = findTransitionsWithAction(aCFSM, 'send');
    const recvs = findTransitionsWithAction(aCFSM, 'receive');
    expect(sends.length).toBe(5);
    expect(recvs.length).toBe(5);
  });

  it('should handle many roles', () => {
    const source = `
      protocol ManyRoles(role A, role B, role C, role D, role E) {
        A -> B: M1();
        B -> C: M2();
        C -> D: M3();
        D -> E: M4();
        E -> A: M5();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    expect(result.cfsms.size).toBe(5);
    expect(result.errors.length).toBe(0);
  });
});

// ============================================================================
// Formal Correctness Properties (Honda-Yoshida-Carbone 2008)
// ============================================================================

describe('CFSM Projection - Formal Correctness Properties', () => {
  it('[Completeness] should project every message exactly once per role', () => {
    const source = `
      protocol CompletionCheck(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    // M1: should appear exactly once as send in A, exactly once as receive in B
    const aSends = result.cfsms.get('A')!.transitions.filter(
      t => t.action?.type === 'send' && (t.action as SendAction).label === 'M1'
    );
    const bRecvs = result.cfsms.get('B')!.transitions.filter(
      t => t.action?.type === 'receive' && (t.action as ReceiveAction).label === 'M1'
    );
    expect(aSends.length).toBe(1);
    expect(bRecvs.length).toBe(1);

    // M2: exactly once as send in B, exactly once as receive in C
    const bSends = result.cfsms.get('B')!.transitions.filter(
      t => t.action?.type === 'send' && (t.action as SendAction).label === 'M2'
    );
    const cRecvs = result.cfsms.get('C')!.transitions.filter(
      t => t.action?.type === 'receive' && (t.action as ReceiveAction).label === 'M2'
    );
    expect(bSends.length).toBe(1);
    expect(cRecvs.length).toBe(1);

    // M3: exactly once as send in C, exactly once as receive in A
    const cSends = result.cfsms.get('C')!.transitions.filter(
      t => t.action?.type === 'send' && (t.action as SendAction).label === 'M3'
    );
    const aRecvs = result.cfsms.get('A')!.transitions.filter(
      t => t.action?.type === 'receive' && (t.action as ReceiveAction).label === 'M3'
    );
    expect(cSends.length).toBe(1);
    expect(aRecvs.length).toBe(1);
  });

  it('[Correctness] should only include actions where role is involved', () => {
    const source = `
      protocol RoleCorrectness(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    // A's CFSM: should have M1 send, M2 should NOT appear
    const aCFSM = result.cfsms.get('A')!;
    const aSendActions = aCFSM.transitions
      .filter(t => t.action?.type === 'send')
      .map(t => (t.action as SendAction).label);
    const aRecvActions = aCFSM.transitions
      .filter(t => t.action?.type === 'receive')
      .map(t => (t.action as ReceiveAction).label);

    expect(aSendActions).toContain('M1');
    expect(aSendActions).not.toContain('M2');
    expect(aRecvActions).not.toContain('M2');

    // All send actions in A's CFSM are sent BY A (by definition of projection)
    // All receive actions in A's CFSM should have to === 'A' (implied by being in A's CFSM)
    // Verify role correctness: receiver is not the sender
    for (const t of aCFSM.transitions) {
      if (t.action?.type === 'send') {
        const sendTo = (t.action as SendAction).to;
        if (typeof sendTo === 'string') {
          expect(sendTo).not.toBe('A'); // Can't send to yourself
        }
      }
      if (t.action?.type === 'receive') {
        const recvFrom = (t.action as ReceiveAction).from;
        expect(recvFrom).not.toBe('A'); // Can't receive from yourself
      }
    }
  });

  it('[Composability] should have matching send/receive pairs (duality)', () => {
    const source = `
      protocol Duality(role A, role B, role C) {
        A -> B: Request();
        B -> A: Response();
        A -> C: Forward();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    // Check all send actions have matching receives
    for (const [role, cfsm] of result.cfsms) {
      for (const t of cfsm.transitions) {
        if (t.action?.type === 'send') {
          const sendAction = t.action as SendAction;
          const receiverCFSM = result.cfsms.get(sendAction.to)!;

          // Find matching receive in receiver's CFSM
          const matchingRecv = receiverCFSM.transitions.find(
            rt => rt.action?.type === 'receive' &&
                  (rt.action as ReceiveAction).from === role &&
                  (rt.action as ReceiveAction).label === sendAction.label
          );

          expect(matchingRecv).toBeDefined();
          expect((matchingRecv!.action as ReceiveAction).from).toBe(role);
          expect((matchingRecv!.action as ReceiveAction).label).toBe(sendAction.label);
        }
      }
    }
  });

  it('[Well-Formedness] should have no orphaned states', () => {
    const source = `
      protocol Reachability(role A, role B) {
        A -> B: Start();
        choice at A {
          A -> B: Option1();
        } or {
          A -> B: Option2();
        }
        B -> A: Done();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    for (const cfsm of result.cfsms.values()) {
      // Find all reachable states from initial state
      const reachable = new Set<string>();
      const queue = [cfsm.initialState];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (reachable.has(current)) continue;
        reachable.add(current);

        const outgoing = cfsm.transitions.filter(t => t.from === current);
        for (const t of outgoing) {
          if (!reachable.has(t.to)) {
            queue.push(t.to);
          }
        }
      }

      // All states should be reachable from initial
      for (const state of cfsm.states) {
        expect(reachable.has(state.id)).toBe(true);
      }
    }
  });

  it('[Well-Formedness] should have deterministic external choice (distinct labels)', () => {
    const source = `
      protocol DeterministicChoice(role Client, role Server) {
        choice at Client {
          Client -> Server: Login();
        } or {
          Client -> Server: Register();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const serverCFSM = project(cfg, 'Server');

    // Server has external choice - check labels are distinct
    const statesWithMultipleIncoming = new Map<string, string[]>();
    for (const t of serverCFSM.transitions) {
      if (t.action?.type === 'receive') {
        if (!statesWithMultipleIncoming.has(t.to)) {
          statesWithMultipleIncoming.set(t.to, []);
        }
        statesWithMultipleIncoming.get(t.to)!.push((t.action as ReceiveAction).label);
      }
    }

    // For each state with multiple incoming, labels should be distinct
    for (const [state, labels] of statesWithMultipleIncoming) {
      if (labels.length > 1) {
        const uniqueLabels = new Set(labels);
        expect(uniqueLabels.size).toBe(labels.length);
      }
    }
  });

  it('[Well-Formedness] should have initial and terminal states', () => {
    const source = `
      protocol BasicProtocol(role A, role B) {
        A -> B: Message();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    for (const cfsm of result.cfsms.values()) {
      // Must have initial state
      expect(cfsm.initialState).toBeDefined();
      expect(cfsm.states.some(s => s.id === cfsm.initialState)).toBe(true);

      // Must have at least one terminal state
      expect(cfsm.terminalStates.length).toBeGreaterThan(0);
      for (const termId of cfsm.terminalStates) {
        expect(cfsm.states.some(s => s.id === termId)).toBe(true);
      }
    }
  });
});

// ============================================================================
// Complex Integration Scenarios
// ============================================================================

describe('CFSM Projection - Complex Integration', () => {
  it('should handle choice within parallel', () => {
    const source = `
      protocol ChoiceInParallel(role A, role B, role C) {
        par {
          choice at A {
            A -> B: X();
          } or {
            A -> B: Y();
          }
        } and {
          A -> C: Z();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // A in both branches, one with choice
    expect(hasSendAction(aCFSM, 'X')).toBe(true);
    expect(hasSendAction(aCFSM, 'Y')).toBe(true);
    expect(hasSendAction(aCFSM, 'Z')).toBe(true);
  });

  it('should handle recursion within parallel', () => {
    const source = `
      protocol RecInParallel(role A, role B, role C) {
        par {
          rec Loop {
            A -> B: Data();
            choice at A {
              continue Loop;
            } or {
            }
          }
        } and {
          A -> C: Other();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // A in both branches, one with recursion
    expect(hasSendAction(aCFSM, 'Data')).toBe(true);
    expect(hasSendAction(aCFSM, 'Other')).toBe(true);
  });

  it('should handle parallel within choice', () => {
    const source = `
      protocol ParallelInChoice(role A, role B, role C) {
        choice at A {
          par {
            A -> B: M1();
          } and {
            A -> C: M2();
          }
        } or {
          A -> B: M3();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Choice between parallel and sequential
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasSendAction(aCFSM, 'M2')).toBe(true);
    expect(hasSendAction(aCFSM, 'M3')).toBe(true);
  });

  it('should handle all constructs combined', () => {
    const source = `
      protocol AllConstructs(role A, role B, role C) {
        rec MainLoop {
          choice at A {
            par {
              A -> B: P1();
            } and {
              A -> C: P2();
            }
            choice at B {
              B -> A: Continue();
              continue MainLoop;
            } or {
              B -> A: Stop();
            }
          } or {
            A -> B: Quit();
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Should project all messages involving A
    expect(hasSendAction(aCFSM, 'P1')).toBe(true);
    expect(hasSendAction(aCFSM, 'P2')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'Continue')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'Stop')).toBe(true);
    expect(hasSendAction(aCFSM, 'Quit')).toBe(true);
  });
});
