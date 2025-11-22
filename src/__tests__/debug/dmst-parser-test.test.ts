/**
 * Test DMst parser capabilities - checking which constructs are supported
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';

describe('DMst Parser Capabilities', () => {
  it('should parse new role declaration', () => {
    const source = `
      protocol Test(role Manager) {
        new role Worker;
        Manager -> Worker: Task();
      }
    `;

    try {
      const ast = parse(source);
      expect(ast.type).toBe('Module');
      console.log('✅ new role: parsed successfully');
    } catch (e) {
      console.log(`❌ new role: ${(e as Error).message}`);
      throw e;
    }
  });

  it('should parse creates action', () => {
    const source = `
      protocol Test(role Manager) {
        new role Worker;
        Manager creates Worker;
        Manager -> Worker: Task();
      }
    `;

    try {
      const ast = parse(source);
      expect(ast.type).toBe('Module');
      console.log('✅ creates: parsed successfully');
    } catch (e) {
      console.log(`❌ creates: ${(e as Error).message}`);
      throw e;
    }
  });

  it('should parse invites action', () => {
    const source = `
      protocol Test(role Manager) {
        new role Worker;
        Manager creates Worker;
        Manager invites Worker;
        Manager -> Worker: Task();
      }
    `;

    try {
      const ast = parse(source);
      expect(ast.type).toBe('Module');
      console.log('✅ invites: parsed successfully');
    } catch (e) {
      console.log(`❌ invites: ${(e as Error).message}`);
      throw e;
    }
  });

  it('should parse protocol call', () => {
    const source = `
      protocol Test(role A, role B) {
        A calls Sub(B);
      }
    `;

    try {
      const ast = parse(source);
      expect(ast.type).toBe('Module');
      console.log('✅ calls: parsed successfully');
    } catch (e) {
      console.log(`❌ calls: ${(e as Error).message}`);
      throw e;
    }
  });

  it('should parse continue with (updatable recursion)', () => {
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
      expect(ast.type).toBe('Module');
      console.log('✅ continue with: parsed successfully');
    } catch (e) {
      console.log(`❌ continue with: ${(e as Error).message}`);
      throw e;
    }
  });
});
