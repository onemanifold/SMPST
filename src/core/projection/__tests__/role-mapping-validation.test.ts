/**
 * Tests for role mapping well-formedness validation
 *
 * Validates that projection correctly enforces:
 * 1. Arity: Number of formal params = number of actual args
 * 2. Uniqueness: No role aliasing
 * 3. Scope: Actual roles exist in parent protocol
 *
 * Based on Pabble (Hu, Yoshida, Honda 2015)
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { createProtocolRegistry } from '../../protocol-registry/registry';
import { buildCFG } from '../../cfg/builder';
import { project } from '../projector';

describe('Role Mapping Well-Formedness Validation', () => {
  describe('Arity Validation', () => {
    it('should reject sub-protocol invocation with wrong number of roles', () => {
      const source = `
        protocol Auth(role Client, role Server) {
          Client -> Server: Login(String);
        }

        protocol Main(role Alice) {
          do Auth(Alice);  // Wrong! Auth expects 2 roles
        }
      `;

      const module = parse(source);
      const registry = createProtocolRegistry(module);
      const mainProtocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
      );

      expect(mainProtocol).toBeDefined();
      if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Main protocol not found');
      }

      const cfg = buildCFG(mainProtocol);

      expect(() => {
        project(cfg, 'Alice', registry);
      }).toThrow(/Role arity mismatch.*expected 2 roles, got 1/);
    });

    it('should accept sub-protocol invocation with correct number of roles', () => {
      const source = `
        protocol Auth(role Client, role Server) {
          Client -> Server: Login(String);
        }

        protocol Main(role Alice, role Bob) {
          do Auth(Alice, Bob);  // Correct!
        }
      `;

      const module = parse(source);
      const registry = createProtocolRegistry(module);
      const mainProtocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
      );

      expect(mainProtocol).toBeDefined();
      if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Main protocol not found');
      }

      const cfg = buildCFG(mainProtocol);

      // Should not throw
      expect(() => {
        project(cfg, 'Alice', registry);
      }).not.toThrow();
    });
  });

  describe('Uniqueness Validation', () => {
    it('should reject sub-protocol invocation with role aliasing', () => {
      const source = `
        protocol Auth(role Client, role Server) {
          Client -> Server: Login(String);
        }

        protocol Main(role Alice, role Bob) {
          do Auth(Alice, Alice);  // Wrong! Role aliasing
        }
      `;

      const module = parse(source);
      const registry = createProtocolRegistry(module);
      const mainProtocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
      );

      expect(mainProtocol).toBeDefined();
      if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Main protocol not found');
      }

      const cfg = buildCFG(mainProtocol);

      expect(() => {
        project(cfg, 'Alice', registry);
      }).toThrow(/Role aliasing detected.*roles must be distinct/);
    });

    it('should accept sub-protocol invocation with distinct roles', () => {
      const source = `
        protocol Auth(role Client, role Server) {
          Client -> Server: Login(String);
        }

        protocol Main(role Alice, role Bob) {
          do Auth(Alice, Bob);  // Correct! Distinct roles
        }
      `;

      const module = parse(source);
      const registry = createProtocolRegistry(module);
      const mainProtocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
      );

      expect(mainProtocol).toBeDefined();
      if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Main protocol not found');
      }

      const cfg = buildCFG(mainProtocol);

      // Should not throw
      expect(() => {
        project(cfg, 'Alice', registry);
      }).not.toThrow();
    });
  });

  describe('Scope Validation', () => {
    it('should reject sub-protocol invocation with undefined role', () => {
      const source = `
        protocol Auth(role Client, role Server) {
          Client -> Server: Login(String);
        }

        protocol Main(role Alice) {
          do Auth(Alice, Charlie);  // Wrong! Charlie not in Main's roles
        }
      `;

      const module = parse(source);
      const registry = createProtocolRegistry(module);
      const mainProtocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
      );

      expect(mainProtocol).toBeDefined();
      if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Main protocol not found');
      }

      const cfg = buildCFG(mainProtocol);

      expect(() => {
        project(cfg, 'Alice', registry);
      }).toThrow(/Role 'Charlie' not found in parent protocol/);
    });

    it('should accept sub-protocol invocation with roles in scope', () => {
      const source = `
        protocol Auth(role Client, role Server) {
          Client -> Server: Login(String);
        }

        protocol Main(role Alice, role Bob) {
          do Auth(Alice, Bob);  // Correct! Both in Main's roles
        }
      `;

      const module = parse(source);
      const registry = createProtocolRegistry(module);
      const mainProtocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
      );

      expect(mainProtocol).toBeDefined();
      if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Main protocol not found');
      }

      const cfg = buildCFG(mainProtocol);

      // Should not throw
      expect(() => {
        project(cfg, 'Alice', registry);
      }).not.toThrow();
    });
  });

  describe('Formal Role Mapping', () => {
    it('should create correct formal → actual role mapping', () => {
      const source = `
        protocol Auth(role Client, role Server) {
          Client -> Server: Login(String);
          Server -> Client: LoginOk();
        }

        protocol Main(role Alice, role Bob) {
          do Auth(Alice, Bob);
          Alice -> Bob: Done();
        }
      `;

      const module = parse(source);
      const registry = createProtocolRegistry(module);
      const mainProtocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
      );

      expect(mainProtocol).toBeDefined();
      if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Main protocol not found');
      }

      const cfg = buildCFG(mainProtocol);
      const aliceCFSM = project(cfg, 'Alice', registry);

      // Find the sub-protocol call action
      const subProtocolTransition = aliceCFSM.transitions.find(
        t => t.action?.type === 'subprotocol'
      );

      expect(subProtocolTransition).toBeDefined();
      expect(subProtocolTransition?.action).toBeDefined();

      if (subProtocolTransition?.action?.type === 'subprotocol') {
        const roleMapping = subProtocolTransition.action.roleMapping;

        // Verify formal mapping: Client → Alice, Server → Bob
        expect(roleMapping).toEqual({
          Client: 'Alice',
          Server: 'Bob',
        });
      }
    });

    it('should handle role remapping correctly', () => {
      const source = `
        protocol TwoParty(role A, role B) {
          A -> B: Message();
        }

        protocol Main(role X, role Y, role Z) {
          do TwoParty(X, Y);  // X plays A, Y plays B
          do TwoParty(Y, Z);  // Y plays A, Z plays B
        }
      `;

      const module = parse(source);
      const registry = createProtocolRegistry(module);
      const mainProtocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
      );

      expect(mainProtocol).toBeDefined();
      if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Main protocol not found');
      }

      const cfg = buildCFG(mainProtocol);
      const xCFSM = project(cfg, 'X', registry);

      // X participates in first call but not second
      const subProtocolTransitions = xCFSM.transitions.filter(
        t => t.action?.type === 'subprotocol'
      );

      // Should have exactly 1 sub-protocol call (the first one)
      expect(subProtocolTransitions).toHaveLength(1);

      const firstCall = subProtocolTransitions[0];
      if (firstCall.action?.type === 'subprotocol') {
        expect(firstCall.action.roleMapping).toEqual({
          A: 'X',
          B: 'Y',
        });
      }
    });
  });
});
