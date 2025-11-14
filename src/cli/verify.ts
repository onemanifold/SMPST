#!/usr/bin/env node
/**
 * CLI utility for verifying protocol safety properties
 *
 * Runs comprehensive verification checks on Scribble protocols.
 *
 * Usage:
 *   npm run verify <file.scr> [options]
 *   npm run verify -- --stdin [options]
 *
 * Options:
 *   --checks <list>   Comma-separated checks to run (default: all)
 *   --format <fmt>    Output format: json, text (default)
 *   --output <file>   Save output to file
 *   --stdin           Read from standard input
 *   --strict          Fail on warnings too
 *   --help            Show this help message
 *
 * Examples:
 *   npm run verify examples/two-phase.scr
 *   npm run verify examples/two-phase.scr --checks deadlock,liveness
 *   npm run verify examples/two-phase.scr --format json
 *   npm run verify examples/two-phase.scr --strict
 */

import { parse } from '../core/parser/parser';
import { buildCFG } from '../core/cfg/builder';
import { verifyProtocol } from '../core/verification/verifier';
import type { GlobalProtocolDeclaration } from '../core/ast/types';
import type { CompleteVerification, VerificationOptions } from '../core/verification/types';
import {
  readInput,
  writeOutput,
  handleError,
  printHeader,
  printDivider,
  printSuccess,
  printInfo,
  parseCommonArgs,
  type CLIOptions,
} from './shared';

// ============================================================================
// Extended Options
// ============================================================================

interface VerifyCLIOptions extends CLIOptions {
  checks?: string;
  strict?: boolean;
}

// ============================================================================
// Verification Output Formatting
// ============================================================================

