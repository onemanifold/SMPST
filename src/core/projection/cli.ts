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
import { projectToLocalProtocols, projectForRole } from './ast-projector';
import { serializeLocalProtocol } from '../serializer/local-serializer';
import type { GlobalProtocolDeclaration } from '../ast/types';

// ============================================================================
// CLI Configuration
// ============================================================================

interface CLIOptions {
  inputFile?: string;
  stdin: boolean;
  role?: string;
  outputDir?: string;
  format: 'text' | 'json' | 'both';
  help: boolean;
}

// ============================================================================
// Main CLI Logic
// ============================================================================

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    stdin: false,
    format: 'text',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--stdin') {
      options.stdin = true;
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
// Projection Handlers
// ============================================================================

function projectSingleRole(
  globalProtocol: GlobalProtocolDeclaration,
  role: string,
  options: CLIOptions
) {
  const localProtocol = projectForRole(globalProtocol, role);

  console.log(`\n📝 Local Protocol for: ${role}`);
  console.log('─'.repeat(80));

  // Output based on format
  if (options.format === 'text' || options.format === 'both') {
    const text = serializeLocalProtocol(localProtocol);

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
    const json = JSON.stringify(localProtocol, null, 2);

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
  console.log(`  Interactions: ${localProtocol.body.length}`);
  console.log(`  Actions: ${countActions(localProtocol.body)}`);
}

function projectAllRoles(
  globalProtocol: GlobalProtocolDeclaration,
  options: CLIOptions
) {
  const result = projectToLocalProtocols(globalProtocol);

  if (result.errors.length > 0) {
    console.error('⚠️  Projection errors:');
    for (const error of result.errors) {
      console.error(`  - ${error.role}: ${error.message}`);
    }
    console.error('');
  }

  // Process each role
  for (const [role, localProtocol] of result.localProtocols) {
    console.log(`\n📝 Local Protocol for: ${role}`);
    console.log('─'.repeat(80));

    // Output based on format
    if (options.format === 'text' || options.format === 'both') {
      const text = serializeLocalProtocol(localProtocol);

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
      const json = JSON.stringify(localProtocol, null, 2);

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
    const actionCount = countActions(localProtocol.body);
    console.log(`  Interactions: ${localProtocol.body.length}, Actions: ${actionCount}`);
  }

  // Summary
  console.log('');
  console.log('─'.repeat(80));
  console.log('Summary:');
  console.log(`  Total roles projected: ${result.localProtocols.size}`);
  console.log(`  Roles: ${Array.from(result.localProtocols.keys()).join(', ')}`);

  if (options.outputDir) {
    console.log(`  Output directory: ${options.outputDir}`);
  }
}

// ============================================================================
// Utilities
// ============================================================================

function countActions(body: any[]): number {
  let count = 0;

  function traverse(interactions: any[]): void {
    for (const interaction of interactions) {
      if (interaction.type === 'Send' || interaction.type === 'Receive') {
        count++;
      } else if (interaction.type === 'LocalChoice') {
        for (const branch of interaction.branches) {
          traverse(branch.body);
        }
      } else if (interaction.type === 'Recursion') {
        traverse(interaction.body);
      } else if (interaction.type === 'LocalParallel') {
        for (const branch of interaction.branches) {
          traverse(branch.body);
        }
      }
    }
  }

  traverse(body);
  return count;
}

// ============================================================================
// Entry Point
// ============================================================================

main();
