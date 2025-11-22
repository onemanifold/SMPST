/**
 * Test DMst CFG builder capabilities
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import type { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('DMst CFG Builder Capabilities', () => {
  it('should build CFG with new role declaration', () => {
    const source = `
      protocol Test(role Manager, role Worker) {
        Manager -> Worker: Task();
      }
    `;

    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    expect(cfg.nodes.length).toBeGreaterThan(0);
    console.log('✅ CFG built: basic protocol');
  });

  it('should build CFG with dynamic role declaration', () => {
    const source = `
      protocol Test(role Manager) {
        new role Worker;
        Manager -> Worker: Task();
      }
    `;

    try {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
      expect(cfg.nodes.length).toBeGreaterThan(0);

      // Check for dynamic role in CFG
      const hasDynamicNode = cfg.nodes.some(n =>
        n.type === 'action' &&
        (n as any).action?.kind === 'dynamic-role-declaration'
      );
      console.log(`  Dynamic role node: ${hasDynamicNode ? 'yes' : 'no'}`);
      console.log('✅ CFG built: new role');
    } catch (e) {
      console.log(`❌ CFG build failed: ${(e as Error).message}`);
      throw e;
    }
  });

  it('should build CFG with creates action', () => {
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
      expect(cfg.nodes.length).toBeGreaterThan(0);

      // Check for create-participants action
      const hasCreateNode = cfg.nodes.some(n =>
        n.type === 'action' &&
        (n as any).action?.kind === 'create-participants'
      );
      console.log(`  Create participants node: ${hasCreateNode ? 'yes' : 'no'}`);
      console.log('✅ CFG built: creates');
    } catch (e) {
      console.log(`❌ CFG build failed: ${(e as Error).message}`);
      throw e;
    }
  });

  it('should build CFG with protocol call', () => {
    const source = `
      protocol Test(role A, role B) {
        A calls Sub(B);
      }
    `;

    try {
      const ast = parse(source);
      const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
      expect(cfg.nodes.length).toBeGreaterThan(0);

      // Check for protocol-call action
      const hasCallNode = cfg.nodes.some(n =>
        n.type === 'action' &&
        (n as any).action?.kind === 'protocol-call'
      );
      console.log(`  Protocol call node: ${hasCallNode ? 'yes' : 'no'}`);
      console.log('✅ CFG built: calls');
    } catch (e) {
      console.log(`❌ CFG build failed: ${(e as Error).message}`);
      throw e;
    }
  });

  it('should build CFG with updatable recursion', () => {
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
      expect(cfg.nodes.length).toBeGreaterThan(0);

      // Check for updatable-recursion action
      const hasUpdateNode = cfg.nodes.some(n =>
        n.type === 'action' &&
        (n as any).action?.kind === 'updatable-recursion'
      );
      console.log(`  Updatable recursion node: ${hasUpdateNode ? 'yes' : 'no'}`);
      console.log('✅ CFG built: continue with');
    } catch (e) {
      console.log(`❌ CFG build failed: ${(e as Error).message}`);
      throw e;
    }
  });
});
