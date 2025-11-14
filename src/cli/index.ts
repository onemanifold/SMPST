#!/usr/bin/env node
/**
 * SMPST Unified CLI Entry Point
 *
 * Routes commands to specific CLI tools.
 *
 * Usage:
 *   npm run smpst <command> [args...]
 *
 * Commands:
 *   parse        - Parse Scribble protocols to AST
 *   build-cfg    - Build Control Flow Graph from protocol
 *   verify       - Verify protocol safety properties
 *   project      - Project global protocol to local protocols
 *   simulate     - Simulate protocol execution
 *   help         - Show this help message
 *
 * Examples:
 *   npm run smpst parse examples/two-phase.scr
 *   npm run smpst verify examples/two-phase.scr
 *   npm run smpst simulate examples/two-phase.scr
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Command Definitions
// ============================================================================

interface Command {
  name: string;
  description: string;
  scriptPath: string;
}

const COMMANDS: Command[] = [
  {
    name: 'parse',
    description: 'Parse Scribble protocols to AST',
    scriptPath: 'src/core/parser/cli.ts',
  },
  {
    name: 'build-cfg',
    description: 'Build Control Flow Graph from protocol',
    scriptPath: 'src/cli/build-cfg.ts',
  },
  {
    name: 'verify',
    description: 'Verify protocol safety properties',
    scriptPath: 'src/cli/verify.ts',
  },
  {
    name: 'project',
    description: 'Project global protocol to local protocols',
    scriptPath: 'src/core/projection/cli.ts',
  },
  {
    name: 'simulate',
    description: 'Simulate protocol execution',
    scriptPath: 'src/cli/simulate.ts',
  },
];

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                        SMPST - Unified CLI Tool                           ║
║                 Multiparty Session Types IDE (Command Line)               ║
╚═══════════════════════════════════════════════════════════════════════════╝

USAGE:
  npm run smpst <command> [args...]

AVAILABLE COMMANDS:
${COMMANDS.map(cmd => `  ${cmd.name.padEnd(15)} ${cmd.description}`).join('\n')}

COMMAND PIPELINE:

  Scribble Source
       ↓
  ┌─────────┐    npm run smpst parse <file.scr>
  │  Parse  │    → AST (Abstract Syntax Tree)
  └─────────┘
       ↓
  ┌─────────┐    npm run smpst build-cfg <file.scr>
  │Build CFG│    → Control Flow Graph
  └─────────┘
       ↓
  ┌─────────┐    npm run smpst verify <file.scr>
  │ Verify  │    → Safety Properties Check
  └─────────┘
       ↓
  ┌─────────┐    npm run smpst project <file.scr>
  │ Project │    → Local Protocols (per role)
  └─────────┘
       ↓
  ┌─────────┐    npm run smpst simulate <file.scr>
  │Simulate │    → Execution Trace
  └─────────┘

QUICK START EXAMPLES:

  # Parse and validate a protocol
  npm run smpst parse examples/request-response.scr

  # Verify safety properties
  npm run smpst verify examples/two-phase.scr

  # Project to local protocols
  npm run smpst project examples/buyer-seller-agency.scr --output-dir ./local

  # Simulate execution
  npm run smpst simulate examples/login-or-register.scr

  # Build CFG and export as DOT for visualization
  npm run smpst build-cfg examples/two-phase.scr --format dot | dot -Tpng > cfg.png

COMPLETE WORKFLOW:

  # 1. Parse
  npm run smpst parse protocol.scr

  # 2. Verify
  npm run smpst verify protocol.scr

  # 3. Project
  npm run smpst project protocol.scr --output-dir ./local

  # 4. Simulate
  npm run smpst simulate protocol.scr

GET HELP FOR SPECIFIC COMMANDS:

  npm run smpst parse --help
  npm run smpst build-cfg --help
  npm run smpst verify --help
  npm run smpst project --help
  npm run smpst simulate --help

COMMON OPTIONS (varies by command):

  --stdin           Read from standard input
  --format <fmt>    Output format (json, text, dot)
  --output <file>   Save output to file
  --help, -h        Show command-specific help

FOR MORE INFORMATION:

  Documentation: docs/CLI.md
  Examples: examples/
  Repository: https://github.com/onemanifold/SMPST
`);
}

// ============================================================================
// Command Router
// ============================================================================

function runCommand(commandName: string, args: string[]): void {
  const command = COMMANDS.find(cmd => cmd.name === commandName);

  if (!command) {
    console.error(`Error: Unknown command "${commandName}"`);
    console.error('');
    console.error('Available commands:');
    for (const cmd of COMMANDS) {
      console.error(`  ${cmd.name.padEnd(15)} ${cmd.description}`);
    }
    console.error('');
    console.error('Run "npm run smpst help" for more information.');
    process.exit(1);
  }

  // Resolve script path
  const projectRoot = path.resolve(__dirname, '../..');
  const scriptPath = path.join(projectRoot, command.scriptPath);

  // Execute the command using tsx
  const child = spawn('tsx', [scriptPath, ...args], {
    stdio: 'inherit',
    cwd: projectRoot,
  });

  child.on('error', (error) => {
    console.error(`Error executing command "${commandName}":`, error.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

// ============================================================================
// Main Entry Point
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);

  // No arguments - show help
  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const commandName = args[0];

  // Handle help command
  if (commandName === 'help' || commandName === '--help' || commandName === '-h') {
    showHelp();
    process.exit(0);
  }

  // Handle version command
  if (commandName === 'version' || commandName === '--version' || commandName === '-v') {
    console.log('SMPST CLI v0.1.0-alpha');
    process.exit(0);
  }

  // Route to specific command
  const commandArgs = args.slice(1);
  runCommand(commandName, commandArgs);
}

main();
