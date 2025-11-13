// Test script to verify the verification API works
import { parseProtocol } from './src/core/parser/parser.js';
import { verifyProtocol } from './src/core/verification/verifier.js';

const testProtocol = `
global protocol TwoParty(role A, role B) {
  msg(int) from A to B;
}
`;

console.log('=== Testing Verification API ===\n');

try {
  console.log('1. Parsing protocol...');
  const cfg = parseProtocol(testProtocol);
  console.log('✓ Protocol parsed successfully');
  console.log('CFG object:', cfg);
  console.log('CFG type:', typeof cfg);
  console.log('CFG constructor:', cfg?.constructor?.name);

  console.log('\n2. Verifying protocol...');
  const result = verifyProtocol(cfg);
  console.log('✓ Verification completed');
  console.log('Result:', JSON.stringify(result, null, 2));
  console.log('Result type:', typeof result);
  console.log('Result keys:', Object.keys(result));

  console.log('\n3. Testing CFGSimulator import...');
  const { CFGSimulator } = await import('./src/core/simulation/cfg-simulator.js');
  console.log('✓ CFGSimulator imported');
  console.log('CFGSimulator type:', typeof CFGSimulator);
  console.log('CFGSimulator:', CFGSimulator);

  console.log('\n4. Creating CFGSimulator instance...');
  const simulator = new CFGSimulator(cfg, {
    onStateChange: () => {},
    onError: () => {}
  });
  console.log('✓ CFGSimulator instantiated successfully');
  console.log('Simulator:', simulator);
  console.log('Simulator type:', typeof simulator);

  console.log('\n=== ALL TESTS PASSED ===');
} catch (error) {
  console.error('\n✗ Test failed with error:');
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
  console.error('Error type:', error.constructor.name);
  process.exit(1);
}
