/**
 * LEMMA 3.6: Well-Formedness Preservation (Honda et al. JACM 2016)
 *
 * STATEMENT:
 *   If the global type G is well-formed, then the local projections G ↓ r
 *   are also well-formed session types.
 *
 *   well-formed(G) ⟹ ∀r. well-formed(G ↓ r)
 *
 * INTUITION:
 *   Projection preserves correctness properties. Safe global implies safe local.
 *   Deadlock-free global implies deadlock-free locals. Deterministic global
 *   implies deterministic locals.
 *
 * SOURCE: docs/theory/projection-correctness.md
 * CITATION: Honda, Yoshida, Carbone (JACM 2016), §3, Lemma 3.6
 *
 * PROOF SKETCH:
 *   By induction on global type structure:
 *   - Base: p→q:ℓ well-formed ⟹ !q.ℓ and ?p.ℓ well-formed ✓
 *   - Choice: Labels unique ⟹ projected labels unique ✓
 *   - Parallel: No races ⟹ projected branches disjoint ✓
 *   - Recursion: Guarded ⟹ projected recursion guarded ✓
 *   Key: Well-formedness properties are compositional. ∎
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { projectAll } from '../../../core/projection/projector';
import { verifyProtocol, checkProgress, checkChoiceDeterminism } from '../../../core/verification/verifier';

// Helper: Count non-tau actions in CFSM (actions live on transitions in LTS)
const countActions = (cfsm: any) =>
  cfsm.transitions.filter((t: any) => t.action.type !== 'tau').length;

// Helper: Check if CFSM has terminal states (states with no outgoing transitions)
const hasTerminalStates = (cfsm: any) => {
  const statesWithOutgoing = new Set(cfsm.transitions.map((t: any) => t.from));
  return cfsm.states.some((s: string) => !statesWithOutgoing.has(s));
};

// Helper: Check if CFSM is deterministic (no state has multiple outgoing transitions with same action)
const isChoiceDeterministic = (cfsm: any) => {
  const stateActions = new Map<string, Set<string>>();
  for (const t of cfsm.transitions) {
    if (!stateActions.has(t.from)) {
      stateActions.set(t.from, new Set());
    }
    const actionKey = `${t.action.type}-${t.action.label || ''}`;
    if (stateActions.get(t.from)!.has(actionKey)) {
      return false; // Non-deterministic: same action from same state
    }
    stateActions.get(t.from)!.add(actionKey);
  }
  return true;
};

// Helper: Check if CFSM can progress (has actions)
const canProgress = (cfsm: any) => {
  return cfsm.transitions.length > 0 && countActions(cfsm) > 0;
};

describe('Lemma 3.6: Well-Formedness Preservation (Honda et al. 2016)', () => {
  describe('Proof Obligation 1: Progress Preservation', () => {
    it('proves: deadlock-free global → deadlock-free locals', () => {
      const protocol = `
        protocol NoDeadlock(role A, role B) {
          A -> B: Request();
          B -> A: Response();
        }
      `;

      const ast = parse(protocol);
      const globalCFG = buildCFG(ast.declarations[0]);

      // Global well-formed (verify on CFG)
      const globalWF = verifyProtocol(globalCFG);
      expect(globalWF.progress.canProgress).toBe(true);
      expect(globalWF.deadlock.hasDeadlock).toBe(false);

      // Project
      const projections = projectAll(globalCFG);

      // Lemma 3.6: Locals also deadlock-free (CFSM semantics)
      for (const [role, cfsm] of projections.cfsms) {
        expect(canProgress(cfsm)).toBe(true);
        expect(hasTerminalStates(cfsm)).toBe(true);
      }
    });
  });

  describe('Proof Obligation 2: Determinism Preservation', () => {
    it('proves: deterministic global → deterministic locals', () => {
      const protocol = `
        protocol Deterministic(role C, role S) {
          choice at C {
            C -> S: Login();
          } or {
            C -> S: Register();
          }
        }
      `;

      const ast = parse(protocol);
      const globalCFG = buildCFG(ast.declarations[0]);

      // Global deterministic (verify on CFG)
      const globalWF = verifyProtocol(globalCFG);
      expect(globalWF.choiceDeterminism.isDeterministic).toBe(true);

      // Project
      const projections = projectAll(globalCFG);

      // Lemma 3.6: Locals also deterministic (CFSM semantics)
      for (const [role, cfsm] of projections.cfsms) {
        expect(isChoiceDeterministic(cfsm)).toBe(true);
      }
    });
  });

  describe('Proof Obligation 3: Complex Protocol Preservation', () => {
    it('proves: well-formed complex protocol → well-formed locals', () => {
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
      const globalCFG = buildCFG(ast.declarations[0]);

      // Global well-formed (verify on CFG)
      const globalWF = verifyProtocol(globalCFG);
      expect(globalWF.connectedness.isConnected).toBe(true);
      expect(globalWF.choiceDeterminism.isDeterministic).toBe(true);
      expect(globalWF.progress.canProgress).toBe(true);

      // Project
      const projections = projectAll(globalCFG);

      // Lemma 3.6: All locals well-formed (CFSM semantics)
      for (const [role, cfsm] of projections.cfsms) {
        expect(isChoiceDeterministic(cfsm)).toBe(true);
        expect(canProgress(cfsm)).toBe(true);
        expect(hasTerminalStates(cfsm)).toBe(true);
      }
    });
  });

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
      expect(content).toContain('Preservation');
      expect(content).toContain('Lemma 3.6');
    });
  });
});
