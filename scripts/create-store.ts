#!/usr/bin/env tsx
/**
 * Code Generator: Create Store with Backend Contract Enforcement
 *
 * Usage: npm run create:store <store-name> <backend-module>
 * Example: npm run create:store verification core/verification/verifier
 *
 * This generates:
 * 1. Store with contract enforcement
 * 2. Contract tests that force faithful implementation
 * 3. Prevents future sessions from forgetting contracts
 */

import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npm run create:store <store-name> <backend-module>');
  console.error('Example: npm run create:store verification core/verification/verifier');
  process.exit(1);
}

const [storeName, backendModule] = args;

// Template for store with contract enforcement
const storeTemplate = `/**
 * ${capitalize(storeName)} Store - With Contract Enforcement
 *
 * This store faithfully implements backend from: ${backendModule}
 * All backend return values MUST be handled via contract handlers.
 */
import { writable, derived, get } from 'svelte/store';
import type { /* TODO: Import backend types */ } from '../../${backendModule}';
import { handleStepResult } from './contracts/backend-contract';

// TODO: Define store state
export const ${storeName}State = writable<any>(null);
export const ${storeName}Error = writable<any>(null);

// TODO: Add backend interaction functions using contract handlers
// Example:
// export function perform${capitalize(storeName)}Action() {
//   const result = backendInstance.someMethod();
//   handleStepResult(result, {
//     onSuccess: (state, event) => {
//       ${storeName}State.set(state);
//       ${storeName}Error.set(null);
//     },
//     onError: (error, state) => {
//       ${storeName}State.set(state);
//       ${storeName}Error.set(error);
//     }
//   });
// }

// TODO: Add derived stores
export const has${capitalize(storeName)}Error = derived(
  ${storeName}Error,
  $error => $error !== null
);
`;

// Template for test suite
const testTemplate = `/**
 * ${capitalize(storeName)} Store Tests - Contract Enforcement
 *
 * These tests GUARANTEE faithful backend implementation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  ${storeName}State,
  ${storeName}Error,
  has${capitalize(storeName)}Error,
  // TODO: Import functions to test
} from '../${storeName}';

describe('${capitalize(storeName)} Store - Backend Contract', () => {
  beforeEach(() => {
    // Reset state
  });

  describe('Success Path', () => {
    it('should handle successful backend response', () => {
      // TODO: Test that all success properties are exposed
      expect(true).toBe(true);
    });

    it('should clear previous errors on success', () => {
      // TODO: Verify errors are cleared
      expect(true).toBe(true);
    });
  });

  describe('Error Path', () => {
    it('should expose backend errors to UI', () => {
      // TODO: Test that errors are exposed
      expect(true).toBe(true);
    });

    it('should preserve state on error', () => {
      // TODO: Verify state is not corrupted
      expect(true).toBe(true);
    });
  });

  describe('Backend Contract Evolution', () => {
    it('should handle all backend return properties', () => {
      // TODO: Document what properties backend returns
      // If backend adds properties, this test MUST be updated
      expect(true).toBe(true);
    });
  });
});
`;

// Create files
const storeDir = path.join(process.cwd(), 'src/lib/stores');
const testDir = path.join(storeDir, '__tests__');

fs.mkdirSync(testDir, { recursive: true });

const storePath = path.join(storeDir, `${storeName}.ts`);
const testPath = path.join(testDir, `${storeName}.test.ts`);

if (fs.existsSync(storePath)) {
  console.error(`❌ Store already exists: ${storePath}`);
  process.exit(1);
}

fs.writeFileSync(storePath, storeTemplate);
fs.writeFileSync(testPath, testTemplate);

console.log(`✅ Created store with contract enforcement:`);
console.log(`   Store: ${storePath}`);
console.log(`   Tests: ${testPath}`);
console.log();
console.log(`📝 Next steps:`);
console.log(`   1. Edit ${storeName}.ts - implement backend interactions`);
console.log(`   2. Edit ${storeName}.test.ts - add contract tests`);
console.log(`   3. Run: npm run test:ui`);
console.log();
console.log(`⚠️  Remember: Tests MUST verify ALL backend return properties!`);

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
