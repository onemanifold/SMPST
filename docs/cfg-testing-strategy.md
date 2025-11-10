# CFG Testing Strategy

The CFG (Control Flow Graph) is the **most critical** component of the MPST framework. Everything depends on it:
- Verification algorithms analyze CFG structure
- Projection generates CFSM from CFG
- Runtime simulation follows CFG paths
- Code generation uses CFG semantics

Therefore, we need **extremely robust testing** to ensure correctness.

## Testing Levels

### Level 1: Unit Tests (Transformation Rules)

Test each transformation rule from `docs/cfg-design.md` individually.

#### Rule 1: Empty Protocol
```typescript
it('should create initial and terminal nodes for empty protocol', () => {
  const ast = parse('protocol Empty(role A) {}');
  const cfg = buildCFG(ast.declarations[0]);

  expect(cfg.nodes).toHaveLength(2);
  expect(cfg.nodes[0].type).toBe('initial');
  expect(cfg.nodes[1].type).toBe('terminal');
  expect(cfg.edges).toHaveLength(1);
  expect(cfg.edges[0].from).toBe(cfg.nodes[0].id);
  expect(cfg.edges[0].to).toBe(cfg.nodes[1].id);
});
```

#### Rule 2: Single Message
```typescript
it('should create action node for single message', () => {
  const ast = parse('protocol Msg(role A, role B) { A -> B: Hello(); }');
  const cfg = buildCFG(ast.declarations[0]);

  expect(cfg.nodes).toHaveLength(3); // initial, action, terminal

  const actionNode = cfg.nodes.find(n => n.type === 'action');
  expect(actionNode).toBeDefined();
  expect(actionNode.action.kind).toBe('message');
  expect(actionNode.action.from).toBe('A');
  expect(actionNode.action.to).toBe('B');
  expect(actionNode.action.label).toBe('Hello');
});
```

#### Rule 3: Sequential Messages
```typescript
it('should create action nodes in sequence', () => {
  const ast = parse(`
    protocol Seq(role A, role B, role C) {
      A -> B: Msg1();
      B -> C: Msg2();
    }
  `);
  const cfg = buildCFG(ast.declarations[0]);

  expect(cfg.nodes).toHaveLength(4); // initial, action1, action2, terminal

  // Verify sequential edges
  const edges = getEdgeSequence(cfg);
  expect(edges).toHaveLength(3);
  expect(edges[0].edgeType).toBe('sequence');
  expect(edges[1].edgeType).toBe('sequence');
  expect(edges[2].edgeType).toBe('sequence');
});
```

#### Rule 4: Choice
```typescript
it('should create branch and merge nodes for choice', () => {
  const ast = parse(`
    protocol Choice(role A, role B) {
      choice at A {
        A -> B: Yes();
      } or {
        A -> B: No();
      }
    }
  `);
  const cfg = buildCFG(ast.declarations[0]);

  const branchNode = cfg.nodes.find(n => n.type === 'branch');
  const mergeNode = cfg.nodes.find(n => n.type === 'merge');

  expect(branchNode).toBeDefined();
  expect(mergeNode).toBeDefined();
  expect(branchNode.at).toBe('A');

  // Branch should have 2 outgoing edges
  const branchEdges = cfg.edges.filter(e => e.from === branchNode.id);
  expect(branchEdges).toHaveLength(2);
  expect(branchEdges[0].label).toBeDefined();
  expect(branchEdges[1].label).toBeDefined();

  // Both branches should lead to merge
  const pathsToMerge = findAllPaths(cfg, branchNode.id, mergeNode.id);
  expect(pathsToMerge).toHaveLength(2);
});
```

#### Rule 7: Parallel
```typescript
it('should create fork and join nodes for parallel', () => {
  const ast = parse(`
    protocol Parallel(role A, role B, role C) {
      par {
        A -> B: Msg1();
      } and {
        A -> C: Msg2();
      }
    }
  `);
  const cfg = buildCFG(ast.declarations[0]);

  const forkNode = cfg.nodes.find(n => n.type === 'fork');
  const joinNode = cfg.nodes.find(n => n.type === 'join');

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
```

#### Rule 6: Recursion
```typescript
it('should create recursive node with back edge', () => {
  const ast = parse(`
    protocol Loop(role A, role B) {
      rec Label {
        A -> B: Msg();
        continue Label;
      }
    }
  `);
  const cfg = buildCFG(ast.declarations[0]);

  const recNode = cfg.nodes.find(n => n.type === 'recursive');
  expect(recNode).toBeDefined();
  expect(recNode.label).toBe('Label');

  // Should have back edge
  const backEdge = cfg.edges.find(e =>
    e.edgeType === 'continue' && e.to === recNode.id
  );
  expect(backEdge).toBeDefined();
});
```

### Level 2: Structural Invariant Tests

