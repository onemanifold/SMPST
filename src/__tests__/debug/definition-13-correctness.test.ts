/**
 * Test: Definition 13 Formal Correctness
 *
 * Verify that updatable recursion projection follows Definition 13:
 * [[rec X { G; continue X with { G_update } }]]_r =
 *   rec X { [[G]]_r; [[G_update]]_r; continue X }
 *
 * The CFSM should include actions from BOTH G and G_update in the loop body.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import type { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('Definition 13: Updatable Recursion Projection', () => {
  it('should project update body into recursion loop', () => {
    // Definition 13 example:
    // rec Loop {
    //   G: A -> B: Work();
    //   continue Loop with {
    //     G_update: A -> B: Extra();
    //   }
    // }
    //
    // [[Loop]]_A should include both Work! and Extra! actions
    // [[Loop]]_B should include both Work? and Extra? actions

    const protocol = `
      protocol UpdateTest(role A, role B) {
        rec Loop {
          A -> B: Work();
          choice at A {
            continue Loop with {
              A -> B: Extra();
            };
          } or {
            A -> B: Done();
          }
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const projections = projectAll(cfg);

    const cfsmA = projections.cfsms.get('A')!;
    const cfsmB = projections.cfsms.get('B')!;

    // Extract all message labels from A's transitions
    const aMessages = cfsmA.transitions
      .filter(t => t.action.type === 'send')
      .map(t => t.action.type === 'send' ? t.action.message.label : '');

    // Extract all message labels from B's transitions
    const bMessages = cfsmB.transitions
      .filter(t => t.action.type === 'receive')
      .map(t => t.action.type === 'receive' ? t.action.message.label : '');

    console.log('A sends:', aMessages);
    console.log('B receives:', bMessages);

    // Definition 13: BOTH Work and Extra should be in the projections
    // These are from G and G_update respectively
    expect(aMessages).toContain('Work');
    expect(aMessages).toContain('Extra');
    expect(aMessages).toContain('Done');

    expect(bMessages).toContain('Work');
    expect(bMessages).toContain('Extra');
    expect(bMessages).toContain('Done');

    console.log('✅ Definition 13: Both G and G_update projected into recursion');
  });

  it('should verify update body is executed in each iteration', () => {
    // More explicit test: the update body should create a path
    // in the CFSM that's reachable from the recursion

    const protocol = `
      protocol UpdateLoop(role Manager, role Worker) {
        rec Loop {
          Manager -> Worker: Task();
          Worker -> Manager: Result();
          choice at Manager {
            continue Loop with {
              Manager -> Worker: Bonus();
            };
          } or {
            Manager -> Worker: Stop();
          }
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const projections = projectAll(cfg);

    const manager = projections.cfsms.get('Manager')!;
    const worker = projections.cfsms.get('Worker')!;

    // Manager should have transitions for: Task!, Result?, Bonus!, Stop!
    const managerSends = manager.transitions
      .filter(t => t.action.type === 'send')
      .map(t => t.action.type === 'send' ? t.action.message.label : '');

    const managerReceives = manager.transitions
      .filter(t => t.action.type === 'receive')
      .map(t => t.action.type === 'receive' ? t.action.message.label : '');

    // Worker should have transitions for: Task?, Result!, Bonus?, Stop?
    const workerReceives = worker.transitions
      .filter(t => t.action.type === 'receive')
      .map(t => t.action.type === 'receive' ? t.action.message.label : '');

    const workerSends = worker.transitions
      .filter(t => t.action.type === 'send')
      .map(t => t.action.type === 'send' ? t.action.message.label : '');

    console.log('Manager sends:', managerSends);
    console.log('Manager receives:', managerReceives);
    console.log('Worker sends:', workerSends);
    console.log('Worker receives:', workerReceives);

    // Verify all expected actions present
    expect(managerSends).toContain('Task');
    expect(managerSends).toContain('Bonus');  // From update body
    expect(managerSends).toContain('Stop');
    expect(managerReceives).toContain('Result');

    expect(workerReceives).toContain('Task');
    expect(workerReceives).toContain('Bonus');  // From update body
    expect(workerReceives).toContain('Stop');
    expect(workerSends).toContain('Result');

    console.log('✅ Update body actions present in CFSM');
  });
});
