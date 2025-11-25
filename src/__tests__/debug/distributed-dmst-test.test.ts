/**
 * Test DistributedSimulator compatibility with DMst protocols
 *
 * Status: DistributedSimulator has partial DMst support
 * ✅ Works: Basic messages, updatable recursion, FIFO delivery
 * ❌ Needs work: Protocol calls (registry required), dynamic participants (create/invite)
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import { GlobalProtocolDeclaration } from '../../core/ast/types';
import { DistributedSimulator } from '../../core/simulation/distributed-simulator';

describe('DistributedSimulator DMst Compatibility', () => {
  it.skip('should handle DMst protocol with dynamic participants', async () => {
    // KNOWN LIMITATION: DistributedSimulator doesn't handle create/invite actions
    // Error: "Distributed deadlock - no role can progress"
    // Reason: create and invite actions aren't executable by the simulator
    //
    // To fix: Add execution handlers for:
    // - projectParticipantCreation (create action)
    // - projectInvitation (invite action)
    //
    // DMst protocol with dynamic participant (projected to static CFSMs)
    const protocol = `
      protocol DynamicTest(role Manager) {
        new role Worker;
        Manager creates Worker as w;
        Manager invites w;
        Manager -> w: Task();
        w -> Manager: Result();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const projections = projectAll(cfg);

    // Projection creates static CFSMs for role types (Manager, Worker)
    expect(projections.cfsms.has('Manager')).toBe(true);
    expect(projections.cfsms.has('Worker')).toBe(true);

    // Run distributed simulation
    const sim = new DistributedSimulator(projections.cfsms, { maxSteps: 100 });
    const result = await sim.run();

    // Should complete successfully once create/invite handlers are added
    expect(result.success).toBe(true);
    expect(result.state.deadlocked).toBe(false);
  });

  it.skip('should handle DMst protocol with protocol calls', async () => {
    // KNOWN LIMITATION: DistributedSimulator needs protocol registry
    // Error: "Sub-protocol 'Sub' not found in registry"
    // Reason: Simulator needs access to all protocols, not just Main
    //
    // To fix: Add protocol registry to DistributedSimulator:
    // - Pass all protocols to simulator
    // - executeSubProtocol should look up protocol CFSMs
    // - Instantiate sub-protocol with roleMapping
    //
    const protocol = `
      protocol Sub(role W) {
        W -> W: SubWork();
      }

      protocol Main(role Manager, role Worker) {
        Manager calls Sub(Worker);
        Manager -> Worker: Done();
      }
    `;

    const ast = parse(protocol);
    const main = ast.declarations[1] as GlobalProtocolDeclaration;
    const cfg = buildCFG(main);
    const projections = projectAll(cfg);

    // Run distributed simulation
    const sim = new DistributedSimulator(projections.cfsms, { maxSteps: 100 });
    const result = await sim.run();

    // Should complete successfully once protocol registry is added
    expect(result.success).toBe(true);
    expect(result.state.deadlocked).toBe(false);
  });

  it('should handle DMst updatable recursion', async () => {
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

    // Run distributed simulation
    const sim = new DistributedSimulator(projections.cfsms, { maxSteps: 100 });
    const result = await sim.run();

    // Should complete (takes one of the choice branches)
    expect(result.success).toBe(true);
  });
});
