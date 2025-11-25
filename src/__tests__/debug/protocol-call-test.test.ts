/**
 * Test protocol calls to verify if sub-protocol support is implemented
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import { verifyProtocol } from '../../core/verification/verifier';
import { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('Protocol Call Test', () => {
  it('should parse protocol with calls statement', () => {
    const protocol = `
      protocol Main(role A, role B) {
        A calls Sub(B);
        A -> B: After();
      }
    `;

    const ast = parse(protocol);
    expect(ast.declarations).toHaveLength(1);

    const proto = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(proto.body[0].type).toBe('ProtocolCall');
  });

  it('should build CFG for protocol with calls', () => {
    const protocol = `
      protocol Main(role A, role B) {
        A calls Sub(B);
        A -> B: Continue();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);

    // Should have protocol-call action nodes
    const callNodes = cfg.nodes.filter(n =>
      n.type === 'action' && n.action?.kind === 'protocol-call'
    );
    expect(callNodes.length).toBeGreaterThan(0);
  });

  it('should project protocol with calls', () => {
    const protocol = `
      protocol Main(role A, role B) {
        A calls Sub(B);
        A -> B: Continue();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const projections = projectAll(cfg);

    // Both roles should have projections
    expect(projections.cfsms.has('A')).toBe(true);
    expect(projections.cfsms.has('B')).toBe(true);

    // Should have protocol-call transitions
    const cfsmA = projections.cfsms.get('A')!;
    const calls = cfsmA.transitions.filter(t =>
      t.action.type === 'subprotocol-call'
    );
    expect(calls.length).toBeGreaterThan(0);
  });

  it('should handle protocol calls with dynamic participants', () => {
    const protocol = `
      protocol Main(role Manager) {
        new role Worker;
        Manager creates Worker as w;
        Manager invites w;
        Manager calls Task(w);
        Manager -> w: Done();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);

    expect(cfg.nodes.length).toBeGreaterThan(0);
  });

  it('should verify protocol with calls is well-formed', () => {
    const protocol = `
      protocol Main(role A, role B) {
        A calls Sub(B);
        A -> B: Continue();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const wf = verifyProtocol(cfg);

    expect(wf.structural.valid).toBe(true);
  });
});
