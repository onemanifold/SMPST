#!/usr/bin/env node
/**
 * CLI utility for simulating protocol execution
 *
 * Executes Scribble protocols and generates execution traces.
 *
 * Usage:
 *   npm run simulate <file.scr> [options]
 *   npm run simulate -- --stdin [options]
 *
 * Options:
 *   --mode <mode>         Simulation mode: cfg (default), cfsm, distributed
 *   --max-steps <n>       Maximum steps (default: 1000)
 *   --choice <strategy>   Choice strategy: manual, random, first (default: first)
 *   --format <fmt>        Output format: json, text (default)
 *   --output <file>       Save output to file
 *   --stdin               Read from standard input
 *   --help                Show this help message
 *
 * Examples:
 *   npm run simulate examples/two-phase.scr
 *   npm run simulate examples/two-phase.scr --max-steps 100
 *   npm run simulate examples/two-phase.scr --choice random
 *   npm run simulate examples/two-phase.scr --format json
 */

import { parse } from '../core/parser/parser';
import { buildCFG } from '../core/cfg/builder';
import { CFGSimulator } from '../core/simulation/cfg-simulator';
import type { GlobalProtocolDeclaration } from '../core/ast/types';
import type { CFGExecutionTrace, CFGExecutionEvent } from '../core/simulation/types';
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

interface SimulateCLIOptions extends CLIOptions {
  mode?: 'cfg' | 'cfsm' | 'distributed';
  maxSteps?: number;
  choice?: 'manual' | 'random' | 'first';
  role?: string;
}

// ============================================================================
// Trace Formatting
// ============================================================================

function formatTraceText(trace: CFGExecutionTrace, protocolName: string): string {
  const lines: string[] = [];

  lines.push(`Execution Trace: ${protocolName}`);
  lines.push('═'.repeat(80));
  lines.push('');

  // Summary
  const duration = trace.endTime && trace.startTime
    ? `${trace.endTime - trace.startTime}ms`
    : 'N/A';

  lines.push(`Status: ${trace.completed ? '✅ Completed' : '⏸️  Incomplete'}`);
  lines.push(`Total Steps: ${trace.totalSteps}`);
  lines.push(`Duration: ${duration}`);
  lines.push('');

  // Events
  lines.push('Execution Trace:');
  lines.push('─'.repeat(80));

  for (let i = 0; i < trace.events.length; i++) {
    const event = trace.events[i];
    const step = i + 1;

    lines.push(formatEvent(step, event));
  }

  if (trace.events.length === 0) {
    lines.push('(No events recorded)');
  }

  return lines.join('\n');
}

function formatEvent(step: number, event: CFGExecutionEvent): string {
  const prefix = `Step ${step}:`;

  switch (event.type) {
    case 'message':
      const toStr = Array.isArray(event.to) ? event.to.join(', ') : event.to;
      return `${prefix} ${event.from} → ${toStr}: ${event.label}`;

    case 'choice':
      return `${prefix} Choice at ${event.role}, selected: ${event.selectedBranch}`;

    case 'recursion':
      if (event.action === 'enter') {
        return `${prefix} Enter recursion: ${event.label}`;
      } else {
        return `${prefix} Continue recursion: ${event.label} (iteration ${event.iteration})`;
      }

    case 'parallel-fork':
      return `${prefix} Fork into ${event.branches} parallel branches`;

    case 'parallel-join':
      return `${prefix} Join from parallel execution`;

    case 'state-change':
      return `${prefix} State: ${event.from} → ${event.to}`;

    case 'subprotocol':
      if (event.action === 'call') {
        return `${prefix} Call subprotocol: ${event.protocol}`;
      } else {
        return `${prefix} Return from subprotocol: ${event.protocol}`;
      }

    default:
      return `${prefix} ${event.type}`;
  }
}

// ============================================================================
// Main CLI Logic
// ============================================================================

function parseArgs(args: string[]): SimulateCLIOptions {
  const baseOptions = parseCommonArgs(args) as SimulateCLIOptions;

  // Defaults
  baseOptions.mode = 'cfg';
  baseOptions.maxSteps = 1000;
  baseOptions.choice = 'first';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--mode') {
      const mode = args[++i];
      if (mode !== 'cfg' && mode !== 'cfsm' && mode !== 'distributed') {
        console.error(`Error: Invalid mode "${mode}". Must be: cfg, cfsm, distributed`);
        process.exit(1);
      }
      baseOptions.mode = mode;
    } else if (arg === '--max-steps') {
      baseOptions.maxSteps = parseInt(args[++i], 10);
      if (isNaN(baseOptions.maxSteps) || baseOptions.maxSteps <= 0) {
        console.error('Error: --max-steps must be a positive number');
        process.exit(1);
      }
    } else if (arg === '--choice') {
      const choice = args[++i];
      if (choice !== 'manual' && choice !== 'random' && choice !== 'first') {
        console.error(`Error: Invalid choice strategy "${choice}". Must be: manual, random, first`);
        process.exit(1);
      }
      baseOptions.choice = choice;
    } else if (arg === '--role') {
      baseOptions.role = args[++i];
    }
  }

  return baseOptions;
}

