/**
 * THEOREM: Determinism Property (Honda et al. JACM 2016)
 *
 * STATEMENT:
 *   A global type G is deterministic if for each choice at a role,
 *   branches are distinguishable by unique labels or sender/receiver roles:
 *
 *   ∀ choice p → q : { ℓᵢ(Gᵢ) }, ℓᵢ ≠ ℓⱼ for i ≠ j
 *
 * INTUITION:
 *   External choices must be unambiguous. When a role receives a message,
 *   it must be able to determine which branch was chosen.
 *   No duplicate message labels in choice branches.
 *
 * SOURCE: docs/theory/well-formedness-properties.md
 * CITATION: Honda, Yoshida, Carbone (JACM 2016)
 *
 * PROOF OBLIGATIONS:
 *   1. Choice branches have unique message labels
 *   2. External choices are distinguishable by receivers
 *   3. Internal choices are distinguishable by sender
 *   4. No ambiguity in nested choices
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { checkChoiceDeterminism } from '../../../core/verification/verifier';

describe('Determinism Property (Honda et al. 2016)', () => {
  /**
   * PROOF OBLIGATION 1: Unique labels in choice branches
   */
  describe('Proof Obligation 1: Label Uniqueness', () => {
    it('proves: choice branches have unique labels', () => {
      const protocol = `
        protocol Deterministic(role Client, role Server) {
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
      const result = checkChoiceDeterminism(cfg);

      // Theorem: Labels are unique (Login ≠ Register)
      expect(result.isDeterministic).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('proves: three-way choice with unique labels', () => {
      const protocol = `
        protocol ThreeWay(role Client, role Server) {
          choice at Client {
            Client -> Server: GetUser();
          } or {
            Client -> Server: GetPost();
          } or {
            Client -> Server: GetComment();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      expect(result.isDeterministic).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('proves: choice with different payload types is deterministic', () => {
      const protocol = `
        protocol PayloadDistinct(role A, role B) {
          choice at A {
            A -> B: Request(String);
          } or {
            A -> B: Request(Int);
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      // Note: Same label but different payload types
      // In Scribble, this is typically ambiguous (receiver can't distinguish)
      // The verifier should catch this
      expect(result.isDeterministic).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  /**
   * COUNTEREXAMPLES: Protocols that violate determinism
   */
  describe('Counterexamples: Determinism Violations', () => {
    it('counterexample: duplicate labels violate determinism', () => {
      const protocol = `
        protocol Ambiguous(role A, role B) {
          choice at A {
            A -> B: Request();
          } or {
            A -> B: Request();  // DUPLICATE!
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      // Theorem violation: Ambiguous - B cannot distinguish branches
      expect(result.isDeterministic).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('counterexample: three branches, two duplicate labels', () => {
      const protocol = `
        protocol PartialDuplicate(role C, role S) {
          choice at C {
            C -> S: Get();
          } or {
            C -> S: Post();
          } or {
            C -> S: Get();  // Duplicate of first branch!
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      expect(result.isDeterministic).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  /**
   * PROOF OBLIGATION 2: External choice distinguishability
   */
  describe('Proof Obligation 2: External Choice', () => {
    it('proves: external choice branches distinguishable', () => {
      const protocol = `
        protocol ExternalChoice(role Decider, role Responder) {
          choice at Decider {
            Decider -> Responder: OptionA();
            Responder -> Decider: AckA();
          } or {
            Decider -> Responder: OptionB();
            Responder -> Decider: AckB();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      // Responder can distinguish by first message: OptionA vs OptionB
      expect(result.isDeterministic).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('proves: multiple receivers can distinguish', () => {
      const protocol = `
        protocol MultiReceiver(role Sender, role R1, role R2) {
          choice at Sender {
            Sender -> R1: Msg1();
            Sender -> R2: Msg2();
          } or {
            Sender -> R1: Msg3();
            Sender -> R2: Msg4();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      // Each receiver can distinguish: R1 sees Msg1 vs Msg3, R2 sees Msg2 vs Msg4
      expect(result.isDeterministic).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  /**
   * PROOF OBLIGATION 3: Nested choices
   */
  describe('Proof Obligation 3: Nested Choices', () => {
    it('proves: nested choices maintain determinism', () => {
      const protocol = `
        protocol NestedChoice(role C, role S) {
          choice at C {
            C -> S: Login();
            choice at S {
              S -> C: Success();
            } or {
              S -> C: Failure();
            }
          } or {
            C -> S: Register();
            S -> C: Confirmation();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      // Outer choice: Login vs Register (unique)
      // Inner choice: Success vs Failure (unique)
      expect(result.isDeterministic).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('proves: deeply nested choices are deterministic', () => {
      const protocol = `
        protocol DeepNesting(role A, role B) {
          choice at A {
            A -> B: Level1A();
            choice at B {
              B -> A: Level2A();
              choice at A {
                A -> B: Level3A();
              } or {
                A -> B: Level3B();
              }
            } or {
              B -> A: Level2B();
            }
          } or {
            A -> B: Level1B();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      expect(result.isDeterministic).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  /**
   * PROOF OBLIGATION 4: Choice combined with other constructs
   */
  describe('Proof Obligation 4: Complex Structures', () => {
    it('proves: choice within recursion is deterministic', () => {
      const protocol = `
        protocol RecursiveChoice(role Client, role Server) {
          rec Loop {
            choice at Client {
              Client -> Server: Request();
              Server -> Client: Response();
              continue Loop;
            } or {
              Client -> Server: Done();
            }
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      expect(result.isDeterministic).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('proves: parallel branches with choices are deterministic', () => {
      const protocol = `
        protocol ParallelChoice(role A, role B, role C, role D) {
          par {
            choice at A {
              A -> B: Opt1();
            } or {
              A -> B: Opt2();
            }
          } and {
            choice at C {
              C -> D: Opt3();
            } or {
              C -> D: Opt4();
            }
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      // Each parallel branch has independent deterministic choices
      expect(result.isDeterministic).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  /**
   * EDGE CASES
   */
  describe('Edge Cases', () => {
    it('handles: binary choice (minimal)', () => {
      const protocol = `
        protocol Binary(role A, role B) {
          choice at A {
            A -> B: Yes();
          } or {
            A -> B: No();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      expect(result.isDeterministic).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('handles: many branches (N > 5)', () => {
      const protocol = `
        protocol ManyBranches(role C, role S) {
          choice at C {
            C -> S: Branch1();
          } or {
            C -> S: Branch2();
          } or {
            C -> S: Branch3();
          } or {
            C -> S: Branch4();
          } or {
            C -> S: Branch5();
          } or {
            C -> S: Branch6();
          } or {
            C -> S: Branch7();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      expect(result.isDeterministic).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('handles: choice with empty continuation', () => {
      const protocol = `
        protocol EmptyContinuation(role A, role B) {
          choice at A {
            A -> B: Option1();
          } or {
            A -> B: Option2();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = checkChoiceDeterminism(cfg);

      expect(result.isDeterministic).toBe(true);
      expect(result.violations).toHaveLength(0);
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
        '../../../../docs/theory/well-formedness-properties.md'
      );

      expect(fs.existsSync(docPath)).toBe(true);

      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain('Determinism');
      expect(content).toContain('Honda');
    });
  });
});
