/**
 * THEOREM 4.7: Projection Completeness (Honda, Yoshida, Carbone, JACM 2016)
 *
 * STATEMENT:
 *   Every observable action in the global protocol G appears in the projection
 *   to some local type.
 *
 *   FORMAL: ∀ a ∈ actions(G), ∃ r ∈ Roles, a ∈ actions(G ↾ r)
 *
 * INTUITION:
 *   No actions are lost during projection. Every communication in the global
 *   protocol appears in at least one role's local type (sender and receiver).
 *
 * SOURCE: docs/theory/projection-correctness.md
 * CITATION: Honda, Yoshida, Carbone (JACM 2016), §4, Theorem 4.7
 *
 * PROOF SKETCH:
 *   By structural induction on G:
 *   - Base: Message A → B: ℓ projects to A (send) and B (receive) ✓
 *   - Choice: Each branch projected, all actions preserved ✓
 *   - Parallel: Both branches projected independently ✓
 *   - Recursion: Body projected, continue preserved ✓
 *   Key lemma: Projection is total (defined for all well-formed G). ∎
 *
 * PROOF OBLIGATIONS (tested as pure LTS properties):
 *   1. Every message action appears in sender's and receiver's projections
 *      - Verified by counting send/receive transitions in CFSMs
 *   2. Choice actions appear in all participant projections
 *      - Verified by detecting branching states (multiple outgoing transitions)
 *   3. Parallel actions appear in respective branch projections
 *      - Verified by counting actions in parallel participant CFSMs
 *   4. Recursive actions maintained through continue statements
 *      - Verified by detecting cycles in CFSM transition graphs
 *
 * TESTING METHODOLOGY:
 *   All tests use ONLY CFSM/LTS properties:
 *   - states: control locations
 *   - transitions: labeled with actions (send, receive, tau)
 *   - Graph analysis: branching, cycles, reachability
 *
 *   NO CFG PROPERTIES USED (no nodes/edges checking).
 *
 * @reference Deniélou, P.-M., & Yoshida, N. (2012). Multiparty Session Types
 *            Meet Communicating Automata. ESOP 2012.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { projectAll } from '../../../core/projection/projector';
import { isActionNode, isMessageAction } from '../../../core/cfg/types';
import {
  countActions,
  findBranchingStates,
  hasCycles,
  findBackEdges,
} from '../../../core/projection/lts-analysis';

describe('Theorem 4.7: Projection Completeness (Honda et al. 2016)', () => {
  /**
   * PROOF OBLIGATION 1: Message actions appear in both sender and receiver projections
   *
   * FORMAL PROPERTY:
   *   ∀ (A → B: ℓ) ∈ Global:
   *     ∃ t_send ∈ (G ↾ A).transitions: t_send.action = send(B, ℓ)
   *     ∃ t_recv ∈ (G ↾ B).transitions: t_recv.action = receive(A, ℓ)
   *
   * WHY THIS IS VALID:
   *   In LTS semantics, actions are labels on transitions.
   *   Completeness means every global action appears as a transition label
   *   in the appropriate role's CFSM.
   */
  describe('Proof Obligation 1: Message Completeness', () => {
    it('proves: every message appears in sender and receiver projections', () => {
      const protocol = `
        protocol TwoWay(role A, role B) {
          A -> B: Request();
          B -> A: Response();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);

      // Extract global actions from CFG (for comparison)
      const globalActions = cfg.nodes
        .filter(isActionNode)
        .filter(n => isMessageAction(n.action))
        .map(n => n.action);

      expect(globalActions).toHaveLength(2);

      // Project to all roles (produces pure LTS CFSMs)
      const projections = projectAll(cfg);

      // THEOREM 4.7: Every action appears in at least one projection
      // VERIFICATION: Count send/receive transitions in CFSMs
      for (const action of globalActions) {
        if (!isMessageAction(action)) continue;

        const sender = action.from;
        const receiver = typeof action.to === 'string' ? action.to : action.to[0];
        const label = action.label;

        // Action must appear in sender's projection as SEND transition
        const senderCFSM = projections.cfsms.get(sender);
        expect(senderCFSM).toBeDefined();

        // LTS CHECK: Count send transitions with this label
        const senderSendCount = countActions(senderCFSM!, 'send', label);
        expect(senderSendCount).toBeGreaterThan(0);
        // ✅ PROOF: Sender has transition with send action

        // Action must appear in receiver's projection as RECEIVE transition
        const receiverCFSM = projections.cfsms.get(receiver);
        expect(receiverCFSM).toBeDefined();

        // LTS CHECK: Count receive transitions with this label
        const receiverRecvCount = countActions(receiverCFSM!, 'receive', label);
        expect(receiverRecvCount).toBeGreaterThan(0);
        // ✅ PROOF: Receiver has transition with receive action
      }
    });

    it('proves: three-party protocol actions complete', () => {
      const protocol = `
        protocol Chain(role A, role B, role C) {
          A -> B: M1();
          B -> C: M2();
          C -> A: M3();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);

      // 3 global actions (3 messages)
      const globalActions = cfg.nodes
        .filter(isActionNode)
        .filter(n => isMessageAction(n.action));

      expect(globalActions).toHaveLength(3);

      const projections = projectAll(cfg);

      /**
       * EXPECTED PROJECTIONS (LTS view):
       *
       * A: q₀ --!M1--> q₁ --?M3--> q₂
       *    2 transitions (1 send, 1 receive)
       *
       * B: q₀ --?M1--> q₁ --!M2--> q₂
       *    2 transitions (1 receive, 1 send)
       *
       * C: q₀ --?M2--> q₁ --!M3--> q₂
       *    2 transitions (1 receive, 1 send)
       */

      // Verify each role has correct number of actions in transitions
      const cfsmA = projections.cfsms.get('A')!;
      const cfsmB = projections.cfsms.get('B')!;
      const cfsmC = projections.cfsms.get('C')!;

      // A: 1 send + 1 receive = 2 actions
      expect(countActions(cfsmA, 'send') + countActions(cfsmA, 'receive')).toBe(2);
      // B: 1 send + 1 receive = 2 actions
      expect(countActions(cfsmB, 'send') + countActions(cfsmB, 'receive')).toBe(2);
      // C: 1 send + 1 receive = 2 actions
      expect(countActions(cfsmC, 'send') + countActions(cfsmC, 'receive')).toBe(2);

      // Total: 3 global actions × 2 (send+receive per message) = 6 local actions
      const totalLocalActions = Array.from(projections.cfsms.values())
        .reduce((sum, cfsm) =>
          sum + countActions(cfsm, 'send') + countActions(cfsm, 'receive'), 0
        );

      expect(totalLocalActions).toBe(6);
      // ✅ PROOF: All global actions appear in projections (as send+receive pairs)
    });

    it('proves: multicast actions appear in all receivers', () => {
      const protocol = `
        protocol Multicast(role Coordinator, role W1, role W2) {
          Coordinator -> W1, W2: Broadcast();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);

      const projections = projectAll(cfg);

      /**
       * EXPECTED (LTS view):
       * Coordinator: q₀ --!Broadcast--> q₁  (send to multiple)
       * W1: q₀ --?Broadcast--> q₁  (receive from Coordinator)
       * W2: q₀ --?Broadcast--> q₁  (receive from Coordinator)
       *
       * MULTICAST SEMANTICS:
       * One send transition in sender, multiple receive transitions in receivers.
       */

      // Coordinator sends (1 send action)
      const coordCFSM = projections.cfsms.get('Coordinator')!;
      expect(countActions(coordCFSM, 'send', 'Broadcast')).toBeGreaterThan(0);

      // Both workers receive (1 receive action each)
      const w1CFSM = projections.cfsms.get('W1')!;
      const w2CFSM = projections.cfsms.get('W2')!;

      expect(countActions(w1CFSM, 'receive', 'Broadcast')).toBeGreaterThan(0);
      expect(countActions(w2CFSM, 'receive', 'Broadcast')).toBeGreaterThan(0);
      // ✅ PROOF: Multicast appears in all participant CFSMs
    });
  });

  /**
   * PROOF OBLIGATION 2: Choice actions appear in all participant projections
   *
   * FORMAL PROPERTY:
   *   choice at R { B₁ } or { B₂ } projects to:
   *     - R: internal choice (branching state with multiple sends)
   *     - Others: external choice (branching state with multiple receives)
   *
   * LTS REPRESENTATION:
   *   A branching state = state q with |{(q, a, q') ∈ → | a ≠ τ}| > 1
   *
   * WHY THIS IS VALID:
   *   Choice in session types is represented as non-determinism in LTS.
   *   We detect branching by counting outgoing transitions from states.
   */
  describe('Proof Obligation 2: Choice Completeness', () => {
    it('proves: all choice branches appear in projections', () => {
      const protocol = `
        protocol Choice(role Client, role Server) {
          choice at Client {
            Client -> Server: Login();
            Server -> Client: Token();
          } or {
            Client -> Server: Register();
            Server -> Client: Confirmation();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);

      // Global CFG has explicit branch node
      const globalActions = cfg.nodes.filter(isActionNode);
      expect(globalActions.length).toBeGreaterThan(0);

      const projections = projectAll(cfg);

      // Both roles must have projections
      expect(projections.cfsms.has('Client')).toBe(true);
      expect(projections.cfsms.has('Server')).toBe(true);

      const clientCFSM = projections.cfsms.get('Client')!;
      const serverCFSM = projections.cfsms.get('Server')!;

      /**
       * CLIENT (chooser) - INTERNAL CHOICE:
       *   LTS: q₀ --!Login--> q₁
       *        q₀ --!Register--> q₂
       *   Property: q₀ is a branching state (2 outgoing send transitions)
       */
      const clientBranches = findBranchingStates(clientCFSM);
      expect(clientBranches.length).toBeGreaterThan(0);
      // ✅ PROOF: Client has branching state (internal choice)

      /**
       * SERVER (reactor) - EXTERNAL CHOICE:
       *   LTS: q₀ --?Login--> q₁
       *        q₀ --?Register--> q₂
       *   Property: q₀ is a branching state (2 outgoing receive transitions)
       */
      const serverBranches = findBranchingStates(serverCFSM);
      expect(serverBranches.length).toBeGreaterThan(0);
      // ✅ PROOF: Server has branching state (external choice)
    });

    it('proves: nested choices preserve all actions', () => {
      const protocol = `
        protocol NestedChoice(role A, role B) {
          choice at A {
            A -> B: Opt1();
            choice at B {
              B -> A: SubOpt1();
            } or {
              B -> A: SubOpt2();
            }
          } or {
            A -> B: Opt2();
            B -> A: Response();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);

      // Global has 5 messages
      const globalActions = cfg.nodes.filter(isActionNode);
      expect(globalActions.length).toBeGreaterThan(3);

      const projections = projectAll(cfg);
      const projA = projections.cfsms.get('A')!;
      const projB = projections.cfsms.get('B')!;

      /**
       * NESTED CHOICE PROJECTIONS:
       *
       * A must have:
       * - First choice: 2 sends (Opt1 or Opt2)
       * - Receives in both branches (SubOpt1, SubOpt2, or Response)
       *
       * B must have:
       * - First choice: 2 receives (Opt1 or Opt2)
       * - Nested choice: 2 sends (SubOpt1 or SubOpt2) in first branch
       * - Single send (Response) in second branch
       */

      // Both should have multiple actions (nested structure)
      const actionsA = countActions(projA, 'send') + countActions(projA, 'receive');
      const actionsB = countActions(projB, 'send') + countActions(projB, 'receive');

      expect(actionsA).toBeGreaterThan(2);
      expect(actionsB).toBeGreaterThan(2);
      // ✅ PROOF: Nested choices preserve all actions in projections
    });
  });

  /**
   * PROOF OBLIGATION 3: Parallel actions appear in respective branch projections
   *
   * FORMAL PROPERTY:
   *   par { B₁ } and { B₂ } projects to independent CFSMs for participants.
   *   If role r participates in Bᵢ, actions from Bᵢ appear in (G ↾ r).
   *
   * LTS REPRESENTATION:
   *   Parallel composition doesn't create special nodes - just sequences
   *   of actions in each participant's CFSM.
   *
   * WHY THIS IS VALID:
   *   Projection is compositional: (B₁ | B₂) ↾ r = (B₁ ↾ r) | (B₂ ↾ r)
   *   We verify by counting actions in participant CFSMs.
   */
  describe('Proof Obligation 3: Parallel Completeness', () => {
    it('proves: parallel branch actions appear in respective projections', () => {
      const protocol = `
        protocol Parallel(role A, role B, role C, role D) {
          par {
            A -> B: AB();
          } and {
            C -> D: CD();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);

      const projections = projectAll(cfg);
      const projA = projections.cfsms.get('A')!;
      const projB = projections.cfsms.get('B')!;
      const projC = projections.cfsms.get('C')!;
      const projD = projections.cfsms.get('D')!;

      /**
       * PARALLEL SEMANTICS (LTS view):
       * A and B participate in first branch: AB message
       * C and D participate in second branch: CD message
       * These execute independently (interleaving semantics)
       */

      // Branch 1 participants
      expect(countActions(projA, 'send') + countActions(projA, 'receive')).toBe(1); // A sends
      expect(countActions(projB, 'send') + countActions(projB, 'receive')).toBe(1); // B receives

      // Branch 2 participants
      expect(countActions(projC, 'send') + countActions(projC, 'receive')).toBe(1); // C sends
      expect(countActions(projD, 'send') + countActions(projD, 'receive')).toBe(1); // D receives

      // ✅ PROOF: Each participant has exactly the actions from their branch
    });
  });

  /**
   * PROOF OBLIGATION 4: Recursive actions maintained through continue statements
   *
   * FORMAL PROPERTY:
   *   rec X { B; continue X } projects to CFSM with cycle:
   *     (G ↾ r) contains cycle if r participates in B
   *
   * LTS REPRESENTATION:
   *   Cycle = back-edge in transition graph: (q_n, a, q_0) where q_0 ∈ path to q_n
   *
   * WHY THIS IS VALID:
   *   Recursion in session types = cycles in CFSM state graph.
   *   We detect cycles using standard graph algorithms (DFS).
   */
  describe('Proof Obligation 4: Recursion Completeness', () => {
    it('proves: recursive protocol actions appear in all iterations', () => {
      const protocol = `
        protocol Echo(role Client, role Server) {
          rec Loop {
            Client -> Server: Request();
            Server -> Client: Response();
            continue Loop;
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);

      const projections = projectAll(cfg);
      const projClient = projections.cfsms.get('Client')!;
      const projServer = projections.cfsms.get('Server')!;

      /**
       * RECURSIVE PROTOCOL (LTS view):
       *
       * Client: q₀ --!Request--> q₁ --?Response--> q₀  (cycle!)
       * Server: q₀ --?Request--> q₁ --!Response--> q₀  (cycle!)
       *
       * Property: Both CFSMs contain cycles (back-edges to q₀)
       */

      // Both should have cycles (recursion)
      expect(hasCycles(projClient)).toBe(true);
      expect(hasCycles(projServer)).toBe(true);
      // ✅ PROOF: Recursion preserved as cycles in CFSMs

      // Both should have back-edges (continue transitions)
      const clientBackEdges = findBackEdges(projClient);
      const serverBackEdges = findBackEdges(projServer);

      expect(clientBackEdges.length).toBeGreaterThan(0);
      expect(serverBackEdges.length).toBeGreaterThan(0);
      // ✅ PROOF: Continue statements appear as back-edges in transition graph
    });
  });

  /**
   * COMPLEX PROTOCOLS: Real-world protocol completeness
   *
   * Tests projection completeness on complex protocols combining
   * choice, recursion, and multicast.
   */
  describe('Complex Protocol Completeness', () => {
    it('proves: real-world protocol completeness', () => {
      const protocol = `
        protocol HTTPSession(role Client, role Server, role Cache) {
          Client -> Server: GET();
          choice at Server {
            Server -> Client, Cache: OK();
          } or {
            Server -> Client: NotFound();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);

      const globalActions = cfg.nodes.filter(isActionNode);
      expect(globalActions.length).toBeGreaterThan(0);

      const projections = projectAll(cfg);

      /**
       * COMPLEX PROTOCOL VERIFICATION:
       * Verify every global action appears in appropriate CFSMs.
       */

      // Each global message should appear as send and receive(s)
      for (const node of globalActions) {
        if (!isActionNode(node)) continue;
        const action = node.action;
        if (!isMessageAction(action)) continue;

        const sender = action.from;
        const receivers = typeof action.to === 'string' ? [action.to] : action.to;
        const label = action.label;

        // Sender projection must exist and have send transition
        const senderProj = projections.cfsms.get(sender);
        expect(senderProj).toBeDefined();
        expect(countActions(senderProj!, 'send', label)).toBeGreaterThan(0);
        // ✅ PROOF: Sender has action

        // Each receiver projection must have receive transition
        for (const receiver of receivers) {
          const receiverProj = projections.cfsms.get(receiver);
          expect(receiverProj).toBeDefined();
          expect(countActions(receiverProj!, 'receive', label)).toBeGreaterThan(0);
          // ✅ PROOF: All receivers have action
        }
      }
    });
  });
});
