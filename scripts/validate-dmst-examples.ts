#!/usr/bin/env ts-node
/**
 * DMst Examples Validation Script
 *
 * Validates all DMst example protocols:
 * - Parses each example
 * - Builds CFG
 * - Runs verification
 * - Checks trace equivalence
 * - Reports results
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from '../src/parser/parser.js';
import { buildCFG } from '../src/core/cfg/cfg-builder.js';
import { verifyProtocol } from '../src/core/verification/verify.js';
import { project } from '../src/core/projection/project.js';
import { verifyTraceEquivalence } from '../src/core/verification/dmst/trace-equivalence.js';
import { checkSafeProtocolUpdate } from '../src/core/verification/dmst/safe-update.js';

interface ValidationResult {
  file: string;
  success: boolean;
  parse: boolean;
  cfg: boolean;
  verify: boolean;
  project: boolean;
  traceEquiv: boolean;
  safeUpdate?: boolean;
  error?: string;
}

function validateExample(filePath: string): ValidationResult {
  const file = filePath.split('/').pop() || filePath;
  const result: ValidationResult = {
    file,
    success: false,
    parse: false,
    cfg: false,
    verify: false,
    project: false,
    traceEquiv: false,
  };

  try {
    // 1. Parse
    const source = readFileSync(filePath, 'utf-8');
    const ast = parse(source);
    result.parse = true;

    // 2. Build CFG
    const cfg = buildCFG(ast);
    result.cfg = true;

    // 3. Verify protocol
    const verifyResult = verifyProtocol(cfg);
    result.verify = verifyResult.isValid && verifyResult.errors.length === 0;

    if (!result.verify) {
      result.error = verifyResult.errors.map(e => e.message).join('; ');
      return result;
    }

    // 4. Project to CFSMs
    const projections = new Map();
    try {
      cfg.roles.forEach((role: string) => {
        const cfsm = project(cfg, role);
        projections.set(role, cfsm);
      });
      result.project = true;
    } catch (projError) {
      result.error = `Projection failed: ${projError}`;
      return result;
    }

    // 5. Trace equivalence
    try {
      const traceResult = verifyTraceEquivalence(cfg, projections);
      result.traceEquiv = traceResult.isEquivalent;
      if (!result.traceEquiv) {
        result.error = `Trace equivalence failed: ${traceResult.reason}`;
      }
    } catch (traceError) {
      result.error = `Trace equivalence check failed: ${traceError}`;
      return result;
    }

    // 6. Safe update check (if applicable)
    if (source.includes('continue') && source.includes('with')) {
      try {
        const safeUpdateResult = checkSafeProtocolUpdate(cfg);
        result.safeUpdate = safeUpdateResult.isSafe;
        if (!result.safeUpdate) {
          result.error = `Safe update failed: ${safeUpdateResult.violations.length} violations`;
        }
      } catch (updateError) {
        result.error = `Safe update check failed: ${updateError}`;
        return result;
      }
    }

    result.success = result.parse && result.cfg && result.verify &&
                     result.project && result.traceEquiv &&
                     (result.safeUpdate === undefined || result.safeUpdate);

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

function main() {
  const examplesDir = join(__dirname, '../examples/dmst');
  const files = readdirSync(examplesDir)
    .filter(f => f.endsWith('.smpst'))
    .sort();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         DMst Examples Validation Report                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const results: ValidationResult[] = [];

  files.forEach(file => {
    const filePath = join(examplesDir, file);
    const result = validateExample(filePath);
    results.push(result);
  });

  // Print summary table
  console.log('┌────────────────────────────────┬───────┬───────┬────────┬─────────┬───────────┬────────────┐');
  console.log('│ Example                        │ Parse │ CFG   │ Verify │ Project │ Trace Eq. │ Safe Upd.  │');
  console.log('├────────────────────────────────┼───────┼───────┼────────┼─────────┼───────────┼────────────┤');

  results.forEach(r => {
    const name = r.file.replace('.smpst', '').padEnd(30);
    const parse = r.parse ? '  ✓  ' : '  ✗  ';
    const cfg = r.cfg ? '  ✓  ' : '  ✗  ';
    const verify = r.verify ? '  ✓   ' : '  ✗   ';
    const project = r.project ? '  ✓    ' : '  ✗    ';
    const traceEq = r.traceEquiv ? '  ✓      ' : '  ✗      ';
    const safeUpd = r.safeUpdate === undefined ? '    N/A    ' :
                    r.safeUpdate ? '     ✓     ' : '     ✗     ';

    console.log(`│ ${name} │ ${parse}│ ${cfg}│ ${verify}│ ${project}│ ${traceEq}│ ${safeUpd}│`);
  });

  console.log('└────────────────────────────────┴───────┴───────┴────────┴─────────┴───────────┴────────────┘\n');

  // Print detailed errors
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('\n⚠️  Failures Details:\n');
    failures.forEach(r => {
      console.log(`❌ ${r.file}:`);
      console.log(`   ${r.error}\n`);
    });
  }

  // Print summary
  const passCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const passRate = ((passCount / totalCount) * 100).toFixed(1);

  console.log('\n┌──────────────────────────────────────────────────────┐');
  console.log('│                  Summary                             │');
  console.log('├──────────────────────────────────────────────────────┤');
  console.log(`│  Total Examples:     ${String(totalCount).padStart(2)}                              │`);
  console.log(`│  Passing:            ${String(passCount).padStart(2)}                              │`);
  console.log(`│  Failing:            ${String(totalCount - passCount).padStart(2)}                              │`);
  console.log(`│  Pass Rate:          ${passRate}%                           │`);
  console.log('└──────────────────────────────────────────────────────┘\n');

  if (passCount === totalCount) {
    console.log('✅ All DMst examples validated successfully!\n');
    process.exit(0);
  } else {
    console.log('❌ Some examples failed validation.\n');
    process.exit(1);
  }
}

main();
