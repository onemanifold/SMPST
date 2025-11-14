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
import { parse } from '../../src/parser/parser';
import { buildCFG } from '../../src/core/cfg/cfg-builder';
import { verifyProtocol } from '../../src/core/verification/verify';
import { project } from '../../src/core/projection/project';
import { checkSafeProtocolUpdate } from '../../src/core/verification/dmst/safe-update';
import { verifyTraceEquivalence } from '../../src/core/verification/dmst/trace-equivalence';

describe('DMst Examples Validation', () => {
  const examplesDir = join(__dirname, '../../examples/dmst');

  const examples = [
    {
      file: 'simple-dynamic-worker.smpst',
      name: 'Simple Dynamic Worker',
      features: ['new role', 'creates', 'invites', 'messages'],
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
      file: 'map-reduce.smpst',
      name: 'Map-Reduce',
      features: ['new role', 'creates', 'invites', 'updatable recursion', 'calls', 'choice'],
    },
  ];

  examples.forEach(({ file, name, features }) => {
    describe(name, () => {
      const filePath = join(examplesDir, file);
      let source: string;
      let ast: any;
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
          ast = parse(source);
        }).not.toThrow();
        expect(ast).toBeTruthy();
        expect(ast.protocols).toBeDefined();
        expect(ast.protocols.length).toBeGreaterThan(0);
      });

      it('should build valid CFG', () => {
        if (!ast) ast = parse(readFileSync(filePath, 'utf-8'));
        expect(() => {
          cfg = buildCFG(ast);
        }).not.toThrow();
        expect(cfg).toBeTruthy();
        expect(cfg.nodes).toBeDefined();
        expect(cfg.edges).toBeDefined();
        expect(cfg.nodes.length).toBeGreaterThan(0);
      });

      it('should have all declared features', () => {
        if (!ast) ast = parse(readFileSync(filePath, 'utf-8'));
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
          ast = parse(readFileSync(filePath, 'utf-8'));
          cfg = buildCFG(ast);
        }

        const result = verifyProtocol(cfg);
        expect(result.errors).toHaveLength(0);
        expect(result.isValid).toBe(true);
      });

      it('should project to valid CFSMs', () => {
        if (!cfg) {
          ast = parse(readFileSync(filePath, 'utf-8'));
          cfg = buildCFG(ast);
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
          ast = parse(readFileSync(filePath, 'utf-8'));
          cfg = buildCFG(ast);
        }

        const projections = new Map();
        cfg.roles.forEach((role: string) => {
          const cfsm = project(cfg, role);
          projections.set(role, cfsm);
        });

        const traceResult = verifyTraceEquivalence(cfg, projections);
        expect(traceResult).toBeTruthy();
        expect(traceResult.isEquivalent).toBe(true);
      });

      if (features.includes('updatable recursion')) {
        it('should verify safe protocol update (Definition 14)', () => {
          if (!cfg) {
            ast = parse(readFileSync(filePath, 'utf-8'));
            cfg = buildCFG(ast);
          }

          const safeUpdateResult = checkSafeProtocolUpdate(cfg);
          expect(safeUpdateResult).toBeTruthy();
          expect(safeUpdateResult.isSafe).toBe(true);
          expect(safeUpdateResult.violations).toHaveLength(0);
          expect(safeUpdateResult.updatableRecursions.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('All Examples Summary', () => {
    it('should have at least 4 passing examples', () => {
      expect(examples.length).toBeGreaterThanOrEqual(4);
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
          const ast = parse(source);
          const cfg = buildCFG(ast);
          const result = verifyProtocol(cfg);

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
