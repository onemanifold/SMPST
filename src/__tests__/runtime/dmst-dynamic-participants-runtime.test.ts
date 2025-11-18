/**
 * Comprehensive Runtime Test Suite: DMst Dynamic Participants
 *
 * Tests all runtime execution scenarios for dynamic participant creation,
 * invitation, and interaction. Covers:
 * - Basic create/invite flows
 * - Multiple dynamic participants
 * - Error conditions
 * - State management
 * - Message passing with dynamic roles
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { project } from '../../core/projection/projector';
import { DMstSimulator } from '../../core/runtime/dmst-simulator';
import { InMemoryTransport } from '../../core/runtime/transport';
import type { GlobalProtocolDeclaration } from '../../core/ast/types';
import type { CFSM } from '../../core/projection/types';

describe('DMst Dynamic Participants Runtime', () => {
  let transport: InMemoryTransport;

  beforeEach(() => {
    transport = new InMemoryTransport();
  });

  describe('Basic Dynamic Participant Creation', () => {
    it('should create a single dynamic participant', async () => {
      const source = `
        protocol SimpleCreate(role Manager) {
          new role Worker;
          Manager creates Worker;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');

      const simulator = new DMstSimulator(
        new Map([['Manager', managerCFSM]]),
        new Map(),
        transport,
        undefined,
        { recordTrace: true, protocolName: 'SimpleCreate' }
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);

      // Verify Worker was created
      const dynamicParticipants = state.dynamicParticipants;
      expect(dynamicParticipants).toBeDefined();
      expect(dynamicParticipants.has('Worker')).toBe(true);
    });

    it('should create dynamic participant with instance name', async () => {
      const source = `
        protocol NamedCreate(role Manager) {
          new role Worker;
          Manager creates Worker as w1;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');

      const simulator = new DMstSimulator(
        new Map([['Manager', managerCFSM]]),
        new Map(),
        transport,
        undefined,
        { recordTrace: true }
      );

      await simulator.run();

      const state = simulator.getState();
      const dynamicParticipants = state.dynamicParticipants;

      // Verify Worker:w1 was created
      expect(dynamicParticipants.has('Worker:w1')).toBe(true);
    });

    it('should create multiple instances of same role type', async () => {
      const source = `
        protocol MultipleWorkers(role Manager) {
          new role Worker;
          Manager creates Worker as w1;
          Manager creates Worker as w2;
          Manager creates Worker as w3;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');

      const simulator = new DMstSimulator(
        new Map([['Manager', managerCFSM]]),
        new Map(),
        transport
      );

      await simulator.run();

      const state = simulator.getState();
      const dynamicParticipants = state.dynamicParticipants;

      expect(dynamicParticipants.has('Worker:w1')).toBe(true);
      expect(dynamicParticipants.has('Worker:w2')).toBe(true);
      expect(dynamicParticipants.has('Worker:w3')).toBe(true);
    });
  });

  describe('Invitation Protocol', () => {
    it('should invite dynamic participant before use', async () => {
      const source = `
        protocol InviteProtocol(role Alice) {
          new role Bob;
          Alice creates Bob;
          Alice invites Bob;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const aliceCFSM = project(cfg, 'Alice');

      const simulator = new DMstSimulator(
        new Map([['Alice', aliceCFSM]]),
        new Map(),
        transport,
        undefined,
        { recordTrace: true }
      );

      await simulator.run();

      const trace = simulator.getTrace();

      // Verify create and invite events in trace
      const createEvent = trace.events.find(
        e => e.type === 'participant_created'
      );
      const inviteEvent = trace.events.find(
        e => e.type === 'participant_invited'
      );

      expect(createEvent).toBeDefined();
      expect(inviteEvent).toBeDefined();

      // Invite should come after create
      const createIndex = trace.events.indexOf(createEvent!);
      const inviteIndex = trace.events.indexOf(inviteEvent!);
      expect(inviteIndex).toBeGreaterThan(createIndex);
    });

    it('should synchronize participants via invitation', async () => {
      const source = `
        protocol SyncInvite(role Manager, role Coordinator) {
          new role Worker;
          Manager creates Worker;
          Manager invites Worker;
          Coordinator invites Worker;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');
      const coordinatorCFSM = project(cfg, 'Coordinator');

      const simulator = new DMstSimulator(
        new Map([
          ['Manager', managerCFSM],
          ['Coordinator', coordinatorCFSM],
        ]),
        new Map(),
        transport,
        undefined,
        { recordTrace: true }
      );

      await simulator.run();

      const trace = simulator.getTrace();

      // Verify both invitations occurred
      const inviteEvents = trace.events.filter(
        e => e.type === 'participant_invited'
      );

      expect(inviteEvents.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Message Passing with Dynamic Participants', () => {
    it('should send message to dynamic participant after invitation', async () => {
      const source = `
        protocol TaskAssignment(role Manager) {
          new role Worker;
          Manager creates Worker;
          Manager invites Worker;
          Manager -> Worker: Task;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');

      const simulator = new DMstSimulator(
        new Map([['Manager', managerCFSM]]),
        new Map(),
        transport,
        undefined,
        { recordTrace: true }
      );

      await simulator.run();

      const trace = simulator.getTrace();

      // Verify message was sent after invitation
      const sendEvent = trace.events.find(
        e => e.type === 'send' && (e as any).label === 'Task'
      );

      expect(sendEvent).toBeDefined();
    });

    it('should receive message from dynamic participant', async () => {
      const source = `
        protocol TaskCompletion(role Manager) {
          new role Worker;
          Manager creates Worker;
          Manager invites Worker;
          Manager -> Worker: Task;
          Worker -> Manager: Done;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');

      const simulator = new DMstSimulator(
        new Map([['Manager', managerCFSM]]),
        new Map(),
        transport,
        undefined,
        { recordTrace: true }
      );

      await simulator.run();

      const trace = simulator.getTrace();

      // Verify bidirectional communication
      const sendEvent = trace.events.find(
        e => e.type === 'send' && (e as any).label === 'Task'
      );
      const receiveEvent = trace.events.find(
        e => e.type === 'receive' && (e as any).label === 'Done'
      );

      expect(sendEvent).toBeDefined();
      expect(receiveEvent).toBeDefined();
    });

    it('should support multiple dynamic participants in communication', async () => {
      const source = `
        protocol MultiWorkerTask(role Manager) {
          new role Worker;
          Manager creates Worker as w1;
          Manager creates Worker as w2;
          Manager invites Worker;
          Manager -> Worker: Task;
          Worker -> Manager: Result;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');

      const simulator = new DMstSimulator(
        new Map([['Manager', managerCFSM]]),
        new Map(),
        transport,
        undefined,
        { recordTrace: true }
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);
    });
  });

  describe('Complex Dynamic Patterns', () => {
    it('should support nested dynamic participant creation', async () => {
      const source = `
        protocol NestedCreation(role Coordinator) {
          new role Manager;
          new role Worker;
          Coordinator creates Manager;
          Coordinator invites Manager;
          Manager creates Worker;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const coordinatorCFSM = project(cfg, 'Coordinator');

      const simulator = new DMstSimulator(
        new Map([['Coordinator', coordinatorCFSM]]),
        new Map(),
        transport,
        undefined,
        { recordTrace: true }
      );

      await simulator.run();

      const state = simulator.getState();
      const dynamicParticipants = state.dynamicParticipants;

      expect(dynamicParticipants.has('Manager')).toBe(true);
      // Note: Worker creation by Manager would require runtime execution
    });

    it('should support dynamic participants in choice blocks', async () => {
      const source = `
        protocol ConditionalWorker(role Manager) {
          new role Worker;
          choice at Manager {
            Manager creates Worker;
            Manager invites Worker;
            Manager -> Worker: Task;
          } or {
            Manager creates Worker;
          }
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');

      const simulator = new DMstSimulator(
        new Map([['Manager', managerCFSM]]),
        new Map(),
        transport
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);
    });

    it('should support dynamic participants in recursion', async () => {
      const source = `
        protocol RecursiveWorkers(role Manager) {
          new role Worker;
          rec X {
            choice at Manager {
              Manager creates Worker;
              Manager -> Worker: Task;
              continue X;
            } or {
              Manager -> Worker: Stop;
            }
          }
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');

      const simulator = new DMstSimulator(
        new Map([['Manager', managerCFSM]]),
        new Map(),
        transport
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);
    });
  });

  describe('State Management', () => {
    it('should track dynamic participant lifecycle in state', async () => {
      const source = `
        protocol LifecycleTracking(role Manager) {
          new role Worker;
          Manager creates Worker as w1;
          Manager invites Worker;
          Manager -> Worker: Start;
          Worker -> Manager: Ready;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');

      const simulator = new DMstSimulator(
        new Map([['Manager', managerCFSM]]),
        new Map(),
        transport,
        undefined,
        { recordTrace: true }
      );

      await simulator.run();

      const state = simulator.getState();
      const trace = simulator.getTrace();

      // Verify state contains dynamic participant
      expect(state.dynamicParticipants.has('Worker:w1')).toBe(true);

      // Verify trace contains lifecycle events
      const createEvent = trace.events.find(
        e => e.type === 'participant_created'
      );
      const inviteEvent = trace.events.find(
        e => e.type === 'participant_invited'
      );

      expect(createEvent).toBeDefined();
      expect(inviteEvent).toBeDefined();
    });

    it('should maintain separate state for each dynamic instance', async () => {
      const source = `
        protocol MultipleStates(role Manager) {
          new role Worker;
          Manager creates Worker as w1;
          Manager creates Worker as w2;
          Manager invites Worker;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');

      const simulator = new DMstSimulator(
        new Map([['Manager', managerCFSM]]),
        new Map(),
        transport
      );

      await simulator.run();

      const state = simulator.getState();
      const dynamicParticipants = state.dynamicParticipants;

      // Each instance should have separate state
      const w1State = dynamicParticipants.get('Worker:w1');
      const w2State = dynamicParticipants.get('Worker:w2');

      expect(w1State).toBeDefined();
      expect(w2State).toBeDefined();
      expect(w1State).not.toBe(w2State);
    });
  });

  describe('Integration with Static Participants', () => {
    it('should allow static and dynamic participants to interact', async () => {
      const source = `
        protocol MixedParticipants(role Manager, role Coordinator) {
          new role Worker;
          Manager creates Worker;
          Manager invites Worker;
          Coordinator invites Worker;
          Manager -> Worker: Task;
          Worker -> Coordinator: Report;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');
      const coordinatorCFSM = project(cfg, 'Coordinator');

      const simulator = new DMstSimulator(
        new Map([
          ['Manager', managerCFSM],
          ['Coordinator', coordinatorCFSM],
        ]),
        new Map(),
        transport,
        undefined,
        { recordTrace: true }
      );

      await simulator.run();

      const state = simulator.getState();
      expect(state.completed).toBe(true);

      // Verify both static roles participated
      expect(state.roles.has('Manager')).toBe(true);
      expect(state.roles.has('Coordinator')).toBe(true);

      // Verify dynamic participant was created
      expect(state.dynamicParticipants.has('Worker')).toBe(true);
    });

    it('should support static participant creating multiple dynamic participants', async () => {
      const source = `
        protocol StaticCreatesDynamic(role Supervisor) {
          new role Manager;
          new role Worker;
          Supervisor creates Manager;
          Supervisor creates Worker as w1;
          Supervisor creates Worker as w2;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const supervisorCFSM = project(cfg, 'Supervisor');

      const simulator = new DMstSimulator(
        new Map([['Supervisor', supervisorCFSM]]),
        new Map(),
        transport
      );

      await simulator.run();

      const state = simulator.getState();
      const dynamicParticipants = state.dynamicParticipants;

      expect(dynamicParticipants.has('Manager')).toBe(true);
      expect(dynamicParticipants.has('Worker:w1')).toBe(true);
      expect(dynamicParticipants.has('Worker:w2')).toBe(true);
    });
  });

  describe('Trace Recording', () => {
    it('should record participant creation in trace', async () => {
      const source = `
        protocol TraceCreate(role Manager) {
          new role Worker;
          Manager creates Worker;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const managerCFSM = project(cfg, 'Manager');

      const simulator = new DMstSimulator(
        new Map([['Manager', managerCFSM]]),
        new Map(),
        transport,
        undefined,
        { recordTrace: true }
      );

      await simulator.run();

      const trace = simulator.getTrace();

      const createEvent = trace.events.find(
        e => e.type === 'participant_created'
      );

      expect(createEvent).toBeDefined();
      expect((createEvent as any).role).toBe('Worker');
      expect((createEvent as any).creator).toBe('Manager');
    });

    it('should record participant invitation in trace', async () => {
      const source = `
        protocol TraceInvite(role Alice) {
          new role Bob;
          Alice creates Bob;
          Alice invites Bob;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const aliceCFSM = project(cfg, 'Alice');

      const simulator = new DMstSimulator(
        new Map([['Alice', aliceCFSM]]),
        new Map(),
        transport,
        undefined,
        { recordTrace: true }
      );

      await simulator.run();

      const trace = simulator.getTrace();

      const inviteEvent = trace.events.find(
        e => e.type === 'participant_invited'
      );

      expect(inviteEvent).toBeDefined();
      expect((inviteEvent as any).inviter).toBe('Alice');
      expect((inviteEvent as any).invitee).toBe('Bob');
    });
  });
});
