/**
 * Comprehensive Runtime Test Suite: DMst Protocol Calls
 *
 * Tests all runtime execution scenarios for dynamic protocol instantiation.
 * Covers:
 * - Basic protocol calls
 * - Role mapping and parameter binding
 * - Nested protocol calls
 * - Protocol calls with dynamic participants
 * - Error conditions
 * - State and trace management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { project } from '../../core/projection/projector';
import { DMstSimulator } from '../../core/runtime/dmst-simulator';
import { InMemoryTransport } from '../../core/runtime/transport';
import type { GlobalProtocolDeclaration, Program } from '../../core/ast/types';
import type { CFSM } from '../../core/projection/types';

describe('DMst Protocol Calls Runtime', () => {
  let transport: InMemoryTransport;

  beforeEach(() => {
    transport = new InMemoryTransport();
  });

  describe('Basic Protocol Calls', () => {
    it('should call a sub-protocol with role mapping', async () => {
      const source = `
        protocol Main(role Alice, role Bob) {
          Alice calls SubProtocol(Bob);
          Alice -> Bob: Continue;
        }

        protocol SubProtocol(role A, role B) {
          A -> B: Work;
          B -> A: Result;
        }
      `;

      const ast = parse(source);
      const protocols = ast.declarations as GlobalProtocolDeclaration[];

      // Build CFG for Main
      const mainProtocol = protocols.find(p => p.name === 'Main')!;
      const mainCFG = buildCFG(mainProtocol);

      // Build CFG for SubProtocol
      const subProtocol = protocols.find(p => p.name === 'SubProtocol')!;
      const subCFG = buildCFG(subProtocol);

      // Project CFSMs
      const aliceCFSM = project(mainCFG, 'Alice');
      const bobCFSM = project(mainCFG, 'Bob');

      // Create CFSM registry for sub-protocols
      const subAliceCFSM = project(subCFG, 'A');
      const subBobCFSM = project(subCFG, 'B');

      const cfsmRegistry = new Map([
        [
          'SubProtocol',
          new Map([
            ['A', subAliceCFSM],
            ['B', subBobCFSM],
          ]),
        ],
      ]);

      const simulator = new DMstSimulator(
        new Map([
          ['Alice', aliceCFSM],
          ['Bob', bobCFSM],
        ]),
        new Map(),
        transport,
        cfsmRegistry,
        { recordTrace: true, protocolName: 'Main' }
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);
    });

    it('should handle protocol call with single caller', async () => {
      const source = `
        protocol Main(role Coordinator, role Worker) {
          Coordinator calls Task(Worker);
        }

        protocol Task(role Leader, role Follower) {
          Leader -> Follower: Instruction;
        }
      `;

      const ast = parse(source);
      const protocols = ast.declarations as GlobalProtocolDeclaration[];

      const mainProtocol = protocols.find(p => p.name === 'Main')!;
      const mainCFG = buildCFG(mainProtocol);

      const taskProtocol = protocols.find(p => p.name === 'Task')!;
      const taskCFG = buildCFG(taskProtocol);

      const coordinatorCFSM = project(mainCFG, 'Coordinator');
      const workerCFSM = project(mainCFG, 'Worker');

      const taskLeaderCFSM = project(taskCFG, 'Leader');
      const taskFollowerCFSM = project(taskCFG, 'Follower');

      const cfsmRegistry = new Map([
        [
          'Task',
          new Map([
            ['Leader', taskLeaderCFSM],
            ['Follower', taskFollowerCFSM],
          ]),
        ],
      ]);

      const simulator = new DMstSimulator(
        new Map([
          ['Coordinator', coordinatorCFSM],
          ['Worker', workerCFSM],
        ]),
        new Map(),
        transport,
        cfsmRegistry,
        { recordTrace: true }
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);
    });

    it('should map multiple role arguments correctly', async () => {
      const source = `
        protocol Main(role A, role B, role C) {
          A calls ThreeWay(B, C);
        }

        protocol ThreeWay(role X, role Y, role Z) {
          X -> Y: Msg1;
          Y -> Z: Msg2;
        }
      `;

      const ast = parse(source);
      const protocols = ast.declarations as GlobalProtocolDeclaration[];

      const mainProtocol = protocols.find(p => p.name === 'Main')!;
      const mainCFG = buildCFG(mainProtocol);

      const threeWayProtocol = protocols.find(p => p.name === 'ThreeWay')!;
      const threeWayCFG = buildCFG(threeWayProtocol);

      const aCFSM = project(mainCFG, 'A');
      const bCFSM = project(mainCFG, 'B');
      const cCFSM = project(mainCFG, 'C');

      const xCFSM = project(threeWayCFG, 'X');
      const yCFSM = project(threeWayCFG, 'Y');
      const zCFSM = project(threeWayCFG, 'Z');

      const cfsmRegistry = new Map([
        [
          'ThreeWay',
          new Map([
            ['X', xCFSM],
            ['Y', yCFSM],
            ['Z', zCFSM],
          ]),
        ],
      ]);

      const simulator = new DMstSimulator(
        new Map([
          ['A', aCFSM],
          ['B', bCFSM],
          ['C', cCFSM],
        ]),
        new Map(),
        transport,
        cfsmRegistry
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);
    });
  });

  describe('Nested Protocol Calls', () => {
    it('should handle nested protocol calls (call stack depth 2)', async () => {
      const source = `
        protocol Main(role A, role B) {
          A calls Level1(B);
        }

        protocol Level1(role X, role Y) {
          X calls Level2(Y);
        }

        protocol Level2(role P, role Q) {
          P -> Q: DeepMsg;
        }
      `;

      const ast = parse(source);
      const protocols = ast.declarations as GlobalProtocolDeclaration[];

      const mainProtocol = protocols.find(p => p.name === 'Main')!;
      const mainCFG = buildCFG(mainProtocol);

      const level1Protocol = protocols.find(p => p.name === 'Level1')!;
      const level1CFG = buildCFG(level1Protocol);

      const level2Protocol = protocols.find(p => p.name === 'Level2')!;
      const level2CFG = buildCFG(level2Protocol);

      const aCFSM = project(mainCFG, 'A');
      const bCFSM = project(mainCFG, 'B');

      const xCFSM = project(level1CFG, 'X');
      const yCFSM = project(level1CFG, 'Y');

      const pCFSM = project(level2CFG, 'P');
      const qCFSM = project(level2CFG, 'Q');

      const cfsmRegistry = new Map([
        [
          'Level1',
          new Map([
            ['X', xCFSM],
            ['Y', yCFSM],
          ]),
        ],
        [
          'Level2',
          new Map([
            ['P', pCFSM],
            ['Q', qCFSM],
          ]),
        ],
      ]);

      const simulator = new DMstSimulator(
        new Map([
          ['A', aCFSM],
          ['B', bCFSM],
        ]),
        new Map(),
        transport,
        cfsmRegistry,
        { recordTrace: true }
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);
    });

    it('should maintain correct call stack state', async () => {
      const source = `
        protocol Main(role Alice, role Bob) {
          Alice -> Bob: Before;
          Alice calls Sub(Bob);
          Alice -> Bob: After;
        }

        protocol Sub(role X, role Y) {
          X -> Y: Inside;
        }
      `;

      const ast = parse(source);
      const protocols = ast.declarations as GlobalProtocolDeclaration[];

      const mainProtocol = protocols.find(p => p.name === 'Main')!;
      const mainCFG = buildCFG(mainProtocol);

      const subProtocol = protocols.find(p => p.name === 'Sub')!;
      const subCFG = buildCFG(subProtocol);

      const aliceCFSM = project(mainCFG, 'Alice');
      const bobCFSM = project(mainCFG, 'Bob');

      const xCFSM = project(subCFG, 'X');
      const yCFSM = project(subCFG, 'Y');

      const cfsmRegistry = new Map([
        [
          'Sub',
          new Map([
            ['X', xCFSM],
            ['Y', yCFSM],
          ]),
        ],
      ]);

      const simulator = new DMstSimulator(
        new Map([
          ['Alice', aliceCFSM],
          ['Bob', bobCFSM],
        ]),
        new Map(),
        transport,
        cfsmRegistry,
        { recordTrace: true }
      );

      await simulator.run();

      const trace = simulator.getTrace();

      // Verify message ordering: Before -> Inside -> After
      const messages = trace.events
        .filter(e => e.type === 'send')
        .map(e => (e as any).label);

      expect(messages).toContain('Before');
      expect(messages).toContain('Inside');
      expect(messages).toContain('After');

      const beforeIdx = messages.indexOf('Before');
      const insideIdx = messages.indexOf('Inside');
      const afterIdx = messages.indexOf('After');

      expect(insideIdx).toBeGreaterThan(beforeIdx);
      expect(afterIdx).toBeGreaterThan(insideIdx);
    });
  });

  describe('Protocol Calls with Choices', () => {
    it('should handle protocol call in choice branch', async () => {
      const source = `
        protocol Main(role Alice, role Bob) {
          choice at Alice {
            Alice calls SubA(Bob);
          } or {
            Alice calls SubB(Bob);
          }
        }

        protocol SubA(role X, role Y) {
          X -> Y: OptionA;
        }

        protocol SubB(role X, role Y) {
          X -> Y: OptionB;
        }
      `;

      const ast = parse(source);
      const protocols = ast.declarations as GlobalProtocolDeclaration[];

      const mainProtocol = protocols.find(p => p.name === 'Main')!;
      const mainCFG = buildCFG(mainProtocol);

      const subAProtocol = protocols.find(p => p.name === 'SubA')!;
      const subACFG = buildCFG(subAProtocol);

      const subBProtocol = protocols.find(p => p.name === 'SubB')!;
      const subBCFG = buildCFG(subBProtocol);

      const aliceCFSM = project(mainCFG, 'Alice');
      const bobCFSM = project(mainCFG, 'Bob');

      const subAXCFSM = project(subACFG, 'X');
      const subAYCFSM = project(subACFG, 'Y');

      const subBXCFSM = project(subBCFG, 'X');
      const subBYCFSM = project(subBCFG, 'Y');

      const cfsmRegistry = new Map([
        [
          'SubA',
          new Map([
            ['X', subAXCFSM],
            ['Y', subAYCFSM],
          ]),
        ],
        [
          'SubB',
          new Map([
            ['X', subBXCFSM],
            ['Y', subBYCFSM],
          ]),
        ],
      ]);

      const simulator = new DMstSimulator(
        new Map([
          ['Alice', aliceCFSM],
          ['Bob', bobCFSM],
        ]),
        new Map(),
        transport,
        cfsmRegistry
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);
    });
  });

  describe('Protocol Calls with Recursion', () => {
    it('should handle protocol call inside recursion', async () => {
      const source = `
        protocol Main(role Manager, role Worker) {
          rec X {
            choice at Manager {
              Manager calls Task(Worker);
              continue X;
            } or {
              Manager -> Worker: Stop;
            }
          }
        }

        protocol Task(role A, role B) {
          A -> B: Work;
          B -> A: Done;
        }
      `;

      const ast = parse(source);
      const protocols = ast.declarations as GlobalProtocolDeclaration[];

      const mainProtocol = protocols.find(p => p.name === 'Main')!;
      const mainCFG = buildCFG(mainProtocol);

      const taskProtocol = protocols.find(p => p.name === 'Task')!;
      const taskCFG = buildCFG(taskProtocol);

      const managerCFSM = project(mainCFG, 'Manager');
      const workerCFSM = project(mainCFG, 'Worker');

      const taskACFSM = project(taskCFG, 'A');
      const taskBCFSM = project(taskCFG, 'B');

      const cfsmRegistry = new Map([
        [
          'Task',
          new Map([
            ['A', taskACFSM],
            ['B', taskBCFSM],
          ]),
        ],
      ]);

      const simulator = new DMstSimulator(
        new Map([
          ['Manager', managerCFSM],
          ['Worker', workerCFSM],
        ]),
        new Map(),
        transport,
        cfsmRegistry,
        { recordTrace: true }
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);
    });
  });

  describe('Protocol Calls with Dynamic Participants', () => {
    it('should call protocol with dynamically created participant', async () => {
      const source = `
        protocol Main(role Manager) {
          new role Worker;
          Manager creates Worker;
          Manager invites Worker;
          Manager calls Task(Worker);
        }

        protocol Task(role A, role B) {
          A -> B: Execute;
        }
      `;

      const ast = parse(source);
      const protocols = ast.declarations as GlobalProtocolDeclaration[];

      const mainProtocol = protocols.find(p => p.name === 'Main')!;
      const mainCFG = buildCFG(mainProtocol);

      const taskProtocol = protocols.find(p => p.name === 'Task')!;
      const taskCFG = buildCFG(taskProtocol);

      const managerCFSM = project(mainCFG, 'Manager');

      const taskACFSM = project(taskCFG, 'A');
      const taskBCFSM = project(taskCFG, 'B');

      const cfsmRegistry = new Map([
        [
          'Task',
          new Map([
            ['A', taskACFSM],
            ['B', taskBCFSM],
          ]),
        ],
      ]);

      const simulator = new DMstSimulator(
        new Map([['Manager', managerCFSM]]),
        new Map(),
        transport,
        cfsmRegistry,
        { recordTrace: true }
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);

      // Verify dynamic participant was created
      expect(state.dynamicParticipants.has('Worker')).toBe(true);
    });

    it('should handle multiple protocol calls with dynamic participants', async () => {
      const source = `
        protocol Main(role Coordinator) {
          new role Worker;
          Coordinator creates Worker as w1;
          Coordinator creates Worker as w2;
          Coordinator invites Worker;
          Coordinator calls TaskA(Worker);
          Coordinator calls TaskB(Worker);
        }

        protocol TaskA(role X, role Y) {
          X -> Y: TaskA;
        }

        protocol TaskB(role X, role Y) {
          X -> Y: TaskB;
        }
      `;

      const ast = parse(source);
      const protocols = ast.declarations as GlobalProtocolDeclaration[];

      const mainProtocol = protocols.find(p => p.name === 'Main')!;
      const mainCFG = buildCFG(mainProtocol);

      const taskAProtocol = protocols.find(p => p.name === 'TaskA')!;
      const taskACFG = buildCFG(taskAProtocol);

      const taskBProtocol = protocols.find(p => p.name === 'TaskB')!;
      const taskBCFG = buildCFG(taskBProtocol);

      const coordinatorCFSM = project(mainCFG, 'Coordinator');

      const taskAXCFSM = project(taskACFG, 'X');
      const taskAYCFSM = project(taskACFG, 'Y');

      const taskBXCFSM = project(taskBCFG, 'X');
      const taskBYCFSM = project(taskBCFG, 'Y');

      const cfsmRegistry = new Map([
        [
          'TaskA',
          new Map([
            ['X', taskAXCFSM],
            ['Y', taskAYCFSM],
          ]),
        ],
        [
          'TaskB',
          new Map([
            ['X', taskBXCFSM],
            ['Y', taskBYCFSM],
          ]),
        ],
      ]);

      const simulator = new DMstSimulator(
        new Map([['Coordinator', coordinatorCFSM]]),
        new Map(),
        transport,
        cfsmRegistry
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);

      // Verify both dynamic participants were created
      expect(state.dynamicParticipants.has('Worker:w1')).toBe(true);
      expect(state.dynamicParticipants.has('Worker:w2')).toBe(true);
    });
  });

  describe('Trace Recording', () => {
    it('should record protocol call events in trace', async () => {
      const source = `
        protocol Main(role Alice, role Bob) {
          Alice calls Sub(Bob);
        }

        protocol Sub(role X, role Y) {
          X -> Y: Msg;
        }
      `;

      const ast = parse(source);
      const protocols = ast.declarations as GlobalProtocolDeclaration[];

      const mainProtocol = protocols.find(p => p.name === 'Main')!;
      const mainCFG = buildCFG(mainProtocol);

      const subProtocol = protocols.find(p => p.name === 'Sub')!;
      const subCFG = buildCFG(subProtocol);

      const aliceCFSM = project(mainCFG, 'Alice');
      const bobCFSM = project(mainCFG, 'Bob');

      const xCFSM = project(subCFG, 'X');
      const yCFSM = project(subCFG, 'Y');

      const cfsmRegistry = new Map([
        [
          'Sub',
          new Map([
            ['X', xCFSM],
            ['Y', yCFSM],
          ]),
        ],
      ]);

      const simulator = new DMstSimulator(
        new Map([
          ['Alice', aliceCFSM],
          ['Bob', bobCFSM],
        ]),
        new Map(),
        transport,
        cfsmRegistry,
        { recordTrace: true }
      );

      await simulator.run();

      const trace = simulator.getTrace();

      // Verify protocol call is recorded
      const callEvent = trace.events.find(
        e => e.type === 'sub_protocol_call' || e.type === 'send'
      );

      expect(callEvent).toBeDefined();
      expect(trace.events.length).toBeGreaterThan(0);
    });

    it('should maintain trace context across protocol boundaries', async () => {
      const source = `
        protocol Main(role Alice, role Bob) {
          Alice -> Bob: Before;
          Alice calls Sub(Bob);
          Alice -> Bob: After;
        }

        protocol Sub(role X, role Y) {
          X -> Y: Inside;
        }
      `;

      const ast = parse(source);
      const protocols = ast.declarations as GlobalProtocolDeclaration[];

      const mainProtocol = protocols.find(p => p.name === 'Main')!;
      const mainCFG = buildCFG(mainProtocol);

      const subProtocol = protocols.find(p => p.name === 'Sub')!;
      const subCFG = buildCFG(subProtocol);

      const aliceCFSM = project(mainCFG, 'Alice');
      const bobCFSM = project(mainCFG, 'Bob');

      const xCFSM = project(subCFG, 'X');
      const yCFSM = project(subCFG, 'Y');

      const cfsmRegistry = new Map([
        [
          'Sub',
          new Map([
            ['X', xCFSM],
            ['Y', yCFSM],
          ]),
        ],
      ]);

      const simulator = new DMstSimulator(
        new Map([
          ['Alice', aliceCFSM],
          ['Bob', bobCFSM],
        ]),
        new Map(),
        transport,
        cfsmRegistry,
        { recordTrace: true }
      );

      await simulator.run();

      const trace = simulator.getTrace();

      // Verify all events are present
      expect(trace.events.length).toBeGreaterThan(3);
      expect(trace.completed).toBe(true);
    });
  });

  describe('Combining Operator Semantics', () => {
    it('should interleave caller and callee protocols correctly', async () => {
      const source = `
        protocol Main(role Alice, role Bob) {
          Alice calls Sub(Bob);
          Alice -> Bob: MainMsg;
        }

        protocol Sub(role X, role Y) {
          X -> Y: SubMsg;
        }
      `;

      const ast = parse(source);
      const protocols = ast.declarations as GlobalProtocolDeclaration[];

      const mainProtocol = protocols.find(p => p.name === 'Main')!;
      const mainCFG = buildCFG(mainProtocol);

      const subProtocol = protocols.find(p => p.name === 'Sub')!;
      const subCFG = buildCFG(subProtocol);

      const aliceCFSM = project(mainCFG, 'Alice');
      const bobCFSM = project(mainCFG, 'Bob');

      const xCFSM = project(subCFG, 'X');
      const yCFSM = project(subCFG, 'Y');

      const cfsmRegistry = new Map([
        [
          'Sub',
          new Map([
            ['X', xCFSM],
            ['Y', yCFSM],
          ]),
        ],
      ]);

      const simulator = new DMstSimulator(
        new Map([
          ['Alice', aliceCFSM],
          ['Bob', bobCFSM],
        ]),
        new Map(),
        transport,
        cfsmRegistry,
        { recordTrace: true }
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);

      // Both protocols should complete successfully
      const trace = simulator.getTrace();
      expect(trace.completed).toBe(true);
    });
  });
});
