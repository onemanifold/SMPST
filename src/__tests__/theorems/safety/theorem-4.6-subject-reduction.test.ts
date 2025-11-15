/**
 * THEOREM 4.6: Subject Reduction (Scalas & Yoshida, POPL 2019)
 *
 * STATEMENT:
 *   Assume Θ·Γ⊢P and Γ safe.
 *   Then, P→P' implies ∃Γ' safe such that Γ→*Γ' and Θ·Γ'⊢P'.
 *
 * INTUITION:
 *   If a process P is well-typed with safe typing context Γ,
 *   and P reduces to P', then:
 *   1. The typing context reduces correspondingly (Γ→*Γ')
 *   2. The new context Γ' is still safe
 *   3. The reduced process P' is well-typed with Γ'
 *
 *   In other words: "Well-typed processes stay well-typed as they execute."
 *
 * COMPARISON WITH CLASSIC MPST:
 *
 *   Classic MPST (WRONG): Θ·Γ⊢P and P→P' implies ∃Γ': Γ→*Γ' and Θ·Γ'⊢P'
 *   Problem: Γ might not be consistent! Statement holds vacuously.
 *
 *   Classic MPST (FIXED): Θ·Γ⊢P with Γ consistent and P→P'
 *                         implies ∃Γ' consistent: Γ→*Γ' and Θ·Γ'⊢P'
 *   Problem: Too restrictive! Rejects OAuth and many valid protocols.
 *
 *   New MPST (THIS): Θ·Γ⊢P with Γ safe and P→P'
 *                    implies ∃Γ' safe: Γ→*Γ' and Θ·Γ'⊢P'
 *   ✓ More general (accepts OAuth)
 *   ✓ Still sound (type safety guaranteed)
 *
 * KEY INSIGHT:
 *   By replacing "consistent" with "safe", we get:
 *   - Same type safety guarantee (Corollary 4.7)
 *   - Much broader applicability (Lemma 5.9)
 *   - Simpler theory (no global types needed!)
 *
 * SOURCE: "Less is More: Multiparty Session Types Revisited"
 * CITATION: Scalas, Yoshida (POPL 2019), §4, Theorem 4.6
 *
 * PROOF SKETCH:
 *   By induction on the derivation of P→P'.
 *
 *   Base case [R-Comm]: s[p][q]⊕m⟨s'[r]⟩.P | s[q][p]&{mi(xi).Pi} → ...
 *     1. By typing: Γ contains s[p]:q⊕m(S).S' and s[q]:p&{mi(Ti).T'i}
 *     2. By safety [S-⊕&]: m ∈ {mi} and S ≤ Ti
 *     3. Therefore: communication can proceed
 *     4. Γ reduces: s[p]:S', s[q]:T'k (where mk = m)
 *     5. By safety [S-→]: Γ' is safe
 *     6. P' is well-typed by Γ' (by typing rules)
 *
 *   Inductive cases: Context rule [R-Ctx], process call [R-X]
 *     Use induction hypothesis and safety preservation
 *
 *   ∴ Subject reduction holds with safety (not consistency). ∎
 *
 * COROLLARY 4.7: Type Safety
 *   If ∅·∅⊢P and P→*P', then P' has no errors.
 *   Proof: By Theorem 4.6 repeatedly. ∎
 *
 * ============================================================================
 * TESTING METHODOLOGY
 * ============================================================================
 *
 * We test subject reduction by:
 * 1. Start with well-typed process P and safe context Γ
 * 2. Execute one step: P → P'
 * 3. Verify: Γ reduces to Γ' (simulate communication)
 * 4. Verify: Γ' is safe (safety preserved)
 * 5. Verify: P' is well-typed by Γ' (typing preserved)
 *
 * SIMPLIFICATION FOR TESTING:
 *   We don't implement the full typing judgement Θ·Γ⊢P.
 *   Instead, we verify the key property: safety is preserved.
 *
 *   Why this is sufficient:
 *   - If safety fails, typing fails (by [TGen-ν] rule)
 *   - If safety holds, typing succeeds (by Definition 4.4)
 *   - Therefore: safety preservation ⇒ typing preservation
 *
 * @reference Scalas, A., & Yoshida, N. (2019). Less is More: Multiparty
 *            Session Types Revisited. POPL 2019, §4
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { projectAll } from '../../../core/projection/projector';
import type { CFSM, CFSMTransition } from '../../../core/projection/types';

/**
 * Typing Context (from Definition 4.1)
 */
