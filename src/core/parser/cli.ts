/**
 * CLI utility for manually testing the parser
 * Usage: node -r esbuild-register src/core/parser/cli.ts <file.scr>
 * Or: npm run parse <file.scr>
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from './parser';

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npm run parse <file.scr>');
    console.log('   or: npm run parse -- --stdin');
    console.log('');
    console.log('Examples:');
    console.log('  npm run parse examples/two-phase.scr');
    console.log('  echo "protocol Test(role A, role B) { A -> B: Msg(); }" | npm run parse -- --stdin');
    process.exit(1);
  }

  let source: string;
  let filename: string;

  if (args[0] === '--stdin') {
    // Read from stdin
    source = fs.readFileSync(0, 'utf-8');
    filename = '<stdin>';
  } else {
    // Read from file
    filename = args[0];
    if (!fs.existsSync(filename)) {
      console.error(`Error: File not found: ${filename}`);
      process.exit(1);
    }
    source = fs.readFileSync(filename, 'utf-8');
  }

  console.log(`Parsing: ${filename}`);
  console.log('─'.repeat(60));

  try {
    const ast = parse(source);

    console.log('✓ Parse successful!');
    console.log('');
    console.log('AST:');
    console.log(JSON.stringify(ast, null, 2));

    // Summary
    console.log('');
    console.log('─'.repeat(60));
    console.log('Summary:');
    console.log(`  Declarations: ${ast.declarations.length}`);

    for (const decl of ast.declarations) {
      if (decl.type === 'GlobalProtocolDeclaration') {
        console.log(`  - Protocol: ${decl.name}`);
        console.log(`    Roles: ${decl.roles.map(r => r.name).join(', ')}`);
        console.log(`    Interactions: ${decl.body.length}`);
      } else if (decl.type === 'ImportDeclaration') {
        console.log(`  - Import: ${decl.modulePath}`);
      } else if (decl.type === 'TypeDeclaration') {
        console.log(`  - Type: ${decl.name}`);
      }
    }
  } catch (error: any) {
    console.error('✗ Parse failed!');
    console.error('');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// ESM entry point - always run
main();
