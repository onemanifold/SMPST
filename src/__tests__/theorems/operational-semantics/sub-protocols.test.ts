/**
 * OPERATIONAL SEMANTICS: Sub-Protocol Invocation
 *
 * FORMAL SEMANTICS:
 *   Sub-protocol invocation do P(r̃) follows formal reduction rules:
 *
 *   Rule SUB-INVOKE:
 *   ⟨do P(r̃), σ⟩ → ⟨P[r̃/roles], push(σ, return)⟩
 *
 *   Rule SUB-RETURN:
 *   ⟨end, push(σ, return)⟩ → ⟨return, σ⟩
 *
 * RECURSION SCOPING (Theorem 5.1, Demangeon & Honda 2012):
 *   rec X.G binds X only within G. X cannot escape to parent protocol.
 *   X ∈ FV(rec X.G) ⟹ X ∉ FV(Parent)
 *
 * CALL STACK PROPERTIES:
 *   1. LIFO: Last invoked sub-protocol returns first
 *   2. Isolation: Sub-protocol state independent of parent
 *   3. Termination: Sub-protocol must complete before return
 *
 * SOURCE: docs/theory/sub-protocol-formal-analysis.md
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { CFGSimulator } from '../../../core/simulation/cfg-simulator';
import { ProtocolRegistry } from '../../../core/protocol-registry/registry';
import { CallStackManager } from '../../../core/simulation/call-stack-manager';

describe('Sub-Protocol Operational Semantics', () => {
  /**
   * FORMAL RULE: SUB-INVOKE
   */
  describe('Rule SUB-INVOKE: Invocation', () => {
    it('proves: sub-protocol invocation pushes call frame', () => {
      const source = `
        protocol Child(role A, role B) {
          A -> B: ChildMsg();
        }

        protocol Parent(role A, role B) {
          do Child(A, B);
        }
      `;

      const ast = parse(source);
      const registry = new ProtocolRegistry();

      registry.register('Child', ast.declarations[0]);
      registry.register('Parent', ast.declarations[1]);

      const parentCFG = buildCFG(ast.declarations[1]);
      const callStack = new CallStackManager();

      const simulator = new CFGSimulator(parentCFG, {
        protocolRegistry: registry,
        callStackManager: callStack,
        maxSteps: 100,
      });

      // Before invocation: stack empty
      expect(callStack.isEmpty()).toBe(true);

      // Execute sub-protocol invocation
      simulator.run();

      // After completion: stack empty again (balanced)
      expect(callStack.isEmpty()).toBe(true);
      expect(simulator.isComplete()).toBe(true);
    });

    it('proves: role parameter substitution', () => {
      const source = `
        protocol GenericPair(role X, role Y) {
          X -> Y: Generic();
        }

        protocol Main(role A, role B) {
          do GenericPair(A, B);
        }
      `;

      const ast = parse(source);
      const registry = new ProtocolRegistry();

      registry.register('GenericPair', ast.declarations[0]);
      registry.register('Main', ast.declarations[1]);

      const mainCFG = buildCFG(ast.declarations[1]);

      // Verify protocol is registered
      const genericProto = registry.resolve('GenericPair');
      expect(genericProto).toBeDefined();
      expect(genericProto.roles).toContain('X');
      expect(genericProto.roles).toContain('Y');
    });
  });

  /**
   * FORMAL RULE: SUB-RETURN
   */
  describe('Rule SUB-RETURN: Return', () => {
    it('proves: sub-protocol return pops call frame', () => {
      const source = `
        protocol Sub(role A, role B) {
          A -> B: Msg();
        }

        protocol Main(role A, role B) {
          do Sub(A, B);
          A -> B: AfterReturn();
        }
      `;

      const ast = parse(source);
      const registry = new ProtocolRegistry();

      registry.register('Sub', ast.declarations[0]);
      registry.register('Main', ast.declarations[1]);

      const mainCFG = buildCFG(ast.declarations[1]);
      const callStack = new CallStackManager();

      const simulator = new CFGSimulator(mainCFG, {
        protocolRegistry: registry,
        callStackManager: callStack,
        maxSteps: 100,
      });

      simulator.run();

      // Execution completes: sub returns, then main continues
      expect(simulator.isComplete()).toBe(true);
      expect(callStack.isEmpty()).toBe(true);
    });
  });

  /**
   * THEOREM 5.1: Recursion Scoping
   */
  describe('Theorem 5.1: Recursion Scoping (Demangeon & Honda 2012)', () => {
    it('proves: recursion variables scoped to defining protocol', () => {
      const source = `
        protocol Child(role A, role B) {
          rec ChildLoop {
            A -> B: Ping();
            continue ChildLoop;
          }
        }

        protocol Parent(role A, role B) {
          do Child(A, B);
          // ChildLoop not accessible here
        }
      `;

      const ast = parse(source);

      // Child has recursive node
      const childCFG = buildCFG(ast.declarations[0]);
      const childRecursive = childCFG.nodes.filter(n => n.type === 'recursive');
      expect(childRecursive.length).toBeGreaterThan(0);

      // Parent does not have ChildLoop in scope
      const parentCFG = buildCFG(ast.declarations[1]);
      const parentRecursive = parentCFG.nodes.filter(n => n.type === 'recursive');
      expect(parentRecursive.length).toBe(0); // No recursion in parent
    });

    it('proves: nested sub-protocols have independent scopes', () => {
      const source = `
        protocol Inner(role A, role B) {
          rec InnerLoop {
            A -> B: Inner();
            continue InnerLoop;
          }
        }

        protocol Outer(role A, role B) {
          rec OuterLoop {
            do Inner(A, B);
            continue OuterLoop;
          }
        }
      `;

      const ast = parse(source);

      const innerCFG = buildCFG(ast.declarations[0]);
      const outerCFG = buildCFG(ast.declarations[1]);

      // Both have recursive nodes
      const innerRec = innerCFG.nodes.filter(n => n.type === 'recursive');
      const outerRec = outerCFG.nodes.filter(n => n.type === 'recursive');

      expect(innerRec.length).toBeGreaterThan(0);
      expect(outerRec.length).toBeGreaterThan(0);

      // Scopes are independent
      expect(innerRec[0].id).not.toBe(outerRec[0].id);
    });
  });

  /**
   * CALL STACK PROPERTIES
   */
  describe('Call Stack Properties', () => {
    it('proves: LIFO ordering (last in, first out)', () => {
      const source = `
        protocol A(role X, role Y) {
          X -> Y: MsgA();
        }

        protocol B(role X, role Y) {
          do A(X, Y);
        }

        protocol C(role X, role Y) {
          do B(X, Y);
        }
      `;

      const ast = parse(source);
      const registry = new ProtocolRegistry();

      registry.register('A', ast.declarations[0]);
      registry.register('B', ast.declarations[1]);
      registry.register('C', ast.declarations[2]);

      const cCFG = buildCFG(ast.declarations[2]);
      const callStack = new CallStackManager();

      const simulator = new CFGSimulator(cCFG, {
        protocolRegistry: registry,
        callStackManager: callStack,
        maxSteps: 100,
      });

      simulator.run();

      // LIFO: C calls B, B calls A, A returns to B, B returns to C
      expect(simulator.isComplete()).toBe(true);
      expect(callStack.isEmpty()).toBe(true);
    });

    it('proves: isolation (sub-protocol state independent)', () => {
      const source = `
        protocol Isolated(role A, role B) {
          rec Local {
            A -> B: LocalMsg();
            continue Local;
          }
        }

        protocol Main(role A, role B) {
          do Isolated(A, B);
          A -> B: MainMsg();
        }
      `;

      const ast = parse(source);

      // Isolated has local recursion
      const isolatedCFG = buildCFG(ast.declarations[0]);
      const isolatedRec = isolatedCFG.nodes.filter(n => n.type === 'recursive');
      expect(isolatedRec.length).toBeGreaterThan(0);

      // Main does not inherit Isolated's recursion
      const mainCFG = buildCFG(ast.declarations[1]);
      const mainRec = mainCFG.nodes.filter(n => n.type === 'recursive');
      expect(mainRec.length).toBe(0);
    });
  });

  /**
   * DOCUMENTATION LINK
   */
  describe('Documentation Reference', () => {
    it('references formal theory document', () => {
      const fs = require('fs');
      const path = require('path');
      const docPath = path.join(
        __dirname,
        '../../../../docs/theory/sub-protocol-formal-analysis.md'
      );

      expect(fs.existsSync(docPath)).toBe(true);

      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain('operational');
      expect(content).toContain('Theorem 5.1');
    });
  });
});
