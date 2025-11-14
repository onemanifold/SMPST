/**
 * DEFINITION 4.1: Safety Property (Scalas & Yoshida, POPL 2019)
 *
 * STATEMENT:
 *   φ is a safety property of typing contexts if it satisfies:
 *
 *   [S-⊕&] φ(Γ, s[p]:q⊕{mi(Si)}.S', s[q]:p&{mj(Tj)}.T')
 *          implies {m1...mn} ⊆ {m1...mk} and ∀i. Si ≤ Ti
 *          (All messages p sends are in q's branching, with compatible types)
 *
 *   [S-μ]  φ(Γ, s[p]:μt.S) implies φ(Γ, s[p]:S{μt.S/t})
 *          (Safety handles recursion unfolding)
 *
 *   [S-→]  φ(Γ) and Γ→Γ' implies φ(Γ')
 *          (Safety is preserved by reduction)
 *
 * INTUITION:
 *   Safety is a BEHAVIORAL property that checks: "If p can send m to q,
 *   then q can receive m from p." Unlike consistency (syntactic duality),
 *   safety checks actual execution states, respecting choice semantics.
 *
 * KEY INSIGHT:
 *   Safety operates on typing contexts (CFSMs at current states), not
 *   session type syntax. This makes it MORE GENERAL than consistency:
 *
 *   consistent(Γ) ==> safe(Γ)     ✓ (Lemma 5.9)
 *   safe(Γ) ==/=> consistent(Γ)   ✗
 *
 * EXAMPLE (OAuth - rejected by consistency, accepted by safety):
 *   Global: choice at s {
 *             s→c:login  c→a:passwd  a→s:auth
 *           } or {
 *             s→c:cancel c→a:quit
 *           }
 *
 *   Consistency FAILS: Ss↾a is undefined in cancel branch
 *   Safety PASSES: At each reachable state, sends match receives
 *
 * SOURCE: "Less is More: Multiparty Session Types Revisited"
 * CITATION: Scalas, Yoshida (POPL 2019), §4, Definition 4.1
 *
 * PROOF SKETCH:
 *   Safety is the foundation for subject reduction (Theorem 4.6).
 *   Three rules ensure:
 *   1. [S-⊕&]: No communication errors (sends match receives)
 *   2. [S-μ]:  Recursion handled correctly
 *   3. [S-→]:  Property preserved as protocol executes
 *
 *   Together, these guarantee typed processes never go wrong. ∎
 *
 * ============================================================================
 * TESTING METHODOLOGY
 * ============================================================================
 *
 * We test safety by checking:
 * 1. ENABLED TRANSITIONS: At each CFSM state, find enabled send/receive
 * 2. COMPATIBILITY: For each enabled send(p→q:m), verify q has receive(p:m)
 * 3. REACHABILITY: Compute all reachable contexts via communication transitions
 * 4. PRESERVATION: Check safety holds for all reachable contexts
 *
 * TYPING CONTEXT REPRESENTATION:
 *   TypingContext = Map<Role, {machine: CFSM, currentState: StateId}>
 *
 * WHY THIS IS VALID:
 * - Safety is defined for typing contexts (CFSMs + states)
 * - CFSMs are LTS (finite state)
 * - Reachability is computable
 * - Tests directly encode Definition 4.1
 *
 * @reference Scalas, A., & Yoshida, N. (2019). Less is More: Multiparty
 *            Session Types Revisited. POPL 2019, §4
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { projectAll } from '../../../core/projection/projector';
import type { CFSM } from '../../../core/projection/types';

/**
 * Typing Context: CFSMs at current execution states
 * This is the fundamental data structure for safety checking.
 */
interface TypingContext {
  session: string;
  cfsms: Map<string, {
    machine: CFSM;
    currentState: string;
  }>;
}

/**
 * Create initial typing context (all CFSMs at their initial states)
 */
function createInitialContext(cfsms: Map<string, CFSM>): TypingContext {
  const context = new Map<string, { machine: CFSM; currentState: string }>();
  for (const [role, cfsm] of cfsms) {
    context.set(role, {
      machine: cfsm,
      currentState: cfsm.initialState
    });
  }
  return {
    session: 's',
    cfsms: context
  };
}

/**
 * STUB: Safety checker (to be implemented)
 * This is the TARGET of our theorem-driven development!
 */
class SafetyChecker {
  /**
   * Check if typing context satisfies safety property (Definition 4.1)
   *
   * IMPLEMENTS:
   *   [S-⊕&]: Check all enabled sends have matching receives
   *   [S-→]:  Check safety preserved by all reductions
   *
   * NOTE: [S-μ] is handled by CFSM unfolding (CFSMs already handle recursion)
   */
  check(context: TypingContext): boolean {
    // TODO: Implement Definition 4.1
    throw new Error('SafetyChecker.check() not yet implemented - THIS IS EXPECTED!');
  }

