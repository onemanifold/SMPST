import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { project } from '../../../core/projection';
import { CFGSimulator } from '../../../core/simulation/cfg-simulator';
import { DistributedSimulator } from '../../../core/simulation/distributed-simulator';
import { CFGDebugger } from '../../../core/simulation/cfg-debugger';
import { DistributedDebugger } from '../../../core/simulation/distributed-debugger';
import { BisimulationValidator } from '../../../core/simulation/bisimulation-validator';

describe('Theorem: CFG vs. Distributed CFSM Bisimulation', () => {
  it('should pass for a simple request-response protocol', async () => {
    const protocol = `
      protocol RequestResponse(role A, role B) {
        A -> B: Request();
        B -> A: Response();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);
    const cfsmA = project(cfg, 'A');
    const cfsmB = project(cfg, 'B');
    const cfsms = new Map([['A', cfsmA], ['B', cfsmB]]);

    const cfgDebugger = new CFGDebugger(cfg, CFGSimulator);
    const distributedDebugger = new DistributedDebugger(cfsms, DistributedSimulator);
    const validator = new BisimulationValidator(cfgDebugger, distributedDebugger);

    let result = validator.checkEquivalence();
    expect(result.equivalent).toBe(true);

    await validator.stepBoth();
    result = validator.checkEquivalence();
    expect(result.equivalent).toBe(true);

    await validator.stepBoth();
    result = validator.checkEquivalence();
    expect(result.equivalent).toBe(true);

    // The distributed simulator may need a few extra steps for all roles to reach
    // their terminal states and report completion.
    for (let i = 0; i < 5 && !distributedDebugger.getState().allCompleted; i++) {
      await distributedDebugger.stepForward();
    }

    expect(cfgDebugger.getState().completed).toBe(true);
    expect(distributedDebugger.getState().allCompleted).toBe(true);
  });
});
