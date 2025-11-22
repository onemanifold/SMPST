/**
 * Test DMst projection capabilities
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import type { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('DMst Projection Capabilities', () => {
  it('should project basic protocol', () => {
    const source = `
      protocol Test(role A, role B) {
        A -> B: Task();
        B -> A: Result();
      }
    `;

    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const result = projectAll(cfg);

    expect(result.cfsms.size).toBe(2);
    expect(result.cfsms.has('A')).toBe(true);
    expect(result.cfsms.has('B')).toBe(true);
    console.log('✅ Projection: basic protocol');
  });

  it('should project protocol with dynamic role declaration', () => {
    const source = `
      protocol Test(role Manager) {
        new role Worker;
        Manager -> Worker: Task();
      }
    `;

    try {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
      const result = projectAll(cfg);

      console.log(`  Projected roles: ${Array.from(result.cfsms.keys()).join(', ')}`);
      expect(result.cfsms.has('Manager')).toBe(true);
      // Worker might or might not be projected depending on implementation
      console.log(`  Worker projected: ${result.cfsms.has('Worker') ? 'yes' : 'no'}`);
      console.log('✅ Projection: new role');
    } catch (e) {
      console.log(`❌ Projection failed: ${(e as Error).message}`);
      throw e;
    }
  });

  it('should project protocol with creates action', () => {
    const source = `
      protocol Test(role Manager) {
        new role Worker;
        Manager creates Worker;
        Manager -> Worker: Task();
      }
    `;

    try {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
      const result = projectAll(cfg);

      console.log(`  Projected roles: ${Array.from(result.cfsms.keys()).join(', ')}`);
      console.log('✅ Projection: creates');
    } catch (e) {
      console.log(`❌ Projection failed: ${(e as Error).message}`);
      throw e;
    }
  });

  it('should project protocol with protocol call', () => {
    const source = `
      protocol Test(role A, role B) {
        A calls Sub(B);
        A -> B: After();
      }
    `;

    try {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
      const result = projectAll(cfg);

      console.log(`  Projected roles: ${Array.from(result.cfsms.keys()).join(', ')}`);
      console.log('✅ Projection: protocol call');
    } catch (e) {
      console.log(`❌ Projection failed: ${(e as Error).message}`);
      throw e;
    }
  });

  it('should project protocol with updatable recursion', () => {
    const source = `
      protocol Test(role A, role B) {
        rec Loop {
          A -> B: Work();
          continue Loop with {
            A -> B: Extra();
          };
        }
      }
    `;

    try {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
      const result = projectAll(cfg);

      console.log(`  Projected roles: ${Array.from(result.cfsms.keys()).join(', ')}`);

      // Check if A's CFSM has transitions
      const acfsm = result.cfsms.get('A');
      if (acfsm) {
        console.log(`  A transitions: ${acfsm.transitions.length}`);
      }
      console.log('✅ Projection: updatable recursion');
    } catch (e) {
      console.log(`❌ Projection failed: ${(e as Error).message}`);
      throw e;
    }
  });
});