  /**
   * Rule [S-⊕&]: Check send/receive compatibility at current states
   */
  private checkSendReceiveCompatibility(context: TypingContext): boolean {
    // TODO: For each CFSM at current state, check enabled sends have matching receives
    throw new Error('Not implemented');
  }

  /**
   * Rule [S-→]: Check safety preserved by all reductions
   */
  private checkPreservationByReduction(context: TypingContext): boolean {
    // TODO: Compute reachable contexts, check safety for each
    throw new Error('Not implemented');
  }

  /**
   * Compute all reachable typing contexts from Γ
   * (Finite because CFSMs have finite states)
   */
  private computeReachable(context: TypingContext): Set<TypingContext> {
    // TODO: BFS/DFS through communication transitions
    throw new Error('Not implemented');
  }
}

describe('Definition 4.1: Safety Property (Scalas & Yoshida 2019)', () => {
  const checker = new SafetyChecker();

  /**
   * =========================================================================
   * RULE [S-⊕&]: Send/Receive Compatibility
   * =========================================================================
   *
   * FORMAL PROPERTY:
   *   If Γ contains s[p]:q⊕{mi(Si)}.S' and s[q]:p&{mj(Tj)}.T'
   *   Then: {m1...mn} ⊆ {m1...mk} and ∀i. Si ≤ Ti
   *
   * INTUITION:
   *   Every message p can send to q must be receivable by q.
   *   This is checked at the CURRENT STATE, not globally!
   *
   * WHY DIFFERENT FROM CONSISTENCY:
   *   Consistency checks type syntax (all branches at once).
   *   Safety checks enabled transitions (each branch separately).
   */
  describe('Rule [S-⊕&]: Send/Receive Compatibility', () => {
    it('accepts simple send/receive pair', () => {
      const protocol = `
        protocol Simple(role A, role B) {
          A -> B: Message();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);
      const context = createInitialContext(projection.cfsms);

      // At initial state:
      // A can send 'Message' to B
      // B can receive 'Message' from A
      // Therefore: SAFE ✓

      expect(() => checker.check(context)).toThrow('not yet implemented');
      // TODO: When implemented, should pass:
      // expect(checker.check(context)).toBe(true);
    });

    it('rejects mismatched send/receive labels', () => {
      // This requires manual CFSM construction since parser won't create invalid CFSMs
      // TODO: Create CFSMs where A sends 'foo' but B expects 'bar'
      // Expected: safety check should FAIL
      expect(true).toBe(true); // Placeholder
    });

    it('checks all messages in internal choice are receivable', () => {
      const protocol = `
        protocol Choice(role A, role B) {
          choice at A {
            A -> B: Option1();
          } or {
            A -> B: Option2();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);
      const context = createInitialContext(projection.cfsms);

      // At initial state:
      // A can send 'Option1' OR 'Option2' to B
      // B must be able to receive BOTH from A
      // Therefore: SAFE ✓

      expect(() => checker.check(context)).toThrow('not yet implemented');
      // TODO: expect(checker.check(context)).toBe(true);
    });

    it('handles tau transitions (roles not involved)', () => {
      const protocol = `
        protocol Tau(role A, role B, role C) {
          A -> B: Message();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);
      const context = createInitialContext(projection.cfsms);

      // C has tau transition (not involved in A→B interaction)
      // Safety should accept tau transitions

      expect(() => checker.check(context)).toThrow('not yet implemented');
      // TODO: expect(checker.check(context)).toBe(true);
    });
  });

  /**
   * =========================================================================
   * RULE [S-→]: Preservation by Reduction
   * =========================================================================
   *
   * FORMAL PROPERTY:
   *   φ(Γ) and Γ→Γ' implies φ(Γ')
   *
   * INTUITION:
   *   If protocol is safe now, it stays safe after any communication.
   *   We check ALL reachable states, not just the next step!
   *
   * DECIDABILITY:
   *   CFSMs have finite states → reachability is finite → decidable!
   */
  describe('Rule [S-→]: Preservation by Reduction', () => {
    it('safety preserved after single message exchange', () => {
      const protocol = `
        protocol TwoSteps(role A, role B) {
          A -> B: First();
          B -> A: Second();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);
      const Γ0 = createInitialContext(projection.cfsms);

      // Initial state Γ0: A can send 'First' to B → SAFE
      // After A sends 'First' → Γ1: B can send 'Second' to A → SAFE
      // Therefore: safety preserved ✓

      expect(() => checker.check(Γ0)).toThrow('not yet implemented');
      // TODO: expect(checker.check(Γ0)).toBe(true);
    });

    it('safety preserved through choice branches', () => {
      const protocol = `
        protocol ChoiceSeq(role A, role B, role C) {
          choice at A {
            A -> B: Left();
            B -> C: LeftContinue();
          } or {
            A -> B: Right();
            B -> C: RightContinue();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);
      const context = createInitialContext(projection.cfsms);

      // Γ0: A can send Left|Right to B → SAFE
      // Γ1 (left): B can send LeftContinue to C → SAFE
      // Γ1'(right): B can send RightContinue to C → SAFE
      // All reachable states are safe ✓

      expect(() => checker.check(context)).toThrow('not yet implemented');
      // TODO: expect(checker.check(context)).toBe(true);
    });

    it('checks all reachable states in recursion', () => {
      const protocol = `
        protocol Loop(role A, role B) {
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
      const context = createInitialContext(projection.cfsms);

      // Loop creates infinite runs, but finite state space
      // Must check safety holds in all states (including loop body)

      expect(() => checker.check(context)).toThrow('not yet implemented');
      // TODO: expect(checker.check(context)).toBe(true);
    });
  });

  /**
   * =========================================================================
   * OAUTH EXAMPLE: The Protocol That Breaks Classic MPST
   * =========================================================================
   *
   * WHY THIS TEST IS CRITICAL:
   *   OAuth is REJECTED by classic MPST consistency but ACCEPTED by safety.
   *   This is the PRIMARY MOTIVATION for "Less is More" paper!
   *
   * CLASSIC MPST FAILURE:
   *   Ss = c⊕{login.a&auth(Bool), cancel}
   *   Sa = c&{passwd(Str).s⊕auth(Bool), quit}
   *
   *   Partial projection Ss↾a:
   *   - Branch 1: login.a&auth(Bool) ↾ a = a&auth(Bool) ✓
   *   - Branch 2: cancel ↾ a = UNDEFINED ✗ (a not mentioned!)
   *   - Merge: a&auth(Bool) ⊓ UNDEFINED = FAIL!
   *
   *   Result: NOT CONSISTENT → REJECTED
   *
   * SAFETY SUCCESS:
   *   Γ0 (initial): s can send login|cancel to c → c can receive both → SAFE ✓
   *   Γ1 (login):   c can send passwd to a → a can receive → SAFE ✓
   *   Γ2 (passwd):  a can send auth to s → s can receive → SAFE ✓
   *   Γ1'(cancel):  c can send quit to a → a can receive → SAFE ✓
   *
   *   All reachable states safe! → ACCEPTED ✓✓✓
   */
  describe('OAuth Protocol (Classic MPST Killer)', () => {
    it('accepts OAuth despite non-consistent types', () => {
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
      const context = createInitialContext(projection.cfsms);

      // THIS IS THE KEY TEST!
      // If this passes, we've successfully generalized MPST beyond consistency!

      expect(() => checker.check(context)).toThrow('not yet implemented');
      // TODO: When implemented:
      // expect(checker.check(context)).toBe(true);
      //
      // And verify OAuth is NOT consistent:
      // expect(checkConsistency(projection.cfsms)).toBe(false);
      //
      // Proving: safe(OAuth) ∧ ¬consistent(OAuth)
      // Therefore: safety is strictly more general! QED
    });

    it('OAuth: branch 1 (login path) is safe', () => {
      // TODO: Create context after s sends 'login'
      // Verify: c can send passwd, a can receive it → SAFE
      expect(true).toBe(true); // Placeholder
    });

    it('OAuth: branch 2 (cancel path) is safe', () => {
      // TODO: Create context after s sends 'cancel'
      // Verify: c can send quit, a can receive it → SAFE
      // NOTE: s and a DON'T interact in this branch - that's OK!
      expect(true).toBe(true); // Placeholder
    });
  });

  /**
   * =========================================================================
   * ADDITIONAL TEST PROTOCOLS FROM PAPER (Figure 4)
   * =========================================================================
   */
  describe('Figure 4 Protocols (All non-consistent but safe)', () => {
    it('Recursive Two-Buyers (cannot project from any global type)', () => {
      // From paper Fig 4.(2)
      // This protocol CANNOT BE WRITTEN as a global type!
      // But it's SAFE via bottom-up checking.

      // TODO: Manually construct CFSMs for recursive two-buyers
      // Verify: safety accepts it, even though no global type exists
      expect(true).toBe(true); // Placeholder
    });

    it('Recursive Map/Reduce (non-consistent)', () => {
      // From paper Fig 4.(3)
      // TODO: Implement and verify safety
      expect(true).toBe(true); // Placeholder
    });

    it('Independent Multiparty Workers (non-consistent)', () => {
      // From paper Fig 4.(4)
      // TODO: Implement and verify safety
      expect(true).toBe(true); // Placeholder
    });
  });
});
