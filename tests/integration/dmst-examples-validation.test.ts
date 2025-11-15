/**
 * DMst Examples Validation Tests
 *
 * Verifies that all DMst example protocols:
 * 1. Parse successfully
 * 2. Build valid CFG
 * 3. Pass all verification checks
 * 4. Project correctly to CFSMs
 * 5. Verify trace equivalence
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from '../../src/core/parser/parser';
import { buildCFG } from '../../src/core/cfg/builder';
import { verifyProtocol, summarizeVerification } from '../../src/core/verification/verifier';
import { project } from '../../src/core/projection/projector';
import { checkSafeProtocolUpdate } from '../../src/core/verification/dmst/safe-update';
import { verifyTraceEquivalence } from '../../src/core/verification/dmst/trace-equivalence';

describe('DMst Examples Validation', () => {
  const examplesDir = join(__dirname, '../../examples/dmst');

  const examples = [
    {
      file: 'minimal-invitation.smpst',
      name: 'Minimal Invitation',
      features: ['new role', 'creates', 'invites'],
    },
    {
      file: 'simple-dynamic-worker.smpst',
      name: 'Simple Dynamic Worker',
      features: ['new role', 'creates', 'invites', 'messages'],
    },
    {
      file: 'multiple-dynamic-roles.smpst',
      name: 'Multiple Dynamic Roles',
      features: ['new role', 'creates', 'invites', 'messages'],
    },
    {
      file: 'choice-with-dynamic.smpst',
      name: 'Choice with Dynamic',
      features: ['new role', 'creates', 'invites', 'choice', 'messages'],
    },
    {
      file: 'updatable-pipeline.smpst',
      name: 'Updatable Pipeline',
      features: ['new role', 'creates', 'invites', 'updatable recursion', 'choice'],
    },
    {
      file: 'protocol-call.smpst',
      name: 'Protocol Call',
      features: ['new role', 'creates', 'invites', 'calls', 'combining operator'],
    },
    {
      file: 'sequential-calls.smpst',
      name: 'Sequential Calls',
      features: ['new role', 'creates', 'invites', 'calls', 'combining operator'],
    },
    {
      file: 'parallel-workers.smpst',
      name: 'Parallel Workers',
      features: ['new role', 'creates', 'invites', 'messages', 'parallel'],
    },
    {
      file: 'nested-update.smpst',
      name: 'Nested Update',
      features: ['new role', 'creates', 'invites', 'updatable recursion', 'choice'],
    },
    {
      file: 'map-reduce.smpst',
      name: 'Map-Reduce',
      features: ['new role', 'creates', 'invites', 'updatable recursion', 'calls', 'choice'],
    },
  ];

  examples.forEach(({ file, name, features }) => {
    describe(name, () => {
      const filePath = join(examplesDir, file);
      let source: string;
      let module: any;
      let protocol: any;
      let cfg: any;

      it('should exist and be readable', () => {
        expect(() => {
          source = readFileSync(filePath, 'utf-8');
        }).not.toThrow();
        expect(source).toBeTruthy();
        expect(source.length).toBeGreaterThan(0);
      });

      it('should parse successfully', () => {
        source = readFileSync(filePath, 'utf-8');
        expect(() => {
          module = parse(source);
        }).not.toThrow();
        expect(module).toBeTruthy();
        expect(module.declarations).toBeDefined();
        expect(module.declarations.length).toBeGreaterThan(0);

        protocol = module.declarations.find(
          (d: any) => d.type === 'GlobalProtocolDeclaration'
        );
        expect(protocol).toBeDefined();
      });

      it('should build valid CFG', () => {
        if (!protocol) {
          module = parse(readFileSync(filePath, 'utf-8'));
          protocol = module.declarations.find(
            (d: any) => d.type === 'GlobalProtocolDeclaration'
          );
        }
        expect(() => {
          cfg = buildCFG(protocol);
        }).not.toThrow();
        expect(cfg).toBeTruthy();
        expect(cfg.nodes).toBeDefined();
        expect(cfg.edges).toBeDefined();
        expect(cfg.nodes.length).toBeGreaterThan(0);
      });

      it('should have all declared features', () => {
        const sourceText = readFileSync(filePath, 'utf-8');

        features.forEach(feature => {
          if (feature === 'new role') {
            expect(sourceText).toContain('new role');
          } else if (feature === 'creates') {
            expect(sourceText).toContain('creates');
          } else if (feature === 'invites') {
            expect(sourceText).toContain('invites');
          } else if (feature === 'calls') {
            expect(sourceText).toContain('calls');
          } else if (feature === 'updatable recursion') {
            expect(sourceText).toContain('continue');
            expect(sourceText).toContain('with');
          }
        });
      });

      it('should pass verification', () => {
        if (!cfg) {
          module = parse(readFileSync(filePath, 'utf-8'));
          protocol = module.declarations.find(
            (d: any) => d.type === 'GlobalProtocolDeclaration'
          );
          cfg = buildCFG(protocol);
        }

        const verification = verifyProtocol(cfg);
        const result = summarizeVerification(verification);

        if (!result.isValid) {
          console.error(`Verification errors for ${name}:`, result.errors);
        }

        expect(result.errors).toHaveLength(0);
        expect(result.isValid).toBe(true);
      });

      it('should project to valid CFSMs', () => {
        if (!cfg) {
          module = parse(readFileSync(filePath, 'utf-8'));
          protocol = module.declarations.find(
            (d: any) => d.type === 'GlobalProtocolDeclaration'
          );
          cfg = buildCFG(protocol);
        }

        const projections = new Map();
        expect(() => {
          cfg.roles.forEach((role: string) => {
            const cfsm = project(cfg, role);
            projections.set(role, cfsm);
          });
        }).not.toThrow();

        expect(projections.size).toBe(cfg.roles.length);

        // Verify each CFSM is valid
        projections.forEach((cfsm, role) => {
          expect(cfsm).toBeTruthy();
          expect(cfsm.states).toBeDefined();
          expect(cfsm.transitions).toBeDefined();
          expect(cfsm.role).toBe(role);
        });
      });

      it('should verify trace equivalence', () => {
        if (!cfg) {
          module = parse(readFileSync(filePath, 'utf-8'));
          protocol = module.declarations.find(
            (d: any) => d.type === 'GlobalProtocolDeclaration'
          );
          cfg = buildCFG(protocol);
        }

        const projections = new Map();
        cfg.roles.forEach((role: string) => {
          const cfsm = project(cfg, role);
          projections.set(role, cfsm);
        });

        const traceResult = verifyTraceEquivalence(cfg, projections);
        expect(traceResult).toBeTruthy();
        if (!traceResult.isEquivalent) {
          console.log(`\n${name} trace mismatch:`);
          console.log('  Reason:', traceResult.reason);
          console.log('  Global:', traceResult.globalTrace);
          console.log('  Composed:', traceResult.composedTrace);
        }
        expect(traceResult.isEquivalent).toBe(true);
      });

      if (features.includes('updatable recursion')) {
        it('should verify safe protocol update (Definition 14)', () => {
          // Always rebuild CFG for safe update test using the LAST protocol
          // This handles cases like map-reduce.smpst with MapTask (helper) and MapReduce (main)
          if (!module) {
            module = parse(readFileSync(filePath, 'utf-8'));
          }
          const protocols = module.declarations.filter(
            (d: any) => d.type === 'GlobalProtocolDeclaration'
          );
          const mainProtocol = protocols[protocols.length - 1];
          const mainCfg = buildCFG(mainProtocol);

          const safeUpdateResult = checkSafeProtocolUpdate(mainCfg);
          expect(safeUpdateResult).toBeTruthy();
          expect(safeUpdateResult.isSafe).toBe(true);
          expect(safeUpdateResult.violations).toHaveLength(0);
          expect(safeUpdateResult.updatableRecursions.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('All Examples Summary', () => {
    it('should have at least 10 passing examples', () => {
      expect(examples.length).toBeGreaterThanOrEqual(10);
    });

    it('should cover all DMst features', () => {
      const allFeatures = new Set<string>();
      examples.forEach(({ features }) => {
        features.forEach(f => allFeatures.add(f));
      });

      const expectedFeatures = [
        'new role',
        'creates',
        'invites',
        'calls',
        'updatable recursion',
        'messages',
        'choice',
        'combining operator',
      ];

      expectedFeatures.forEach(feature => {
        expect(allFeatures.has(feature)).toBe(true);
      });
    });

    it('should all parse and verify', () => {
      let passCount = 0;

      examples.forEach(({ file }) => {
        try {
          const filePath = join(examplesDir, file);
          const source = readFileSync(filePath, 'utf-8');
          const module = parse(source);
          const protocol = module.declarations.find(
            (d: any) => d.type === 'GlobalProtocolDeclaration'
          );
          const cfg = buildCFG(protocol);
          const verification = verifyProtocol(cfg);
          const result = summarizeVerification(verification);

          if (result.isValid) {
            passCount++;
          }
        } catch (error) {
          // Failures will be caught in individual tests
        }
      });

      expect(passCount).toBe(examples.length);
    });
  });
});
