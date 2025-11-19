/**
 * Test Helpers for Component Testing
 *
 * Shared utilities for creating test CFGs and initializing simulations
 */
import { parse } from '../../../../core/parser/parser';
import { buildCFG } from '../../../../core/cfg/builder';
import type { GlobalProtocolDeclaration } from '../../../../core/ast/types';
import type { CFG } from '../../../../core/cfg/types';

/**
 * Create a simple CFG with 2 message interactions (no choices)
 */
export function createSimpleCFG(): CFG {
  const source = `
    protocol SimpleProtocol(role A, role B) {
      A -> B: Hello(string);
      B -> A: World(string);
    }
  `;
  const module = parse(source);
  const protocol = module.declarations.find(
    d => d.type === 'GlobalProtocolDeclaration'
  ) as GlobalProtocolDeclaration;
  return buildCFG(protocol);
}

/**
 * Create a CFG with a choice point (2 branches)
 */
export function createChoiceCFG(): CFG {
  const source = `
    protocol ChoiceProtocol(role A, role B) {
      choice at A {
        A -> B: Option1(string);
      } or {
        A -> B: Option2(string);
      }
    }
  `;
  const module = parse(source);
  const protocol = module.declarations.find(
    d => d.type === 'GlobalProtocolDeclaration'
  ) as GlobalProtocolDeclaration;
  return buildCFG(protocol);
}

/**
 * Create a CFG with multiple steps (for timeline testing)
 */
export function createMultiStepCFG(): CFG {
  const source = `
    protocol MultiStepProtocol(role A, role B, role C) {
      A -> B: Start(string);
      B -> C: Forward(string);
      C -> A: Reply(string);
      A -> B: Continue(string);
      B -> C: End(string);
    }
  `;
  const module = parse(source);
  const protocol = module.declarations.find(
    d => d.type === 'GlobalProtocolDeclaration'
  ) as GlobalProtocolDeclaration;
  return buildCFG(protocol);
}

/**
 * Create a CFG that completes quickly (for completion state testing)
 */
export function createCompletableCFG(): CFG {
  const source = `
    protocol CompletableProtocol(role A, role B) {
      A -> B: Done(string);
    }
  `;
  const module = parse(source);
  const protocol = module.declarations.find(
    d => d.type === 'GlobalProtocolDeclaration'
  ) as GlobalProtocolDeclaration;
  return buildCFG(protocol);
}

/**
 * Create both CFG and CFSMs for mode switching tests
 */
export function createCFGAndCFSMs() {
  const source = `
    protocol ModeSwitchProtocol(role A, role B) {
      A -> B: Request(string);
      B -> A: Response(string);
    }
  `;
  const module = parse(source);
  const protocol = module.declarations.find(
    d => d.type === 'GlobalProtocolDeclaration'
  ) as GlobalProtocolDeclaration;

  const cfg = buildCFG(protocol);

  // Generate CFSMs
  // Dynamic import for test environment
  const projectorModule = await import('../../../../core/projection/projector');
  const result = projectorModule.projectAll(cfg);

  return { cfg, cfsms: result.cfsms };
}
