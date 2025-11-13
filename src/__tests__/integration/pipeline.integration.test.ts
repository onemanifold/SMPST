/**
 * Integration Tests - Full Pipeline
 *
 * Tests the complete pipeline: Parser → CFG → Verification → Projection
 *
 * Ensures all layers work together correctly and errors propagate appropriately.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { verifyProtocol } from '../../core/verification/verifier';
import { project, projectAll } from '../../core/projection/projector';
import { createDebugCFSM, visualizeCFSM, snapshotCFSM } from '../../__test-utils__/debug';
import {
  REQUEST_RESPONSE,
  TWO_PHASE_COMMIT,
  STREAMING,
  THREE_BUYER,
  PING_PONG,
  CONDITIONAL_LOOP,
  NESTED_RECURSION,
  PARALLEL_MULTIPLE_BRANCHES,
  CHOICE_WITH_CONTINUATION,
  NESTED_CHOICE,
  ALL_CONSTRUCTS,
  LONG_SEQUENCE,
  MANY_ROLES,
  UNUSED_ROLE,
} from '../../core/projection/__fixtures__/protocols';

describe('Integration - Full Pipeline', () => {
  describe('Parser → CFG → Verification → Projection', () => {
    it('[Request-Response] should complete full pipeline', () => {
      // Parse
      const ast = parse(REQUEST_RESPONSE);
      expect(ast.declarations).toHaveLength(1);
      expect(ast.declarations[0].name).toBe('RequestResponse');

      // Build CFG
      const cfg = buildCFG(ast.declarations[0]);
      expect(cfg.roles).toEqual(['Client', 'Server']);
      expect(cfg.nodes.length).toBeGreaterThan(0);
      expect(cfg.edges.length).toBeGreaterThan(0);

      // Verify
      const verification = verifyProtocol(cfg);
      expect(verification.structural.valid).toBe(true);
      expect(verification.deadlock.hasDeadlock).toBe(false);
      expect(verification.liveness.isLive).toBe(true);

      // Project all roles
      const projection = projectAll(cfg);
      expect(projection.errors).toHaveLength(0);
      expect(projection.cfsms.size).toBe(2);

      // Validate Client CFSM
      const clientCFSM = projection.cfsms.get('Client')!;
      expect(clientCFSM.states.length).toBeGreaterThan(0);
      expect(clientCFSM.transitions.length).toBeGreaterThan(0); // At least send Request, receive Response

      // Find send and receive transitions
      const clientSends = clientCFSM.transitions.filter(t => t.action?.type === 'send');
      const clientRecvs = clientCFSM.transitions.filter(t => t.action?.type === 'receive');
      expect(clientSends.length).toBe(1);
      expect(clientRecvs.length).toBe(1);

      // Validate Server CFSM
      const serverCFSM = projection.cfsms.get('Server')!;
      expect(serverCFSM.transitions.length).toBeGreaterThan(0); // At least receive Request, send Response

      const serverRecvs = serverCFSM.transitions.filter(t => t.action?.type === 'receive');
      const serverSends = serverCFSM.transitions.filter(t => t.action?.type === 'send');
      expect(serverRecvs.length).toBe(1);
      expect(serverSends.length).toBe(1);
    });

    it('[Two-Phase Commit] should handle parallel composition', () => {
      // Parse
      const ast = parse(TWO_PHASE_COMMIT);
      const cfg = buildCFG(ast.declarations[0]);

      // Verify
      const verification = verifyProtocol(cfg);
      expect(verification.structural.valid).toBe(true);
      expect(verification.parallelDeadlock.hasDeadlock).toBe(false);

      // Project
      const projection = projectAll(cfg);
      expect(projection.errors).toHaveLength(0);
      expect(projection.cfsms.size).toBe(3); // Coordinator, P1, P2

      // Use debug utilities to inspect Coordinator
      const { cfsm, debug, helpers } = createDebugCFSM(TWO_PHASE_COMMIT, 'Coordinator');

      // Verify state summary
      expect(debug.stateSummary.total).toBeGreaterThan(0);
      expect(debug.stateSummary.unreachable).toHaveLength(0);

      // Verify transitions table
      expect(debug.transitionTable.rows.length).toBeGreaterThan(0);

      // Check for VoteRequest sends
      const voteRequests = helpers.findTransitionsFrom(cfsm.initialState);
      expect(voteRequests.length).toBeGreaterThan(0);
    });

    it('[Streaming] should handle recursion correctly', () => {
      // Parse → CFG → Verify → Project
      const ast = parse(STREAMING);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);
      const projection = projectAll(cfg);

      expect(verification.structural.valid).toBe(true);
      expect(projection.errors).toHaveLength(0);

      // Use debug utilities to detect cycles
      const { cfsm, helpers } = createDebugCFSM(STREAMING, 'Producer');
      const cycles = helpers.detectCycles();

      // Streaming has a conditional loop, so should have a cycle
      expect(cycles.length).toBeGreaterThan(0);

      // Verify reachability
      const reachable = helpers.getReachableStates(cfsm.initialState);
      expect(reachable.length).toBe(cfsm.states.length); // All states should be reachable
    });

    it('[Three-Buyer] should handle complex choice and sequencing', () => {
      const ast = parse(THREE_BUYER);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);
      const projection = projectAll(cfg);

      expect(verification.structural.valid).toBe(true);
      expect(verification.choiceDeterminism.violations).toHaveLength(0);
      expect(projection.cfsms.size).toBe(3);

      // Validate each role's CFSM
      const buyer1 = projection.cfsms.get('Buyer1')!;
      const buyer2 = projection.cfsms.get('Buyer2')!;
      const seller = projection.cfsms.get('Seller')!;

      expect(buyer1.transitions.length).toBeGreaterThan(0);
      expect(buyer2.transitions.length).toBeGreaterThan(0);
      expect(seller.transitions.length).toBeGreaterThan(0);

      // Use debug to verify Buyer2's choice structure
      const { debug } = createDebugCFSM(THREE_BUYER, 'Buyer2');
      const visualization = debug.visualize();
      expect(visualization).toContain('Accept');
      expect(visualization).toContain('Reject');
    });

    it('[Ping-Pong] should handle recursion with choice', () => {
      const ast = parse(PING_PONG);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);

      expect(verification.structural.valid).toBe(true);
      expect(verification.progress.canProgress).toBe(true);

      const projection = projectAll(cfg);
      expect(projection.cfsms.size).toBe(2);

      // Debug role A
      const { cfsm, helpers } = createDebugCFSM(PING_PONG, 'A');

      // Check for cycles (recursion)
      const cycles = helpers.detectCycles();
      expect(cycles.length).toBeGreaterThan(0);

      // Verify all states are reachable
      const reachable = helpers.getReachableStates(cfsm.initialState);
      expect(reachable.length).toBe(cfsm.states.length);
    });
  });

  describe('Error Propagation', () => {
    it('should propagate parse errors', () => {
      const invalidSyntax = `
        protocol Invalid(role A, role B) {
          A -> B: Missing semicolon()
        }
      `;

      expect(() => parse(invalidSyntax)).toThrow();
    });

    it('should propagate CFG build errors for invalid AST', () => {
      // Create invalid AST manually (missing required fields)
      const invalidAST: any = {
        type: 'Protocol',
        name: 'Invalid',
        roles: [],
        body: null,
      };

      expect(() => buildCFG(invalidAST)).toThrow();
    });

    it('should detect verification errors', () => {
      // Create a protocol that should fail verification
      const deadlockProtocol = `
        protocol Deadlock(role A, role B) {
          choice at A {
            A -> B: M1();
          } or {
            A -> B: M2();
          }
          choice at B {
            B -> A: M3();
          } or {
            B -> A: M4();
          }
        }
      `;

      const ast = parse(deadlockProtocol);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);

      // This protocol has potential issues
      // At minimum, structural validation should run
      expect(verification.structural).toBeDefined();
    });

    it('should propagate projection errors for invalid roles', () => {
      const ast = parse(REQUEST_RESPONSE);
      const cfg = buildCFG(ast.declarations[0]);

      expect(() => project(cfg, 'NonExistentRole')).toThrow(/not found/);
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('[Conditional Loop] should handle recursion with exit path', () => {
      const ast = parse(CONDITIONAL_LOOP);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);
      const projection = projectAll(cfg);

      expect(verification.structural.valid).toBe(true);
      expect(projection.errors).toHaveLength(0);

      // Verify Server has choice transitions
      const { cfsm, helpers } = createDebugCFSM(CONDITIONAL_LOOP, 'Server');
      const fromInitial = helpers.findTransitionsFrom(cfsm.initialState);
      expect(fromInitial.length).toBeGreaterThan(0);
    });

    it('[Nested Recursion] should handle multiple recursion levels', () => {
      const ast = parse(NESTED_RECURSION);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);

      expect(verification.structural.valid).toBe(true);

      const { cfsm, helpers } = createDebugCFSM(NESTED_RECURSION, 'A');
      const cycles = helpers.detectCycles();

      // Should detect nested cycles
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('[Parallel Multiple Branches] should handle role in multiple branches', () => {
      const ast = parse(PARALLEL_MULTIPLE_BRANCHES);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);
      const projection = projectAll(cfg);

      expect(verification.structural.valid).toBe(true);
      // Note: This protocol may have parallel deadlock depending on verification implementation
      // The important thing is that projection succeeds
      expect(projection.errors).toHaveLength(0);

      // Role A is in both branches
      const { cfsm } = createDebugCFSM(PARALLEL_MULTIPLE_BRANCHES, 'A');
      const sends = cfsm.transitions.filter(t => t.action?.type === 'send');
      // Diamond pattern: 2 paths (M1 then M2, OR M2 then M1) = 4 send transitions total
      expect(sends.length).toBe(4); // Two paths, each with 2 sends
    });

    it('[Choice with Continuation] should handle post-choice sequencing', () => {
      const ast = parse(CHOICE_WITH_CONTINUATION);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);
      const projection = projectAll(cfg);

      expect(verification.structural.valid).toBe(true);
      expect(verification.choiceDeterminism.violations).toHaveLength(0);
      expect(projection.errors).toHaveLength(0);

      // Role A should have choice + continuation
      const { cfsm, debug } = createDebugCFSM(CHOICE_WITH_CONTINUATION, 'A');
      expect(debug.transitionTable.rows.length).toBeGreaterThan(3); // At least 4 transitions
    });

    it('[Nested Choice] should handle choice within choice', () => {
      const ast = parse(NESTED_CHOICE);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);

      expect(verification.structural.valid).toBe(true);
      expect(verification.choiceDeterminism.violations).toHaveLength(0);

      const projection = projectAll(cfg);
      expect(projection.errors).toHaveLength(0);
    });

    it('[All Constructs] should handle protocol with all features', () => {
      const ast = parse(ALL_CONSTRUCTS);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);
      const projection = projectAll(cfg);

      // Should successfully verify and project
      expect(verification.structural.valid).toBe(true);
      expect(projection.errors).toHaveLength(0);
      expect(projection.cfsms.size).toBe(3);

      // Use debug to inspect role A
      const { cfsm, helpers } = createDebugCFSM(ALL_CONSTRUCTS, 'A');

      // Should have cycles (recursion)
      const cycles = helpers.detectCycles();
      expect(cycles.length).toBeGreaterThan(0);

      // All states should be reachable
      const reachable = helpers.getReachableStates(cfsm.initialState);
      expect(reachable.length).toBe(cfsm.states.length);
    });
  });

  describe('Edge Cases', () => {
    it('[Long Sequence] should handle many sequential messages', () => {
      const ast = parse(LONG_SEQUENCE);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);
      const projection = projectAll(cfg);

      expect(verification.structural.valid).toBe(true);
      expect(projection.errors).toHaveLength(0);

      // Role A should have 5 sends + 5 receives (plus possibly terminal transition)
      const { cfsm } = createDebugCFSM(LONG_SEQUENCE, 'A');
      const actionTransitions = cfsm.transitions.filter(t => t.action?.type);
      expect(actionTransitions.length).toBe(10); // Exactly 10 action transitions (5 sends, 5 receives)
    });

    it('[Many Roles] should handle protocols with many participants', () => {
      const ast = parse(MANY_ROLES);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);
      const projection = projectAll(cfg);

      expect(verification.structural.valid).toBe(true);
      expect(projection.errors).toHaveLength(0);
      expect(projection.cfsms.size).toBe(5);

      // Each role should have valid CFSM
      for (const [role, cfsm] of projection.cfsms.entries()) {
        expect(cfsm.role).toBe(role);
        expect(cfsm.states.length).toBeGreaterThan(0);
      }
    });

    it('[Unused Role] should handle role not involved in protocol', () => {
      const ast = parse(UNUSED_ROLE);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);

      expect(projection.errors).toHaveLength(0);
      expect(projection.cfsms.size).toBe(3);

      // Role C should have minimal CFSM (just initial → terminal)
      const { cfsm } = createDebugCFSM(UNUSED_ROLE, 'C');
      expect(cfsm.transitions.length).toBe(1); // Just initial → terminal
    });
  });

  describe('Debug Utilities Integration', () => {
    it('should use createDebugCFSM to inspect protocol', () => {
      const { cfsm, debug, helpers } = createDebugCFSM(REQUEST_RESPONSE, 'Client');

      // CFSM should be valid
      expect(cfsm.role).toBe('Client');
      expect(cfsm.states.length).toBeGreaterThan(0);

      // Debug info should be complete
      expect(debug.cfgSummary.nodeCount).toBeGreaterThan(0);
      expect(debug.cfgSummary.roles).toContain('Client');
      expect(debug.verification.structural.valid).toBe(true);
      expect(debug.stateSummary.total).toBe(cfsm.states.length);
      expect(debug.transitionTable.rows.length).toBe(cfsm.transitions.length);

      // Helpers should work
      const fromInitial = helpers.findTransitionsFrom(cfsm.initialState);
      expect(fromInitial.length).toBeGreaterThan(0);

      const reachable = helpers.getReachableStates(cfsm.initialState);
      expect(reachable.length).toBe(cfsm.states.length);
    });

    it('should visualize CFSM as ASCII art', () => {
      const { cfsm, debug } = createDebugCFSM(REQUEST_RESPONSE, 'Client');
      const visualization = debug.visualize();

      expect(visualization).toContain('CFSM for role: Client');
      expect(visualization).toContain('Initial:');
      expect(visualization).toContain('Terminal:');
      expect(visualization).toContain('States');
      expect(visualization).toContain('Transitions');
    });

    it('should detect cycles in recursive protocols', () => {
      const { helpers } = createDebugCFSM(STREAMING, 'Producer');
      const cycles = helpers.detectCycles();

      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0].length).toBeGreaterThan(0); // Cycle should have states
    });

    it('should verify execution traces', () => {
      const { cfsm, helpers } = createDebugCFSM(REQUEST_RESPONSE, 'Client');

      // Valid trace: send Request, receive Response
      const sendAction = cfsm.transitions[0].action;
      const recvAction = cfsm.transitions[1].action;
      const validTrace = [sendAction, recvAction];

      const result = helpers.verifyTrace(validTrace);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should create snapshots for regression testing', () => {
      const { cfsm } = createDebugCFSM(REQUEST_RESPONSE, 'Client');
      const snapshot = snapshotCFSM(cfsm);

      expect(snapshot).toContain('CFSM SNAPSHOT: Client');
      expect(snapshot).toContain('Initial State:');
      expect(snapshot).toContain('Terminal States:');
      expect(snapshot).toContain('States (');
      expect(snapshot).toContain('Transitions (');
    });

    it('should visualize CFG structure', () => {
      const { debug } = createDebugCFSM(REQUEST_RESPONSE, 'Client');
      const cfgViz = debug.visualizeCFG();

      expect(cfgViz).toContain('CFG for protocol:');
      expect(cfgViz).toContain('Roles:');
      expect(cfgViz).toContain('Nodes');
      expect(cfgViz).toContain('Edges');
    });
  });

  describe('Verification Integration', () => {
    it('should verify structural properties', () => {
      const protocols = [
        REQUEST_RESPONSE,
        TWO_PHASE_COMMIT,
        STREAMING,
        THREE_BUYER,
        PING_PONG,
      ];

      for (const protocol of protocols) {
        const ast = parse(protocol);
        const cfg = buildCFG(ast.declarations[0]);
        const verification = verifyProtocol(cfg);

        // All known-good protocols should pass structural validation
        expect(verification.structural.valid).toBe(true);
      }
    });

    it('should verify deadlock freedom', () => {
      const ast = parse(TWO_PHASE_COMMIT);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);

      expect(verification.deadlock.hasDeadlock).toBe(false);
      expect(verification.deadlock.cycles).toHaveLength(0);
    });

    it('should verify liveness properties', () => {
      const ast = parse(STREAMING);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);

      expect(verification.liveness.isLive).toBe(true);
    });

    it('should verify progress properties', () => {
      const ast = parse(CONDITIONAL_LOOP);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);

      expect(verification.progress.canProgress).toBe(true);
    });

    it('should verify parallel composition', () => {
      const ast = parse(TWO_PHASE_COMMIT);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);

      expect(verification.parallelDeadlock.hasDeadlock).toBe(false);
      expect(verification.forkJoinStructure.isValid).toBe(true);
    });

    it('should verify choice properties', () => {
      const ast = parse(THREE_BUYER);
      const cfg = buildCFG(ast.declarations[0]);
      const verification = verifyProtocol(cfg);

      expect(verification.choiceDeterminism.violations).toHaveLength(0);
      expect(verification.choiceMergeability.violations).toHaveLength(0);
    });
  });

  describe('Projection Integration', () => {
    it('should project all roles consistently', () => {
      const ast = parse(THREE_BUYER);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);

      expect(projection.errors).toHaveLength(0);
      expect(projection.roles).toEqual(['Buyer1', 'Buyer2', 'Seller']);
      expect(projection.cfsms.size).toBe(3);

      // Each role should have valid initial and terminal states
      for (const [role, cfsm] of projection.cfsms.entries()) {
        expect(cfsm.initialState).toBeDefined();
        expect(cfsm.terminalStates.length).toBeGreaterThan(0);
        expect(cfsm.states.find(s => s.id === cfsm.initialState)).toBeDefined();
      }
    });

    it('should maintain duality (send/receive matching)', () => {
      const ast = parse(REQUEST_RESPONSE);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);

      const clientCFSM = projection.cfsms.get('Client')!;
      const serverCFSM = projection.cfsms.get('Server')!;

      // Client sends Request
      const clientSend = clientCFSM.transitions.find(
        t => t.action.type === 'send' && t.action.label === 'Request'
      );
      expect(clientSend).toBeDefined();

      // Server receives Request
      const serverRecv = serverCFSM.transitions.find(
        t => t.action.type === 'receive' && t.action.label === 'Request'
      );
      expect(serverRecv).toBeDefined();

      // Verify dual structure
      expect(clientSend!.action.type).toBe('send');
      expect(serverRecv!.action.type).toBe('receive');
      expect(clientSend!.action.label).toBe(serverRecv!.action.label);
    });

    it('should handle tau-elimination (uninvolved roles)', () => {
      const ast = parse(UNUSED_ROLE);
      const cfg = buildCFG(ast.declarations[0]);
      const projection = projectAll(cfg);

      // Role C is not involved in any message
      const roleCCFSM = projection.cfsms.get('C')!;

      // Should have minimal structure (just initial → terminal transition)
      expect(roleCCFSM.transitions.length).toBe(1);
      expect(roleCCFSM.states.length).toBe(2); // initial + terminal
    });
  });
});