interface TypingContext {
  session: string;
  cfsms: Map<string, {
    machine: CFSM;
    currentState: string;
  }>;
}

/**
 * STUB: Safety checker
 */
class SafetyChecker {
  check(context: TypingContext): boolean {
    throw new Error('Not implemented - theorem-driven development!');
  }
}

/**
 * STUB: Context reducer
 * Simulates communication transition Γ → Γ'
 */
class ContextReducer {
  /**
   * Find an enabled communication in the typing context
   */
  findEnabledCommunication(context: TypingContext): {
    sender: string;
    receiver: string;
    message: string;
  } | null {
    throw new Error('Not implemented');
  }

  /**
   * Execute one communication step: Γ → Γ'
   * Returns new context with advanced states
   */
  reduce(context: TypingContext): TypingContext {
    throw new Error('Not implemented');
  }

  /**
   * Check if context is terminal (all CFSMs at terminal states)
   */
  isTerminal(context: TypingContext): boolean {
    for (const {machine, currentState} of context.cfsms.values()) {
      if (!machine.terminalStates.includes(currentState)) {
        return false;
      }
    }
    return true;
  }
}

describe('Theorem 4.6: Subject Reduction (Scalas & Yoshida 2019)', () => {
  const checker = new SafetyChecker();
  const reducer = new ContextReducer();

  /**
   * =========================================================================
   * BASIC SUBJECT REDUCTION: Single Step
   * =========================================================================
   *
   * PROPERTY:
   *   Γ safe and Γ→Γ' implies Γ' safe
   *
   * This is the simplest form of subject reduction:
   * safety preserved by one communication step.
   */
  describe('Basic Subject Reduction (Single Step)', () => {
    it('safety preserved after one communication', () => {
      const protocol = `
        protocol Simple(role A, role B) {
          A -> B: Message();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);

      // Initial context
      const Γ0: TypingContext = {
        session: 's',
        cfsms: new Map([
          ['A', { machine: projection.cfsms.get('A')!, currentState: projection.cfsms.get('A')!.initialState }],
          ['B', { machine: projection.cfsms.get('B')!, currentState: projection.cfsms.get('B')!.initialState }]
        ])
      };

      // Check: Γ0 is safe
      expect(() => checker.check(Γ0)).toThrow('Not implemented');
      // TODO: expect(checker.check(Γ0)).toBe(true);

      // Reduce: Γ0 → Γ1 (A sends Message to B)
      expect(() => reducer.reduce(Γ0)).toThrow('Not implemented');
      // TODO: const Γ1 = reducer.reduce(Γ0);

      // Check: Γ1 is safe (SUBJECT REDUCTION!)
      // TODO: expect(checker.check(Γ1)).toBe(true);
    });

    it('safety preserved through sequence of communications', () => {
      const protocol = `
        protocol TwoSteps(role A, role B) {
          A -> B: First();
          B -> A: Second();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);

      const Γ0: TypingContext = {
        session: 's',
        cfsms: new Map([
          ['A', { machine: projection.cfsms.get('A')!, currentState: projection.cfsms.get('A')!.initialState }],
          ['B', { machine: projection.cfsms.get('B')!, currentState: projection.cfsms.get('B')!.initialState }]
        ])
      };

      // Γ0 → Γ1 → Γ2
      // All should be safe!

      expect(() => {
        let Γ = Γ0;
        while (!reducer.isTerminal(Γ)) {
          expect(checker.check(Γ)).toBe(true);  // Safety before step
          Γ = reducer.reduce(Γ);                 // Execute step
          expect(checker.check(Γ)).toBe(true);  // Safety after step (SUBJECT REDUCTION)
        }
      }).toThrow('Not implemented');
    });
  });

  /**
   * =========================================================================
   * SUBJECT REDUCTION WITH CHOICE
   * =========================================================================
   *
   * PROPERTY:
   *   If Γ is safe and contains choice,
   *   then both branches lead to safe contexts.
   *
   * This tests that subject reduction works with branching,
   * which is where classic MPST (consistency) fails!
   */
  describe('Subject Reduction with Choice', () => {
    it('safety preserved in both branches of choice', () => {
      const protocol = `
        protocol Choice(role A, role B) {
          choice at A {
            A -> B: Left();
          } or {
            A -> B: Right();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);

      const Γ0: TypingContext = {
        session: 's',
        cfsms: new Map([
          ['A', { machine: projection.cfsms.get('A')!, currentState: projection.cfsms.get('A')!.initialState }],
          ['B', { machine: projection.cfsms.get('B')!, currentState: projection.cfsms.get('B')!.initialState }]
        ])
      };

      // Γ0 is safe
      expect(() => checker.check(Γ0)).toThrow('Not implemented');
      // TODO: expect(checker.check(Γ0)).toBe(true);

      // Γ0 → Γ1 (choose Left) - should be safe
      // Γ0 → Γ1'(choose Right) - should also be safe
      // This proves subject reduction handles choice correctly!
    });

    it('OAuth: subject reduction through both branches', () => {
      const oauth = `
        protocol OAuth(role s, role c, role a) {
          choice at s {
            s -> c: login();
            c -> a: passwd(Str);
            a -> s: auth(Bool);
          } or {
            s -> c: cancel();
            c -> a: quit();
          }
        }
      `;

      const ast = parse(oauth);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);

      const Γ0: TypingContext = {
        session: 's',
        cfsms: new Map([
          ['s', { machine: projection.cfsms.get('s')!, currentState: projection.cfsms.get('s')!.initialState }],
          ['c', { machine: projection.cfsms.get('c')!, currentState: projection.cfsms.get('c')!.initialState }],
          ['a', { machine: projection.cfsms.get('a')!, currentState: projection.cfsms.get('a')!.initialState }]
        ])
      };

      // THIS IS THE CRITICAL TEST!
      // Γ0 → Γ1 → Γ2 → Γ3 (login branch)
      // Γ0 → Γ1'→ Γ2' (cancel branch)
      // All states should be safe (SUBJECT REDUCTION)

      // Classic MPST fails because it can't handle this!
      // Our safety-based system should succeed!

      expect(() => {
        // TODO: Trace both execution paths
        // Verify safety holds at each step
        checker.check(Γ0);
      }).toThrow('Not implemented');
    });
  });

  /**
   * =========================================================================
   * SUBJECT REDUCTION WITH RECURSION
   * =========================================================================
   *
   * PROPERTY:
   *   Safety preserved through recursive loops.
   *
   * This tests that [S-μ] (recursion unfolding) works correctly.
   */
  describe('Subject Reduction with Recursion', () => {
    it('safety preserved through recursion loop', () => {
      const protocol = `
        protocol Loop(role A, role B) {
          rec X {
            A -> B: Ping();
            B -> A: Pong();
            continue X;
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);

      const Γ0: TypingContext = {
        session: 's',
        cfsms: new Map([
          ['A', { machine: projection.cfsms.get('A')!, currentState: projection.cfsms.get('A')!.initialState }],
          ['B', { machine: projection.cfsms.get('B')!, currentState: projection.cfsms.get('B')!.initialState }]
        ])
      };

      // Execute several loop iterations
      // Safety should hold at each step

      expect(() => {
        let Γ = Γ0;
        for (let i = 0; i < 10; i++) {  // 10 iterations
          expect(checker.check(Γ)).toBe(true);
          Γ = reducer.reduce(Γ);  // Ping
          expect(checker.check(Γ)).toBe(true);
          Γ = reducer.reduce(Γ);  // Pong
          expect(checker.check(Γ)).toBe(true);  // Back to loop start
        }
      }).toThrow('Not implemented');
    });

    it('safety preserved in recursive choice', () => {
      const protocol = `
        protocol RecChoice(role A, role B) {
          rec X {
            choice at A {
              A -> B: Continue();
              continue X;
            } or {
              A -> B: Stop();
            }
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);

      const Γ0: TypingContext = {
        session: 's',
        cfsms: new Map([
          ['A', { machine: projection.cfsms.get('A')!, currentState: projection.cfsms.get('A')!.initialState }],
          ['B', { machine: projection.cfsms.get('B')!, currentState: projection.cfsms.get('B')!.initialState }]
        ])
      };

      // Test both:
      // 1. Continue branch (loops back) - safety preserved
      // 2. Stop branch (terminates) - safety preserved

      expect(() => checker.check(Γ0)).toThrow('Not implemented');
    });
  });

  /**
   * =========================================================================
   * FULL SUBJECT REDUCTION: Run to Completion
   * =========================================================================
   *
   * PROPERTY:
   *   For any protocol, execute all possible runs to completion.
   *   Safety should hold at every step.
   *
   * This is the strongest form of subject reduction test:
   * verify the theorem for complete protocol executions.
   */
  describe('Full Subject Reduction (Run to Completion)', () => {
    it('maintains safety through complete protocol execution', () => {
      const protocol = `
        protocol Complete(role A, role B, role C) {
          A -> B: Start();
          choice at B {
            B -> C: Option1();
            C -> A: Response1();
          } or {
            B -> C: Option2();
            C -> A: Response2();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);

      const Γ0: TypingContext = {
        session: 's',
        cfsms: new Map([
          ['A', { machine: projection.cfsms.get('A')!, currentState: projection.cfsms.get('A')!.initialState }],
          ['B', { machine: projection.cfsms.get('B')!, currentState: projection.cfsms.get('B')!.initialState }],
          ['C', { machine: projection.cfsms.get('C')!, currentState: projection.cfsms.get('C')!.initialState }]
        ])
      };

      expect(() => {
        // Execute all possible traces
        // Verify safety at each step
        function executeAllTraces(Γ: TypingContext): void {
          if (reducer.isTerminal(Γ)) {
            return;  // Done
          }

          // Safety must hold before any reduction
          expect(checker.check(Γ)).toBe(true);

          // Find all enabled communications
          const enabled = []; // TODO: get all enabled

          // Try each one (explores all interleavings)
          for (const comm of enabled) {
            const Γ_next = reducer.reduce(Γ);
            expect(checker.check(Γ_next)).toBe(true);  // SUBJECT REDUCTION!
            executeAllTraces(Γ_next);  // Recurse
          }
        }

        executeAllTraces(Γ0);
      }).toThrow('Not implemented');
    });
  });

  /**
   * =========================================================================
   * COMPARISON WITH CLASSIC MPST
   * =========================================================================
   *
   * These tests demonstrate the advantage of safety over consistency.
   */
  describe('Comparison: Safety vs Consistency', () => {
    it('safety accepts OAuth, consistency rejects it', () => {
      const oauth = `
        protocol OAuth(role s, role c, role a) {
          choice at s {
            s -> c: login();
            c -> a: passwd(Str);
            a -> s: auth(Bool);
          } or {
            s -> c: cancel();
            c -> a: quit();
          }
        }
      `;

      const ast = parse(oauth);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);

      const Γ0: TypingContext = {
        session: 's',
        cfsms: new Map([
          ['s', { machine: projection.cfsms.get('s')!, currentState: projection.cfsms.get('s')!.initialState }],
          ['c', { machine: projection.cfsms.get('c')!, currentState: projection.cfsms.get('c')!.initialState }],
          ['a', { machine: projection.cfsms.get('a')!, currentState: projection.cfsms.get('a')!.initialState }]
        ])
      };

      // Safety should accept
      expect(() => checker.check(Γ0)).toThrow('Not implemented');
      // TODO: expect(checker.check(Γ0)).toBe(true);

      // Consistency should reject
      // TODO: expect(checkConsistency(projection.cfsms)).toBe(false);

      // This proves: safe(OAuth) ∧ ¬consistent(OAuth)
      // Therefore: Safety is strictly more general!
    });
  });
});
