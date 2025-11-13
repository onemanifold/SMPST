#!/usr/bin/env tsx
/**
 * Direct parser test - CORRECTED approach
 */

const simpleProtocol = `
protocol RequestResponse(role Client, role Server) {
  Client -> Server: Request(String);
  Server -> Client: Response(String);
}
`;

console.log('Testing parser pipeline (CORRECTED)...\n');
console.log('Protocol to parse:');
console.log(simpleProtocol);
console.log('\n' + '='.repeat(60) + '\n');

async function testParserPipeline() {
  try {
    // CORRECTED: Import standalone parse function, not the class
    console.log('Step 1: Importing parse function...');
    const { parse } = await import('./src/core/parser/parser.js');
    console.log('✓ Parser module imported');
    console.log('  parse type:', typeof parse);

    // Step 2: Parse directly (no instantiation!)
    console.log('\nStep 2: Parsing protocol...');
    const ast = parse(simpleProtocol);
    console.log('✓ Parse completed');

    if (ast) {
      console.log('\n✅ SUCCESS! Parser works correctly\n');
      console.log('Parsed AST type:', ast.type);
      console.log('Number of declarations:', ast.declarations?.length);
      if (ast.declarations && ast.declarations.length > 0) {
        console.log('First declaration type:', ast.declarations[0].type);
        console.log('First declaration:', JSON.stringify(ast.declarations[0], null, 2).substring(0, 500));
      }
    } else {
      console.error('✗ Parser returned null/undefined');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Pipeline failed with error:');
    console.error(error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testParserPipeline();
