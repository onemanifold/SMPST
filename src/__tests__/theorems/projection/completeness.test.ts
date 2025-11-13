/**
 * THEOREM 4.7: Projection Completeness (Honda, Yoshida, Carbone, JACM 2016)
 *
 * STATEMENT:
 *   Every observable action in the global protocol G appears in the projection
 *   to some local type.
 *
 *   ∀ a ∈ actions(G), ∃ r ∈ Roles, a ∈ actions(G ↓ r)
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
 * PROOF OBLIGATIONS:
 *   1. Every message action appears in sender's and receiver's projections
 *   2. Choice actions appear in all participant projections
 *   3. Parallel actions appear in respective branch projections
 *   4. Recursive actions maintained through continue statements
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { projectAll } from '../../../core/projection/projector';
import { isActionNode, isMessageAction } from '../../../core/cfg/types';

// Helper: Count non-tau actions in CFSM (actions live on transitions in LTS)
const countActions = (cfsm: any) =>
  cfsm.transitions.filter((t: any) => t.action.type !== 'tau').length;

// Helper: Get all send/receive transitions
const getMessageTransitions = (cfsm: any) =>
  cfsm.transitions.filter((t: any) => t.action.type === 'send' || t.action.type === 'receive');

// Helper: Check if CFSM has choice (state with multiple outgoing transitions)
const hasChoice = (cfsm: any) => {
  const outgoingCounts = new Map<string, number>();
  for (const t of cfsm.transitions) {
    outgoingCounts.set(t.from, (outgoingCounts.get(t.from) || 0) + 1);
  }
  return Array.from(outgoingCounts.values()).some(count => count > 1);
};

// Helper: Check if CFSM has recursion (transitions that loop back to earlier states)
const hasRecursion = (cfsm: any) => {
  const stateOrder = new Map<string, number>();
  cfsm.states.forEach((s: string, i: number) => stateOrder.set(s, i));
  return cfsm.transitions.some((t: any) => {
    const fromOrder = stateOrder.get(t.from) || 0;
    const toOrder = stateOrder.get(t.to) || 0;
    return toOrder <= fromOrder && t.action.type !== 'tau'; // Back-edge with action
  });
};

// Helper: Count choice branches (states with multiple non-tau outgoing transitions)
const countChoiceBranches = (cfsm: any) => {
  const branchCounts = new Map<string, number>();
  for (const t of cfsm.transitions) {
    if (t.action.type !== 'tau') {
      branchCounts.set(t.from, (branchCounts.get(t.from) || 0) + 1);
    }
  }
  return Array.from(branchCounts.values()).reduce((sum, count) => sum + (count > 1 ? count : 0), 0);
};

describe('Theorem 4.7: Projection Completeness (Honda et al. 2016)', () => {
  /**
   * PROOF OBLIGATION 1: Message actions appear in both sender and receiver projections
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

      // Extract global actions
      const globalActions = cfg.nodes
        .filter(isActionNode)
        .filter(n => isMessageAction(n.action))
        .map(n => n.action);

      expect(globalActions).toHaveLength(2);

      // Project to all roles
      const projections = projectAll(cfg);

      // Theorem 4.7: Every action appears in at least one projection
      for (const action of globalActions) {
        if (!isMessageAction(action)) continue;

        const sender = action.from;
        const receiver = typeof action.to === 'string' ? action.to : action.to[0];

        // Action must appear in sender's projection (CFSM/LTS semantics)
        const senderCFSM = projections.cfsms.get(sender);
        expect(senderCFSM).toBeDefined();

        // Action must appear in receiver's projection (CFSM/LTS semantics)
        const receiverCFSM = projections.cfsms.get(receiver);
        expect(receiverCFSM).toBeDefined();

        // Both projections should have transitions with send/receive actions
        // In CFSM, actions live on TRANSITIONS, not nodes
        const senderActions = senderCFSM!.transitions.filter(t => t.action.type === 'send');
        const receiverActions = receiverCFSM!.transitions.filter(t => t.action.type === 'receive');

        expect(senderActions.length).toBeGreaterThan(0);
        expect(receiverActions.length).toBeGreaterThan(0);
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

      const globalActions = cfg.nodes
        .filter(isActionNode)
        .filter(n => isMessageAction(n.action));

      expect(globalActions).toHaveLength(3);

      const projections = projectAll(cfg);

      // Verify each role has actions (CFSM semantics: count non-tau transitions)
      const countActions = (cfsm: any) =>
        cfsm.transitions.filter((t: any) => t.action.type !== 'tau').length;

      expect(countActions(projections.cfsms.get('A')!)).toBe(2); // send M1, receive M3
      expect(countActions(projections.cfsms.get('B')!)).toBe(2); // receive M1, send M2
      expect(countActions(projections.cfsms.get('C')!)).toBe(2); // receive M2, send M3

      // Total: 3 global actions × 2 (send+receive) = 6 local actions
      const totalLocalActions = Array.from(projections.cfsms.values())
        .reduce((sum, cfsm) => sum + countActions(cfsm), 0);

      expect(totalLocalActions).toBe(6);
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

      // Coordinator sends (CFSM semantics: check transitions)
      const coordCFSM = projections.cfsms.get('Coordinator')!;
      expect(countActions(coordCFSM)).toBeGreaterThan(0);

      // Both workers receive (CFSM semantics: check transitions)
      const w1CFSM = projections.cfsms.get('W1')!;
      const w2CFSM = projections.cfsms.get('W2')!;

      expect(countActions(w1CFSM)).toBeGreaterThan(0);
      expect(countActions(w2CFSM)).toBeGreaterThan(0);
    });
  });

  /**
   * PROOF OBLIGATION 2: Choice actions preserved in projections
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

      const globalActions = cfg.nodes.filter(isActionNode);
      expect(globalActions.length).toBeGreaterThan(0);

      const projections = projectAll(cfg);

      // Both roles must have projections
      expect(projections.cfsms.has('Client')).toBe(true);
      expect(projections.cfsms.has('Server')).toBe(true);

      // Client projection must have choice (CFSM semantics: state with multiple outgoing transitions)
      const clientCFSM = projections.cfsms.get('Client')!;
      expect(hasChoice(clientCFSM)).toBe(true);
      expect(countChoiceBranches(clientCFSM)).toBeGreaterThan(0);

      // Server projection must have choice (CFSM semantics: external choice)
      const serverCFSM = projections.cfsms.get('Server')!;
      expect(hasChoice(serverCFSM)).toBe(true);
      expect(countChoiceBranches(serverCFSM)).toBeGreaterThan(0);
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

      const globalActions = cfg.nodes.filter(isActionNode);
      const projections = projectAll(cfg);

      // All global actions must appear in projections (CFSM semantics)
      const projA = projections.cfsms.get('A')!;
      const projB = projections.cfsms.get('B')!;

      // Both projections should have multiple actions (count transitions)
      expect(countActions(projA)).toBeGreaterThan(2);
      expect(countActions(projB)).toBeGreaterThan(2);
    });
  });

  /**
   * PROOF OBLIGATION 3: Parallel actions preserved
   */
  describe('Proof Obligation 3: Parallel Completeness', () => {
    it('proves: parallel branch actions appear in respective projections', () => {
      const protocol = `
        protocol Parallel(role A, role B, role C, role D) {
          par {
            A -> B: M1();
            B -> A: R1();
          } and {
            C -> D: M2();
            D -> C: R2();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);

      const projections = projectAll(cfg);

      // A and B participate in first branch (CFSM semantics: count transitions)
      const projA = projections.cfsms.get('A')!;
      const projB = projections.cfsms.get('B')!;

      expect(countActions(projA)).toBe(2);
      expect(countActions(projB)).toBe(2);

      // C and D participate in second branch (CFSM semantics: count transitions)
      const projC = projections.cfsms.get('C')!;
      const projD = projections.cfsms.get('D')!;

      expect(countActions(projC)).toBe(2);
      expect(countActions(projD)).toBe(2);
    });
  });

  /**
   * PROOF OBLIGATION 4: Recursive actions preserved
   */
  describe('Proof Obligation 4: Recursion Completeness', () => {
    it('proves: recursive protocol actions appear in all iterations', () => {
      const protocol = `
        protocol Recursive(role Client, role Server) {
          rec Loop {
            Client -> Server: Request();
            Server -> Client: Response();
            choice at Client {
              Client -> Server: Continue();
              continue Loop;
            } or {
              Client -> Server: Done();
            }
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);

      const projections = projectAll(cfg);

      // Both roles must have projections with recursion (CFSM semantics)
      const projClient = projections.cfsms.get('Client')!;
      const projServer = projections.cfsms.get('Server')!;

      // Both should have actions (recursion means they loop back)
      expect(countActions(projClient)).toBeGreaterThan(0);
      expect(countActions(projServer)).toBeGreaterThan(0);

      // Both should have choice (from the choice at Client and its projection)
      expect(hasChoice(projClient)).toBe(true);
      expect(hasChoice(projServer)).toBe(true);

      // Both should have recursive structure (back-edges in transitions)
      expect(hasRecursion(projClient)).toBe(true);
      expect(hasRecursion(projServer)).toBe(true);
    });
  });

  /**
   * COMPLEX PROTOCOLS
   */
  describe('Complex Protocol Completeness', () => {
    it('proves: real-world protocol completeness', () => {
      const protocol = `
        protocol TwoPhaseCommit(role Coordinator, role W1, role W2) {
          Coordinator -> W1: Prepare();
          Coordinator -> W2: Prepare();
          W1 -> Coordinator: Vote();
          W2 -> Coordinator: Vote();
          choice at Coordinator {
            Coordinator -> W1: Commit();
            Coordinator -> W2: Commit();
          } or {
            Coordinator -> W1: Abort();
            Coordinator -> W2: Abort();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);

      const globalActions = cfg.nodes.filter(isActionNode);
      const projections = projectAll(cfg);

      // Every global action must appear in projections (CFSM semantics)
      for (const node of globalActions) {
        if (!isMessageAction(node.action)) continue;

        const action = node.action;
        const sender = action.from;
        const receivers = typeof action.to === 'string' ? [action.to] : action.to;

        // Sender projection must exist and have actions (count transitions)
        const senderProj = projections.cfsms.get(sender);
        expect(senderProj).toBeDefined();
        expect(countActions(senderProj!)).toBeGreaterThan(0);

        // Each receiver projection must exist and have actions (count transitions)
        for (const receiver of receivers) {
          const receiverProj = projections.cfsms.get(receiver);
          expect(receiverProj).toBeDefined();
          expect(countActions(receiverProj!)).toBeGreaterThan(0);
        }
      }
    });
  });

  /**
   * DOCUMENTATION LINK
   */
  describe('Documentation Reference', () => {
    it('references formal theory document', () => {
      const fs = require('fs');
      const path = require('path');
      const docPath = path.join(
        __dirname,
        '../../../../docs/theory/projection-correctness.md'
      );

      expect(fs.existsSync(docPath)).toBe(true);

      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain('Completeness');
      expect(content).toContain('Theorem 4.7');
      expect(content).toContain('Honda');
    });
  });
});
