/**
 * Simulation Example: Banking Transaction Protocol
 *
 * Run with: npx ts-node examples/with-simulation/banking-transaction.ts
 */

import { parse } from '../../src/core/parser/parser';
import { buildCFG } from '../../src/core/cfg/builder';
import { projectAll } from '../../src/core/projection/projector';
import { DistributedSimulator } from '../../src/core/simulation/distributed-simulator';
import type { GlobalProtocolDeclaration } from '../../src/core/parser/ast';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('='.repeat(80));
console.log('Banking Transaction Protocol Simulation');
console.log('='.repeat(80));
console.log();

// Parse protocol
console.log('📄 Parsing protocol...');
const protocolSource = readFileSync(
  join(__dirname, 'banking-transaction.smp'),
  'utf-8'
);
const ast = parse(protocolSource);
const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
console.log(`   ✓ Protocol: ${protocol.name}`);
console.log();

// Build CFG
console.log('🔧 Building CFG...');
const cfg = buildCFG(protocol);
console.log(`   ✓ CFG built`);
console.log();

// Project to CFSMs
console.log('📊 Projecting to CFSMs...');
const projection = projectAll(cfg);
console.log(`   ✓ Projected ${projection.cfsms.size} roles`);

// Show CFSM structure
console.log();
console.log('🔍 CFSM Analysis:');
for (const [role, cfsm] of projection.cfsms) {
  console.log(`   ${role}:`);
  console.log(`     States: ${cfsm.states.length}`);
  console.log(`     Transitions: ${cfsm.transitions.length}`);

  // Show transitions
  console.log('     Actions:');
  for (const t of cfsm.transitions) {
    if (t.action.type === 'send') {
      console.log(`       - SEND ${t.action.label} → ${t.action.to}`);
    } else if (t.action.type === 'receive') {
      console.log(`       - RECV ${t.action.label} ← ${t.action.from}`);
    } else if (t.action.type === 'choice') {
      console.log(`       - CHOICE (${t.action.branch})`);
    } else if (t.action.type === 'tau') {
      console.log(`       - TAU (internal)`);
    }
  }
  console.log();
}

// Simulate multiple times to test both branches
console.log('🎬 Running simulations (testing both branches)...');
console.log();

const runs = 5;
const outcomes = { success: 0, failure: 0, other: 0 };

for (let i = 0; i < runs; i++) {
  const sim = new DistributedSimulator(projection.cfsms, {
    schedulingStrategy: 'round-robin',
    recordTrace: true,
  });

  const result = sim.run();

  if (result.success) {
    // Check which branch was taken
    const bankTrace = result.traces!.get('Bank')!;
    const sendEvent = bankTrace.events.find(e => e.type === 'send');

    if (sendEvent && sendEvent.type === 'send') {
      if (sendEvent.label === 'TransferSuccess') {
        outcomes.success++;
        console.log(`   Run ${i + 1}: ✅ Transfer successful`);
      } else if (sendEvent.label === 'TransferFailure') {
        outcomes.failure++;
        console.log(`   Run ${i + 1}: ❌ Transfer failed`);
      } else {
        outcomes.other++;
        console.log(`   Run ${i + 1}: ❓ Unexpected outcome: ${sendEvent.label}`);
      }
    }
  } else {
    console.log(`   Run ${i + 1}: ⚠️  Simulation error: ${result.error?.message}`);
  }
}

console.log();
console.log('📊 Simulation Results:');
console.log(`   Total runs: ${runs}`);
console.log(`   Success outcomes: ${outcomes.success}`);
console.log(`   Failure outcomes: ${outcomes.failure}`);
console.log(`   Other outcomes: ${outcomes.other}`);
console.log();

// Run one detailed simulation
console.log('📋 Detailed Execution Trace (Sample Run):');
console.log('='.repeat(80));
console.log();

const detailedSim = new DistributedSimulator(projection.cfsms, {
  schedulingStrategy: 'round-robin',
  recordTrace: true,
});

const detailedResult = detailedSim.run();

if (detailedResult.success) {
  for (const [role, trace] of detailedResult.traces!) {
    console.log(`${role}:`);
    trace.events.forEach((event, i) => {
      const time = new Date(event.timestamp).toLocaleTimeString();

      if (event.type === 'send') {
        console.log(`  ${i + 1}. [${time}] SEND ${event.label} → ${event.to}`);
      } else if (event.type === 'receive') {
        console.log(`  ${i + 1}. [${time}] RECV ${event.label} ← ${event.from}`);
      } else if (event.type === 'choice') {
        console.log(`  ${i + 1}. [${time}] CHOICE (branch: ${event.branch})`);
      } else if (event.type === 'tau') {
        console.log(`  ${i + 1}. [${time}] TAU (internal transition)`);
      }
    });
    console.log();
  }
}

console.log('✅ Banking protocol simulation complete!');
console.log();
