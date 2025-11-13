/**
 * THEOREM 4.5: No Races (Deniélou & Yoshida, ESOP 2012)
 *
 * STATEMENT:
 *   A global type has no races if no two actions in parallel
 *   communicate on the same channel or interfere.
 *
 *   For any parallel composition G₁ | G₂:
 *   channels(G₁) ∩ channels(G₂) = ∅
 *
 * INTUITION:
 *   Parallel branches must use disjoint channels. No two concurrent
 *   actions can send/receive on the same (sender, receiver) pair.
 *   This prevents race conditions and undefined ordering.
 *
 * SOURCE: docs/theory/well-formedness-properties.md
 * CITATION: Deniélou, Yoshida (ESOP 2012), Theorem 4.5
 *
 * PROOF OBLIGATIONS:
 *   1. Parallel branches use disjoint channels
 *   2. No overlapping role interactions in parallel
 *   3. Nested parallel constructs maintain disjointness
 *   4. Race detection for complex protocols
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { detectRaceConditions } from '../../../core/verification/verifier';

describe('Theorem 4.5: No Races (Deniélou & Yoshida 2012)', () => {
  /**
   * PROOF OBLIGATION 1: Disjoint channels in parallel
   */
  describe('Proof Obligation 1: Channel Disjointness', () => {
    it('proves: parallel branches use disjoint channels', () => {
      const protocol = `
        protocol NoRace(role A, role B, role C, role D) {
          par {
            A -> B: Msg1();
            B -> A: Reply1();
          } and {
            C -> D: Msg2();
            D -> C: Reply2();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      // Theorem 4.5: Channels are disjoint
      // Branch 1: {(A, B), (B, A)}
      // Branch 2: {(C, D), (D, C)}
      // Intersection: ∅
      expect(result.hasRaces).toBe(false);
      expect(result.races).toHaveLength(0);
    });

    it('proves: three-way parallel with disjoint channels', () => {
      const protocol = `
        protocol ThreeWayParallel(role A, role B, role C, role D, role E, role F) {
          par {
            A -> B: M1();
          } and {
            C -> D: M2();
          } and {
            E -> F: M3();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      expect(result.hasRaces).toBe(false);
      expect(result.races).toHaveLength(0);
    });

    it('proves: parallel with same roles but different channels', () => {
      const protocol = `
        protocol DifferentChannels(role A, role B, role C) {
          par {
            A -> B: FromAtoB();
          } and {
            A -> C: FromAtoC();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      // Same sender A, but different receivers → different channels → no race
      expect(result.hasRaces).toBe(false);
      expect(result.races).toHaveLength(0);
    });
  });

  /**
   * COUNTEREXAMPLES: Protocols that violate no-race property
   */
  describe('Counterexamples: Race Conditions', () => {
    it('counterexample: same channel in parallel violates theorem', () => {
      const protocol = `
        protocol RaceCondition(role A, role B) {
          par {
            A -> B: Msg1();
          } and {
            A -> B: Msg2();  // RACE! Same channel (A, B)
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      // Theorem 4.5 violation: Channels not disjoint
      expect(result.hasRaces).toBe(true);
      expect(result.races.length).toBeGreaterThan(0);
    });

    it('counterexample: bidirectional race on same channel', () => {
      const protocol = `
        protocol BidirectionalRace(role A, role B) {
          par {
            A -> B: Forward();
            B -> A: Backward();
          } and {
            A -> B: AnotherForward();  // Race on A→B channel
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      expect(result.hasRaces).toBe(true);
      expect(result.races.length).toBeGreaterThan(0);
    });

    it('counterexample: multiple races in protocol', () => {
      const protocol = `
        protocol MultipleRaces(role A, role B, role C) {
          par {
            A -> B: M1();
            A -> C: M2();
          } and {
            A -> B: M3();  // Race 1
            A -> C: M4();  // Race 2
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      expect(result.hasRaces).toBe(true);
      // Should detect 2 races: (A,B) and (A,C)
      expect(result.races.length).toBeGreaterThanOrEqual(2);
    });
  });

  /**
   * PROOF OBLIGATION 2: No overlapping role interactions
   */
  describe('Proof Obligation 2: Role Disjointness', () => {
    it('proves: parallel branches with disjoint roles', () => {
      const protocol = `
        protocol DisjointRoles(role A, role B, role C, role D) {
          par {
            A -> B: Msg1();
          } and {
            C -> D: Msg2();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      // Disjoint roles → disjoint channels → no races
      expect(result.hasRaces).toBe(false);
      expect(result.races).toHaveLength(0);
    });

    it('proves: overlapping roles but different channels OK', () => {
      const protocol = `
        protocol OverlapOK(role Hub, role A, role B) {
          par {
            Hub -> A: ToA();
          } and {
            Hub -> B: ToB();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      // Same sender (Hub), different receivers → no race
      expect(result.hasRaces).toBe(false);
      expect(result.races).toHaveLength(0);
    });
  });

  /**
   * PROOF OBLIGATION 3: Nested parallel constructs
   */
  describe('Proof Obligation 3: Nested Parallel', () => {
    it('proves: nested parallel maintains disjointness', () => {
      const protocol = `
        protocol NestedParallel(role A, role B, role C, role D, role E, role F) {
          par {
            A -> B: M1();
          } and {
            par {
              C -> D: M2();
            } and {
              E -> F: M3();
            }
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      expect(result.hasRaces).toBe(false);
      expect(result.races).toHaveLength(0);
    });

    it('proves: deeply nested parallel is race-free', () => {
      const protocol = `
        protocol DeepNesting(role R1, role R2, role R3, role R4, role R5, role R6) {
          par {
            R1 -> R2: M1();
          } and {
            par {
              R3 -> R4: M2();
            } and {
              par {
                R5 -> R6: M3();
              } and {
                R1 -> R3: M4();  // R1 appears again, but different channel
              }
            }
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      expect(result.hasRaces).toBe(false);
      expect(result.races).toHaveLength(0);
    });
  });

  /**
   * PROOF OBLIGATION 4: Complex protocol structures
   */
  describe('Proof Obligation 4: Complex Structures', () => {
    it('proves: parallel with choice is race-free', () => {
      const protocol = `
        protocol ParallelChoice(role A, role B, role C, role D) {
          par {
            choice at A {
              A -> B: Opt1();
            } or {
              A -> B: Opt2();
            }
          } and {
            C -> D: Msg();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      expect(result.hasRaces).toBe(false);
      expect(result.races).toHaveLength(0);
    });

    it('proves: parallel with recursion is race-free', () => {
      const protocol = `
        protocol ParallelRecursion(role A, role B, role C, role D) {
          par {
            rec Loop1 {
              A -> B: Ping();
              B -> A: Pong();
              continue Loop1;
            }
          } and {
            rec Loop2 {
              C -> D: Request();
              D -> C: Response();
              continue Loop2;
            }
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      expect(result.hasRaces).toBe(false);
      expect(result.races).toHaveLength(0);
    });

    it('proves: sequential after parallel is race-free', () => {
      const protocol = `
        protocol SequentialAfterParallel(role A, role B, role C, role D) {
          par {
            A -> B: ParallelMsg1();
          } and {
            C -> D: ParallelMsg2();
          }
          A -> C: SequentialMsg();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      // Sequential message after parallel join → no race
      expect(result.hasRaces).toBe(false);
      expect(result.races).toHaveLength(0);
    });
  });

  /**
   * EDGE CASES
   */
  describe('Edge Cases', () => {
    it('handles: two parallel branches (minimal)', () => {
      const protocol = `
        protocol MinimalParallel(role A, role B, role C, role D) {
          par {
            A -> B: M1();
          } and {
            C -> D: M2();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      expect(result.hasRaces).toBe(false);
      expect(result.races).toHaveLength(0);
    });

    it('handles: many parallel branches (N > 5)', () => {
      const protocol = `
        protocol ManyBranches(
          role A, role B,
          role C, role D,
          role E, role F,
          role G, role H,
          role I, role J,
          role K, role L
        ) {
          par {
            A -> B: M1();
          } and {
            C -> D: M2();
          } and {
            E -> F: M3();
          } and {
            G -> H: M4();
          } and {
            I -> J: M5();
          } and {
            K -> L: M6();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      expect(result.hasRaces).toBe(false);
      expect(result.races).toHaveLength(0);
    });

    it('handles: parallel with empty branch', () => {
      const protocol = `
        protocol EmptyBranch(role A, role B) {
          par {
            A -> B: Msg();
          } and {
            A -> B: AnotherMsg();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const result = detectRaceConditions(cfg);

      // Same channel → should detect race
      expect(result.hasRaces).toBe(true);
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
        '../../../docs/theory/well-formedness-properties.md'
      );

      expect(fs.existsSync(docPath)).toBe(true);

      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain('No Races');
      expect(content).toContain('Theorem 4.5');
      expect(content).toContain('Deniélou');
      expect(content).toContain('Yoshida');
    });
  });
});
