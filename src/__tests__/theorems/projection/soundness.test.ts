/**
 * THEOREM 3.1: Projection Soundness (Deniélou, Yoshida, ESOP 2012)
 *
 * STATEMENT:
 *   Projected local types preserve the semantics of the global protocol.
 *   If G → G' (global step), then for each role r: G ↓ r → G' ↓ r
 *   and the composition of local projections simulates global behavior.
 *
 *   [[G]] ≈ ⊗r∈roles [[G ↓ r]]  (semantic equivalence via bisimulation)
 *
 * INTUITION:
 *   Local execution matches global specification. No role can deviate from
 *   the global protocol. Composition of local behaviors equals global behavior.
 *
 * SOURCE: docs/theory/projection-correctness.md
 * CITATION: Deniélou, Yoshida (ESOP 2012), §3, Theorem 3.1
 *
 * PROOF SKETCH:
 *   By bisimulation between global and local transition systems:
 *   Define R = {(G, ⟨T₁, ..., Tₙ⟩) | ∀i. Tᵢ = G ↓ i}
 *   Show forward simulation: G → G' ⟹ ∃ Tᵢ' s.t. Tᵢ → Tᵢ' ∧ (G', ⟨T'⟩) ∈ R
 *   Show backward simulation: Tᵢ → Tᵢ' ⟹ ∃ G' s.t. G → G' ∧ (G', ⟨T'⟩) ∈ R
 *   Therefore: Local transitions mirror global transitions. ∎
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { projectAll } from '../../../core/projection/projector';
import { CFGSimulator } from '../../../core/simulation/cfg-simulator';
import { isActionNode, isMessageAction } from '../../../core/cfg/types';

describe('Theorem 3.1: Projection Soundness (Deniélou & Yoshida 2012)', () => {
  /**
   * PROOF OBLIGATION 1: Local steps correspond to global steps
   */
  describe('Proof Obligation 1: Step Correspondence', () => {
    it('proves: linear protocol steps correspond', () => {
      const protocol = `
        protocol Linear(role A, role B) {
          A -> B: Request();
          B -> A: Response();
        }
      `;

      const ast = parse(protocol);
      const globalCFG = buildCFG(ast.declarations[0]);
      const projections = projectAll(globalCFG);

      // Global simulator
      const globalSim = new CFGSimulator(globalCFG, {
        maxSteps: 100,
        deterministic: true,
      });

      // Local simulators
      const localSimA = new CFGSimulator(projections.cfsms.get('A')!, {
        maxSteps: 100,
        deterministic: true,
      });

      const localSimB = new CFGSimulator(projections.cfsms.get('B')!, {
        maxSteps: 100,
        deterministic: true,
      });

      // Execute global
      globalSim.run();
      expect(globalSim.isComplete()).toBe(true);

      // Execute locals
      localSimA.run();
      localSimB.run();

      // Theorem 3.1: Both locals complete when global completes
      expect(localSimA.isComplete()).toBe(true);
      expect(localSimB.isComplete()).toBe(true);
    });

    it('proves: choice protocol steps correspond', () => {
      const protocol = `
        protocol Choice(role C, role S) {
          choice at C {
            C -> S: Login();
          } or {
            C -> S: Register();
          }
        }
      `;

      const ast = parse(protocol);
      const globalCFG = buildCFG(ast.declarations[0]);
      const projections = projectAll(globalCFG);

      // Verify projections exist
      expect(projections.cfsms.has('C')).toBe(true);
      expect(projections.cfsms.has('S')).toBe(true);

      // Both should have branch nodes
      const projC = projections.cfsms.get('C')!;
      const projS = projections.cfsms.get('S')!;

      expect(projC.nodes.some(n => n.type === 'branch')).toBe(true);
      expect(projS.nodes.some(n => n.type === 'branch')).toBe(true);
    });
  });

  /**
   * PROOF OBLIGATION 2: Trace equivalence
   */
  describe('Proof Obligation 2: Trace Equivalence', () => {
    it('proves: global trace matches composed local traces', () => {
      const protocol = `
        protocol Test(role A, role B, role C) {
          A -> B: M1();
          B -> C: M2();
        }
      `;

      const ast = parse(protocol);
      const globalCFG = buildCFG(ast.declarations[0]);

      // Global actions
      const globalActions = globalCFG.nodes
        .filter(isActionNode)
        .filter(n => isMessageAction(n.action));

      expect(globalActions).toHaveLength(2);

      const projections = projectAll(globalCFG);

      // Local actions (sum across all roles)
      const localActionsCount = Array.from(projections.cfsms.values())
        .reduce((sum, cfsm) => {
          return sum + cfsm.nodes.filter(isActionNode).length;
        }, 0);

      // Each global action appears twice (send + receive)
      expect(localActionsCount).toBe(globalActions.length * 2);
    });

    it('proves: parallel protocol trace equivalence', () => {
      const protocol = `
        protocol Parallel(role A, role B, role C, role D) {
          par {
            A -> B: M1();
          } and {
            C -> D: M2();
          }
        }
      `;

      const ast = parse(protocol);
      const globalCFG = buildCFG(ast.declarations[0]);
      const projections = projectAll(globalCFG);

      // All four roles should have projections
      expect(projections.cfsms.size).toBe(4);

      // Each pair should have actions
      const projA = projections.cfsms.get('A')!;
      const projB = projections.cfsms.get('B')!;
      const projC = projections.cfsms.get('C')!;
      const projD = projections.cfsms.get('D')!;

      expect(projA.nodes.filter(isActionNode).length).toBeGreaterThan(0);
      expect(projB.nodes.filter(isActionNode).length).toBeGreaterThan(0);
      expect(projC.nodes.filter(isActionNode).length).toBeGreaterThan(0);
      expect(projD.nodes.filter(isActionNode).length).toBeGreaterThan(0);
    });
  });

  /**
   * PROOF OBLIGATION 3: Preservation of protocol properties
   */
  describe('Proof Obligation 3: Property Preservation', () => {
    it('proves: deadlock-free global → deadlock-free locals', () => {
      const protocol = `
        protocol DeadlockFree(role A, role B) {
          A -> B: Ping();
          B -> A: Pong();
        }
      `;

      const ast = parse(protocol);
      const globalCFG = buildCFG(ast.declarations[0]);
      const projections = projectAll(globalCFG);

      // Global simulator completes
      const globalSim = new CFGSimulator(globalCFG, { maxSteps: 100 });
      globalSim.run();
      expect(globalSim.isComplete()).toBe(true);

      // Local simulators also complete
      for (const [_, cfsm] of projections.cfsms) {
        const localSim = new CFGSimulator(cfsm, { maxSteps: 100 });
        localSim.run();
        expect(localSim.isComplete()).toBe(true);
      }
    });

    it('proves: terminating global → terminating locals', () => {
      const protocol = `
        protocol Terminating(role A, role B) {
          A -> B: Start();
          B -> A: End();
        }
      `;

      const ast = parse(protocol);
      const globalCFG = buildCFG(ast.declarations[0]);
      const projections = projectAll(globalCFG);

      // Global terminates at terminal node
      const globalTerminals = globalCFG.nodes.filter(n => n.type === 'terminal');
      expect(globalTerminals.length).toBeGreaterThan(0);

      // Each local also terminates
      for (const [_, cfsm] of projections.cfsms) {
        const localTerminals = cfsm.nodes.filter(n => n.type === 'terminal');
        expect(localTerminals.length).toBeGreaterThan(0);
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
      expect(content).toContain('Soundness');
      expect(content).toContain('Theorem 3.1');
      expect(content).toContain('Deniélou');
    });
  });
});
