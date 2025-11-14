/**
 * Shared utilities for CLI tools
 */

import * as fs from 'fs';

// ============================================================================
// Types
// ============================================================================

export interface CLIOptions {
  inputFile?: string;
  stdin: boolean;
  format: 'json' | 'text' | 'dot';
  output?: string;
  help: boolean;
  [key: string]: any; // Allow additional options
}

export interface ParsedInput {
  source: string;
  filename: string;
}

// ============================================================================
// Input Reading
// ============================================================================

/**
 * Read input from file or stdin
 */
export function readInput(options: Pick<CLIOptions, 'stdin' | 'inputFile'>): ParsedInput {
  let source: string;
  let filename: string;

  if (options.stdin) {
    source = fs.readFileSync(0, 'utf-8');
    filename = '<stdin>';
  } else if (options.inputFile) {
    filename = options.inputFile;
    if (!fs.existsSync(filename)) {
      console.error(`Error: File not found: ${filename}`);
      process.exit(1);
    }
    source = fs.readFileSync(filename, 'utf-8');
  } else {
    console.error('Error: No input specified. Use --stdin or provide a file path.');
    process.exit(1);
  }

  return { source, filename };
}

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Format output based on format option
 */
export function formatOutput(data: any, format: 'json' | 'text' | 'dot'): string {
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }
  // Text and DOT formats handled by specific CLIs
  return String(data);
}

/**
 * Write output to file or stdout
 */
export function writeOutput(content: string, outputPath?: string): void {
  if (outputPath) {
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`💾 Saved to: ${outputPath}`);
  } else {
    console.log(content);
  }
}

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * Parse common CLI arguments
 */
export function parseCommonArgs(args: string[]): Partial<CLIOptions> {
  const options: Partial<CLIOptions> = {
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
    } else if (arg === '--format' || arg === '-f') {
      const fmt = args[++i];
      if (fmt !== 'json' && fmt !== 'text' && fmt !== 'dot') {
        console.error(`Error: Invalid format "${fmt}". Must be: json, text, or dot`);
        process.exit(1);
      }
      options.format = fmt as 'json' | 'text' | 'dot';
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (!arg.startsWith('-')) {
      options.inputFile = arg;
    }
  }

  return options;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Handle errors consistently across CLIs
 */
export function handleError(error: any, context: string): never {
  console.error(`✗ ${context} failed!`);
  console.error('');
  console.error('Error:', error.message);

  if (process.env.DEBUG) {
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
  }

  process.exit(1);
}

// ============================================================================
// Pretty Printing
// ============================================================================

/**
 * Print a header
 */
export function printHeader(title: string): void {
  console.log('═'.repeat(80));
  console.log(title);
  console.log('═'.repeat(80));
}

/**
 * Print a section divider
 */
export function printDivider(): void {
  console.log('─'.repeat(80));
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
  console.log(`✓ ${message}`);
}

/**
 * Print info message
 */
export function printInfo(label: string, value: string): void {
  console.log(`  ${label}: ${value}`);
}
