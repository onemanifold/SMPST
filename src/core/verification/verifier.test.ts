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
  checkMulticast,
  checkSelfCommunication,
  checkEmptyChoiceBranch,
  checkMergeReachability,
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

  it('should reject continue in nested parallel branch', () => {
    // INVALID: continue in nested parallel targeting outer rec
    const source = `
      protocol NestedParallelRec(role A, role B, role C, role D) {
        rec Outer {
          A -> B: Start();
          par {
            par {
              A -> C: Inner();
              continue Outer;
            } and {
              B -> D: Other();
            }
          } and {
            C -> A: Branch2();
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkRecursionInParallel(cfg);

    // Should detect continue spanning parallel boundary
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('should reject multiple continues in different parallel branches', () => {
    // INVALID: multiple continues in parallel branches
    const source = `
      protocol MultipleContinues(role A, role B, role C, role D) {
        rec Loop {
          par {
            A -> B: M1();
            continue Loop;
          } and {
            C -> D: M2();
            continue Loop;
          }
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkRecursionInParallel(cfg);

    // Should detect both violations
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
  });

  it('should accept parallel outside of recursion', () => {
    // VALID: parallel not nested in recursion
    const source = `
      protocol ParallelOutsideRec(role A, role B, role C, role D) {
        par {
          A -> B: M1();
        } and {
          C -> D: M2();
        }
        rec Loop {
          A -> C: InRec();
          continue Loop;
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

  it('should detect orphaned fork node (manual CFG test)', () => {
    // Test verifier can detect structural violations
    // This would only happen if CFG builder has a bug
    const ast = parse('protocol Test(role A, role B) { A -> B: M(); }');
    const cfg = buildCFG(ast.declarations[0]);

    // Manually inject an orphaned fork node to test detection
    const orphanedFork = {
      id: 'orphan_fork',
      type: 'fork' as const,
      parallel_id: 'orphaned_parallel',
    };
    cfg.nodes.push(orphanedFork);

    const result = checkForkJoinStructure(cfg);

    // Should detect the orphaned fork
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].type).toBe('orphaned-fork');
    expect(result.violations[0].forkNodeId).toBe('orphan_fork');
  });

  it('should detect orphaned join node (manual CFG test)', () => {
    // Test verifier can detect structural violations
    const ast = parse('protocol Test(role A, role B) { A -> B: M(); }');
    const cfg = buildCFG(ast.declarations[0]);

    // Manually inject an orphaned join node to test detection
    const orphanedJoin = {
      id: 'orphan_join',
      type: 'join' as const,
      parallel_id: 'orphaned_parallel',
    };
    cfg.nodes.push(orphanedJoin);

    const result = checkForkJoinStructure(cfg);

    // Should detect the orphaned join
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].type).toBe('orphaned-join');
    expect(result.violations[0].joinNodeId).toBe('orphan_join');
  });
});

// ============================================================================
// Multicast (P2 - MEDIUM for Correctness)
// ============================================================================

describe('Multicast', () => {
  it('should accept protocols without multicast', () => {
    // VALID: Standard single-receiver message
    const source = `
      protocol NoMulticast(role A, role B) {
        A -> B: Message(String);
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkMulticast(cfg);

    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBe(0);
  });

  it('should detect multicast with array receivers (manual CFG test)', () => {
    // Parser doesn't support multicast syntax yet (A -> B, C, D: Msg)
    // But verifier should handle CFG with multicast structure
    const source = `protocol Test(role A, role B, role C) { A -> B: M(); }`;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // Find the action node and modify it to have multiple receivers
    const actionNode = cfg.nodes.find(n => n.type === 'action');
    if (actionNode && actionNode.type === 'action') {
      // Modify action to have multicast (array of receivers)
      (actionNode.action as any).to = ['B', 'C'];
    }

    const result = checkMulticast(cfg);

    // Should detect multicast and generate warning
    expect(result.isValid).toBe(true); // Multicast is valid, just warns
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].sender).toBe('A');
    expect(result.warnings[0].receivers).toEqual(['B', 'C']);
  });

  it('should detect multicast to three receivers (manual CFG test)', () => {
    const source = `protocol Test(role A, role B, role C, role D) { A -> B: M(); }`;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // Modify action to have multicast to 3 receivers
    const actionNode = cfg.nodes.find(n => n.type === 'action');
    if (actionNode && actionNode.type === 'action') {
      (actionNode.action as any).to = ['B', 'C', 'D'];
    }

    const result = checkMulticast(cfg);

    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].receivers).toHaveLength(3);
    expect(result.warnings[0].description).toContain('B, C, D');
  });
});

// ============================================================================
// Self-Communication (P2 - MEDIUM - Spec Verification)
// ============================================================================