**Critical**: These tests verify CFG correctness properties that MUST always hold.

```typescript
describe('CFG Structural Invariants', () => {
  it('must have exactly one initial node', () => {
    const cfg = buildCFG(anyProtocol);
    const initialNodes = cfg.nodes.filter(n => n.type === 'initial');
    expect(initialNodes).toHaveLength(1);
  });

  it('must have at least one terminal node', () => {
    const cfg = buildCFG(anyProtocol);
    const terminalNodes = cfg.nodes.filter(n => n.type === 'terminal');
    expect(terminalNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('all nodes must be reachable from initial', () => {
    const cfg = buildCFG(anyProtocol);
    const initial = cfg.nodes.find(n => n.type === 'initial');
    const reachable = findReachableNodes(cfg, initial.id);

    expect(reachable.size).toBe(cfg.nodes.length);
  });

  it('all nodes must reach at least one terminal', () => {
    const cfg = buildCFG(anyProtocol);
    const terminals = cfg.nodes.filter(n => n.type === 'terminal');

    for (const node of cfg.nodes) {
      const canReachTerminal = terminals.some(t =>
        canReach(cfg, node.id, t.id)
      );
      expect(canReachTerminal).toBe(true);
    }
  });

  it('every fork must have matching join', () => {
    const cfg = buildCFG(anyProtocol);
    const forks = cfg.nodes.filter(n => n.type === 'fork');
    const joins = cfg.nodes.filter(n => n.type === 'join');

    for (const fork of forks) {
      const matchingJoin = joins.find(j => j.parallel_id === fork.parallel_id);
      expect(matchingJoin).toBeDefined();
    }

    // And vice versa
    for (const join of joins) {
      const matchingFork = forks.find(f => f.parallel_id === join.parallel_id);
      expect(matchingFork).toBeDefined();
    }
  });

  it('every branch must have matching merge', () => {
    const cfg = buildCFG(anyProtocol);
    const branches = cfg.nodes.filter(n => n.type === 'branch');
    const merges = cfg.nodes.filter(n => n.type === 'merge');

    // For each branch, must be able to reach a merge from all paths
    for (const branch of branches) {
      const outgoingEdges = cfg.edges.filter(e => e.from === branch.id);
      expect(outgoingEdges.length).toBeGreaterThanOrEqual(2);

      // All branches must converge at same merge
      const mergeSets = outgoingEdges.map(edge =>
        findNextMerge(cfg, edge.to)
      );
      const firstMerge = mergeSets[0];
      expect(mergeSets.every(m => m === firstMerge)).toBe(true);
    }
  });

  it('no orphaned nodes (nodes with no incoming or outgoing edges)', () => {
    const cfg = buildCFG(anyProtocol);

    for (const node of cfg.nodes) {
      if (node.type === 'initial') {
        // Initial has no incoming, must have outgoing
        const outgoing = cfg.edges.filter(e => e.from === node.id);
        expect(outgoing.length).toBeGreaterThan(0);
      } else if (node.type === 'terminal') {
        // Terminal has no outgoing, must have incoming
        const incoming = cfg.edges.filter(e => e.to === node.id);
        expect(incoming.length).toBeGreaterThan(0);
      } else {
        // All other nodes must have both incoming and outgoing
        const incoming = cfg.edges.filter(e => e.to === node.id);
        const outgoing = cfg.edges.filter(e => e.from === node.id);
        expect(incoming.length).toBeGreaterThan(0);
        expect(outgoing.length).toBeGreaterThan(0);
      }
    }
  });

  it('edge from/to references must point to existing nodes', () => {
    const cfg = buildCFG(anyProtocol);
    const nodeIds = new Set(cfg.nodes.map(n => n.id));

    for (const edge of cfg.edges) {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
    }
  });
});
```

### Level 3: Known-Good Protocol Tests

Test against manually verified CFGs for well-known protocols.

```typescript
describe('CFG Builder - Two-Phase Commit', () => {
  it('should build correct CFG structure', () => {
    const ast = parse(readFile('examples/two-phase-commit.scr'));
    const cfg = buildCFG(ast.declarations[0]);

    // Expected structure:
    // initial -> msg1 -> msg2 -> fork -> [branch1, branch2] -> join -> choice -> [commit, abort] -> merge -> terminal

    expect(cfg.nodes).toHaveLength(/* expected count */);

    // Verify specific structure
    const forkNode = cfg.nodes.find(n => n.type === 'fork');
    const joinNode = cfg.nodes.find(n => n.type === 'join');
    const choiceNode = cfg.nodes.find(n => n.type === 'branch');
    const mergeNode = cfg.nodes.find(n => n.type === 'merge');

    // Fork comes before join
    expect(canReach(cfg, forkNode.id, joinNode.id)).toBe(true);

    // Join comes before choice
    expect(canReach(cfg, joinNode.id, choiceNode.id)).toBe(true);

    // Choice leads to merge
    expect(canReach(cfg, choiceNode.id, mergeNode.id)).toBe(true);
  });
});
```

