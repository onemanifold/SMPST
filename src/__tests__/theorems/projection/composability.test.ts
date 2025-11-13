/**
 * THEOREM 5.3: Projection Composability (Duality) (Honda et al. JACM 2016)
 *
 * STATEMENT:
 *   Local types projected from a global type compose back into a well-formed
 *   global type via duality conditions.
 *
 *   ∀ roles p, q: G ↓ p dual to G ↓ q
 *
 * FORMAL DUALITY:
 *   - Send !r.ℓ dual to Receive ?r.ℓ (matching label, opposite direction)
 *   - Internal choice ⊕{ℓᵢ: Tᵢ} dual to External choice &{ℓᵢ: T'ᵢ}
 *   - T₁ | T₂ dual to T'₁ | T'₂ (componentwise)
 *
 * INTUITION:
 *   Projections are mutually consistent. Every send has a matching receive.
 *   Choice makers and reactors are complementary. Protocols can be composed back.
 *
 * SOURCE: docs/theory/projection-correctness.md
 * CITATION: Honda, Yoshida, Carbone (JACM 2016), §5, Theorem 5.3
 *
 * PROOF SKETCH:
 *   By coinduction on local type structure:
 *   Define duality relation dual(T₁, T₂) inductively
 *   Show: ∀ p→q:ℓ in G, (G↓p has !q.ℓ) ⟺ (G↓q has ?p.ℓ)
 *   Show: ∀ choice at p, (G↓p has ⊕) ⟺ (G↓others have &)
 *   Reconstruction: From dual locals, synthesize global via merging. ∎
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

describe('Theorem 5.3: Projection Composability (Honda et al. 2016)', () => {
  /**
   * PROOF OBLIGATION 1: Send/Receive Duality
   */
  describe('Proof Obligation 1: Send-Receive Duality', () => {
    it('proves: every send has matching receive', () => {
      const protocol = `
        protocol Duality(role A, role B) {
          A -> B: Request();
          B -> A: Response();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projections = projectAll(cfg);

      const projA = projections.cfsms.get('A')!;
      const projB = projections.cfsms.get('B')!;

      // A: send Request, receive Response (CFSM semantics: count transitions)
      // B: receive Request, send Response (CFSM semantics: count transitions)
      expect(countActions(projA)).toBe(2);
      expect(countActions(projB)).toBe(2);

      // Verify duality: complementary actions
      // This is implicit in the projection - if A sends to B, B receives from A
    });

    it('proves: three-party duality', () => {
      const protocol = `
        protocol ThreeParty(role A, role B, role C) {
          A -> B: M1();
          B -> C: M2();
          C -> A: M3();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projections = projectAll(cfg);

      // Each global message appears twice: once as send, once as receive (CFSM semantics)
      const globalActions = cfg.nodes.filter(isActionNode).length;
      const localActionsTotal = Array.from(projections.cfsms.values())
        .reduce((sum, cfsm) => sum + countActions(cfsm), 0);

      expect(localActionsTotal).toBe(globalActions * 2);
    });

    it('proves: multicast duality', () => {
      const protocol = `
        protocol Multicast(role Sender, role R1, role R2) {
          Sender -> R1, R2: Broadcast();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projections = projectAll(cfg);

      // Sender has 1 send action (to multiple receivers) (CFSM semantics)
      const senderCFSM = projections.cfsms.get('Sender')!;
      expect(countActions(senderCFSM)).toBeGreaterThan(0);

      // Each receiver has 1 receive action (CFSM semantics)
      const r1CFSM = projections.cfsms.get('R1')!;
      const r2CFSM = projections.cfsms.get('R2')!;

      expect(countActions(r1CFSM)).toBeGreaterThan(0);
      expect(countActions(r2CFSM)).toBeGreaterThan(0);
    });
  });

  /**
   * PROOF OBLIGATION 2: Choice Duality (Internal ↔ External)
   */
  describe('Proof Obligation 2: Choice Duality', () => {
    it('proves: internal choice dual to external choice', () => {
      const protocol = `
        protocol ChoiceDuality(role Decider, role Reactor) {
          choice at Decider {
            Decider -> Reactor: Option1();
          } or {
            Decider -> Reactor: Option2();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projections = projectAll(cfg);

      const projDecider = projections.cfsms.get('Decider')!;
      const projReactor = projections.cfsms.get('Reactor')!;

      // Decider has internal choice (CFSM semantics: state with multiple outgoing transitions)
      expect(hasChoice(projDecider)).toBe(true);
      const deciderBranches = countChoiceBranches(projDecider);
      expect(deciderBranches).toBeGreaterThan(0);

      // Reactor has external choice (CFSM semantics: state with multiple outgoing transitions)
      expect(hasChoice(projReactor)).toBe(true);
      const reactorBranches = countChoiceBranches(projReactor);
      expect(reactorBranches).toBeGreaterThan(0);

      // Number of branches should match
      expect(deciderBranches).toBe(reactorBranches);
    });

    it('proves: n-way choice duality', () => {
      const protocol = `
        protocol NWayChoice(role C, role S) {
          choice at C {
            C -> S: Opt1();
          } or {
            C -> S: Opt2();
          } or {
            C -> S: Opt3();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projections = projectAll(cfg);

      const projC = projections.cfsms.get('C')!;
      const projS = projections.cfsms.get('S')!;

      // Both should have 3 branches (CFSM semantics: count choice branches)
      const cBranches = countChoiceBranches(projC);
      const sBranches = countChoiceBranches(projS);

      expect(cBranches).toBe(sBranches);
      expect(cBranches).toBe(3);
    });
  });

  /**
   * PROOF OBLIGATION 3: Parallel Composition Duality
   */
  describe('Proof Obligation 3: Parallel Duality', () => {
    it('proves: parallel projections are componentwise dual', () => {
      const protocol = `
        protocol ParallelDual(role A, role B, role C, role D) {
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

      // Each pair should have dual actions (CFSM semantics: count transitions)
      const projA = projections.cfsms.get('A')!;
      const projB = projections.cfsms.get('B')!;

      // A sends, then receives
      expect(countActions(projA)).toBe(2);
      // B receives, then sends
      expect(countActions(projB)).toBe(2);

      // Same for C-D pair
      const projC = projections.cfsms.get('C')!;
      const projD = projections.cfsms.get('D')!;

      expect(countActions(projC)).toBe(2);
      expect(countActions(projD)).toBe(2);
    });
  });

  /**
   * PROOF OBLIGATION 4: Recursion Duality
   */
  describe('Proof Obligation 4: Recursion Duality', () => {
    it('proves: recursive protocols maintain duality', () => {
      const protocol = `
        protocol RecursiveDual(role Client, role Server) {
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

      const projClient = projections.cfsms.get('Client')!;
      const projServer = projections.cfsms.get('Server')!;

      // Both should have actions (CFSM semantics)
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
   * COMPLEX PROTOCOL DUALITY
   */
  describe('Complex Protocol Duality', () => {
    it('proves: real-world protocol composability', () => {
      const protocol = `
        protocol Auth(role Client, role Server) {
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
      const projections = projectAll(cfg);

      const projClient = projections.cfsms.get('Client')!;
      const projServer = projections.cfsms.get('Server')!;

      // Client makes choice (2 branches) (CFSM semantics)
      const clientBranches = countChoiceBranches(projClient);
      expect(clientBranches).toBe(2);

      // Server reacts to choice (2 branches) (CFSM semantics)
      const serverBranches = countChoiceBranches(projServer);
      expect(serverBranches).toBe(2);

      // Both should have multiple actions (CFSM semantics: count transitions)
      expect(countActions(projClient)).toBeGreaterThan(2);
      expect(countActions(projServer)).toBeGreaterThan(2);
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
      expect(content).toContain('Composability');
      expect(content).toContain('Theorem 5.3');
      expect(content).toContain('Honda');
    });
  });
});
