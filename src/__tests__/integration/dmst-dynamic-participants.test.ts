/**
 * Integration Test: DMst Dynamic Participants
 *
 * Tests the complete pipeline for dynamic participant creation:
 * Source → Parser → AST → CFG → Projection → CFSM → Runtime
 *
 * This verifies that the newly implemented projection layer correctly
 * integrates with the existing infrastructure.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { project } from '../../core/projection/projector';
import type { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('DMst Dynamic Participants Integration', () => {
  describe('Parser → AST Integration', () => {
    it('should parse dynamic role declaration syntax', () => {
      const source = `
        protocol DynamicRoles(role Manager) {
          new role Worker;
          Manager creates Worker;
        }
      `;

      const ast = parse(source);
      expect(ast.declarations).toHaveLength(1);

      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      expect(protocol.type).toBe('GlobalProtocolDeclaration');
      expect(protocol.body).toHaveLength(2);

      // Check dynamic role declaration
      const dynamicRole = protocol.body[0];
      expect(dynamicRole.type).toBe('DynamicRoleDeclaration');
      expect((dynamicRole as any).roleName).toBe('Worker');

      // Check creates statement
      const creates = protocol.body[1];
      expect(creates.type).toBe('CreateParticipants');
      expect((creates as any).creator).toBe('Manager');
      expect((creates as any).roleName).toBe('Worker');
    });

    it('should parse invitation syntax', () => {
      const source = `
        protocol Invitation(role Alice) {
          new role Bob;
          Alice creates Bob;
          Alice invites Bob;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;

      const invitation = protocol.body[2];
      expect(invitation.type).toBe('Invitation');
      expect((invitation as any).inviter).toBe('Alice');
      expect((invitation as any).invitee).toBe('Bob');
    });

    it('should parse protocol call syntax', () => {
      const source = `
        protocol Main(role Alice, role Bob) {
          Alice calls SubProtocol(Bob);
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;

      const call = protocol.body[0];
      expect(call.type).toBe('ProtocolCall');
      expect((call as any).caller).toBe('Alice');
      expect((call as any).protocol).toBe('SubProtocol');
      expect((call as any).roleArguments).toEqual(['Bob']);
    });
  });

  describe('AST → CFG Integration', () => {
    it('should build CFG with CreateParticipantsAction', () => {
      const source = `
        protocol DynamicWorker(role Manager) {
          new role Worker;
          Manager creates Worker;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      // Find create action node
      const createNode = cfg.nodes.find(
        n => n.type === 'action' && (n as any).action.kind === 'create-participants'
      );

      expect(createNode).toBeDefined();
      expect((createNode as any).action.creator).toBe('Manager');
      expect((createNode as any).action.roleName).toBe('Worker');
    });

    it('should build CFG with InvitationAction', () => {
      const source = `
        protocol DynamicSetup(role Alice) {
          new role Bob;
          Alice creates Bob;
          Alice invites Bob;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const inviteNode = cfg.nodes.find(
        n => n.type === 'action' && (n as any).action.kind === 'invitation'
      );

      expect(inviteNode).toBeDefined();
      expect((inviteNode as any).action.inviter).toBe('Alice');
      expect((inviteNode as any).action.invitee).toBe('Bob');
    });
  });

  describe('CFG → CFSM Projection Integration', () => {
    it('should project CreateParticipants to CreateAction for creator', () => {
      const source = `
        protocol SimpleCreate(role Manager) {
          new role Worker;
          Manager creates Worker;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      // Project for Manager (creator)
      const cfsm = project(cfg, 'Manager');

      // Manager should have CreateAction in transitions
      const createTransition = cfsm.transitions.find(
        t => t.action.type === 'create'
      );

      expect(createTransition).toBeDefined();
      expect((createTransition?.action as any).role).toBe('Worker');
    });

    it('should project Invitation to InviteAction for inviter', () => {
      const source = `
        protocol SimpleInvite(role Alice) {
          new role Bob;
          Alice creates Bob;
          Alice invites Bob;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      const cfsm = project(cfg, 'Alice');

      const inviteTransition = cfsm.transitions.find(
        t => t.action.type === 'invite'
      );

      expect(inviteTransition).toBeDefined();
      expect((inviteTransition?.action as any).target).toBe('Bob');
    });

    it('should skip CreateParticipants for uninvolved roles (tau-elimination)', () => {
      const source = `
        protocol MultiRole(role Manager, role Observer) {
          new role Worker;
          Manager creates Worker;
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      // Project for Observer (not involved)
      const cfsm = project(cfg, 'Observer');

      // Observer should NOT have CreateAction (tau-eliminated)
      const createTransition = cfsm.transitions.find(
        t => t.action.type === 'create'
      );

      expect(createTransition).toBeUndefined();
    });
  });

  describe('End-to-End Pipeline', () => {
    it('should handle complete dynamic participant protocol', () => {
      const source = `
        protocol TaskDelegation(role Manager) {
          new role Worker;
          Manager creates Worker as w1;
          Manager -> Worker: Task();
          Worker -> Manager: Done();
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      // Project for Manager
      const managerCFSM = project(cfg, 'Manager');

      // Should have create, send, receive actions
      const actionTypes = managerCFSM.transitions.map(t => t.action.type);

      expect(actionTypes).toContain('create');
      expect(actionTypes).toContain('send');
      expect(actionTypes).toContain('receive');

      // Verify CFSMs are well-formed
      expect(managerCFSM.states.length).toBeGreaterThan(0);
      expect(managerCFSM.transitions.length).toBeGreaterThan(0);
      expect(managerCFSM.role).toBe('Manager');
    });
  });
});