### Level 4: Edge Case Tests

```typescript
describe('CFG Builder - Edge Cases', () => {
  it('should handle empty protocol', () => {
    const ast = parse('protocol Empty(role A) {}');
    const cfg = buildCFG(ast.declarations[0]);

    expect(cfg.nodes).toHaveLength(2);
    expect(cfg.edges).toHaveLength(1);
  });

  it('should handle deeply nested choices', () => {
    const ast = parse(`
      protocol Nested(role A, role B) {
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
    `);
    const cfg = buildCFG(ast.declarations[0]);

    // Should have 2 branch nodes, 2 merge nodes
    const branches = cfg.nodes.filter(n => n.type === 'branch');
    const merges = cfg.nodes.filter(n => n.type === 'merge');
    expect(branches).toHaveLength(2);
    expect(merges).toHaveLength(2);
  });

  it('should handle parallel inside choice', () => {
    // Complex nesting test
  });

  it('should handle choice inside parallel', () => {
    // Complex nesting test
  });

  it('should handle recursion with choice', () => {
    // Streaming protocol pattern
  });

  it('should handle three-way parallel', () => {
    const ast = parse(`
      protocol ThreeWay(role A, role B, role C, role D) {
        par {
          A -> B: M1();
        } and {
          A -> C: M2();
        } and {
          A -> D: M3();
        }
      }
    `);
    const cfg = buildCFG(ast.declarations[0]);

    const forkNode = cfg.nodes.find(n => n.type === 'fork');
    const forkEdges = cfg.edges.filter(e => e.from === forkNode.id);
    expect(forkEdges).toHaveLength(3);
  });
});
```

### Level 5: Visualization & Manual Inspection

Generate DOT format for visual verification:

```typescript
describe('CFG Visualization', () => {
  it('should export to DOT format', () => {
    const cfg = buildCFG(anyProtocol);
    const dot = exportToDOT(cfg);

    // Should be valid DOT syntax
    expect(dot).toContain('digraph');
    expect(dot).toContain('->');

    // Save for manual inspection
    fs.writeFileSync('test-output/cfg.dot', dot);
    // Then run: dot -Tpng cfg.dot -o cfg.png
  });
});
```

### Level 6: Property-Based Testing (Future)

For even more robustness, we can use property-based testing:

```typescript
import { fc } from 'fast-check';

describe('CFG Property-Based Tests', () => {
  it('any valid AST should produce valid CFG', () => {
    fc.assert(
      fc.property(validProtocolGenerator, (ast) => {
        const cfg = buildCFG(ast);

        // All invariants must hold
        expect(hasExactlyOneInitial(cfg)).toBe(true);
        expect(allNodesReachable(cfg)).toBe(true);
        expect(forksMatchJoins(cfg)).toBe(true);
        expect(branchesMatchMerges(cfg)).toBe(true);
      })
    );
  });
});
```

## Testing Utilities

We'll need helper functions for testing:

```typescript
// Graph traversal
function findReachableNodes(cfg: CFG, startId: string): Set<string>;
function canReach(cfg: CFG, fromId: string, toId: string): boolean;
function findAllPaths(cfg: CFG, fromId: string, toId: string): Path[];

// CFG analysis
function getTopologicalOrder(cfg: CFG): Node[];
function findCycles(cfg: CFG): Cycle[];
function validateStructure(cfg: CFG): ValidationResult;

// Comparison
function compareCFGs(cfg1: CFG, cfg2: CFG): boolean;
function cfgToCanonicalString(cfg: CFG): string;

// Visualization
function exportToDOT(cfg: CFG): string;
function exportToJSON(cfg: CFG): object;
```

## Test Execution Strategy

1. **Red Phase**: Write all tests first (they fail)
2. **Green Phase**: Implement CFG builder to make tests pass
3. **Refactor Phase**: Optimize while keeping tests green
4. **Visual Verification**: Generate DOT graphs, inspect manually
5. **Integration**: Test with next layer (Verification)

## Success Criteria

✅ All transformation rule tests pass
✅ All structural invariant tests pass
✅ All known-good protocol tests pass
✅ All edge case tests pass
✅ Visual inspection confirms correctness
✅ 100% code coverage for CFG builder
✅ No TODO or FIXME comments in production code

## Notes

- The CFG is the **single source of truth** for protocol semantics
- If CFG is wrong, everything built on it is wrong
- Invest heavily in testing here - it pays off massively later
- Visual inspection is critical - graphs are easier to verify visually
- Keep test protocols simple - complexity comes from combinations
- Document expected CFG structure for each test