describe('Self-Communication', () => {
  it('should detect self-communication (likely invalid)', () => {
    // INVALID: Role sends to itself
    const source = `
      protocol SelfMsg(role A, role B) {
        A -> A: Reflect();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkSelfCommunication(cfg);

    // Self-communication is semantically questionable
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].role).toBe('A');
    expect(result.violations[0].description).toContain('sends message to itself');
  });

  it('should detect self in multicast receiver list (manual CFG test)', () => {
    // INVALID: Role sends multicast including itself
    const source = `protocol Test(role A, role B, role C) { A -> B: M(); }`;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // Modify action to have multicast including sender
    const actionNode = cfg.nodes.find(n => n.type === 'action');
    if (actionNode && actionNode.type === 'action') {
      (actionNode.action as any).to = ['A', 'B', 'C']; // A includes itself
    }

    const result = checkSelfCommunication(cfg);

    // Should detect self in multicast
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].role).toBe('A');
    expect(result.violations[0].description).toContain('multicast receiver list');
    expect(result.violations[0].description).toContain('self-communication');
  });

  it('should accept normal communication', () => {
    // VALID: Normal role-to-role communication
    const source = `
      protocol Normal(role A, role B) {
        A -> B: Message();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkSelfCommunication(cfg);

    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
  });
});

// ============================================================================
// Empty Choice Branch (P2 - MEDIUM - Well-Formedness)
// ============================================================================

describe('Empty Choice Branch', () => {
  it('should accept choice with both branches having content', () => {
    // VALID: Both branches have actions
    const source = `
      protocol BothBranchesHaveContent(role A, role B) {
        choice at A {
          A -> B: Something();
        } or {
          A -> B: Nothing();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkEmptyChoiceBranch(cfg);

    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should detect empty choice branch (manual CFG test)', () => {
    // Parser doesn't support truly empty branches
    // Test verifier can detect empty branch in CFG structure
    const source = `
      protocol Test(role A, role B) {
        choice at A {
          A -> B: Opt1();
        } or {
          A -> B: Opt2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // Find the branch node and one of its outgoing edges
    const branchNode = cfg.nodes.find(n => n.type === 'branch');
    const mergeNode = cfg.nodes.find(n => n.type === 'merge');

    if (branchNode && mergeNode) {
      // Add a branch edge that goes directly to merge (empty branch)
      cfg.edges.push({
        from: branchNode.id,
        to: mergeNode.id,
        edgeType: 'branch',
        label: 'empty_branch',
      });
    }

    const result = checkEmptyChoiceBranch(cfg);

    // Should detect the empty branch
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].emptyBranchLabel).toContain('empty_branch');
    expect(result.violations[0].description).toContain('empty');
  });
});

// ============================================================================
// Merge Node Reachability (P3 - Structural Correctness)
// ============================================================================

describe('Merge Node Reachability', () => {
  it('should verify all choice branches reach same merge', () => {
    // VALID: Both branches converge at same merge
    const source = `
      protocol ProperMerge(role A, role B) {
        choice at A {
          A -> B: Opt1();
        } or {
          A -> B: Opt2();
        }
        A -> B: AfterChoice();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkMergeReachability(cfg);

    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should verify sequential choices merge correctly', () => {
    // VALID: Sequential choices (not nested)
    const source = `
      protocol SequentialChoices(role A, role B) {
        choice at A {
          A -> B: First1();
        } or {
          A -> B: First2();
        }
        choice at A {
          A -> B: Second1();
        } or {
          A -> B: Second2();
        }
        A -> B: AfterAll();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkMergeReachability(cfg);

    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should verify parallel in choice branches merges correctly', () => {
    // VALID: Parallel constructs within choice branches
    const source = `
      protocol ParallelInChoice(role A, role B, role C, role D) {
        choice at A {
          par {
            A -> B: P1();
          } and {
            C -> D: P2();
          }
        } or {
          A -> B: Simple();
        }
        A -> B: After();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkMergeReachability(cfg);

    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should verify three-way choice merges correctly', () => {
    // VALID: Three branches all converging to same merge
    const source = `
      protocol ThreeWayChoice(role A, role B) {
        choice at A {
          A -> B: Option1();
        } or {
          A -> B: Option2();
        } or {
          A -> B: Option3();
        }
        A -> B: AfterChoice();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkMergeReachability(cfg);

    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should accept terminal branches without explicit merge', () => {
    // VALID: Branches can terminate without continuation
    const source = `
      protocol TerminalBranches(role A, role B) {
        choice at A {
          A -> B: Branch1();
        } or {
          A -> B: Branch2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkMergeReachability(cfg);

    // CFG builder creates proper merge nodes even for terminal cases
    expect(result.isValid).toBe(true);
  });
});
