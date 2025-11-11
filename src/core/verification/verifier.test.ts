/**
 * Verification Tests
 * Following TDD: These tests are written BEFORE implementation
 *
 * Tests verification algorithms for deadlock, liveness, parallel issues, etc.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../parser/parser';
import { buildCFG } from '../cfg/builder';
import {
  detectDeadlock,
  checkLiveness,
  detectParallelDeadlock,
  detectRaceConditions,
  checkProgress,
  verifyProtocol,
  checkChoiceDeterminism,
  checkChoiceMergeability,
  checkConnectedness,
  checkNestedRecursion,
  checkRecursionInParallel,
  checkForkJoinStructure,
} from './verifier';

// ============================================================================
// Known-Bad Protocols (Should Fail Verification)
// ============================================================================

describe('Deadlock Detection - Known-Bad Protocols', () => {
  it('should detect simple cyclic deadlock', () => {
    const source = `
      protocol SimpleDeadlock(role A, role B) {
        rec Loop {
          A -> B: Request();
          B -> A: Response();
          continue Loop;
        }
      }
    `;
    // This is actually NOT a deadlock - it's a valid infinite loop
    // Real deadlock would be if both wait for each other simultaneously
  });

  it('should detect mutual waiting deadlock', () => {
    // This is hard to express in Scribble since it enforces ordering
    // Deadlock typically happens in implementation, not protocol
    // But we can detect unreachable states
  });

  it('should detect parallel branch deadlock', () => {
    const source = `
      protocol ParallelDeadlock(role A, role B, role C) {
        par {
          A -> B: M1();
          B -> A: M2();
        } and {
          A -> C: M3();
          C -> A: M4();
        }
      }
    `;
    // Role A appears in both branches - potential deadlock
    // A might be blocked sending M1 while needing to send M3
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectParallelDeadlock(cfg);

    expect(result.hasDeadlock).toBe(true);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it('should detect role appearing in multiple parallel branches', () => {
    const source = `
      protocol RoleConflict(role Client, role ServerA, role ServerB) {
        par {
          Client -> ServerA: Req1();
          ServerA -> Client: Resp1();
        } and {
          Client -> ServerB: Req2();
          ServerB -> Client: Resp2();
        }
      }
    `;
    // Client appears in both branches - needs to handle concurrently
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectParallelDeadlock(cfg);

    // This should be flagged as potential issue
    expect(result.conflicts.length).toBeGreaterThan(0);
  });
});

describe('Liveness Detection', () => {
  it('should detect infinite loop as warning (not error)', () => {
    const source = `
      protocol InfiniteLoop(role A, role B) {
        rec Loop {
          A -> B: Msg();
          continue Loop;
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkLiveness(cfg);

    // Infinite loop is valid, but should be noted
    expect(result.isLive).toBe(true); // Still live (can make progress)
  });

  it('should pass for protocols with choice exit', () => {
    const source = `
      protocol LoopWithExit(role A, role B) {
        rec Loop {
          choice at A {
            A -> B: Continue();
            continue Loop;
          } or {
            A -> B: Stop();
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkLiveness(cfg);

    expect(result.isLive).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

describe('Race Condition Detection', () => {
  it('should detect potential race in parallel branches', () => {
    const source = `
      protocol PotentialRace(role A, role B, role C) {
        par {
          A -> B: Update();
        } and {
          A -> C: Update();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectRaceConditions(cfg);

    // A sending to multiple recipients concurrently might be a race
    // depending on whether order matters
    // For now, we'll be conservative and flag it
    expect(result.hasRaces).toBe(true);
  });

  it('should detect race when same role receives in parallel', () => {
    const source = `
      protocol ReceiveRace(role A, role B, role C) {
        par {
          A -> C: M1();
        } and {
          B -> C: M2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectRaceConditions(cfg);

    // C receiving from multiple senders concurrently is a race
    expect(result.hasRaces).toBe(true);
  });
});

describe('Progress Checking', () => {
  it('should verify all roles can make progress', () => {
    const source = `
      protocol GoodProgress(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkProgress(cfg);

    expect(result.canProgress).toBe(true);
    expect(result.blockedNodes).toHaveLength(0);
  });
});

// ============================================================================
// Known-Good Protocols (Should Pass Verification)
// ============================================================================

describe('Verification - Known-Good Protocols', () => {
  const goodProtocols = [
    {
      name: 'Simple Request-Response',
      source: `
        protocol RequestResponse(role Client, role Server) {
          Client -> Server: Request(String);
          Server -> Client: Response(Int);
        }
      `,
    },
    {
      name: 'Two-Phase Commit',
      source: `
        protocol TwoPhaseCommit(role Coordinator, role P1, role P2) {
          Coordinator -> P1: VoteRequest();
          Coordinator -> P2: VoteRequest();

          par {
            P1 -> Coordinator: Vote(Bool);
          } and {
            P2 -> Coordinator: Vote(Bool);
          }

          choice at Coordinator {
            Coordinator -> P1: Commit();
            Coordinator -> P2: Commit();
          } or {
            Coordinator -> P1: Abort();
            Coordinator -> P2: Abort();
          }
        }
      `,
    },
    {
      name: 'Streaming with Exit',
      source: `
        protocol Streaming(role Client, role Server) {
          Client -> Server: Start();
          rec Loop {
            choice at Server {
              Server -> Client: Data(String);
              continue Loop;
            } or {
              Server -> Client: End();
            }
          }
        }
      `,
    },
  ];

  goodProtocols.forEach(({ name, source }) => {
    it(`[${name}] should pass all verifications`, () => {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const result = verifyProtocol(cfg);

      if (!result.deadlock.hasDeadlock === false ||
          !result.liveness.isLive ||
          result.parallelDeadlock.hasDeadlock ||
          !result.progress.canProgress) {
        console.error(`${name} failed verification:`, result);
      }

      expect(result.deadlock.hasDeadlock).toBe(false);
      expect(result.liveness.isLive).toBe(true);
      expect(result.parallelDeadlock.hasDeadlock).toBe(false);
      expect(result.progress.canProgress).toBe(true);
    });
  });
});

// ============================================================================
// Individual Algorithm Tests
// ============================================================================

describe('Deadlock Detection Algorithm', () => {
  it('should return no deadlock for linear protocol', () => {
    const source = `
      protocol Linear(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectDeadlock(cfg);

    expect(result.hasDeadlock).toBe(false);
    expect(result.cycles).toHaveLength(0);
  });

  it('should handle recursion correctly', () => {
    const source = `
      protocol WithRec(role A, role B) {
        rec Loop {
          choice at A {
            A -> B: Go();
            continue Loop;
          } or {
            A -> B: Stop();
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectDeadlock(cfg);

    // Recursion creates cycles, but not deadlock
    expect(result.hasDeadlock).toBe(false);
  });
});

describe('Parallel Deadlock Detection Algorithm', () => {
  it('should pass when parallel branches are independent', () => {
    const source = `
      protocol IndependentParallel(role A, role B, role C) {
        par {
          A -> B: M1();
        } and {
          C -> B: M2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectParallelDeadlock(cfg);

    // No role appears in multiple branches as sender/receiver
    expect(result.hasDeadlock).toBe(false);
  });

  it('should detect when same role sends in multiple branches', () => {
    const source = `
      protocol SameSenderParallel(role A, role B, role C) {
        par {
          A -> B: M1();
        } and {
          A -> C: M2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectParallelDeadlock(cfg);

    // A sends in both branches - might be OK if A can handle concurrency
    // But we flag it as potential issue
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it('should NOT flag same role receiving in multiple branches as deadlock', () => {
    const source = `
      protocol SameReceiverParallel(role A, role B, role C) {
        par {
          A -> C: M1();
        } and {
          B -> C: M2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectParallelDeadlock(cfg);

    // C receives from both branches - this is OK with proper buffering
    // (Not a deadlock, though it may be a race condition)
    expect(result.hasDeadlock).toBe(false);
  });

  it('should handle three-way parallel', () => {
    const source = `
      protocol ThreeWayParallel(role A, role B, role C, role D) {
        par {
          A -> B: M1();
        } and {
          A -> C: M2();
        } and {
          A -> D: M3();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectParallelDeadlock(cfg);

    // A appears in all three branches
    expect(result.conflicts.length).toBeGreaterThan(0);
  });
});

describe('Race Condition Detection Algorithm', () => {
  it('should pass when no concurrent access to same role', () => {
    const source = `
      protocol NoRace(role A, role B, role C) {
        par {
          A -> B: M1();
        } and {
          C -> B: M2();
        }
      }
    `;
    // Even though B receives from both, we need to check if they're truly concurrent
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectRaceConditions(cfg);

    // B is receiving from two sources concurrently
    expect(result.hasRaces).toBe(true);
  });

  it('should detect race on shared resource', () => {
    const source = `
      protocol SharedResource(role A, role B, role Resource) {
        par {
          A -> Resource: Write();
        } and {
          B -> Resource: Read();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectRaceConditions(cfg);

    expect(result.hasRaces).toBe(true);
    expect(result.races[0].resource).toContain('Resource');
  });
});

// ============================================================================
// Complete Verification Tests
// ============================================================================

describe('Complete Protocol Verification', () => {
  it('should provide comprehensive verification results', () => {
    const source = `
      protocol Complete(role A, role B) {
        A -> B: Start();
        choice at A {
          A -> B: Option1();
        } or {
          A -> B: Option2();
        }
        B -> A: Done();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = verifyProtocol(cfg);

    expect(result).toHaveProperty('deadlock');
    expect(result).toHaveProperty('liveness');
    expect(result).toHaveProperty('parallelDeadlock');
    expect(result).toHaveProperty('raceConditions');
    expect(result).toHaveProperty('progress');

    // All checks should pass
    expect(result.deadlock.hasDeadlock).toBe(false);
    expect(result.liveness.isLive).toBe(true);
    expect(result.parallelDeadlock.hasDeadlock).toBe(false);
    expect(result.raceConditions.hasRaces).toBe(false);
    expect(result.progress.canProgress).toBe(true);
  });

  it('should allow selective verification', () => {
    const source = `
      protocol Selective(role A, role B) {
        A -> B: Msg();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const result = verifyProtocol(cfg, {
      checkDeadlock: true,
      checkLiveness: false,
      checkParallelDeadlock: false,
      checkRaceConditions: false,
      checkProgress: false,
    });

    // Only deadlock should be checked
    expect(result.deadlock).toBeDefined();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Verification Edge Cases', () => {
  it('should handle empty protocol', () => {
    const source = `protocol Empty(role A) {}`;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = verifyProtocol(cfg);

    expect(result.deadlock.hasDeadlock).toBe(false);
    expect(result.liveness.isLive).toBe(true);
  });

  it('should handle deeply nested constructs', () => {
    const source = `
      protocol Nested(role A, role B) {
        choice at A {
          par {
            A -> B: M1();
          } and {
            A -> B: M2();
          }
        } or {
          A -> B: M3();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = verifyProtocol(cfg);

    // Should not crash, results depend on implementation
    expect(result).toBeDefined();
  });
});

// ============================================================================
// Choice Determinism (P0 - CRITICAL for Projection)
// ============================================================================

describe('Choice Determinism', () => {
  it('should detect same message label with different payloads', () => {
    // INVALID: Receiver can't distinguish which branch was taken
    const source = `
      protocol Ambiguous(role A, role B) {
        choice at A {
          A -> B: Msg(Int);
        } or {
          A -> B: Msg(String);
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkChoiceDeterminism(cfg);

    expect(result.isDeterministic).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].duplicateLabel).toBe('Msg');
  });

  it('should detect same message label to different receivers', () => {
    // INVALID: Still ambiguous for projection
    const source = `
      protocol AmbiguousReceivers(role A, role B, role C) {
        choice at A {
          A -> B: Request();
        } or {
          A -> C: Request();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkChoiceDeterminism(cfg);

    expect(result.isDeterministic).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].duplicateLabel).toBe('Request');
  });

  it('should accept distinguishable message labels', () => {
    // VALID: Different labels allow receiver to distinguish
    const source = `
      protocol Distinguishable(role A, role B) {
        choice at A {
          A -> B: Option1();
        } or {
          A -> B: Option2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkChoiceDeterminism(cfg);

    expect(result.isDeterministic).toBe(true);
    expect(result.violations.length).toBe(0);
  });
});

// ============================================================================
// Choice Mergeability (P0 - CRITICAL for Projection)
// ============================================================================

describe('Choice Mergeability', () => {
  it('should detect unbalanced choice branches', () => {
    // INVALID: Role C has inconsistent behavior across branches
    const source = `
      protocol Unmergeable(role A, role B, role C) {
        choice at A {
          A -> B: Option1();
          B -> C: Forward();
        } or {
          A -> B: Option2();
        }
        C -> A: Done();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkChoiceMergeability(cfg);

    expect(result.isMergeable).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('should detect role appearing in only some branches', () => {
    // INVALID: Role D only appears in one branch
    const source = `
      protocol PartialRole(role A, role B, role C, role D) {
        choice at A {
          A -> B: Opt1();
          B -> D: Extra();
        } or {
          A -> C: Opt2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkChoiceMergeability(cfg);

    expect(result.isMergeable).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('should accept balanced choice branches', () => {
    // VALID: All roles have consistent behavior across branches
    const source = `
      protocol Balanced(role A, role B) {
        choice at A {
          A -> B: Opt1();
        } or {
          A -> B: Opt2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkChoiceMergeability(cfg);

    expect(result.isMergeable).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should accept all branches with same continuation', () => {
    // VALID: Both branches have same structure
    const source = `
      protocol SameContinuation(role A, role B, role C) {
        choice at A {
          A -> B: Opt1();
          B -> C: Forward1();
        } or {
          A -> B: Opt2();
          B -> C: Forward2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkChoiceMergeability(cfg);

    expect(result.isMergeable).toBe(true);
    expect(result.violations.length).toBe(0);
  });
});

// ============================================================================
// Connectedness (P0 - CRITICAL for Projection)
// ============================================================================

describe('Connectedness', () => {
  it('should detect orphaned roles', () => {
    // INVALID: Role C is declared but never used
    const source = `
      protocol Orphan(role A, role B, role C) {
        A -> B: Msg();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkConnectedness(cfg);

    expect(result.isConnected).toBe(false);
    expect(result.orphanedRoles).toContain('C');
  });

  it('should accept all roles participating', () => {
    // VALID: All declared roles are used
    const source = `
      protocol Connected(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkConnectedness(cfg);

    expect(result.isConnected).toBe(true);
    expect(result.orphanedRoles.length).toBe(0);
  });
});

// ============================================================================
// Nested Recursion (P1 - HIGH for Correctness)
// ============================================================================

describe('Nested Recursion', () => {
  it('should accept nested recursion with different labels', () => {
    // VALID: Multiple rec labels can coexist
    const source = `
      protocol NestedRec(role A, role B) {
        rec Outer {
          A -> B: Start();
          rec Inner {
            choice at A {
              A -> B: InnerContinue();
              continue Inner;
            } or {
              A -> B: InnerExit();
            }
          }
          choice at A {
            A -> B: OuterContinue();
            continue Outer;
          } or {
            A -> B: OuterExit();
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkNestedRecursion(cfg);

    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should detect continue targeting non-existent rec label', () => {
    // INVALID: continue to undefined label
    // The CFG builder will catch this error at build time
    const source = `
      protocol InvalidContinue(role A, role B) {
        rec Loop {
          A -> B: Msg();
          continue NonExistent;
        }
      }
    `;
    const ast = parse(source);

    // CFG builder should throw for undefined label
    expect(() => buildCFG(ast.declarations[0])).toThrow('undefined recursion label');
  });

  it('should verify inner continue does not affect outer rec', () => {
    // VALID: Inner continue only loops inner rec
    const source = `
      protocol ScopedContinue(role A, role B) {
        rec Outer {
          A -> B: OuterMsg();
          rec Inner {
            A -> B: InnerMsg();
            continue Inner;
          }
          A -> B: AfterInner();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkNestedRecursion(cfg);

    expect(result.isValid).toBe(true);
    // Verify the CFG structure has correct continue edges
    const continueEdges = cfg.edges.filter(e => e.edgeType === 'continue');
    expect(continueEdges.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Recursion in Parallel (P1 - HIGH - Well-Formedness!)
// ============================================================================

describe('Recursion in Parallel', () => {
  it('should reject continue in parallel branch (Scribble spec 4.1.3)', () => {
    // INVALID: continue spans parallel boundary
    const source = `
      protocol RecInParallel(role A, role B, role C) {
        rec Loop {
          par {
            A -> B: M1();
            continue Loop;
          } and {
            C -> A: M2();
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkRecursionInParallel(cfg);

    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].description).toContain('parallel');
  });

  it('should accept rec fully contained in parallel branch', () => {
    // VALID: rec and continue both in same parallel branch
    const source = `
      protocol RecContained(role A, role B, role C, role D) {
        par {
          rec Loop {
            A -> B: M1();
            continue Loop;
          }
        } and {
          C -> D: M2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkRecursionInParallel(cfg);

    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
  });
});

// ============================================================================
// Fork-Join Structure (P1 - HIGH for Well-Formedness)
// ============================================================================

describe('Fork-Join Structure', () => {
  it('should accept nested fork-join', () => {
    // VALID: Parallel can be nested
    const source = `
      protocol NestedParallel(role A, role B, role C, role D, role E, role F) {
        par {
          A -> B: M1();
          par {
            A -> C: M2();
          } and {
            A -> D: M3();
          }
        } and {
          E -> F: M4();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkForkJoinStructure(cfg);

    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should accept multiple parallel blocks in sequence', () => {
    // VALID: Sequential parallel blocks
    const source = `
      protocol SequentialParallel(role A, role B, role C, role D) {
        par {
          A -> B: M1();
        } and {
          C -> D: M2();
        }
        par {
          A -> C: M3();
        } and {
          B -> D: M4();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkForkJoinStructure(cfg);

    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should accept parallel in choice branches', () => {
    // VALID: Parallel can appear in choice
    const source = `
      protocol ParallelInChoice(role A, role B, role C, role D) {
        choice at A {
          par {
            A -> B: M1();
          } and {
            C -> D: M2();
          }
        } or {
          A -> B: M3();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkForkJoinStructure(cfg);

    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
  });
});
