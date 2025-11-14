/**
 * Golden Protocol Tests
 *
 * Regression tests using snapshot-based comparison of:
 * - CFG structure
 * - Verification results
 * - CFSM projections
 * - Local protocol serialization
 *
 * These tests ensure that language evolution doesn't break existing functionality.
 */

import { describe, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { GoldenTestRunner } from '../runner';
import type { GoldenTestMetadata } from '../runner';

// ============================================================================
// Test Configuration
// ============================================================================

const GOLDEN_DIR = path.join(__dirname, '..');
const METADATA_PATH = path.join(GOLDEN_DIR, 'metadata', 'protocols.json');

// Load all protocol metadata
const allMetadata: Record<string, GoldenTestMetadata> = JSON.parse(
  fs.readFileSync(METADATA_PATH, 'utf-8')
);

// ============================================================================
// Test Generator
// ============================================================================

function generateGoldenTests() {
  const runner = new GoldenTestRunner(GOLDEN_DIR);

  // Group tests by category
  const byCategory: Record<string, Array<[string, GoldenTestMetadata]>> = {};

  for (const [name, metadata] of Object.entries(allMetadata)) {
    const category = metadata.category;
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push([name, metadata as GoldenTestMetadata]);
  }

  // Generate test suites per category
  for (const [category, protocols] of Object.entries(byCategory)) {
    describe(`Golden Tests - ${category}`, () => {
      for (const [name, metadata] of protocols) {
        it(`${name}: ${metadata.description}`, async () => {
          const protocolPath = `protocols/${category}/${name}.scr`;
          await runner.runGoldenTest(protocolPath, metadata);
        });
      }
    });
  }
}

// ============================================================================
// Run Tests
// ============================================================================

generateGoldenTests();
