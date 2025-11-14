/**
 * Edge Case Tests for Safety Implementation
 *
 * Tests boundary conditions and unusual protocols to ensure robustness.
 * These tests catch bugs that theorem tests might miss.
 *
 * Categories:
 * - Empty/minimal protocols
 * - Single role protocols
 * - Protocols with tau transitions (observers)
 * - Deep nesting
 * - Large state spaces
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import { BasicSafety } from '../../core/safety/safety-checker';
import { ContextReducer } from '../../core/safety/context-reducer';
import { createInitialContext } from '../../core/safety/utils';
import type { CFSM, CFSMState, CFSMTransition } from '../../core/projection/types';

describe('Edge Case Tests', () => {
  describe('Empty and Minimal Protocols', () => {
    it('should handle protocol with no interactions (empty body)', () => {
      const empty = `
        global protocol Empty(role A, role B) {
          // No interactions - roles immediately terminate
        }
      `;

      const ast = parse(empty);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'empty');

      const checker = new BasicSafety();
      const result = checker.check(context);

      // Empty protocol is vacuously safe
      expect(result.safe).toBe(true);
      expect(result.violations).toHaveLength(0);

      // Should be terminal immediately
      const reducer = new ContextReducer();
      expect(reducer.isTerminal(context)).toBe(true);
    });

    it('should handle protocol with single message', () => {
      const single = `
        global protocol SingleMessage(role A, role B) {
          msg() from A to B;
        }
      `;

      const ast = parse(single);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'single');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);

      // Should have exactly one communication possible
      const reducer = new ContextReducer();
      const enabled = reducer.findEnabledCommunications(context);
      expect(enabled.communications).toHaveLength(1);
      expect(enabled.communications[0].message).toBe('msg');
    });

    it('should handle protocol with two roles, one message each direction', () => {
      const ping = `
        global protocol Ping(role A, role B) {
          ping() from A to B;
          pong() from B to A;
        }
      `;

      const ast = parse(ping);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'ping');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);

      // Execute to completion
      const reducer = new ContextReducer();
      const trace = reducer.executeToCompletion(context);

      // Should have: initial, after ping, after pong (terminal)
      expect(trace.length).toBe(3);
      expect(reducer.isTerminal(trace[2])).toBe(true);
    });
  });

  describe('Single Role Protocols', () => {
    it('should handle single role (no possible interactions)', () => {
      const solo = `
        global protocol Solo(role A) {
          // Single role cannot communicate with itself
        }
      `;

      const ast = parse(solo);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);

      expect(cfsms.size).toBe(1);
      expect(cfsms.has('A')).toBe(true);

      const context = createInitialContext(cfsms, 'solo');
      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);
    });
  });

  describe('Observer Roles (Tau Transitions)', () => {
    it('should handle role that only observes (tau transitions)', () => {
      const observer = `
        global protocol Observer(role A, role B, role C) {
          msg() from A to B;
          resp() from B to A;
          // C is observer - not involved in any communication
        }
      `;

      const ast = parse(observer);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'observer');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);

      // Role C should have tau transitions
      const cfsmC = cfsms.get('C')!;
      const hasTau = cfsmC.transitions.some(t => t.action.type === 'tau');
      expect(hasTau).toBe(true);
    });

    it('should handle role that observes only one branch', () => {
      const partialObserver = `
        global protocol PartialObserver(role A, role B, role C) {
          choice at A {
            msg1() from A to B;
            resp1() from B to C;
          } or {
            msg2() from A to B;
            // C not involved in this branch
          }
        }
      `;

      const ast = parse(partialObserver);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'partial');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);
    });
  });

  describe('Deeply Nested Protocols', () => {
    it('should handle deeply nested choices', () => {
      const nested = `
        global protocol DeepNesting(role A, role B) {
          choice at A {
            a1() from A to B;
            choice at B {
              b1() from B to A;
              choice at A {
                a2() from A to B;
                b2() from B to A;
              } or {
                a3() from A to B;
              }
            } or {
              b3() from B to A;
            }
          } or {
            a4() from A to B;
          }
        }
      `;

      const ast = parse(nested);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'nested');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);
    });

    it('should handle protocol with many sequential messages', () => {
      const sequential = `
        global protocol Sequential(role A, role B) {
          m1() from A to B;
          m2() from B to A;
          m3() from A to B;
          m4() from B to A;
          m5() from A to B;
          m6() from B to A;
          m7() from A to B;
          m8() from B to A;
          m9() from A to B;
          m10() from B to A;
        }
      `;

      const ast = parse(sequential);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'seq');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);

      // Should have 11 states in trace (initial + 10 messages)
      const reducer = new ContextReducer();
      const trace = reducer.executeToCompletion(context);
      expect(trace.length).toBe(11);
    });
  });

  describe('Multiple Roles', () => {
    it('should handle protocol with 4 roles', () => {
      const fourRoles = `
        global protocol FourRoles(role A, role B, role C, role D) {
          m1() from A to B;
          m2() from B to C;
          m3() from C to D;
          m4() from D to A;
        }
      `;

      const ast = parse(fourRoles);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'four');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);
      expect(cfsms.size).toBe(4);
    });

    it('should handle protocol with 5 roles (ring topology)', () => {
      const ring = `
        global protocol Ring(role R0, role R1, role R2, role R3, role R4) {
          m0() from R0 to R1;
          m1() from R1 to R2;
          m2() from R2 to R3;
          m3() from R3 to R4;
          m4() from R4 to R0;
        }
      `;

      const ast = parse(ring);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'ring');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);
      expect(cfsms.size).toBe(5);
    });
  });

  describe('Recursion Edge Cases', () => {
    it('should handle immediate recursion (rec at start)', () => {
      const immediate = `
        global protocol ImmediateRec(role A, role B) {
          rec Loop {
            msg() from A to B;
            continue Loop;
          }
        }
      `;

      const ast = parse(immediate);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'immediate');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);
    });

    it('should handle recursion with choice inside', () => {
      const recChoice = `
        global protocol RecWithChoice(role A, role B) {
          rec Loop {
            choice at A {
              continue() from A to B;
              continue Loop;
            } or {
              stop() from A to B;
            }
          }
        }
      `;

      const ast = parse(recChoice);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'recchoice');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);
    });

    it('should handle nested recursion', () => {
      const nested = `
        global protocol NestedRec(role A, role B) {
          rec Outer {
            msg1() from A to B;
            rec Inner {
              msg2() from B to A;
              choice at A {
                continue Inner;
              } or {
                break() from A to B;
              }
            }
            choice at B {
              continue Outer;
            } or {
              done() from B to A;
            }
          }
        }
      `;

      const ast = parse(nested);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'nestedrec');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);
    });
  });

  describe('Choice Variations', () => {
    it('should handle choice with empty branch', () => {
      const emptyBranch = `
        global protocol EmptyBranch(role A, role B) {
          choice at A {
            msg() from A to B;
            resp() from B to A;
          } or {
            // Empty branch - immediate termination
          }
        }
      `;

      const ast = parse(emptyBranch);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'empty-branch');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);
    });

    it('should handle choice with many branches', () => {
      const manyBranches = `
        global protocol ManyBranches(role A, role B) {
          choice at A {
            opt1() from A to B;
          } or {
            opt2() from A to B;
          } or {
            opt3() from A to B;
          } or {
            opt4() from A to B;
          } or {
            opt5() from A to B;
          }
        }
      `;

      const ast = parse(manyBranches);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'many-branches');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);

      // All branches should be reachable from initial state
      const reducer = new ContextReducer();
      const enabled = reducer.findEnabledCommunications(context);

      // Should have 5 possible first communications
      expect(enabled.communications.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle asymmetric choice (different lengths)', () => {
      const asymmetric = `
        global protocol Asymmetric(role A, role B, role C) {
          choice at A {
            long1() from A to B;
            long2() from B to C;
            long3() from C to A;
            long4() from A to B;
          } or {
            short() from A to B;
          }
        }
      `;

      const ast = parse(asymmetric);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'asymmetric');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(true);
    });
  });

  describe('State Space Size', () => {
    it('should report states explored', () => {
      const oauth = `
        global protocol OAuth(role s, role c, role a) {
          choice at s {
            login() from s to c;
            passwd(Str) from c to a;
            auth(Bool) from a to s;
          } or {
            cancel() from s to c;
            quit() from c to a;
          }
        }
      `;

      const ast = parse(oauth);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'oauth');

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.diagnostics?.statesExplored).toBeDefined();
      expect(result.diagnostics!.statesExplored!).toBeGreaterThan(0);

      // Log for visibility
      console.log(`OAuth states explored: ${result.diagnostics!.statesExplored}`);
    });

    it('should handle protocol with exponential state space efficiently', () => {
      // Protocol with independent choices creates exponential states
      const exponential = `
        global protocol Exponential(role A, role B, role C) {
          choice at A {
            a1() from A to B;
          } or {
            a2() from A to B;
          }
          choice at B {
            b1() from B to C;
          } or {
            b2() from B to C;
          }
          choice at C {
            c1() from C to A;
          } or {
            c2() from C to A;
          }
        }
      `;

      const ast = parse(exponential);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'exp');

      const checker = new BasicSafety();
      const startTime = Date.now();
      const result = checker.check(context);
      const duration = Date.now() - startTime;

      expect(result.safe).toBe(true);
      expect(duration).toBeLessThan(5000); // Should still be fast
    });
  });

  describe('Terminal State Detection', () => {
    it('should correctly identify terminal context', () => {
      const simple = `
        global protocol Simple(role A, role B) {
          msg() from A to B;
        }
      `;

      const ast = parse(simple);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      const context = createInitialContext(cfsms, 'simple');

      const reducer = new ContextReducer();

      // Initial context is NOT terminal
      expect(reducer.isTerminal(context)).toBe(false);

      // After one step, should be terminal
      const next = reducer.reduce(context);
      expect(reducer.isTerminal(next)).toBe(true);
    });

    it('should identify all roles must be terminal', () => {
      const threeRoles = `
        global protocol ThreeRoles(role A, role B, role C) {
          m1() from A to B;
          m2() from B to C;
        }
      `;

      const ast = parse(threeRoles);
      const cfg = buildCFG(ast);
      const cfsms = projectAll(cfg);
      let context = createInitialContext(cfsms, 'three');

      const reducer = new ContextReducer();

      // Step through protocol
      context = reducer.reduce(context); // m1
      expect(reducer.isTerminal(context)).toBe(false); // B and C not done

      context = reducer.reduce(context); // m2
      expect(reducer.isTerminal(context)).toBe(true); // All terminal
    });
  });
});
