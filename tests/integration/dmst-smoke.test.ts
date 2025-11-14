/**
 * DMst Examples Smoke Test
 *
 * Quick validation that all 10 DMst examples can:
 * - Parse without errors
 * - Build CFG without errors
 * - Pass basic verification
 *
 * This is a faster smoke test before running comprehensive validation.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from '../../src/core/parser/parser';
import { buildCFG } from '../../src/core/cfg/builder';
import { verifyProtocol } from '../../src/core/verification/verifier';

const DMST_EXAMPLES_DIR = join(__dirname, '../../examples/dmst');

describe('DMst Examples Smoke Test', () => {
  const exampleFiles = readdirSync(DMST_EXAMPLES_DIR)
    .filter(f => f.endsWith('.smpst'))
    .sort();

  it('should have 10 example files', () => {
    expect(exampleFiles.length).toBe(10);
  });

  exampleFiles.forEach((filename) => {
    describe(filename, () => {
      const filePath = join(DMST_EXAMPLES_DIR, filename);
      const source = readFileSync(filePath, 'utf-8');

      it('should parse without errors', () => {
        expect(() => parse(source)).not.toThrow();
      });

      it('should build CFG without errors', () => {
        const module = parse(source);
        expect(() => buildCFG(module)).not.toThrow();
      });

      it('should pass verification', () => {
        const module = parse(source);
        const cfg = buildCFG(module);
        const result = verifyProtocol(cfg);

        if (!result.isValid) {
          console.error(`Verification errors for ${filename}:`, result.errors);
        }

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('Coverage Summary', () => {
    it('should cover all DMst features', () => {
      const allSources = exampleFiles.map(f =>
        readFileSync(join(DMST_EXAMPLES_DIR, f), 'utf-8')
      ).join('\n');

      expect(allSources).toContain('new role');
      expect(allSources).toContain('creates');
      expect(allSources).toContain('invites');
      expect(allSources).toContain('calls');
      expect(allSources).toContain('continue');
      expect(allSources).toContain('with');
      expect(allSources).toContain('choice');
    });
  });
});
