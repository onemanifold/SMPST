/**
 * Well-Formedness Validation Tests
 *
 * Tests the validateWellFormedness function to ensure it catches
 * common protocol errors.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser/parser';
import { validateWellFormedness } from '../ast-projector';
import type { GlobalProtocolDeclaration } from '../../../core/ast/types';

describe('Well-Formedness Validation', () => {
  describe('Role Name Validation', () => {
    it('should detect undefined sender role', () => {
      const source = `
        protocol Test(role A, role B) {
          C -> B: Msg();
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('undefined-role');
      expect(errors[0].role).toBe('C');
      expect(errors[0].message).toContain('not defined');
    });

    it('should detect undefined receiver role', () => {
      const source = `
        protocol Test(role A, role B) {
          A -> C: Msg();
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('undefined-role');
      expect(errors[0].role).toBe('C');
    });

    it('should detect undefined receiver in multicast', () => {
      const source = `
        protocol Test(role A, role B) {
          A -> B, C, D: Msg();
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      expect(errors.length).toBeGreaterThan(0);
      const undefinedRoles = errors.filter(e => e.type === 'undefined-role');
      expect(undefinedRoles.length).toBe(2); // C and D
    });

    it('should accept valid roles', () => {
      const source = `
        protocol Test(role A, role B, role C) {
          A -> B: M1();
          B -> C: M2();
          C -> A: M3();
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      const roleErrors = errors.filter(e => e.type === 'undefined-role');
      expect(roleErrors.length).toBe(0);
    });
  });

  describe('Self-Communication Detection', () => {
    it('should detect self-communication in unicast', () => {
      const source = `
        protocol Test(role A, role B) {
          A -> A: Msg();
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('self-communication');
      expect(errors[0].role).toBe('A');
      expect(errors[0].message).toContain('cannot send to itself');
    });

    it('should detect self-communication in multicast', () => {
      const source = `
        protocol Test(role A, role B, role C) {
          A -> A, B, C: Msg();
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      expect(errors.length).toBeGreaterThan(0);
      const selfCommErrors = errors.filter(e => e.type === 'self-communication');
      expect(selfCommErrors.length).toBe(1);
      expect(selfCommErrors[0].role).toBe('A');
    });

    it('should accept valid multicast without self-communication', () => {
      const source = `
        protocol Test(role A, role B, role C) {
          A -> B, C: Msg();
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      const selfCommErrors = errors.filter(e => e.type === 'self-communication');
      expect(selfCommErrors.length).toBe(0);
    });
  });

  describe('Recursion Label Validation', () => {
    it('should detect undefined recursion label', () => {
      const source = `
        protocol Test(role A, role B) {
          rec X {
            A -> B: Msg();
            continue Y;
          }
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('undefined-recursion-label');
      expect(errors[0].message).toContain('Continue label "Y"');
    });

    it('should accept valid recursion label', () => {
      const source = `
        protocol Test(role A, role B) {
          rec Loop {
            A -> B: Data();
            continue Loop;
          }
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      const recErrors = errors.filter(e => e.type === 'undefined-recursion-label');
      expect(recErrors.length).toBe(0);
    });

    it('should handle nested recursion scopes', () => {
      const source = `
        protocol Test(role A, role B) {
          rec Outer {
            A -> B: Start();
            rec Inner {
              B -> A: Data();
              continue Inner;
            }
            continue Outer;
          }
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      const recErrors = errors.filter(e => e.type === 'undefined-recursion-label');
      expect(recErrors.length).toBe(0);
    });
  });

  describe('Choice Determinism', () => {
    it('should detect non-deterministic choice branches', () => {
      const source = `
        protocol Test(role A, role B) {
          choice at A {
            A -> B: Msg();
          } or {
            A -> B: Msg();
          }
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('non-deterministic-choice');
      expect(errors[0].message).toContain('same first message');
    });

    it('should accept deterministic choice branches', () => {
      const source = `
        protocol Test(role A, role B) {
          choice at A {
            A -> B: Accept();
          } or {
            A -> B: Reject();
          }
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      const choiceErrors = errors.filter(e => e.type === 'non-deterministic-choice');
      expect(choiceErrors.length).toBe(0);
    });
  });

  describe('Sub-protocol Validation', () => {
    it('should detect undefined role in sub-protocol call', () => {
      const source = `
        protocol Test(role A, role B) {
          do SubProtocol(A, C);
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      expect(errors.length).toBeGreaterThan(0);
      const roleErrors = errors.filter(e => e.type === 'undefined-role');
      expect(roleErrors.length).toBeGreaterThan(0);
      expect(roleErrors[0].role).toBe('C');
    });

    it('should accept valid sub-protocol call', () => {
      const source = `
        protocol Test(role A, role B, role C) {
          do SubProtocol(A, B, C);
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      const roleErrors = errors.filter(e => e.type === 'undefined-role');
      expect(roleErrors.length).toBe(0);
    });
  });

  describe('Complex Protocol Validation', () => {
    it('should validate complex protocol with all features', () => {
      const source = `
        protocol TwoBuyer(role Seller, role Buyer1, role Buyer2) {
          Seller -> Buyer1, Buyer2: Quote(Int);
          Buyer1 -> Buyer2: Share(Int);
          choice at Buyer2 {
            Buyer2 -> Seller: Accept();
          } or {
            Buyer2 -> Seller: Reject();
          }
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      // Should have no errors
      expect(errors.length).toBe(0);
    });

    it('should catch multiple errors in invalid protocol', () => {
      const source = `
        protocol BadProtocol(role A, role B) {
          C -> A: Msg1();
          A -> A: Msg2();
          rec X {
            B -> A: Msg3();
            continue Y;
          }
        }
      `;
      const ast = parse(source);
      const errors = validateWellFormedness(ast.declarations[0] as GlobalProtocolDeclaration);

      expect(errors.length).toBeGreaterThan(2);

      // Should have undefined role error
      const roleErrors = errors.filter(e => e.type === 'undefined-role');
      expect(roleErrors.length).toBeGreaterThan(0);

      // Should have self-communication error
      const selfCommErrors = errors.filter(e => e.type === 'self-communication');
      expect(selfCommErrors.length).toBeGreaterThan(0);

      // Should have undefined recursion label error
      const recErrors = errors.filter(e => e.type === 'undefined-recursion-label');
      expect(recErrors.length).toBeGreaterThan(0);
    });
  });
});
