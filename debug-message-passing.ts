import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';
import { project } from './src/core/projection/projector';
import { DMstSimulator } from './src/core/runtime/dmst-simulator';
import { InMemoryTransport } from './src/core/runtime/transport';
import type { GlobalProtocolDeclaration } from './src/core/ast/types';
import type { CFSM } from './src/core/projection/types';

const source = `
  protocol TaskAssignment(role Manager) {
    new role Worker;
    Manager creates Worker;
    Manager invites Worker;
    Manager -> Worker: Task;
  }
`;

const ast = parse(source);
const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
const cfg = buildCFG(protocol);

console.log('CFG roles:', cfg.roles);

// Project static roles
const staticCFSMs = new Map<string, CFSM>();
staticCFSMs.set('Manager', project(cfg, 'Manager'));

// Project dynamic roles
const dynamicCFSMs = new Map<string, CFSM>();
dynamicCFSMs.set('Worker', project(cfg, 'Worker'));

console.log('Manager CFSM:');
console.log('  States:', staticCFSMs.get('Manager')!.states);
console.log('  Transitions:', staticCFSMs.get('Manager')!.transitions.map(t =>
  `${t.from} --[${t.action?.type || 'tau'}]--> ${t.to}`
));

console.log('Worker CFSM:');
console.log('  States:', dynamicCFSMs.get('Worker')!.states);
console.log('  Transitions:', dynamicCFSMs.get('Worker')!.transitions.map(t =>
  `${t.from} --[${t.action?.type || 'tau'}]--> ${t.to}`
));

const transport = new InMemoryTransport();
const simulator = new DMstSimulator(
  staticCFSMs,
  dynamicCFSMs,
  transport,
  undefined,
  { recordTrace: true }
);

(async () => {
  console.log('\n=== Starting Simulation ===\n');

  let step = 0;
  while (step < 20) {
    const state = simulator.getState();

    if (state.completed || state.deadlocked) {
      console.log(`\nSimulation ended: completed=${state.completed}, deadlocked=${state.deadlocked}`);
      break;
    }

    console.log(`\n--- Step ${step} ---`);
    const result = await simulator.step();

    if (result.updates) {
      for (const [role, update] of result.updates) {
        console.log(`${role}: ${update.success ? 'success' : 'failed'}`);
        if (update.messagesSent) {
          console.log(`  Sent: ${update.messagesSent.map(m => `${m.label} to ${m.to}`).join(', ')}`);
        }
        if (update.messagesConsumed) {
          console.log(`  Received: ${update.messagesConsumed.map(m => `${m.label} from ${m.from}`).join(', ')}`);
        }
      }
    }

    // Show dynamic participants
    const dynParticipants = Array.from(state.dynamicParticipants.values());
    if (dynParticipants.length > 0) {
      console.log('Dynamic participants:');
      for (const p of dynParticipants) {
        console.log(`  ${p.instanceId}: invited=${p.invitationCompleted}, blocked=${p.state.blocked}, completed=${p.state.completed}, state=${p.state.currentState}`);
      }
    }

    step++;
  }

  const trace = simulator.getTrace();
  console.log('\n=== Trace Events ===');
  for (const event of trace.events) {
    if (event.type === 'participant_created') {
      console.log(`participant_created: ${event.instanceId}`);
    } else if (event.type === 'participant_invited') {
      console.log(`participant_invited: ${event.invitee}`);
    } else if (event.type === 'message-sent') {
      const msg = (event as any).message;
      console.log(`message-sent: ${msg.label} from ${msg.from} to ${msg.to}`);
    } else if (event.type === 'message-received') {
      const msg = (event as any).message;
      console.log(`message-received: ${msg.label} from ${msg.from} to ${(event as any).role}`);
    }
  }

  const sendEvent = trace.events.find(
    e => e.type === 'message-sent' && (e as any).message?.label === 'Task'
  );
  console.log(`\nTask message sent: ${!!sendEvent}`);
})();
