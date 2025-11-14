#!/usr/bin/env node
/**
 * CLI utility for building Control Flow Graphs (CFG)
 *
 * Transforms Scribble protocols into CFG representation for analysis.
 *
 * Usage:
 *   npm run build-cfg <file.scr> [options]
 *   npm run build-cfg -- --stdin [options]
 *
 * Options:
 *   --format <fmt>    Output format: json (default), dot, text
 *   --output <file>   Save output to file
 *   --stdin           Read from standard input
 *   --help            Show this help message
 *
 * Examples:
 *   npm run build-cfg examples/two-phase.scr
 *   npm run build-cfg examples/two-phase.scr --format dot
 *   npm run build-cfg examples/two-phase.scr --output cfg.json
 *   echo "protocol Test(role A, role B) { A -> B: Msg(); }" | npm run build-cfg -- --stdin
 */

import { parse } from '../core/parser/parser';
import { buildCFG } from '../core/cfg/builder';
import type { GlobalProtocolDeclaration } from '../core/ast/types';
import type { CFG } from '../core/cfg/types';
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
// CFG to DOT Format
// ============================================================================

function cfgToDot(cfg: CFG, protocolName: string): string {
  const lines: string[] = [];
  lines.push(`digraph "${protocolName}" {`);
  lines.push('  rankdir=TB;');
  lines.push('  node [shape=box, style=rounded];');
  lines.push('');

  // Nodes
  for (const node of cfg.nodes) {
    const shape = node.type === 'initial' || node.type === 'terminal' ? 'circle' : 'box';
    const label = formatNodeLabel(node);
    lines.push(`  ${node.id} [label="${label}", shape=${shape}];`);
  }

  lines.push('');

  // Edges
  for (const edge of cfg.edges) {
    const label = edge.label ? ` [label="${edge.label}"]` : '';
    const style = edge.edgeType === 'continue' ? ' [style=dashed, color=blue]' : '';
    lines.push(`  ${edge.from} -> ${edge.to}${label}${style};`);
  }

  lines.push('}');
  return lines.join('\n');
}

function formatNodeLabel(node: any): string {
  switch (node.type) {
    case 'initial':
      return 'START';
    case 'terminal':
      return 'END';
    case 'action':
      if (node.action.kind === 'message') {
        const { from, to, label } = node.action;
        const toStr = Array.isArray(to) ? to.join(',') : to;
        return `${from} → ${toStr}: ${label}`;
      } else if (node.action.kind === 'parallel') {
        return `parallel ${node.action.parallel_id}`;
      } else if (node.action.kind === 'subprotocol') {
        return `do ${node.action.protocol}`;
      }
      return 'action';
    case 'branch':
      return `branch at ${node.at}`;
    case 'merge':
      return 'merge';
    case 'fork':
      return `fork ${node.parallel_id}`;
    case 'join':
      return `join ${node.parallel_id}`;
    case 'recursive':
      return `rec ${node.label}`;
    default:
      return node.type;
  }
}

// ============================================================================
// CFG to Text Format
// ============================================================================

function cfgToText(cfg: CFG, protocolName: string): string {
  const lines: string[] = [];
  lines.push(`Control Flow Graph: ${protocolName}`);
  lines.push('─'.repeat(60));
  lines.push('');

  // Summary
  lines.push(`Roles: ${cfg.roles.join(', ')}`);
  lines.push(`Nodes: ${cfg.nodes.length}`);
  lines.push(`Edges: ${cfg.edges.length}`);
  lines.push('');

  // Nodes
  lines.push('Nodes:');
  for (const node of cfg.nodes) {
    const label = formatNodeLabel(node);
    lines.push(`  ${node.id}: [${node.type}] ${label}`);
  }
  lines.push('');

  // Edges
  lines.push('Edges:');
  for (const edge of cfg.edges) {
    const label = edge.label ? ` (${edge.label})` : '';
    lines.push(`  ${edge.id}: ${edge.from} → ${edge.to} [${edge.edgeType}]${label}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Main CLI Logic
// ============================================================================

function showHelp(): void {
  console.log(`
Scribble CFG Builder CLI

Transforms Scribble protocols into Control Flow Graph (CFG) representation.

USAGE:
  npm run build-cfg <file.scr> [options]
  npm run build-cfg -- --stdin [options]

OPTIONS:
  --format <fmt>    Output format: json (default), dot, text
  --output <file>   Save output to file instead of stdout
  --stdin           Read from standard input
  --help, -h        Show this help message

OUTPUT FORMATS:
  json              JSON representation of CFG (for programmatic use)
  dot               GraphViz DOT format (for visualization)
  text              Human-readable text format

EXAMPLES:
  # Build CFG and output as JSON
  npm run build-cfg examples/two-phase.scr

  # Output in DOT format for visualization
  npm run build-cfg examples/two-phase.scr --format dot

  # Save to file
  npm run build-cfg examples/two-phase.scr --output cfg.json

  # Generate and visualize with GraphViz
  npm run build-cfg examples/two-phase.scr --format dot | dot -Tpng > cfg.png

  # Read from stdin
  echo "protocol Test(role A, role B) { A -> B: Msg(); }" | npm run build-cfg -- --stdin

  # Text format for inspection
  npm run build-cfg examples/two-phase.scr --format text

PIPELINE USAGE:
  # Parse, build CFG, and verify in one pipeline
  npm run build-cfg protocol.scr --format json > cfg.json
  npm run verify protocol.scr < cfg.json

SEE ALSO:
  - npm run parse     - Parse Scribble protocols
  - npm run verify    - Verify protocol safety properties
  - npm run project   - Project to local protocols
`);
}

function main(): void {
  const args = process.argv.slice(2);

  // Parse arguments
  const options = parseCommonArgs(args) as CLIOptions;

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
    console.error('Hint: Make sure your protocol starts with "protocol Name(...)"');
    process.exit(1);
  }

  printSuccess('Parse successful!');
  printInfo('Protocol', globalProtocol.name);
  printInfo('Roles', globalProtocol.roles.map((r) => r.name).join(', '));
  console.log('');

  // Build CFG
  console.log('🔨 Building Control Flow Graph...');
  printDivider();

  let cfg: CFG;
  try {
    cfg = buildCFG(globalProtocol);
  } catch (error: any) {
    handleError(error, 'CFG Build');
  }

  printSuccess('CFG built successfully!');
  printInfo('Nodes', String(cfg.nodes.length));
  printInfo('Edges', String(cfg.edges.length));
  printInfo('Roles', cfg.roles.join(', '));
  console.log('');

  // Format output
  printDivider();
  console.log('📄 Output:');
  printDivider();

  let output: string;
  if (options.format === 'json') {
    output = JSON.stringify(cfg, null, 2);
  } else if (options.format === 'dot') {
    output = cfgToDot(cfg, globalProtocol.name);
  } else {
    output = cfgToText(cfg, globalProtocol.name);
  }

  writeOutput(output, options.output);
}

// ============================================================================
// Entry Point
// ============================================================================

main();
