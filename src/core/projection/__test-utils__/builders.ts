/**
 * Test data builders for creating test scenarios
 */
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import { project, projectAll } from '../projector';
import type { CFSM, ProjectionResult } from '../types';

/**
 * Build CFSM from protocol source string
 */
export function buildCFSMFromSource(source: string, role: string): CFSM {
  const ast = parse(source);
  const cfg = buildCFG(ast.declarations[0]);
  return project(cfg, role);
}

/**
 * Build all CFSMs from protocol source
 */
export function buildAllCFSMsFromSource(source: string): ProjectionResult {
  const ast = parse(source);
  const cfg = buildCFG(ast.declarations[0]);
  return projectAll(cfg);
}

/**
 * Create a simple two-role protocol
 */
export function createTwoRoleProtocol(
  protocolName: string,
  roleA: string,
  roleB: string,
  body: string
): string {
  return `
    protocol ${protocolName}(role ${roleA}, role ${roleB}) {
      ${body}
    }
  `;
}

/**
 * Create a three-role protocol
 */
export function createThreeRoleProtocol(
  protocolName: string,
  roles: [string, string, string],
  body: string
): string {
  return `
    protocol ${protocolName}(role ${roles[0]}, role ${roles[1]}, role ${roles[2]}) {
      ${body}
    }
  `;
}