function formatVerificationText(result: CompleteVerification, strict: boolean): string {
  const lines: string[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  lines.push('Verification Report');
  lines.push('═'.repeat(80));
  lines.push('');

  // Deadlock Detection
  lines.push('🔍 Deadlock Detection');
  lines.push('─'.repeat(80));
  if (result.deadlock.hasDeadlock) {
    lines.push(`❌ FAILED: ${result.deadlock.cycles.length} deadlock cycle(s) detected`);
    totalErrors++;
    for (const cycle of result.deadlock.cycles) {
      lines.push(`   ${cycle.description}`);
    }
  } else {
    lines.push('✅ PASSED: No deadlocks detected');
  }
  lines.push('');

  // Liveness
  lines.push('🔍 Liveness Checking');
  lines.push('─'.repeat(80));
  if (!result.liveness.isLive) {
    lines.push(`❌ FAILED: ${result.liveness.violations.length} liveness violation(s)`);
    totalErrors++;
    for (const violation of result.liveness.violations) {
      lines.push(`   ${violation.description}`);
    }
  } else {
    lines.push('✅ PASSED: Protocol is live');
  }
  lines.push('');

  // Parallel Deadlock
  lines.push('🔍 Parallel Deadlock Detection');
  lines.push('─'.repeat(80));
  if (result.parallelDeadlock.hasDeadlock) {
    lines.push(`❌ FAILED: ${result.parallelDeadlock.conflicts.length} parallel conflict(s)`);
    totalErrors++;
    for (const conflict of result.parallelDeadlock.conflicts) {
      lines.push(`   ${conflict.description}`);
    }
  } else {
    lines.push('✅ PASSED: No parallel deadlocks');
  }
  lines.push('');

  // Race Conditions
  lines.push('🔍 Race Condition Detection');
  lines.push('─'.repeat(80));
  if (result.raceConditions.hasRaces) {
    lines.push(`❌ FAILED: ${result.raceConditions.races.length} race condition(s)`);
    totalErrors++;
    for (const race of result.raceConditions.races) {
      lines.push(`   ${race.description}`);
    }
  } else {
    lines.push('✅ PASSED: No race conditions');
  }
  lines.push('');

  // Progress
  lines.push('🔍 Progress Checking');
  lines.push('─'.repeat(80));
  if (!result.progress.canProgress) {
    lines.push(`❌ FAILED: Protocol cannot make progress`);
    totalErrors++;
    if (result.progress.description) {
      lines.push(`   ${result.progress.description}`);
    }
  } else {
    lines.push('✅ PASSED: Protocol can make progress');
  }
  lines.push('');

  // Choice Determinism (P0 - Critical)
  lines.push('🔍 Choice Determinism (P0 - Projection Critical)');
  lines.push('─'.repeat(80));
  if (!result.choiceDeterminism.isDeterministic) {
    lines.push(`❌ FAILED: ${result.choiceDeterminism.violations.length} determinism violation(s)`);
    totalErrors++;
    for (const violation of result.choiceDeterminism.violations) {
      lines.push(`   ${violation.description}`);
    }
  } else {
    lines.push('✅ PASSED: All choices are deterministic');
  }
  lines.push('');

  // Choice Mergeability (P0 - Critical)
  lines.push('🔍 Choice Mergeability (P0 - Projection Critical)');
  lines.push('─'.repeat(80));
  if (!result.choiceMergeability.isMergeable) {
    lines.push(`❌ FAILED: ${result.choiceMergeability.violations.length} mergeability violation(s)`);
    totalErrors++;
    for (const violation of result.choiceMergeability.violations) {
      lines.push(`   ${violation.description}`);
    }
  } else {
    lines.push('✅ PASSED: All choices are mergeable');
  }
  lines.push('');

  // Connectedness (P0 - Critical)
  lines.push('🔍 Connectedness (P0 - Projection Critical)');
  lines.push('─'.repeat(80));
  if (!result.connectedness.isConnected) {
    lines.push(`❌ FAILED: Protocol has disconnected roles`);
    totalErrors++;
    if (result.connectedness.description) {
      lines.push(`   ${result.connectedness.description}`);
    }
    if (result.connectedness.orphanedRoles.length > 0) {
      lines.push(`   Orphaned roles: ${result.connectedness.orphanedRoles.join(', ')}`);
    }
  } else {
    lines.push('✅ PASSED: All roles are connected');
  }
  lines.push('');

  // Nested Recursion (P1 - High)
  lines.push('🔍 Nested Recursion Validation (P1 - High Priority)');
  lines.push('─'.repeat(80));
  if (!result.nestedRecursion.isValid) {
    lines.push(`❌ FAILED: ${result.nestedRecursion.violations.length} recursion violation(s)`);
    totalErrors++;
    for (const violation of result.nestedRecursion.violations) {
      lines.push(`   ${violation.description}`);
    }
  } else {
    lines.push('✅ PASSED: Recursion is properly nested');
  }
  lines.push('');

  // Recursion in Parallel (P1 - High)
  lines.push('🔍 Recursion in Parallel (P1 - High Priority)');
  lines.push('─'.repeat(80));
  if (!result.recursionInParallel.isValid) {
    lines.push(`❌ FAILED: ${result.recursionInParallel.violations.length} recursion-parallel violation(s)`);
    totalErrors++;
    for (const violation of result.recursionInParallel.violations) {
      lines.push(`   ${violation.description}`);
    }
  } else {
    lines.push('✅ PASSED: No recursion crossing parallel boundaries');
  }
  lines.push('');

  // Fork-Join Structure (P1 - High)
  lines.push('🔍 Fork-Join Structure (P1 - High Priority)');
  lines.push('─'.repeat(80));
  if (!result.forkJoinStructure.isValid) {
    lines.push(`❌ FAILED: ${result.forkJoinStructure.violations.length} fork-join violation(s)`);
    totalErrors++;
    for (const violation of result.forkJoinStructure.violations) {
      lines.push(`   ${violation.description}`);
    }
  } else {
    lines.push('✅ PASSED: All fork-join pairs match correctly');
  }
  lines.push('');

  // Multicast (P2 - Medium - Warnings Only)
  lines.push('🔍 Multicast Detection (P2 - Medium Priority)');
  lines.push('─'.repeat(80));
  if (!result.multicast.isValid && result.multicast.warnings.length > 0) {
    lines.push(`⚠️  WARNING: ${result.multicast.warnings.length} multicast(s) detected`);
    totalWarnings++;
    for (const warning of result.multicast.warnings) {
      lines.push(`   ${warning.description}`);
    }
  } else {
    lines.push('✅ PASSED: No multicast communications');
  }
  lines.push('');

  // Self-Communication (P2 - Medium)
  lines.push('🔍 Self-Communication Detection (P2 - Medium Priority)');
  lines.push('─'.repeat(80));
  if (!result.selfCommunication.isValid) {
    lines.push(`❌ FAILED: ${result.selfCommunication.violations.length} self-communication(s)`);
    totalErrors++;
    for (const violation of result.selfCommunication.violations) {
      lines.push(`   ${violation.description}`);
    }
  } else {
    lines.push('✅ PASSED: No self-communication');
  }
  lines.push('');

  // Empty Choice Branch (P2 - Medium)
  lines.push('🔍 Empty Choice Branch Detection (P2 - Medium Priority)');
  lines.push('─'.repeat(80));
  if (!result.emptyChoiceBranch.isValid) {
    lines.push(`❌ FAILED: ${result.emptyChoiceBranch.violations.length} empty branch(es)`);
    totalErrors++;
    for (const violation of result.emptyChoiceBranch.violations) {
      lines.push(`   ${violation.description}`);
    }
  } else {
    lines.push('✅ PASSED: No empty choice branches');
  }
  lines.push('');

  // Merge Reachability (P3 - Structural)
  lines.push('🔍 Merge Reachability (P3 - Structural Correctness)');
  lines.push('─'.repeat(80));
  if (!result.mergeReachability.isValid) {
    lines.push(`❌ FAILED: ${result.mergeReachability.violations.length} merge violation(s)`);
    totalErrors++;
    for (const violation of result.mergeReachability.violations) {
      lines.push(`   ${violation.description}`);
    }
  } else {
    lines.push('✅ PASSED: All choice branches reach same merge point');
  }
  lines.push('');

  // Summary
  lines.push('═'.repeat(80));
  lines.push('Summary');
  lines.push('═'.repeat(80));
  lines.push(`Total Errors: ${totalErrors}`);
  lines.push(`Total Warnings: ${totalWarnings}`);
  lines.push('');

  const allPassed = totalErrors === 0 && (!strict || totalWarnings === 0);
  if (allPassed) {
    lines.push('🎉 ALL CHECKS PASSED! Protocol is safe.');
  } else {
    if (totalErrors > 0) {
      lines.push(`❌ VERIFICATION FAILED: ${totalErrors} error(s) detected`);
    }
    if (strict && totalWarnings > 0) {
      lines.push(`⚠️  WARNINGS TREATED AS ERRORS (--strict mode): ${totalWarnings} warning(s)`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Main CLI Logic
// ============================================================================

function parseArgs(args: string[]): VerifyCLIOptions {
  const baseOptions = parseCommonArgs(args) as VerifyCLIOptions;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--checks') {
      baseOptions.checks = args[++i];
    } else if (arg === '--strict') {
      baseOptions.strict = true;
    }
  }

  return baseOptions;
}

function showHelp(): void {
  console.log(`
Scribble Protocol Verification CLI

Runs comprehensive safety property verification on Scribble protocols.

USAGE:
  npm run verify <file.scr> [options]
  npm run verify -- --stdin [options]

OPTIONS:
  --checks <list>   Comma-separated checks (default: all)
  --format <fmt>    Output format: text (default), json
  --output <file>   Save output to file
  --strict          Treat warnings as errors
  --stdin           Read from standard input
  --help, -h        Show this help message

AVAILABLE CHECKS:
  all               All verification checks (default)
  deadlock          Deadlock detection (cycle detection)
  liveness          Liveness checking (progress guarantee)
  parallel          Parallel deadlock detection
  race              Race condition detection
  progress          Progress checking
  determinism       Choice determinism (P0 - projection critical)
  mergeability      Choice mergeability (P0 - projection critical)
  connectedness     Role connectedness (P0 - projection critical)
  recursion         Nested recursion validation (P1)
  recursion-parallel Recursion in parallel (P1)
  fork-join         Fork-join structure (P1)
  multicast         Multicast detection (P2 - warnings)
  self-comm         Self-communication detection (P2)
  empty-branch      Empty choice branch detection (P2)
  merge-reach       Merge reachability (P3)

EXAMPLES:
  # Run all checks
  npm run verify examples/two-phase.scr

  # Run specific checks only
  npm run verify examples/two-phase.scr --checks deadlock,liveness

  # JSON output for programmatic use
  npm run verify examples/two-phase.scr --format json

  # Strict mode (warnings become errors)
  npm run verify examples/two-phase.scr --strict

  # Save to file
  npm run verify examples/two-phase.scr --output report.txt

  # Read from stdin
  echo "protocol Test(role A, role B) { A -> B: Msg(); }" | npm run verify -- --stdin

PRIORITY LEVELS:
  P0: Critical for projection (determinism, mergeability, connectedness)
  P1: High priority (recursion, fork-join structure)
  P2: Medium priority (multicast, self-comm, empty branches)
  P3: Structural correctness (merge reachability)

EXIT CODES:
  0: All checks passed
  1: Verification failed (errors found)
  2: Invalid arguments or parse error

SEE ALSO:
  - npm run parse      - Parse Scribble protocols
  - npm run build-cfg  - Build Control Flow Graph
  - npm run project    - Project to local protocols
`);
}

function main(): void {
  const args = process.argv.slice(2);

  // Parse arguments
  const options = parseArgs(args);

  // Show help if requested or no input
  if (options.help || args.length === 0) {
    showHelp();
    process.exit(options.help ? 0 : 1);
  }

  // Read input
  const { source, filename } = readInput(options);

  console.log(`📖 Parsing: ${filename}`);
  printDivider();

  // Parse
  let ast;
  try {
    ast = parse(source);
  } catch (error: any) {
    handleError(error, 'Parse');
  }

  // Find global protocol
  const globalProtocol = ast.declarations.find(
    (d) => d.type === 'GlobalProtocolDeclaration'
  ) as GlobalProtocolDeclaration | undefined;

  if (!globalProtocol) {
    console.error('Error: No global protocol declaration found in input.');
    process.exit(1);
  }

  printSuccess('Parse successful!');
  printInfo('Protocol', globalProtocol.name);
  printInfo('Roles', globalProtocol.roles.map((r) => r.name).join(', '));
  console.log('');

  // Build CFG
  console.log('🔨 Building Control Flow Graph...');
  printDivider();

  let cfg;
  try {
    cfg = buildCFG(globalProtocol);
  } catch (error: any) {
    handleError(error, 'CFG Build');
  }

  printSuccess('CFG built successfully!');
  console.log('');

  // Verify
  console.log('🔍 Running Verification...');
  printDivider();
  console.log('');

  let result: CompleteVerification;
  try {
    // TODO: Parse --checks option to create custom VerificationOptions
    result = verifyProtocol(cfg);
  } catch (error: any) {
    handleError(error, 'Verification');
  }

  // Format output
  let output: string;
  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2);
  } else {
    output = formatVerificationText(result, options.strict || false);
  }

  if (options.output) {
    writeOutput(output, options.output);
    console.log('');
  } else {
    console.log(output);
  }

  // Exit code based on results
  const hasErrors =
    result.deadlock.hasDeadlock ||
    !result.liveness.isLive ||
    result.parallelDeadlock.hasDeadlock ||
    result.raceConditions.hasRaces ||
    !result.progress.canProgress ||
    !result.choiceDeterminism.isDeterministic ||
    !result.choiceMergeability.isMergeable ||
    !result.connectedness.isConnected ||
    !result.nestedRecursion.isValid ||
    !result.recursionInParallel.isValid ||
    !result.forkJoinStructure.isValid ||
    !result.selfCommunication.isValid ||
    !result.emptyChoiceBranch.isValid ||
    !result.mergeReachability.isValid;

  const hasWarnings = !result.multicast.isValid;

  if (hasErrors || (options.strict && hasWarnings)) {
    process.exit(1);
  }

  process.exit(0);
}

// ============================================================================
// Entry Point
// ============================================================================

main();
