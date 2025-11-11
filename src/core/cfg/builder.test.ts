/**
 * CFG Builder Tests
 * Following TDD: These tests are written BEFORE implementation
 *
 * The CFG is the MOST CRITICAL component. These tests ensure correctness.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../parser/parser';
import { buildCFG } from './builder';
import type { CFG, ActionNode, BranchNode, MergeNode, ForkNode, JoinNode, RecursiveNode } from './types';
import {
  isInitialNode,
  isTerminalNode,
  isActionNode,
  isBranchNode,
  isMergeNode,
  isForkNode,
  isJoinNode,
  isRecursiveNode,
  isMessageAction,
} from './types';
import {
  validateCFG,
  findReachableNodes,
  canReach,
  findAllPaths,
  hasExactlyOneInitial,
  hasAtLeastOneTerminal,
  allNodesReachable,
  allNodesReachTerminal,
  forksMatchJoins,
  branchesMatchMerges,
  hasNoOrphanedNodes,
  allEdgesValid,
  getCFGStats,
} from './test-utils';

// ============================================================================
// Level 1: Transformation Rule Tests
// ============================================================================

describe('CFG Builder - Rule 1: Empty Protocol', () => {
  it('should create initial and terminal nodes for empty protocol', () => {
    const source = 'protocol Empty(role A) {}';
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    expect(cfg.nodes).toHaveLength(2);

    const initial = cfg.nodes.find(isInitialNode);
    const terminal = cfg.nodes.find(isTerminalNode);

    expect(initial).toBeDefined();
    expect(terminal).toBeDefined();

    // Should have exactly one edge from initial to terminal
    expect(cfg.edges).toHaveLength(1);
    expect(cfg.edges[0].from).toBe(initial!.id);
    expect(cfg.edges[0].to).toBe(terminal!.id);
    expect(cfg.edges[0].edgeType).toBe('sequence');
  });

  it('should extract roles from protocol declaration', () => {
    const source = 'protocol Test(role A, role B, role C) {}';
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    expect(cfg.roles).toEqual(['A', 'B', 'C']);
  });
});

describe('CFG Builder - Rule 2: Single Message', () => {
  it('should create action node for single message', () => {
    const source = 'protocol Msg(role A, role B) { A -> B: Hello(); }';
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // initial -> action -> terminal
    expect(cfg.nodes).toHaveLength(3);

    const actionNode = cfg.nodes.find(isActionNode) as ActionNode;
    expect(actionNode).toBeDefined();
    expect(actionNode.action.kind).toBe('message');

    if (isMessageAction(actionNode.action)) {
      expect(actionNode.action.from).toBe('A');
      expect(actionNode.action.to).toBe('B');
      expect(actionNode.action.label).toBe('Hello');
    }

    // Edges: initial -> action -> terminal
    expect(cfg.edges).toHaveLength(2);
  });

  it('should include payload type in action', () => {
    const source = 'protocol Msg(role A, role B) { A -> B: Request(String); }';
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const actionNode = cfg.nodes.find(isActionNode) as ActionNode;
    if (isMessageAction(actionNode.action)) {
      expect(actionNode.action.payloadType).toBe('String');
    }
  });
});

describe('CFG Builder - Rule 3: Sequential Messages', () => {
  it('should create action nodes in sequence', () => {
    const source = `
      protocol Seq(role A, role B, role C) {
        A -> B: Msg1();
        B -> C: Msg2();
        C -> A: Msg3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // initial -> action1 -> action2 -> action3 -> terminal
    expect(cfg.nodes).toHaveLength(5);

    const actions = cfg.nodes.filter(isActionNode) as ActionNode[];
    expect(actions).toHaveLength(3);

    // Verify sequence
    if (isMessageAction(actions[0].action)) {
      expect(actions[0].action.from).toBe('A');
      expect(actions[0].action.to).toBe('B');
    }
    if (isMessageAction(actions[1].action)) {
      expect(actions[1].action.from).toBe('B');
      expect(actions[1].action.to).toBe('C');
    }
    if (isMessageAction(actions[2].action)) {
      expect(actions[2].action.from).toBe('C');
      expect(actions[2].action.to).toBe('A');
    }

    // All edges should be sequence type
    expect(cfg.edges.every(e => e.edgeType === 'sequence')).toBe(true);
  });

  it('should maintain sequential ordering', () => {
    const source = `
      protocol Seq(role A, role B) {
        A -> B: First();
        A -> B: Second();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const initial = cfg.nodes.find(isInitialNode)!;
    const terminal = cfg.nodes.find(isTerminalNode)!;

    // Find path from initial to terminal
    const paths = findAllPaths(cfg, initial.id, terminal.id);
    expect(paths).toHaveLength(1);

    // Path should go through actions in order
    const path = paths[0];
    expect(path).toHaveLength(4); // initial, action1, action2, terminal
  });
});

describe('CFG Builder - Rule 4: Choice', () => {
  it('should create branch and merge nodes for choice', () => {
    const source = `
      protocol Choice(role A, role B) {
        choice at A {
          A -> B: Yes();
        } or {
          A -> B: No();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const branchNode = cfg.nodes.find(isBranchNode) as BranchNode;
    const mergeNode = cfg.nodes.find(isMergeNode);

    expect(branchNode).toBeDefined();
    expect(mergeNode).toBeDefined();
    expect(branchNode.at).toBe('A');

    // Branch should have 2 outgoing edges
    const branchEdges = cfg.edges.filter(e => e.from === branchNode.id);
    expect(branchEdges).toHaveLength(2);
    expect(branchEdges[0].edgeType).toBe('branch');
    expect(branchEdges[1].edgeType).toBe('branch');

    // Both branches should lead to merge
    const pathsToMerge = findAllPaths(cfg, branchNode.id, mergeNode!.id);
    expect(pathsToMerge).toHaveLength(2);
  });

  it('should handle three-way choice', () => {
    const source = `
      protocol ThreeWay(role A, role B) {
        choice at A {
          A -> B: Option1();
        } or {
          A -> B: Option2();
        } or {
          A -> B: Option3();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const branchNode = cfg.nodes.find(isBranchNode)!;
    const branchEdges = cfg.edges.filter(e => e.from === branchNode.id);

    expect(branchEdges).toHaveLength(3);
  });

  it('should handle nested choices', () => {
    const source = `
      protocol NestedChoice(role A, role B) {
        choice at A {
          choice at A {
            A -> B: A1();
          } or {
            A -> B: A2();
          }
        } or {
          A -> B: B();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const branches = cfg.nodes.filter(isBranchNode);
    const merges = cfg.nodes.filter(isMergeNode);

    expect(branches).toHaveLength(2); // Outer and inner choice
    expect(merges).toHaveLength(2);   // Corresponding merges
  });
});

describe('CFG Builder - Rule 7: Parallel Composition', () => {
  it('should create fork and join nodes for parallel', () => {
    const source = `
      protocol Parallel(role A, role B, role C) {
        par {
          A -> B: Msg1();
        } and {
          A -> C: Msg2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const forkNode = cfg.nodes.find(isForkNode) as ForkNode;
    const joinNode = cfg.nodes.find(isJoinNode) as JoinNode;

    expect(forkNode).toBeDefined();
    expect(joinNode).toBeDefined();
    expect(forkNode.parallel_id).toBe(joinNode.parallel_id);

    // Fork should have 2 outgoing edges
    const forkEdges = cfg.edges.filter(e => e.from === forkNode.id);
    expect(forkEdges).toHaveLength(2);
    expect(forkEdges[0].edgeType).toBe('fork');
    expect(forkEdges[1].edgeType).toBe('fork');

    // Both branches should lead to join
    const pathsToJoin = findAllPaths(cfg, forkNode.id, joinNode.id);
    expect(pathsToJoin).toHaveLength(2);
  });

  it('should handle three-way parallel', () => {
    const source = `
      protocol ThreeWay(role A, role B, role C, role D) {
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

    const forkNode = cfg.nodes.find(isForkNode)!;
    const forkEdges = cfg.edges.filter(e => e.from === forkNode.id);

    expect(forkEdges).toHaveLength(3);
  });

  it('should handle nested parallel', () => {
    const source = `
      protocol NestedParallel(role A, role B, role C, role D) {
        par {
          par {
            A -> B: Inner1();
          } and {
            A -> C: Inner2();
          }
        } and {
          A -> D: Outer();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const forks = cfg.nodes.filter(isForkNode) as ForkNode[];
    const joins = cfg.nodes.filter(isJoinNode) as JoinNode[];

    expect(forks).toHaveLength(2);
    expect(joins).toHaveLength(2);

    // Each fork should have matching join
    for (const fork of forks) {
      const matchingJoin = joins.find(j => j.parallel_id === fork.parallel_id);
      expect(matchingJoin).toBeDefined();
    }
  });

  it('should handle protocol continuing after parallel', () => {
    const source = `
      protocol ParallelThenSeq(role A, role B, role C) {
        par {
          A -> B: Par1();
        } and {
          A -> C: Par2();
        }
        A -> B: AfterParallel();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const joinNode = cfg.nodes.find(isJoinNode)!;

    // Should have edge from join to the "AfterParallel" action
    const afterJoinEdges = cfg.edges.filter(e => e.from === joinNode.id);
    expect(afterJoinEdges).toHaveLength(1);

    const nextNode = cfg.nodes.find(n => n.id === afterJoinEdges[0].to);
    expect(nextNode?.type).toBe('action');
  });
});

describe('CFG Builder - Rule 6: Recursion', () => {
  it('should create recursive node with back edge', () => {
    const source = `
      protocol Loop(role A, role B) {
        rec Loop {
          A -> B: Msg();
          continue Loop;
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const recNode = cfg.nodes.find(isRecursiveNode) as RecursiveNode;
    expect(recNode).toBeDefined();
    expect(recNode.label).toBe('Loop');

    // Should have back edge
    const backEdge = cfg.edges.find(
      e => e.edgeType === 'continue' && e.to === recNode.id
    );
    expect(backEdge).toBeDefined();
  });

  it('should handle recursion with choice (loop with exit)', () => {
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

    const recNode = cfg.nodes.find(isRecursiveNode);
    const branchNode = cfg.nodes.find(isBranchNode);

    expect(recNode).toBeDefined();
    expect(branchNode).toBeDefined();

    // One branch should loop back, other should exit
    const continueEdge = cfg.edges.find(e => e.edgeType === 'continue');
    expect(continueEdge).toBeDefined();
    expect(continueEdge!.to).toBe(recNode!.id);
  });

  it('should handle nested recursion', () => {
    const source = `
      protocol NestedLoop(role A, role B) {
        rec Outer {
          A -> B: OuterMsg();
          rec Inner {
            A -> B: InnerMsg();
            continue Inner;
          }
          continue Outer;
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const recNodes = cfg.nodes.filter(isRecursiveNode) as RecursiveNode[];
    expect(recNodes).toHaveLength(2);

    const outerRec = recNodes.find(r => r.label === 'Outer');
    const innerRec = recNodes.find(r => r.label === 'Inner');

    expect(outerRec).toBeDefined();
    expect(innerRec).toBeDefined();

    // Should have 2 continue edges
    const continueEdges = cfg.edges.filter(e => e.edgeType === 'continue');
    expect(continueEdges).toHaveLength(2);
  });
});

// ============================================================================
// Level 2: Structural Invariant Tests
// ============================================================================

describe('CFG Structural Invariants', () => {
  const testProtocols = [
    'protocol Empty(role A) {}',
    'protocol Msg(role A, role B) { A -> B: Hello(); }',
    `protocol Seq(role A, role B) {
      A -> B: M1();
      B -> A: M2();
    }`,
    `protocol Choice(role A, role B) {
      choice at A {
        A -> B: Yes();
      } or {
        A -> B: No();
      }
    }`,
    `protocol Parallel(role A, role B, role C) {
      par {
        A -> B: M1();
      } and {
        A -> C: M2();
      }
    }`,
    // Note: Infinite loop protocol (rec with only continue) is tested separately
    // because its terminal is intentionally unreachable
  ];

  testProtocols.forEach((source) => {
    const protocolName = source.match(/protocol (\w+)/)?.[1] || 'Unknown';

    it(`[${protocolName}] must have exactly one initial node`, () => {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      expect(hasExactlyOneInitial(cfg)).toBe(true);
    });

    it(`[${protocolName}] must have at least one terminal node`, () => {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      expect(hasAtLeastOneTerminal(cfg)).toBe(true);
    });

    it(`[${protocolName}] all nodes must be reachable from initial`, () => {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      expect(allNodesReachable(cfg)).toBe(true);
    });

    it(`[${protocolName}] all nodes must reach a terminal`, () => {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      expect(allNodesReachTerminal(cfg)).toBe(true);
    });

    it(`[${protocolName}] must have no orphaned nodes`, () => {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      expect(hasNoOrphanedNodes(cfg)).toBe(true);
    });

    it(`[${protocolName}] all edges must reference existing nodes`, () => {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      expect(allEdgesValid(cfg)).toBe(true);
    });

    it(`[${protocolName}] must pass complete validation`, () => {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0]);
      const result = validateCFG(cfg);

      if (!result.valid) {
        console.error(`Validation errors for ${protocolName}:`, result.errors);
      }

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  it('every fork must have matching join', () => {
    const source = `
      protocol Par(role A, role B, role C) {
        par {
          A -> B: M1();
        } and {
          A -> C: M2();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    expect(forksMatchJoins(cfg)).toBe(true);
  });

  it('every branch must have matching merge', () => {
    const source = `
      protocol Ch(role A, role B) {
        choice at A {
          A -> B: Y();
        } or {
          A -> B: N();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    expect(branchesMatchMerges(cfg)).toBe(true);
  });

  it('infinite loop protocols have exit edges for composability', () => {
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

    // Even infinite loops have exit edges to allow composition with outer protocols
    expect(hasAtLeastOneTerminal(cfg)).toBe(true);

    // All nodes should be reachable (including terminal via exit edge)
    expect(allNodesReachable(cfg)).toBe(true);

    // Should have a continue edge for the loop
    const continueEdges = cfg.edges.filter(e => e.edgeType === 'continue');
    expect(continueEdges.length).toBeGreaterThanOrEqual(1);

    // Should have a recursive node
    const recNodes = cfg.nodes.filter(n => n.type === 'recursive');
    expect(recNodes).toHaveLength(1);
  });
});

// ============================================================================
// Level 3: Known-Good Protocol Tests
// ============================================================================

describe('CFG Builder - Two-Phase Commit', () => {
  it('should build correct CFG structure', () => {
    const source = `
      protocol TwoPhaseCommit(role Coordinator, role Participant1, role Participant2) {
        Coordinator -> Participant1: VoteRequest();
        Coordinator -> Participant2: VoteRequest();

        par {
          Participant1 -> Coordinator: Vote(Bool);
        } and {
          Participant2 -> Coordinator: Vote(Bool);
        }

        choice at Coordinator {
          Coordinator -> Participant1: Commit();
          Coordinator -> Participant2: Commit();
        } or {
          Coordinator -> Participant1: Abort();
          Coordinator -> Participant2: Abort();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // Verify major structure
    const forkNode = cfg.nodes.find(isForkNode);
    const joinNode = cfg.nodes.find(isJoinNode);
    const branchNode = cfg.nodes.find(isBranchNode);
    const mergeNode = cfg.nodes.find(isMergeNode);

    expect(forkNode).toBeDefined();
    expect(joinNode).toBeDefined();
    expect(branchNode).toBeDefined();
    expect(mergeNode).toBeDefined();

    // Fork should come before join
    expect(canReach(cfg, forkNode!.id, joinNode!.id)).toBe(true);

    // Join should come before choice
    expect(canReach(cfg, joinNode!.id, branchNode!.id)).toBe(true);

    // Choice should lead to merge
    expect(canReach(cfg, branchNode!.id, mergeNode!.id)).toBe(true);

    // Complete validation
    const validation = validateCFG(cfg);
    expect(validation.valid).toBe(true);
  });
});

// ============================================================================
// Level 4: Edge Case Tests
// ============================================================================

describe('CFG Builder - Edge Cases', () => {
  it('should handle empty protocol', () => {
    const source = 'protocol Empty(role A) {}';
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    expect(cfg.nodes).toHaveLength(2);
    expect(cfg.edges).toHaveLength(1);

    const validation = validateCFG(cfg);
    expect(validation.valid).toBe(true);
  });

  it('should handle single message', () => {
    const source = 'protocol Single(role A, role B) { A -> B: M(); }';
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    expect(cfg.nodes).toHaveLength(3); // initial, action, terminal
    const validation = validateCFG(cfg);
    expect(validation.valid).toBe(true);
  });

  it('should handle complex nesting: parallel inside choice', () => {
    const source = `
      protocol Complex1(role A, role B, role C) {
        choice at A {
          par {
            A -> B: M1();
          } and {
            A -> C: M2();
          }
        } or {
          A -> B: M3();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const validation = validateCFG(cfg);
    expect(validation.valid).toBe(true);

    // Should have both fork/join and branch/merge
    expect(cfg.nodes.some(isForkNode)).toBe(true);
    expect(cfg.nodes.some(isJoinNode)).toBe(true);
    expect(cfg.nodes.some(isBranchNode)).toBe(true);
    expect(cfg.nodes.some(isMergeNode)).toBe(true);
  });

  it('should handle complex nesting: choice inside parallel', () => {
    const source = `
      protocol Complex2(role A, role B, role C) {
        par {
          choice at A {
            A -> B: Y();
          } or {
            A -> B: N();
          }
        } and {
          A -> C: M();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const validation = validateCFG(cfg);
    expect(validation.valid).toBe(true);
  });
});

// ============================================================================
// Level 5: Statistics and Debugging
// ============================================================================

describe('CFG Statistics', () => {
  it('should compute correct statistics', () => {
    const source = `
      protocol Stats(role A, role B) {
        choice at A {
          A -> B: Y();
        } or {
          A -> B: N();
        }
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    const stats = getCFGStats(cfg);

    expect(stats.nodeCount).toBe(cfg.nodes.length);
    expect(stats.edgeCount).toBe(cfg.edges.length);
    expect(stats.nodeTypes['initial']).toBe(1);
    expect(stats.nodeTypes['terminal']).toBe(1);
    expect(stats.nodeTypes['branch']).toBe(1);
    expect(stats.nodeTypes['merge']).toBe(1);
  });
});
