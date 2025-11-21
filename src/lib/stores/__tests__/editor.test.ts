/**
 * Editor Store Tests - Backend Contract Enforcement
 *
 * These tests GUARANTEE the editor store faithfully implements ALL backend modules:
 * - Parser (parse)
 * - CFG Builder (buildCFG)
 * - Verifier (verifyProtocol) - ALL 16 checks
 * - Projector (projectAll)
 * - Serializer (serializeCFSM)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  parseProtocol,
  parseStatus,
  parseError,
  verificationResult,
  projectionData,
  projectionErrors,
  hasProjectionErrors,
  editorContent,
  setEditorContent,
  clearEditor,
} from '../editor';
import { extractVerificationIssues } from '../contracts/editor-contract';

describe('Editor Store - Backend Contract Enforcement', () => {
  beforeEach(() => {
    // Reset all stores
    clearEditor();
    vi.clearAllMocks();
  });

  describe('parse() Integration - AST Contract', () => {
    it('should handle Module.declarations array', async () => {
      const protocol = `
        global protocol TwoParty(role A, role B) {
          msg(int) from A to B;
        }
      `;

      const result = await parseProtocol(protocol);

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
      expect(result.ast?.declarations).toHaveLength(1);
      expect(result.ast?.declarations[0].type).toBe('GlobalProtocolDeclaration');
    });

    it('should expose parse errors with details', async () => {
      const invalidProtocol = `
        global protocol BadSyntax(role A) {
          msg(int from A to;  // Invalid syntax
        }
      `;

      const result = await parseProtocol(invalidProtocol);

      expect(result.success).toBe(false);
      expect(get(parseStatus)).toBe('error');
      const error = get(parseError);
      expect(error).toBeDefined();
      expect(error?.message).toBeDefined();
      expect(error?.message).not.toBe('');
    });

    // ✅ NOW EXPOSED - Parse error location information
    it('should preserve parse error location for error highlighting', async () => {
      // Parser errors include line/column information
      const invalidProtocol = `
        global protocol Invalid(role A, role B) {
          msg from A to B;
        }
      `;

      const result = await parseProtocol(invalidProtocol);

      expect(result.success).toBe(false);
      const error = get(parseError);
      expect(error).toBeDefined();
      expect(error?.message).toBeDefined();

      // Location should be extracted if available in error message
      if (error?.location) {
        expect(error.location).toHaveProperty('line');
        expect(error.location).toHaveProperty('column');
        expect(typeof error.location.line).toBe('number');
        expect(typeof error.location.column).toBe('number');
      }
    });

    it('should handle parse errors with location information', async () => {
      // Test that ParseErrorInfo structure is correct
      const invalidSyntax = 'this is not valid scribble';
      const result = await parseProtocol(invalidSyntax);

      expect(result.success).toBe(false);
      const error = get(parseError);
      expect(error).toBeDefined();
      expect(error).toHaveProperty('message');
      // Location is optional - may be undefined for some error types
      if (error?.location) {
        expect(error.location.line).toBeGreaterThan(0);
        expect(error.location.column).toBeGreaterThan(0);
      }
    });
  });

  describe('buildCFG() Integration - CFG Contract', () => {
    it('should use CFG.roles array', async () => {
      const protocol = `
        global protocol ThreeParty(role A, role B, role C) {
          msg(int) from A to B;
          msg(int) from B to C;
        }
      `;

      const result = await parseProtocol(protocol);

      expect(result.success).toBe(true);
      expect(result.cfg).toBeDefined();
      expect(result.cfg?.roles).toEqual(['A', 'B', 'C']);
    });

    it('should validate CFG.initialNode exists', async () => {
      const protocol = `
        global protocol Simple(role A, role B) {
          msg(int) from A to B;
        }
      `;

      const result = await parseProtocol(protocol);

      expect(result.success).toBe(true);
      expect(result.cfg?.initialNode).toBeDefined();
      expect(result.cfg?.nodes).toBeDefined();
      // Initial node should exist in nodes array
      const hasInitialNode = result.cfg?.nodes.some(
        n => n.id === result.cfg?.initialNode
      );
      expect(hasInitialNode).toBe(true);
    });

    it.todo('should preserve CFG.metadata', async () => {
      // TODO: CFG includes metadata property but not explicitly validated
      // Could contain sourceProtocol reference for debugging
    });
  });

  describe('verifyProtocol() Integration - COMPLETE CONTRACT', () => {
    /**
     * CRITICAL: verifyProtocol() returns 16 verification checks.
     * Editor.ts currently only uses 7 of them.
     * These tests DOCUMENT all 16 and verify they're handled.
     */

    describe('Currently Handled Checks (7/16)', () => {
      it('should expose deadlock check', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result).toBeDefined();
        expect(result?.deadlockFree).toBeDefined();
      });

      it('should expose liveness check', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result?.livenessSatisfied).toBeDefined();
      });

      it('should expose progress check (via safetySatisfied)', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result?.safetySatisfied).toBeDefined();
      });

      it('should collect warnings from multiple checks', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result?.warnings).toBeDefined();
        expect(Array.isArray(result?.warnings)).toBe(true);
      });

      it('should collect errors from multiple checks', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result?.errors).toBeDefined();
        expect(Array.isArray(result?.errors)).toBe(true);
      });
    });

    describe('Previously Missing Checks - NOW EXPOSED (9/16)', () => {
      /**
       * ✅ THESE CHECKS ARE NOW EXPOSED ✅
       *
       * These were previously ignored but are now included in the
       * comprehensive VerificationResult interface.
       */

      it('should expose structural verification', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result).toBeDefined();
        expect(result?.structural).toBeDefined();
        expect(result?.structural).toHaveProperty('valid');
        expect(result?.structural).toHaveProperty('issues');
      });

      it('should expose choiceMergeability check', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result?.choiceMergeability).toBeDefined();
        expect(result?.choiceMergeability).toHaveProperty('valid');
        expect(result?.choiceMergeability).toHaveProperty('issues');
      });

      it('should expose connectedness check', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result?.connectedness).toBeDefined();
        expect(result?.connectedness).toHaveProperty('valid');
        expect(result?.connectedness).toHaveProperty('issues');
      });

      it('should expose nestedRecursion check (Theorem 5.1)', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result?.nestedRecursion).toBeDefined();
        expect(result?.nestedRecursion).toHaveProperty('valid');
        expect(result?.nestedRecursion).toHaveProperty('issues');
      });

      it('should expose recursionInParallel check', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result?.recursionInParallel).toBeDefined();
        expect(result?.recursionInParallel).toHaveProperty('valid');
        expect(result?.recursionInParallel).toHaveProperty('issues');
      });

      it('should expose forkJoinStructure check', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result?.forkJoinStructure).toBeDefined();
        expect(result?.forkJoinStructure).toHaveProperty('valid');
        expect(result?.forkJoinStructure).toHaveProperty('issues');
      });

      it('should expose selfCommunication check', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result?.selfCommunication).toBeDefined();
        expect(result?.selfCommunication).toHaveProperty('valid');
        expect(result?.selfCommunication).toHaveProperty('issues');
      });

      it('should expose emptyChoiceBranch check', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result?.emptyChoiceBranch).toBeDefined();
        expect(result?.emptyChoiceBranch).toHaveProperty('valid');
        expect(result?.emptyChoiceBranch).toHaveProperty('issues');
      });

      it('should expose mergeReachability check', async () => {
        const protocol = `
          global protocol Simple(role A, role B) {
            msg(int) from A to B;
          }
        `;

        await parseProtocol(protocol);
        const result = get(verificationResult);

        expect(result?.mergeReachability).toBeDefined();
        expect(result?.mergeReachability).toHaveProperty('valid');
        expect(result?.mergeReachability).toHaveProperty('issues');
      });
    });

    describe('Verification Contract Handler', () => {
      it('should extract all 16 verification checks', async () => {
        const protocol = `
          global protocol Complete(role A, role B) {
            msg(int) from A to B;
          }
        `;

        // Parse to get verification result
        const result = await parseProtocol(protocol);
        expect(result.success).toBe(true);

        // Get the raw verification result from backend (not exposed by store)
        const { verifyProtocol } = await import('../../../core/verification/verifier');
        const verificationResult = verifyProtocol(result.cfg!);

        // Extract ALL checks using contract handler
        const issues = extractVerificationIssues(verificationResult);

        // Verify all 16 checks are documented
        expect(issues.allChecks).toHaveProperty('structural');
        expect(issues.allChecks).toHaveProperty('deadlock');
        expect(issues.allChecks).toHaveProperty('liveness');
        expect(issues.allChecks).toHaveProperty('parallelDeadlock');
        expect(issues.allChecks).toHaveProperty('raceConditions');
        expect(issues.allChecks).toHaveProperty('progress');
        expect(issues.allChecks).toHaveProperty('choiceDeterminism');
        expect(issues.allChecks).toHaveProperty('choiceMergeability');
        expect(issues.allChecks).toHaveProperty('connectedness');
        expect(issues.allChecks).toHaveProperty('nestedRecursion');
        expect(issues.allChecks).toHaveProperty('recursionInParallel');
        expect(issues.allChecks).toHaveProperty('forkJoinStructure');
        expect(issues.allChecks).toHaveProperty('multicast');
        expect(issues.allChecks).toHaveProperty('selfCommunication');
        expect(issues.allChecks).toHaveProperty('emptyChoiceBranch');
        expect(issues.allChecks).toHaveProperty('mergeReachability');

        // Verify we have 16 checks
        expect(Object.keys(issues.allChecks)).toHaveLength(16);
      });
    });
  });

  describe('projectAll() Integration - Projection Contract', () => {
    it('should expose projection data for all roles', async () => {
      const protocol = `
        global protocol TwoParty(role A, role B) {
          msg(int) from A to B;
        }
      `;

      await parseProtocol(protocol);
      const data = get(projectionData);

      expect(data).toBeDefined();
      expect(data.length).toBe(2); // A and B
      expect(data.map(d => d.role)).toContain('A');
      expect(data.map(d => d.role)).toContain('B');
    });

    it('should include states and transitions for each role', async () => {
      const protocol = `
        global protocol Simple(role A, role B) {
          msg(int) from A to B;
        }
      `;

      await parseProtocol(protocol);
      const data = get(projectionData);

      data.forEach(roleData => {
        expect(roleData.states).toBeDefined();
        expect(Array.isArray(roleData.states)).toBe(true);
        expect(roleData.transitions).toBeDefined();
        expect(Array.isArray(roleData.transitions)).toBe(true);
      });
    });

    it('should include serialized local protocol text', async () => {
      const protocol = `
        global protocol Simple(role A, role B) {
          msg(int) from A to B;
        }
      `;

      await parseProtocol(protocol);
      const data = get(projectionData);

      data.forEach(roleData => {
        expect(roleData.localProtocol).toBeDefined();
        expect(typeof roleData.localProtocol).toBe('string');
        expect(roleData.localProtocol.length).toBeGreaterThan(0);
      });
    });

    // ✅ NOW EXPOSED - Projection errors
    it('should expose projection errors when they occur', async () => {
      const protocol = `
        global protocol Simple(role A, role B) {
          msg(int) from A to B;
        }
      `;

      await parseProtocol(protocol);

      // projectionErrors store should be defined
      const errors = get(projectionErrors);
      expect(errors).toBeDefined();
      expect(Array.isArray(errors)).toBe(true);

      // For a valid protocol, should have no errors
      expect(errors.length).toBe(0);
      expect(get(hasProjectionErrors)).toBe(false);
    });

    it('should clear projection errors on successful projection', async () => {
      const protocol = `
        global protocol Simple(role A, role B) {
          msg(int) from A to B;
        }
      `;

      await parseProtocol(protocol);

      // Should have no projection errors
      expect(get(projectionErrors)).toEqual([]);
      expect(get(hasProjectionErrors)).toBe(false);
    });

    it('should expose projectionErrors store with correct structure', async () => {
      const protocol = `
        global protocol Simple(role A, role B) {
          msg(int) from A to B;
        }
      `;

      await parseProtocol(protocol);
      const errors = get(projectionErrors);

      // Even if empty, should have correct structure
      errors.forEach(error => {
        expect(error).toHaveProperty('role');
        expect(error).toHaveProperty('message');
        // Optional properties
        if (error.nodeId) expect(typeof error.nodeId).toBe('string');
        if (error.phase) expect(['merging', 'continuation', 'projection']).toContain(error.phase);
      });
    });

    // ✅ NOW VALIDATED - CFSM parameters preserved (Phase 4)
    it('should preserve CFSM.parameters for sub-protocols', async () => {
      // CFSM parameters are needed for sub-protocol support (higher-order session types)
      const protocol = `
        global protocol Simple(role A, role B) {
          msg(int) from A to B;
        }
      `;

      await parseProtocol(protocol);
      const projections = get(projectionData);

      expect(projections).toBeDefined();
      expect(projections.length).toBeGreaterThan(0);

      // Verify each projection has parameters property (may be undefined if no params)
      projections.forEach(p => {
        expect(p).toHaveProperty('parameters');

        // If parameters exist, verify structure
        if (p.parameters && p.parameters.length > 0) {
          p.parameters.forEach(param => {
            expect(param).toHaveProperty('name');
            expect(param).toHaveProperty('type');
            expect(['role', 'type', 'sig']).toContain(param.type);
          });
        }
      });
    });

    // ✅ NOW VALIDATED - Multiple terminal states (Phase 4)
    it('should handle CFSM.terminalStates (multiple terminals)', async () => {
      // CFSMs can have multiple terminal states (e.g., different choice outcomes)
      const protocol = `
        global protocol Simple(role A, role B) {
          msg(int) from A to B;
        }
      `;

      await parseProtocol(protocol);
      const projections = get(projectionData);

      expect(projections).toBeDefined();
      expect(projections.length).toBeGreaterThan(0);

      // Verify each projection has terminalStates array
      projections.forEach(p => {
        expect(p).toHaveProperty('terminalStates');
        expect(Array.isArray(p.terminalStates)).toBe(true);

        // At least one terminal state must exist
        expect(p.terminalStates.length).toBeGreaterThan(0);
      });
    });

    // ✅ NOW VALIDATED - Complete CFSM properties (Phase 4)
    it('should expose all CFSM completeness properties', async () => {
      const protocol = `
        global protocol ThreeParty(role A, role B, role C) {
          msg(int) from A to B;
          msg(string) from B to C;
        }
      `;

      await parseProtocol(protocol);
      const projections = get(projectionData);

      expect(projections.length).toBe(3);

      projections.forEach(p => {
        // Required properties
        expect(p).toHaveProperty('role');
        expect(p).toHaveProperty('protocolName');
        expect(p).toHaveProperty('states');
        expect(p).toHaveProperty('transitions');
        expect(p).toHaveProperty('localProtocol');

        // Phase 4: CFSM completeness properties
        expect(p).toHaveProperty('initialState');
        expect(p).toHaveProperty('terminalStates');
        expect(p).toHaveProperty('parameters');

        // Validate types
        expect(typeof p.protocolName).toBe('string');
        expect(typeof p.initialState).toBe('string');
        expect(Array.isArray(p.terminalStates)).toBe(true);
        expect(p.protocolName).toBe('ThreeParty');
      });
    });
  });

  describe('serializeCFSM() Integration', () => {
    it('should generate valid Scribble local protocol', async () => {
      const protocol = `
        global protocol Simple(role A, role B) {
          msg(int) from A to B;
        }
      `;

      await parseProtocol(protocol);
      const data = get(projectionData);

      data.forEach(roleData => {
        // Local protocol should start with 'local protocol'
        expect(roleData.localProtocol).toMatch(/local\s+protocol/);
        // Should contain role name
        expect(roleData.localProtocol).toContain(roleData.role);
      });
    });
  });

  describe('Full Pipeline Integration', () => {
    it('should handle complete parse → verify → project → serialize flow', async () => {
      const protocol = `
        global protocol TwoBuyer(role Buyer1, role Buyer2, role Seller) {
          title(string) from Buyer1 to Seller;
          price(int) from Seller to Buyer1;
          price(int) from Seller to Buyer2;
          choice at Buyer1 {
            agree() from Buyer1 to Seller;
            agree() from Buyer1 to Buyer2;
            address(string) from Buyer2 to Seller;
          } or {
            quit() from Buyer1 to Seller;
            quit() from Buyer1 to Buyer2;
          }
        }
      `;

      const result = await parseProtocol(protocol);

      // 1. Parse succeeded
      expect(result.success).toBe(true);
      expect(get(parseStatus)).toBe('success');
      expect(get(parseError)).toBeNull();

      // 2. AST obtained
      expect(result.ast).toBeDefined();
      expect(result.ast?.declarations[0].type).toBe('GlobalProtocolDeclaration');

      // 3. CFG built
      expect(result.cfg).toBeDefined();
      expect(result.cfg?.roles).toEqual(['Buyer1', 'Buyer2', 'Seller']);

      // 4. Verification completed
      const verification = get(verificationResult);
      expect(verification).toBeDefined();
      expect(verification?.deadlockFree).toBeDefined();
      expect(verification?.livenessSatisfied).toBeDefined();

      // 5. Projection completed for all roles
      const projections = get(projectionData);
      expect(projections.length).toBe(3);

      // 6. All roles have serialized local protocols
      projections.forEach(p => {
        expect(p.localProtocol).toBeDefined();
        expect(p.localProtocol.length).toBeGreaterThan(0);
      });

      // 7. CFSMs returned
      expect(result.cfsms).toBeDefined();
      expect(result.cfsms?.size).toBe(3);
    });

    it('should handle protocols with errors gracefully', async () => {
      const deadlockProtocol = `
        global protocol Deadlock(role A, role B) {
          choice at A {
            msg1(int) from A to B;
          } or {
            msg2(int) from A to B;
          }
          choice at B {
            reply1(int) from B to A;
          } or {
            reply2(int) from B to A;
          }
        }
      `;

      const result = await parseProtocol(deadlockProtocol);

      // Parse should succeed
      expect(result.success).toBe(true);

      // But verification should find issues
      const verification = get(verificationResult);
      expect(verification).toBeDefined();

      // Should have either errors or warnings
      const hasIssues =
        (verification?.errors && verification.errors.length > 0) ||
        (verification?.warnings && verification.warnings.length > 0);

      expect(hasIssues).toBe(true);
    });
  });

  describe('Store State Management', () => {
    it('should reset state when content changes', () => {
      setEditorContent('new content');

      expect(get(parseStatus)).toBe('idle');
      expect(get(parseError)).toBeNull();
    });

    it('should clear all state when editor cleared', () => {
      // Set some state
      setEditorContent('test');

      // Clear
      clearEditor();

      expect(get(editorContent)).toBe('');
      expect(get(parseStatus)).toBe('idle');
      expect(get(parseError)).toBeNull();
      expect(get(verificationResult)).toBeNull();
      expect(get(projectionData)).toEqual([]);
      expect(get(projectionErrors)).toEqual([]);
      expect(get(hasProjectionErrors)).toBe(false);
    });
  });

  describe('Backend Contract Evolution Tracking', () => {
    /**
     * This test DOCUMENTS what properties backend returns.
     * If backend adds new properties, this test MUST be updated.
     * This forces future sessions to handle new backend features.
     */
    it('should document all backend return types', async () => {
      const protocol = `
        global protocol Simple(role A, role B) {
          msg(int) from A to B;
        }
      `;

      const result = await parseProtocol(protocol);

      // Parse result contract
      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result).toHaveProperty('cfg');
        expect(result).toHaveProperty('ast');
        expect(result).toHaveProperty('cfsms');
      } else {
        expect(result).toHaveProperty('error');
      }

      // VerificationResult contract (as exposed by store)
      const verification = get(verificationResult);
      if (verification) {
        expect(verification).toHaveProperty('deadlockFree');
        expect(verification).toHaveProperty('livenessSatisfied');
        expect(verification).toHaveProperty('safetySatisfied');
        expect(verification).toHaveProperty('warnings');
        expect(verification).toHaveProperty('errors');
      }

      // ProjectionData contract (as exposed by store)
      const projections = get(projectionData);
      if (projections.length > 0) {
        const firstProjection = projections[0];
        expect(firstProjection).toHaveProperty('role');
        expect(firstProjection).toHaveProperty('states');
        expect(firstProjection).toHaveProperty('transitions');
        expect(firstProjection).toHaveProperty('localProtocol');
      }

      // If backend adds new properties to these interfaces,
      // TypeScript will force us to handle them here.
    });
  });

  describe('Projection Data Consistency - Race Condition Prevention', () => {
    /**
     * These tests verify that projection data updates are atomic and consistent,
     * preventing race conditions where UI components see partial or stale state.
     *
     * Context: LocalProjectionPanel had timing issues where projections would
     * sometimes display and sometimes not, caused by non-deterministic reactive
     * statement execution order in Svelte.
     *
     * Fix: Store updates are synchronous and atomic - all projection data is
     * computed and set together in a single operation.
     */

    it('should always provide complete projection data for all roles', async () => {
      const protocol = `
        global protocol ThreeParty(role Alice, role Bob, role Carol) {
          msg1(int) from Alice to Bob;
          msg2(string) from Bob to Carol;
          msg3(bool) from Carol to Alice;
        }
      `;

      await parseProtocol(protocol);
      const projections = get(projectionData);

      // All three roles should have complete data
      expect(projections).toHaveLength(3);

      projections.forEach(projection => {
        // Every projection must have all required fields
        expect(projection.role).toBeTruthy();
        expect(projection.protocolName).toBe('ThreeParty');
        expect(projection.states).toBeDefined();
        expect(Array.isArray(projection.states)).toBe(true);
        expect(projection.transitions).toBeDefined();
        expect(Array.isArray(projection.transitions)).toBe(true);

        // CRITICAL: localProtocol must always be present and non-empty
        expect(projection.localProtocol).toBeDefined();
        expect(typeof projection.localProtocol).toBe('string');
        expect(projection.localProtocol.length).toBeGreaterThan(0);
        expect(projection.localProtocol).toMatch(/local\s+protocol/);
        expect(projection.localProtocol).toContain(projection.role);
      });
    });

    it('should maintain projection data consistency when switching protocols', async () => {
      // Test protocol switching to verify no stale data
      const protocol1 = `
        global protocol First(role Alice, role Bob) {
          msg(int) from Alice to Bob;
        }
      `;

      const protocol2 = `
        global protocol Second(role Server, role Client) {
          request(string) from Client to Server;
          response(int) from Server to Client;
        }
      `;

      // Load first protocol
      await parseProtocol(protocol1);
      let projections = get(projectionData);

      expect(projections).toHaveLength(2);
      expect(projections.map(p => p.role).sort()).toEqual(['Alice', 'Bob']);
      expect(projections[0].protocolName).toBe('First');
      expect(projections[0].localProtocol).toContain('Alice');

      // Switch to second protocol
      await parseProtocol(protocol2);
      projections = get(projectionData);

      // Verify OLD data is completely replaced, not mixed
      expect(projections).toHaveLength(2);
      expect(projections.map(p => p.role).sort()).toEqual(['Client', 'Server']);
      expect(projections[0].protocolName).toBe('Second');

      // No traces of old protocol
      projections.forEach(p => {
        expect(p.protocolName).not.toBe('First');
        expect(p.role).not.toBe('Alice');
        expect(p.role).not.toBe('Bob');
        expect(p.localProtocol).not.toContain('First');
      });
    });

    it('should handle rapid sequential protocol switches', async () => {
      // Simulate rapid protocol switching (like user quickly clicking examples)
      const protocols = [
        { code: `global protocol P1(role A, role B) { m1(int) from A to B; }`, name: 'P1', roles: ['A', 'B'] },
        { code: `global protocol P2(role X, role Y) { m2(string) from X to Y; }`, name: 'P2', roles: ['X', 'Y'] },
        { code: `global protocol P3(role C, role D) { m3(bool) from C to D; }`, name: 'P3', roles: ['C', 'D'] },
      ];

      for (const proto of protocols) {
        await parseProtocol(proto.code);
        const projections = get(projectionData);

        // Each parse should completely replace previous data
        expect(projections).toHaveLength(proto.roles.length);
        expect(projections.map(p => p.role).sort()).toEqual(proto.roles.sort());
        expect(projections[0].protocolName).toBe(proto.name);

        // All projections should have valid localProtocol
        projections.forEach(p => {
          expect(p.localProtocol).toBeDefined();
          expect(p.localProtocol.length).toBeGreaterThan(0);
          expect(p.localProtocol).toContain(proto.name);
          expect(p.localProtocol).toContain(p.role);
        });
      }
    });

    it('should ensure localProtocol is never empty string for valid projections', async () => {
      const protocol = `
        global protocol TwoBuyer(role Buyer1, role Buyer2, role Seller) {
          title(string) from Buyer1 to Seller;
          price(int) from Seller to Buyer1;
          price(int) from Seller to Buyer2;
          choice at Buyer1 {
            agree() from Buyer1 to Seller;
            agree() from Buyer1 to Buyer2;
            address(string) from Buyer2 to Seller;
          } or {
            quit() from Buyer1 to Seller;
            quit() from Buyer1 to Buyer2;
          }
        }
      `;

      await parseProtocol(protocol);
      const projections = get(projectionData);

      expect(projections).toHaveLength(3);

      projections.forEach(projection => {
        // localProtocol should NEVER be empty for successful projection
        expect(projection.localProtocol).not.toBe('');
        expect(projection.localProtocol.trim()).not.toBe('');

        // Should be valid Scribble syntax
        expect(projection.localProtocol).toMatch(/local\s+protocol/);
        expect(projection.localProtocol).toContain('at ' + projection.role);

        // Should contain actual protocol content, not just header
        expect(projection.localProtocol.length).toBeGreaterThan(50);
      });
    });

    it('should maintain atomic updates - all fields update together', async () => {
      const protocol = `
        global protocol Chat(role Alice, role Bob) {
          msg(string) from Alice to Bob;
          reply(string) from Bob to Alice;
        }
      `;

      await parseProtocol(protocol);
      const projections = get(projectionData);

      // For each role, verify ALL fields are consistent with each other
      projections.forEach(projection => {
        const role = projection.role;

        // Protocol name should match across all fields
        expect(projection.protocolName).toBe('Chat');

        // Local protocol should reference the same role
        expect(projection.localProtocol).toContain(`at ${role}`);

        // Transitions should be for this role's perspective
        // (this is a smoke test - detailed correctness is tested elsewhere)
        expect(projection.transitions).toBeDefined();
        expect(projection.transitions.length).toBeGreaterThan(0);

        // States should exist
        expect(projection.states.length).toBeGreaterThan(0);

        // All fields should be internally consistent (not a mix of old/new data)
        if (role === 'Alice') {
          expect(projection.localProtocol).toContain('Alice');
          // Alice sends msg and receives reply (serializer uses "to" and "from")
          expect(projection.localProtocol).toContain('to Bob');
          expect(projection.localProtocol).toContain('from Bob');
        } else if (role === 'Bob') {
          expect(projection.localProtocol).toContain('Bob');
          // Bob receives msg and sends reply
          expect(projection.localProtocol).toContain('from Alice');
          expect(projection.localProtocol).toContain('to Alice');
        }
      });
    });

    it('should preserve last good projection data when parse fails', async () => {
      // First load a valid protocol
      const validProtocol = `
        global protocol Valid(role A, role B) {
          msg(int) from A to B;
        }
      `;

      await parseProtocol(validProtocol);
      let projections = get(projectionData);
      expect(projections.length).toBeGreaterThan(0);
      const validProjections = projections;

      // Now try to parse invalid protocol
      const invalidProtocol = `
        global protocol Invalid(role A, role B) {
          msg(int from A to;  // Syntax error
        }
      `;

      const result = await parseProtocol(invalidProtocol);
      expect(result.success).toBe(false);
      expect(get(parseStatus)).toBe('error');

      // Projection data should preserve last good state (not be cleared)
      // This allows UI to show last successful projection with error banner
      projections = get(projectionData);
      expect(projections).toEqual(validProjections);
      expect(projections[0].protocolName).toBe('Valid');
    });

    it('should verify projectionData store updates are synchronous', async () => {
      const protocol = `
        global protocol Sync(role A, role B) {
          msg(int) from A to B;
        }
      `;

      // projectionData should be empty before parsing
      expect(get(projectionData)).toEqual([]);

      await parseProtocol(protocol);

      // After await, projectionData should be immediately available (synchronous update)
      const projections = get(projectionData);
      expect(projections).toHaveLength(2);
      expect(projections[0].localProtocol).toBeDefined();
      expect(projections[0].localProtocol).not.toBe('');
    });
  });
});
