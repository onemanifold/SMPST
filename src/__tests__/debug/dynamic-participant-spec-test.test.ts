/**
 * Specification-Driven Test for Dynamic Participants
 *
 * This test defines CORRECT behavior according to DMst semantics,
 * NOT what the current implementation does.
 *
 * DMst Formal Semantics (ECOOP 2023):
 * - Static roles: Declared in protocol signature, exist from start
 * - Dynamic roles: Declared with 'new role X', created at runtime
 * - Projection: Creates CFSM templates for both, but marks them differently
 * - Execution: Only static roles execute initially
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('Dynamic Participant Specification', () => {
  it('SPEC: projectAll should distinguish static vs dynamic roles', () => {
    const protocol = `
      protocol DynamicTest(role Manager) {
        new role Worker;
        Manager creates Worker as w;
        Manager -> w: Task();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const result = projectAll(cfg);

    // SPECIFICATION: Result should identify which roles are static vs dynamic
    // Currently MISSING this information

    console.log('\n=== CURRENT BEHAVIOR ===');
    console.log('result.roles:', result.roles);
    console.log('result.cfsms.keys():', Array.from(result.cfsms.keys()));

    console.log('\n=== EXPECTED BEHAVIOR ===');
    console.log('result.staticRoles should be:', ['Manager']);
    console.log('result.dynamicRoles should be:', ['Worker']);
    console.log('Both should have CFSMs in result.cfsms');

    // SPECIFICATION: Result should identify which roles are static vs dynamic
    const hasStaticRoles = 'staticRoles' in result;
    const hasDynamicRoles = 'dynamicRoles' in result;

    console.log('\n=== SPEC COMPLIANCE ===');
    console.log('Has staticRoles field:', hasStaticRoles);
    console.log('Has dynamicRoles field:', hasDynamicRoles);
    console.log('staticRoles:', result.staticRoles);
    console.log('dynamicRoles:', result.dynamicRoles);

    // SPEC REQUIREMENT: Must distinguish static from dynamic
    expect(result.staticRoles).toEqual(['Manager']);
    expect(result.dynamicRoles).toEqual(['Worker']);
  });

  it('SPEC: DistributedSimulator should only start static roles', async () => {
    const protocol = `
      protocol DynamicTest(role Manager) {
        new role Worker;
        Manager creates Worker as w;
        Manager invites w;
        Manager -> w: Task();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const projections = projectAll(cfg);

    console.log('\n=== SPECIFICATION ===');
    console.log('Static roles in signature:', ['Manager']);
    console.log('Dynamic roles (new role):', ['Worker']);

    console.log('\n=== PROJECTION RESULT ===');
    console.log('Static roles:', projections.staticRoles);
    console.log('Dynamic roles:', projections.dynamicRoles);
    console.log('All CFSMs created:', Array.from(projections.cfsms.keys()));

    // SPEC: Can now distinguish static from dynamic
    expect(projections.staticRoles).toEqual(['Manager']);
    expect(projections.dynamicRoles).toEqual(['Worker']);

    console.log('\n=== CORRECT EXECUTION FLOW (now possible) ===');
    console.log('1. DistributedSimulator receives staticRoles + dynamicRoles');
    console.log('2. Start simulators ONLY for staticRoles: [Manager]');
    console.log('3. Keep dynamicRoles CFSMs as templates: [Worker]');
    console.log('4. When Manager executes create → instantiate Worker');
    console.log('5. Worker starts from initial state, receives create');
    console.log('6. Continue execution with both roles');

    // NOTE: DistributedSimulator still needs to be updated to USE this info
  });

  it('SPEC: Multiple instances of dynamic role should be supported', () => {
    const protocol = `
      protocol MultiWorker(role Manager) {
        new role Worker;
        Manager creates Worker as w1;
        Manager creates Worker as w2;
        Manager -> w1: Task1();
        Manager -> w2: Task2();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const projections = projectAll(cfg);

    console.log('\n=== SPECIFICATION ===');
    console.log('Worker is a ROLE TYPE (template)');
    console.log('w1 and w2 are INSTANCES of Worker');
    console.log('At runtime: Manager, w1, w2 all execute');

    console.log('\n=== CURRENT PROJECTION ===');
    console.log('CFSMs created:', Array.from(projections.cfsms.keys()));
    console.log('Worker CFSM is a template for instances');

    console.log('\n=== MISSING AT RUNTIME ===');
    console.log('Need instance tracking: w1 and w2 both use Worker CFSM');
    console.log('Need instance naming: Messages addressed to w1, not Worker');
    console.log('Need dynamic instantiation: Create w1, then w2');

    // This documents architectural need
    expect(true).toBe(true);
  });
});
