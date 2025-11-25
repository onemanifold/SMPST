/**
 * Test parallel composition to verify it's working
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import { verifyProtocol } from '../../core/verification/verifier';
import { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('Parallel Composition Test', () => {
  it('should parse parallel composition', () => {
    const protocol = `
      protocol ParallelTest(role A, role B, role C) {
        par {
          A -> B: Message1();
        } and {
          A -> C: Message2();
        }
      }
    `;

    const ast = parse(protocol);
    expect(ast.declarations).toHaveLength(1);

    const proto = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(proto.body).toHaveLength(1);
    expect(proto.body[0].type).toBe('Parallel');
  });

  it('should build CFG for parallel composition', () => {
    const protocol = `
      protocol ParallelTest(role A, role B, role C) {
        par {
          A -> B: Message1();
        } and {
          A -> C: Message2();
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);

    // Should have fork and join nodes
    const forkNodes = cfg.nodes.filter(n => n.type === 'fork');
    const joinNodes = cfg.nodes.filter(n => n.type === 'join');

    expect(forkNodes.length).toBeGreaterThan(0);
    expect(joinNodes.length).toBeGreaterThan(0);
  });

  it('should project parallel composition', () => {
    const protocol = `
      protocol ParallelTest(role A, role B, role C) {
        par {
          A -> B: Message1();
        } and {
          A -> C: Message2();
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const projections = projectAll(cfg);

    // All roles should have CFSMs
    expect(projections.cfsms.has('A')).toBe(true);
    expect(projections.cfsms.has('B')).toBe(true);
    expect(projections.cfsms.has('C')).toBe(true);

    // A should have send transitions
    const cfsmA = projections.cfsms.get('A')!;
    const sends = cfsmA.transitions.filter(t => t.action.type === 'send');

    // Check that both messages are present
    const message1Sends = sends.filter(t => t.action.message?.label === 'Message1');
    const message2Sends = sends.filter(t => t.action.message?.label === 'Message2');

    expect(message1Sends.length).toBeGreaterThan(0);
    expect(message2Sends.length).toBeGreaterThan(0);
  });

  it('should verify parallel composition is well-formed', () => {
    const protocol = `
      protocol ParallelTest(role A, role B, role C) {
        par {
          A -> B: Message1();
        } and {
          A -> C: Message2();
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const wf = verifyProtocol(cfg);

    expect(wf.structural.valid).toBe(true);
    expect(wf.raceConditions.hasRaces).toBe(false);
  });
});
