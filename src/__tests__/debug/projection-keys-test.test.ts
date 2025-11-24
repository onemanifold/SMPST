/**
 * Debug: Check what keys projection uses for role instances
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import type { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('Projection Keys Debug', () => {
  it('should show what keys projection uses for instances', () => {
    const protocol = `
      protocol Test(role Manager) {
        new role Worker;
        Manager creates Worker as w1;
        Manager creates Worker as w2;
        Manager invites w1;
        Manager invites w2;
        Manager -> w1: Task1();
        Manager -> w2: Task2();
        w1 -> Manager: Result1();
        w2 -> Manager: Result2();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const projections = projectAll(cfg);

    console.log('Projection keys:', Array.from(projections.cfsms.keys()));
    console.log('Total CFSMs:', projections.cfsms.size);

    // What are the actual keys?
    expect(projections.cfsms.size).toBeGreaterThan(0);
  });
});
