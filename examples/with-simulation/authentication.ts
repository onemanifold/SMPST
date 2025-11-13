/**
 * Simulation Example: Authentication Protocol
 *
 * Run with: npx ts-node examples/with-simulation/authentication.ts
 */

import { parse } from '../../src/core/parser/parser';
import { buildCFG } from '../../src/core/cfg/builder';
import { projectAll } from '../../src/core/projection/projector';
import { DistributedSimulator } from '../../src/core/simulation/distributed-simulator';
import type { GlobalProtocolDeclaration } from '../../src/core/parser/ast';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('='.repeat(80));
console.log('Authentication Protocol Simulation');
console.log('='.repeat(80));
console.log();

// Parse protocol
const protocolSource = readFileSync(
  join(__dirname, 'authentication.smp'),
  'utf-8'
);
const ast = parse(protocolSource);
const protocol = ast.declarations[0] as GlobalProtocolDeclaration;

console.log(`Protocol: ${protocol.name}`);
console.log(`Roles: ${protocol.roles.map(r => r.name).join(', ')}`);
console.log();

// Build and project
const cfg = buildCFG(protocol);
const projection = projectAll(cfg);

console.log('📊 CFSM Structure:');
console.log();

for (const [role, cfsm] of projection.cfsms) {
  console.log(`${role}:`);
  console.log(`  States: ${cfsm.states.map(s => s.id).join(', ')}`);
  console.log(`  Initial: ${cfsm.initialState}`);
  console.log(`  Terminal: ${cfsm.terminalStates.join(', ')}`);
  console.log();
}

// Simulate both branches
console.log('🎬 Simulation Scenarios:');
console.log('='.repeat(80));
console.log();

const scenarios = [
  { name: 'Success Path', expected: 'AuthToken' },
  { name: 'Failure Path', expected: 'AuthError' },
];

scenarios.forEach((scenario, idx) => {
  console.log(`Scenario ${idx + 1}: ${scenario.name}`);
  console.log('-'.repeat(40));

  const sim = new DistributedSimulator(projection.cfsms, {
    schedulingStrategy: 'round-robin',
    recordTrace: true,
  });

  const result = sim.run();

  if (result.success) {
    const serverTrace = result.traces!.get('Server')!;
    const authResponse = serverTrace.events.find(
      e => e.type === 'send' && (e.label === 'AuthToken' || e.label === 'AuthError')
    );

    if (authResponse && authResponse.type === 'send') {
      console.log(`  Auth Result: ${authResponse.label}`);

      if (authResponse.label === 'AuthToken') {
        console.log('  ✅ Authentication successful');
        console.log('  📨 User can now request data');

        // Show full message flow
        console.log();
        console.log('  Message Flow:');
        console.log('    User -> Server: LoginRequest');
        console.log('    Server -> User: AuthToken');
        console.log('    User -> Server: DataRequest');
        console.log('    Server -> User: DataResponse');
      } else {
        console.log('  ❌ Authentication failed');
        console.log('  🚫 Protocol terminates');

        console.log();
        console.log('  Message Flow:');
        console.log('    User -> Server: LoginRequest');
        console.log('    Server -> User: AuthError');
      }
    }

    console.log();
    console.log(`  Total Steps: ${result.globalSteps}`);
    console.log(`  User Events: ${result.traces!.get('User')!.events.length}`);
    console.log(`  Server Events: ${result.traces!.get('Server')!.events.length}`);
  } else {
    console.log(`  ⚠️  Error: ${result.error?.message}`);
  }

  console.log();
});

console.log('✅ Authentication protocol simulation complete!');
console.log();
