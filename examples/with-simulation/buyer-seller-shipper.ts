/**
 * Simulation Example: Buyer-Seller-Shipper Protocol
 *
 * Run with: npx ts-node examples/with-simulation/buyer-seller-shipper.ts
 */

import { parse } from '../../src/core/parser/parser';
import { buildCFG } from '../../src/core/cfg/builder';
import { projectAll } from '../../src/core/projection/projector';
import { DistributedSimulator } from '../../src/core/simulation/distributed-simulator';
import type { GlobalProtocolDeclaration } from '../../src/core/parser/ast';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('='.repeat(80));
console.log('E-Commerce Protocol Simulation: Buyer-Seller-Shipper');
console.log('='.repeat(80));
console.log();

// Step 1: Load and parse protocol
console.log('📄 Step 1: Parsing protocol...');
const protocolSource = readFileSync(
  join(__dirname, 'buyer-seller-shipper.smp'),
  'utf-8'
);
const ast = parse(protocolSource);
const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
console.log(`   ✓ Parsed protocol: ${protocol.name}`);
console.log(`   ✓ Roles: ${protocol.roles.map(r => r.name).join(', ')}`);
console.log();

// Step 2: Build CFG
console.log('🔧 Step 2: Building Control Flow Graph...');
const cfg = buildCFG(protocol);
console.log(`   ✓ CFG nodes: ${cfg.nodes.length}`);
console.log(`   ✓ CFG edges: ${cfg.edges.length}`);
console.log();

// Step 3: Project to CFSMs
console.log('📊 Step 3: Projecting to CFSMs (pure LTS)...');
const projection = projectAll(cfg);

if (projection.errors.length > 0) {
  console.error('   ✗ Projection errors:');
  projection.errors.forEach(err => {
    console.error(`     - ${err.role}: ${err.message}`);
  });
  process.exit(1);
}

console.log(`   ✓ Projected ${projection.cfsms.size} roles`);
for (const [role, cfsm] of projection.cfsms) {
  console.log(`     - ${role}: ${cfsm.states.length} states, ${cfsm.transitions.length} transitions`);
}
console.log();

// Step 4: Simulate execution
console.log('🎬 Step 4: Simulating distributed execution...');
const simulator = new DistributedSimulator(projection.cfsms, {
  schedulingStrategy: 'round-robin',
  recordTrace: true,
  maxSteps: 100,
});

const result = simulator.run();

if (!result.success) {
  console.error('   ✗ Simulation failed:', result.error?.message);
  if (result.error?.type === 'deadlock') {
    console.error('   Deadlocked roles:', result.error.roles);
  }
  process.exit(1);
}

console.log(`   ✓ Simulation completed successfully!`);
console.log(`   ✓ Total steps: ${result.globalSteps}`);
console.log();

// Step 5: Display execution traces
console.log('📋 Step 5: Execution Traces');
console.log('='.repeat(80));
console.log();

for (const [role, trace] of result.traces!) {
  console.log(`${role}:`);
  console.log(`  Steps: ${trace.totalSteps}`);
  console.log(`  Events: ${trace.events.length}`);
  console.log(`  Completed: ${trace.completed ? '✓' : '✗'}`);
  console.log();

  console.log('  Event Timeline:');
  trace.events.forEach((event, i) => {
    const time = new Date(event.timestamp).toLocaleTimeString();

    if (event.type === 'send') {
      console.log(`    ${i + 1}. [${time}] SEND ${event.label} → ${event.to}`);
    } else if (event.type === 'receive') {
      console.log(`    ${i + 1}. [${time}] RECV ${event.label} ← ${event.from}`);
    } else if (event.type === 'tau') {
      console.log(`    ${i + 1}. [${time}] TAU (internal)`);
    } else if (event.type === 'choice') {
      console.log(`    ${i + 1}. [${time}] CHOICE (${event.branch})`);
    }
  });

  console.log();
}

// Step 6: Message Flow Diagram
console.log('📨 Step 6: Message Flow');
console.log('='.repeat(80));
console.log();

console.log('  Buyer          Seller         Shipper');
console.log('    |              |              |');
console.log('    |---Order----->|              |');
console.log('    |              |              |');
console.log('    |              |--ShipReq---->|');
console.log('    |              |              |');
console.log('    |<----------DeliveryConf------|');
console.log('    |              |              |');
console.log();

// Step 7: Summary
console.log('✅ Simulation Summary');
console.log('='.repeat(80));
console.log();
console.log(`Protocol: ${protocol.name}`);
console.log(`Roles: ${projection.cfsms.size}`);
console.log(`Total steps: ${result.globalSteps}`);
console.log(`Status: ${result.state.allCompleted ? 'All completed ✓' : 'Incomplete'}`);
console.log(`Deadlock: ${result.state.deadlocked ? 'Yes ✗' : 'No ✓'}`);
console.log();

console.log('🎉 Protocol executed successfully!');
console.log();
