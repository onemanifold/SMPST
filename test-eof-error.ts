import { parse } from './src/core/parser/parser.js';

// Try to reproduce "Expecting EOF but found 'global'" error

const tests = [
  {
    name: 'Empty string then global',
    input: '\n\nglobal protocol Test(role A, role B) { A -> B: Hello(); }'
  },
  {
    name: 'Just newlines then global',
    input: '\n\n\nglobal protocol Test(role A, role B) { A -> B: Hello(); }'
  },
  {
    name: 'Whitespace then global',
    input: '   \n  global protocol Test(role A, role B) { A -> B: Hello(); }'
  },
  {
    name: 'Double protocol (typo)',
    input: 'protocol protocol Test(role A, role B) { A -> B: Hello(); }'
  },
  {
    name: 'Global global (typo)',
    input: 'global global protocol Test(role A, role B) { A -> B: Hello(); }'
  },
  {
    name: 'Protocol then global',
    input: 'protocol Test1(role A, role B) {} global protocol Test2(role C, role D) {}'
  },
  {
    name: 'Normal global protocol',
    input: 'global protocol Test(role A, role B) { A -> B: Hello(); }'
  }
];

for (const test of tests) {
  console.log(`\n=== ${test.name} ===`);
  console.log(`Input: "${test.input.substring(0, 50)}..."`);
  try {
    const ast = parse(test.input);
    console.log(`✅ SUCCESS: ${ast.declarations.length} declaration(s)`);
  } catch (e) {
    console.log(`❌ ERROR: ${e.message}`);
    if (e.message.includes('EOF') && e.message.includes('global')) {
      console.log('⭐ REPRODUCED THE ERROR!');
    }
  }
}
