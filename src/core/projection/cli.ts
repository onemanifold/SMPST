#!/usr/bin/env node
/**
 * CLI utility for local protocol projection
 *
 * Projects global protocols to local protocols following formal MPST rules.
 *
 * Usage:
 *   npm run project <file.scr> [options]
 *   npm run project -- --stdin [options]
 *
 * Options:
 *   --role <name>         Project for a specific role only
 *   --output-dir <dir>    Save local protocols to directory (one file per role)
 *   --format <fmt>        Output format: text (default), json, or both
 *   --stdin               Read from standard input
 *   --help                Show this help message
 *
 * Examples:
 *   npm run project examples/two-phase.scr
 *   npm run project examples/two-phase.scr --role Client
 *   npm run project examples/two-phase.scr --output-dir ./local-protocols
 *   npm run project examples/two-phase.scr --format json
 *   echo "protocol Test(role A, role B) { A -> B: Msg(); }" | npm run project -- --stdin
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '../parser/parser';
import { buildCFG } from '../cfg/builder';
import { verifyProtocol } from '../verification/verifier';
import { projectAll, project } from './projector';
import { serializeCFSM } from '../serializer/cfsm-serializer';
import type { GlobalProtocolDeclaration } from '../ast/types';
import type { CompleteVerification } from '../verification/types';

// ============================================================================
// CLI Configuration
// ============================================================================

interface CLIOptions {
  inputFile?: string;
  stdin: boolean;
  role?: string;
  outputDir?: string;
  format: 'text' | 'json' | 'both';
  skipVerification: boolean;
  help: boolean;
}

// ============================================================================
// Main CLI Logic
// ============================================================================

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    stdin: false,
    format: 'text',
    skipVerification: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--stdin') {
      options.stdin = true;
    } else if (arg === '--skip-verification') {
      options.skipVerification = true;
    } else if (arg === '--role' || arg === '-r') {
      options.role = args[++i];
    } else if (arg === '--output-dir' || arg === '-o') {
      options.outputDir = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      const fmt = args[++i];
      if (fmt !== 'text' && fmt !== 'json' && fmt !== 'both') {
        console.error(`Error: Invalid format "${fmt}". Must be: text, json, or both`);
        process.exit(1);
      }
      options.format = fmt;
    } else if (!arg.startsWith('-')) {
      options.inputFile = arg;
    } else {
      console.error(`Error: Unknown option "${arg}"`);
      showHelp();
      process.exit(1);
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Scribble Local Protocol Projection CLI

Projects global protocols to local protocols following formal MPST rules.

USAGE:
  npm run project <file.scr> [options]
  npm run project -- --stdin [options]

OPTIONS:
  --role <name>         Project for a specific role only
  --output-dir <dir>    Save local protocols to directory (one file per role)
  --format <fmt>        Output format: text (default), json, or both
  --stdin               Read from standard input
  --help, -h            Show this help message

OUTPUT FORMATS:
  text                  Scribble local protocol text (default)
  json                  JSON representation of local protocol AST
  both                  Both text and JSON output

EXAMPLES:
  # Project all roles to console
  npm run project examples/two-phase.scr

  # Project specific role
  npm run project examples/two-phase.scr --role Client

  # Save to files (creates Client.scr, Server.scr, etc.)
  npm run project examples/two-phase.scr --output-dir ./local-protocols

  # JSON output
  npm run project examples/two-phase.scr --format json

  # Read from stdin
  echo "protocol Test(role A, role B) { A -> B: Msg(); }" | npm run project -- --stdin

  # Combine options
  npm run project examples/two-phase.scr --role Server --output-dir ./out --format both

PROJECTION RULES:
  The CLI implements formal MPST projection rules:
  - Message passing: sender/receiver/tau-elimination
  - Choice: internal (select) vs external (offer)
  - Recursion: structure preservation
  - Parallel: concurrent composition

REFERENCES:
  See docs/LOCAL_PROTOCOL_PROJECTION.md for formal specification
`);
}

function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options = parseArgs(args);

  // Show help if requested or no input
  if (options.help || (args.length === 0)) {
    showHelp();
    process.exit(options.help ? 0 : 1);
  }

  // Validate input
  if (!options.stdin && !options.inputFile) {
    console.error('Error: No input file specified. Use --stdin or provide a file path.');
    showHelp();
    process.exit(1);
  }

  // Read input
  let source: string;
  let filename: string;

  try {
    if (options.stdin) {
      source = fs.readFileSync(0, 'utf-8');
      filename = '<stdin>';
    } else {
      filename = options.inputFile!;
      if (!fs.existsSync(filename)) {
        console.error(`Error: File not found: ${filename}`);
        process.exit(1);
      }
      source = fs.readFileSync(filename, 'utf-8');
    }
  } catch (error: any) {
    console.error(`Error reading input: ${error.message}`);
    process.exit(1);
  }

  // Parse global protocol
  console.log(`📖 Parsing: ${filename}`);
  console.log('═'.repeat(80));

  let ast;
  try {
    ast = parse(source);
  } catch (error: any) {
    console.error('✗ Parse failed!');
    console.error('');
    console.error('Error:', error.message);
    process.exit(1);
  }

  // Find global protocol declaration
  const globalProtocol = ast.declarations.find(
    d => d.type === 'GlobalProtocolDeclaration'
  ) as GlobalProtocolDeclaration | undefined;

  if (!globalProtocol) {
    console.error('Error: No global protocol declaration found in input.');
    console.error('Hint: Make sure your protocol starts with "protocol Name(...)"');
    process.exit(1);
  }

  console.log(`✓ Parse successful!`);
  console.log(`  Protocol: ${globalProtocol.name}`);
  console.log(`  Roles: ${globalProtocol.roles.map(r => r.name).join(', ')}`);
  console.log('');

  // Project
  console.log('🔄 Projecting to local protocols...');
  console.log('─'.repeat(80));

  try {
    if (options.role) {
      // Project single role
      projectSingleRole(globalProtocol, options.role, options);
    } else {
      // Project all roles
      projectAllRoles(globalProtocol, options);
    }
  } catch (error: any) {
    console.error('✗ Projection failed!');
    console.error('');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('✓ Projection complete!');
}

// ============================================================================
// Verification
// ============================================================================

function runVerification(cfg: any, skipVerification: boolean): boolean {
  if (skipVerification) {
    console.log('⏭️  Skipping verification (--skip-verification)');
    return true;
  }

  console.log('🔍 Verifying protocol correctness...');
  console.log('─'.repeat(80));

  const verification = verifyProtocol(cfg);

  // Check for critical errors
  const criticalErrors = [];

  if (verification.deadlock.hasDeadlock) {
    criticalErrors.push(`Deadlock detected: ${verification.deadlock.cycles.length} cycle(s)`);
  }

  if (!verification.liveness.isLive) {
    criticalErrors.push(`Liveness violation: ${verification.liveness.violations.length} violation(s)`);
  }

  if (verification.parallelDeadlock.hasDeadlock) {
    criticalErrors.push(`Parallel deadlock: ${verification.parallelDeadlock.conflicts.length} conflict(s)`);
  }

  if (verification.raceConditions.hasRaces) {
    console.log(`⚠️  Warning: Race conditions detected (${verification.raceConditions.races.length})`);
  }

  if (!verification.selfCommunication.isValid) {
    criticalErrors.push(`Self-communication detected: ${verification.selfCommunication.violations.length} violation(s)`);
  }

  if (criticalErrors.length > 0) {
    console.log('✗ Verification failed!');
    console.log('');
    for (const error of criticalErrors) {
      console.error(`  ❌ ${error}`);
    }
    console.log('');
    return false;
  }

  console.log('✓ Verification passed!');
  console.log('');
  return true;
}

// ============================================================================
// Projection Handlers
// ============================================================================

function projectSingleRole(
  globalProtocol: GlobalProtocolDeclaration,
  role: string,
  options: CLIOptions
) {
  // NEW PIPELINE: Global → CFG → Verification → CFSM → Scribble
  const cfg = buildCFG(globalProtocol);

  if (!runVerification(cfg, options.skipVerification)) {
    process.exit(1);
  }

  const cfsm = project(cfg, role);

  console.log(`\n📝 Local Protocol for: ${role}`);
  console.log('─'.repeat(80));

  // Output based on format
  if (options.format === 'text' || options.format === 'both') {
    const text = serializeCFSM(cfsm);

    if (options.outputDir) {
      // Save to file
      const outputPath = path.join(options.outputDir, `${role}.scr`);
      fs.mkdirSync(options.outputDir, { recursive: true });
      fs.writeFileSync(outputPath, text, 'utf-8');
      console.log(`💾 Saved to: ${outputPath}`);
    } else {
      // Print to console
      console.log(text);
    }
  }

  if (options.format === 'json' || options.format === 'both') {
    const json = JSON.stringify(cfsm, null, 2);

    if (options.outputDir) {
      // Save to file
      const outputPath = path.join(options.outputDir, `${role}.json`);
      fs.mkdirSync(options.outputDir, { recursive: true });
      fs.writeFileSync(outputPath, json, 'utf-8');
      console.log(`💾 Saved JSON to: ${outputPath}`);
    } else {
      // Print to console
      console.log(json);
    }
  }

  // Statistics
  console.log('');
  console.log(`  States: ${cfsm.states.length}`);
  console.log(`  Transitions: ${cfsm.transitions.length}`);
  const protocolActions = cfsm.transitions.filter(
    t => t.action.type === 'send' || t.action.type === 'receive'
  );
  console.log(`  Protocol Actions: ${protocolActions.length}`);
}

function projectAllRoles(
  globalProtocol: GlobalProtocolDeclaration,
  options: CLIOptions
) {
  // NEW PIPELINE: Global → CFG → Verification → CFSMs → Scribble
  const cfg = buildCFG(globalProtocol);

  if (!runVerification(cfg, options.skipVerification)) {
    process.exit(1);
  }

  const result = projectAll(cfg);

  if (result.errors.length > 0) {
    console.error('⚠️  Projection errors:');
    for (const error of result.errors) {
      console.error(`  - ${error.role}: ${error.message}`);
    }
    console.error('');
  }

  // Process each role
  for (const [role, cfsm] of result.cfsms) {
    console.log(`\n📝 Local Protocol for: ${role}`);
    console.log('─'.repeat(80));

    // Output based on format
    if (options.format === 'text' || options.format === 'both') {
      const text = serializeCFSM(cfsm);

      if (options.outputDir) {
        // Save to file
        const outputPath = path.join(options.outputDir, `${role}.scr`);
        fs.mkdirSync(options.outputDir, { recursive: true });
        fs.writeFileSync(outputPath, text, 'utf-8');
        console.log(`💾 Saved to: ${outputPath}`);
      } else {
        // Print to console
        console.log(text);
      }
    }

    if (options.format === 'json' || options.format === 'both') {
      const json = JSON.stringify(cfsm, null, 2);

      if (options.outputDir) {
        // Save to file
        const outputPath = path.join(options.outputDir, `${role}.json`);
        fs.mkdirSync(options.outputDir, { recursive: true });
        fs.writeFileSync(outputPath, json, 'utf-8');
        console.log(`💾 Saved JSON to: ${outputPath}`);
      } else if (options.format === 'json') {
        // Only print JSON if format is explicitly json (not both)
        console.log(json);
      }
    }

    // Statistics
    const protocolActions = cfsm.transitions.filter(
      t => t.action.type === 'send' || t.action.type === 'receive'
    );
    console.log(`  States: ${cfsm.states.length}, Transitions: ${cfsm.transitions.length}, Actions: ${protocolActions.length}`);
  }

  // Summary
  console.log('');
  console.log('─'.repeat(80));
  console.log('Summary:');
  console.log(`  Total roles projected: ${result.cfsms.size}`);
  console.log(`  Roles: ${Array.from(result.cfsms.keys()).join(', ')}`);

  if (options.outputDir) {
    console.log(`  Output directory: ${options.outputDir}`);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

main();
