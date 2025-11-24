/**
 * Test: Role Instance Semantics
 *
 * Verify that the system correctly handles:
 * - new role Worker (TYPE declaration)
 * - creates Worker as w1, w2, w3 (INSTANCE creation)
 * - Messages sent to instance names, not type names
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import type { GlobalProtocolDeclaration, CreateParticipants } from '../../core/ast/types';

describe('Role Instance Semantics (Formal Correctness)', () => {
  it('should parse multiple instances of same role type', () => {
    const protocol = `
      protocol Test(role Master) {
        new role Worker;
        Master creates Worker as w1;
        Master creates Worker as w2;
        Master creates Worker as w3;
      }
    `;

    const ast = parse(protocol);
    const proto = ast.declarations[0] as GlobalProtocolDeclaration;

    // Find create statements
    const creates = proto.body.filter(s => s.type === 'CreateParticipants') as CreateParticipants[];

    expect(creates).toHaveLength(3);
    expect(creates[0].roleName).toBe('Worker');
    expect(creates[0].instanceName).toBe('w1');
    expect(creates[1].roleName).toBe('Worker');
    expect(creates[1].instanceName).toBe('w2');
    expect(creates[2].roleName).toBe('Worker');
    expect(creates[2].instanceName).toBe('w3');

    // ALL three creates reference the SAME type "Worker"
    // but with DIFFERENT instance names w1, w2, w3
  });

  it('should allow messages to instance names', () => {
    const protocol = `
      protocol Test(role Master) {
        new role Worker;
        Master creates Worker as w1;
        Master creates Worker as w2;
        Master invites w1;
        Master invites w2;
        Master -> w1: Task1();
        Master -> w2: Task2();
        w1 -> Master: Result1();
        w2 -> Master: Result2();
      }
    `;

    const ast = parse(protocol);
    const proto = ast.declarations[0] as GlobalProtocolDeclaration;

    // Find message sends
    const messages = proto.body.filter(s => s.type === 'MessageTransfer');

    expect(messages).toHaveLength(4);

    // Messages use instance names w1, w2 NOT the type "Worker"
    expect(messages[0]).toMatchObject({ from: 'Master', to: 'w1' });
    expect(messages[1]).toMatchObject({ from: 'Master', to: 'w2' });
    expect(messages[2]).toMatchObject({ from: 'w1', to: 'Master' });
    expect(messages[3]).toMatchObject({ from: 'w2', to: 'Master' });
  });

  it('should build CFG with instance information', () => {
    const protocol = `
      protocol Test(role Master) {
        new role Worker;
        Master creates Worker as w1;
        Master creates Worker as w2;
      }
    `;

    const ast = parse(protocol);
    const proto = ast.declarations[0] as GlobalProtocolDeclaration;
    const cfg = buildCFG(proto);

    // Find create-participants nodes
    const createNodes = cfg.nodes.filter(n =>
      n.action?.kind === 'create-participants'
    );

    expect(createNodes).toHaveLength(2);

    const action1 = createNodes[0].action as any;
    const action2 = createNodes[1].action as any;

    // Both create the SAME type "Worker"
    expect(action1.roleName).toBe('Worker');
    expect(action2.roleName).toBe('Worker');

    // But with DIFFERENT instance names
    expect(action1.instanceName).toBe('w1');
    expect(action2.instanceName).toBe('w2');
  });
});