function showHelp(): void {
  console.log(`
Scribble Protocol Simulation CLI

Executes Scribble protocols and generates execution traces.

USAGE:
  npm run simulate <file.scr> [options]
  npm run simulate -- --stdin [options]

OPTIONS:
  --mode <mode>         Simulation mode: cfg, cfsm, distributed (default: cfg)
  --max-steps <n>       Maximum execution steps (default: 1000)
  --choice <strategy>   Choice strategy: manual, random, first (default: first)
  --format <fmt>        Output format: text (default), json
  --output <file>       Save output to file
  --stdin               Read from standard input
  --help, -h            Show this help message

SIMULATION MODES:
  cfg                   Global CFG simulation (choreography view)
                        - Centralized orchestration
                        - Synchronous execution
                        - Total order of events

  cfsm                  Single-role CFSM simulation (local view)
                        - Asynchronous execution
                        - FIFO message buffers
                        - Single participant perspective
                        - Requires --role option

  distributed           Multi-role distributed simulation
                        - Multiple CFSMs coordinated
                        - Asynchronous message passing
                        - Realistic distributed execution

CHOICE STRATEGIES:
  first                 Always select first branch (deterministic)
  random                Random branch selection
  manual                Prompt user for choice (interactive)

EXAMPLES:
  # Simple CFG simulation
  npm run simulate examples/two-phase.scr

  # Limit execution steps (useful for recursive protocols)
  npm run simulate examples/stream-data.scr --max-steps 10

  # Random choice selection
  npm run simulate examples/login-or-register.scr --choice random

  # JSON output for programmatic use
  npm run simulate examples/two-phase.scr --format json

  # CFSM mode for single role
  npm run simulate examples/two-phase.scr --mode cfsm --role Client

  # Save trace to file
  npm run simulate examples/two-phase.scr --output trace.json --format json

  # Read from stdin
  echo "protocol Test(role A, role B) { A -> B: Msg(); }" | npm run simulate -- --stdin

NOTES:
  - CFG mode shows global choreography (all participants)
  - CFSM mode shows single participant's view
  - Distributed mode shows realistic async execution
  - Use --max-steps to bound recursive protocols

SEE ALSO:
  - npm run parse      - Parse Scribble protocols
  - npm run build-cfg  - Build Control Flow Graph
  - npm run verify     - Verify protocol safety
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

  // Validate mode-specific requirements
  if (options.mode === 'cfsm' && !options.role) {
    console.error('Error: CFSM mode requires --role option');
    console.error('Example: npm run simulate protocol.scr --mode cfsm --role Client');
    process.exit(1);
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

  // Simulate based on mode
  if (options.mode === 'cfg') {
    simulateCFG(cfg, globalProtocol.name, options);
  } else if (options.mode === 'cfsm') {
    console.error('Error: CFSM mode not yet implemented in CLI');
    console.error('Use CFG mode for now: npm run simulate protocol.scr --mode cfg');
    process.exit(1);
  } else if (options.mode === 'distributed') {
    console.error('Error: Distributed mode not yet implemented in CLI');
    console.error('Use CFG mode for now: npm run simulate protocol.scr --mode cfg');
    process.exit(1);
  }
}

function simulateCFG(
  cfg: any,
  protocolName: string,
  options: SimulateCLIOptions
): void {
  console.log('▶️  Running CFG Simulation...');
  printDivider();

  let simulator: CFGSimulator;
  try {
    simulator = new CFGSimulator(cfg, {
      maxSteps: options.maxSteps,
      recordTrace: true,
      choiceStrategy: options.choice || 'first',
    });
  } catch (error: any) {
    handleError(error, 'Simulator Initialization');
  }

  // Run simulation
  let stepCount = 0;
  const maxSteps = options.maxSteps || 1000;

  try {
    while (!simulator.getState().completed && stepCount < maxSteps) {
      const state = simulator.getState();

      // Handle pending choice
      if (state.atChoice && state.availableChoices) {
        if (options.choice === 'manual') {
          console.error('Error: Manual choice strategy not supported in CLI (use "first" or "random")');
          process.exit(1);
        }
        // Choice will be auto-selected by simulator based on strategy
      }

      const result = simulator.step();

      if (!result.success) {
        console.error(`\n❌ Simulation error at step ${stepCount + 1}:`);
        console.error(`   ${result.error?.message}`);
        process.exit(1);
      }

      stepCount++;
    }
  } catch (error: any) {
    handleError(error, 'Simulation');
  }

  const finalState = simulator.getState();
  const trace = simulator.getTrace();

  printSuccess('Simulation complete!');
  printInfo('Total Steps', String(stepCount));
  printInfo('Status', finalState.completed ? 'Completed' : 'Max steps reached');
  console.log('');

  // Format output
  printDivider();
  console.log('📊 Execution Trace:');
  printDivider();

  let output: string;
  if (options.format === 'json') {
    output = JSON.stringify(trace, null, 2);
  } else {
    output = formatTraceText(trace, protocolName);
  }

  if (options.output) {
    writeOutput(output, options.output);
    console.log('');
  } else {
    console.log(output);
  }

  // Exit code
  if (!finalState.completed && !finalState.reachedMaxSteps) {
    process.exit(1);
  }

  process.exit(0);
}

// ============================================================================
// Entry Point
// ============================================================================

main();
