/**
 * End-to-End Test: Updatable Recursion
 *
 * Tests complete pipeline from syntax to execution:
 * 1. Parse protocol with `continue X with { G }` syntax
 * 2. Project to CFSMs for each role
 * 3. (Future) Execute with DMst simulator
 *
 * Sprint 3 completion test.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import type {
  GlobalProtocolDeclaration,
  Continue,
} from '../../core/ast/types';

describe('End-to-End: Updatable Recursion Protocol', () => {
  it('should parse, build CFG, and project updatable protocol', () => {
    const source = `
      protocol UpdatableTaskDistribution(role Coordinator, role Worker) {
        rec X {
          Coordinator -> Worker: Task(string);
          Worker -> Coordinator: Result(int);
          choice at Coordinator {
            continue X;
          } or {
            continue X with {
              Worker -> Coordinator: Log(string);
              Coordinator -> Worker: Ack();
            };
          }
        }
      }
    `;

    // Step 1: Parse
    const ast = parse(source);
    expect(ast.declarations).toHaveLength(1);

    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.type).toBe('GlobalProtocolDeclaration');
    expect(protocol.name).toBe('UpdatableTaskDistribution');

    // Step 2: Verify AST structure
    const recursion = protocol.body[0];
    expect(recursion.type).toBe('Recursion');
    expect((recursion as any).label).toBe('X');

    // Should have: Task message, Result message, Choice
    expect((recursion as any).body).toHaveLength(3);

    const choice = (recursion as any).body[2];
    expect(choice.type).toBe('Choice');

    // First branch: simple continue
    const branch1 = choice.branches[0];
    expect(branch1).toHaveLength(1);
    const continueSimple = branch1[0] as Continue;
    expect(continueSimple.type).toBe('Continue');
    expect(continueSimple.label).toBe('X');
    expect(continueSimple.extension).toBeUndefined();

    // Second branch: continue with extension
    const branch2 = choice.branches[1];
    expect(branch2).toHaveLength(1);
    const continueWithExt = branch2[0] as Continue;
    expect(continueWithExt.type).toBe('Continue');
    expect(continueWithExt.label).toBe('X');
    expect(continueWithExt.extension).toBeDefined();
    expect(continueWithExt.extension).toHaveLength(2);  // Log + Ack

    // Step 3: Build CFG
    const cfg = buildCFG(protocol);
    expect(cfg.entry).toBeDefined();
    expect(cfg.terminal).toBeDefined();
    expect(cfg.nodes.length).toBeGreaterThan(0);

    // Step 4: Project to CFSMs
    const projection = projectAll(cfg);
    expect(projection.cfsms.size).toBe(2);  // Coordinator + Worker

    const coordinatorCFSM = projection.cfsms.get('Coordinator');
    const workerCFSM = projection.cfsms.get('Worker');

    expect(coordinatorCFSM).toBeDefined();
    expect(workerCFSM).toBeDefined();

    // Verify CFSMs have states and transitions
    expect(coordinatorCFSM!.states.length).toBeGreaterThan(0);
    expect(coordinatorCFSM!.transitions.length).toBeGreaterThan(0);
    expect(workerCFSM!.states.length).toBeGreaterThan(0);
    expect(workerCFSM!.transitions.length).toBeGreaterThan(0);
  });

  it('should parse simple updatable protocol', () => {
    const source = `
      protocol SimpleUpdate(role A, role B) {
        rec Loop {
          A -> B: Data();
          continue Loop with {
            A -> B: Extra();
          };
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;

    const recursion = protocol.body[0];
    const body = (recursion as any).body;

    // Should have: Data message, continue-with
    expect(body).toHaveLength(2);

    const continueStmt = body[1] as Continue;
    expect(continueStmt.type).toBe('Continue');
    expect(continueStmt.extension).toBeDefined();
    expect(continueStmt.extension).toHaveLength(1);  // Extra message
  });

  it('should handle nested recursion with updatable continue', () => {
    const source = `
      protocol NestedUpdate(role A, role B) {
        rec Outer {
          A -> B: Start();
          rec Inner {
            A -> B: Data();
            choice at A {
              continue Inner;
            } or {
              continue Inner with {
                B -> A: Response();
              };
            }
          }
          continue Outer;
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;

    // Build CFG
    const cfg = buildCFG(protocol);
    expect(cfg.entry).toBeDefined();

    // Project
    const projection = projectAll(cfg);
    expect(projection.cfsms.size).toBe(2);
  });

  it('should project extension correctly for each role', () => {
    const source = `
      protocol RoleSpecificUpdate(role A, role B, role C) {
        rec X {
          A -> B: Msg1();
          choice at A {
            continue X;
          } or {
            continue X with {
              A -> C: Msg2();
              C -> A: Msg3();
            };
          }
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;

    const cfg = buildCFG(protocol);
    const projection = projectAll(cfg);

    // All three roles should have CFSMs
    expect(projection.cfsms.size).toBe(3);
    expect(projection.cfsms.has('A')).toBe(true);
    expect(projection.cfsms.has('B')).toBe(true);
    expect(projection.cfsms.has('C')).toBe(true);

    // Role B's CFSM should be simpler (not involved in extension)
    const cfsmA = projection.cfsms.get('A')!;
    const cfsmB = projection.cfsms.get('B')!;
    const cfsmC = projection.cfsms.get('C')!;

    // All should have states
    expect(cfsmA.states.length).toBeGreaterThan(0);
    expect(cfsmB.states.length).toBeGreaterThan(0);
    expect(cfsmC.states.length).toBeGreaterThan(0);
  });
});
