/**
 * Verification test for dynamic participant support
 *
 * Goal: Check if projection and CFG building already work for dynamic participants
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('Dynamic Participant Projection Verification', () => {
  it('should parse dynamic participant syntax', () => {
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
    expect(ast.declarations).toHaveLength(1);

    const decl = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(decl.type).toBe('GlobalProtocolDeclaration');
    expect(decl.name).toBe('DynamicTest');
  });

  it('should build CFG with dynamic participant nodes', () => {
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

    // CFG should have nodes
    expect(cfg.nodes.length).toBeGreaterThan(0);

    // Check for create and invite actions
    const hasCreateAction = cfg.nodes.some(node =>
      node.type === 'action' && (node as any).action.kind === 'create-participants'
    );
    const hasInviteAction = cfg.nodes.some(node =>
      node.type === 'action' && (node as any).action.kind === 'invitation'
    );

    console.log('Has create action:', hasCreateAction);
    console.log('Has invite action:', hasInviteAction);
    console.log('CFG nodes:', cfg.nodes.length);

    // Log all action kinds
    for (const node of cfg.nodes) {
      if (node.type === 'action') {
        const action = (node as any).action;
        console.log('Node', node.id, 'action kind:', action.kind);
      } else {
        console.log('Node', node.id, 'type:', node.type);
      }
    }

    expect(hasCreateAction).toBe(true);
    expect(hasInviteAction).toBe(true);
  });

  it('should project dynamic participants to CFSMs', () => {
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

    // Should have CFSMs for both Manager and Worker (static projection)
    console.log('Projected roles:', Array.from(projections.cfsms.keys()));
    expect(projections.cfsms.has('Manager')).toBe(true);
    expect(projections.cfsms.has('Worker')).toBe(true);

    // Check Manager's CFSM has create/invite transitions
    const managerCFSM = projections.cfsms.get('Manager')!;
    console.log('Manager transitions:', managerCFSM.transitions.length);

    const createTransitions = managerCFSM.transitions.filter(t =>
      (t.action as any).type === 'create' || (t.action as any).kind === 'create'
    );
    const inviteTransitions = managerCFSM.transitions.filter(t =>
      (t.action as any).type === 'invite' || (t.action as any).kind === 'invite'
    );

    console.log('Create transitions:', createTransitions.length);
    console.log('Invite transitions:', inviteTransitions.length);
    console.log('Manager action types:', managerCFSM.transitions.map(t => t.action.type));
  });

  it('should verify simple dynamic participant protocol structure', () => {
    // Simpler test - just Manager creates and sends
    const protocol = `
      protocol Simple(role Manager) {
        new role Worker;
        Manager creates Worker as w;
        Manager -> w: Task();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);

    console.log('\n=== CFG Nodes ===');
    for (const node of cfg.nodes) {
      console.log(`Node ${node.id} (${node.type}):`);
      if (node.type === 'action') {
        const action = (node as any).action;
        console.log(`  kind: ${action.kind}`);
        console.log(`  full action:`, JSON.stringify(action, null, 2));
      }
      if (node.type === 'split') {
        console.log(`  branches: ${node.branches?.length || 0}`);
      }
    }

    const projections = projectAll(cfg);

    console.log('\n=== Simple Protocol ===');
    console.log('Roles:', Array.from(projections.cfsms.keys()));

    for (const [role, cfsm] of projections.cfsms) {
      console.log(`\n${role} CFSM:`);
      console.log('  States:', cfsm.states.length);
      console.log('  Transitions:', cfsm.transitions.length);
      console.log('  Action types:', cfsm.transitions.map(t => t.action.type));
      for (const t of cfsm.transitions) {
        console.log(`    ${t.from} --[${t.action.type}]--> ${t.to}`);
      }
    }
  });
});
