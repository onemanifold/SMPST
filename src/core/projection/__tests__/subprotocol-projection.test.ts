/**
 * CFSM Projection Tests for Sub-Protocol Support
 *
 * Tests that CFSM projector correctly handles sub-protocol invocations:
 * - Sub-protocols are tau-eliminated (transparent) in CFSMs
 * - CFSMs contain only direct send/receive actions
 * - Sub-protocol expansion happens at simulation time, not projection time
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import { project } from '../projector';

describe('CFSM Projection - Sub-Protocol Support', () => {
  it('should tau-eliminate sub-protocol invocations', () => {
    const source = `
      protocol Auth(role Client, role Server) {
        Client -> Server: Login(String);
        Server -> Client: LoginOk();
      }

      protocol Main(role Client, role Server) {
        do Auth(Client, Server);
        Client -> Server: Request(String);
        Server -> Client: Response(Int);
      }
    `;

    const module = parse(source);
    const mainProtocol = module.declarations.find(
      d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
    );
    expect(mainProtocol).toBeDefined();

    if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Main protocol not found');
    }

    const cfg = buildCFG(mainProtocol);
    const clientCFSM = project(cfg, 'Client');
    const serverCFSM = project(cfg, 'Server');

    // Client CFSM should have: initial -> send Request -> receive Response -> terminal
    // The "do Auth" should be transparent (tau-eliminated)
    expect(clientCFSM.states.length).toBeGreaterThan(0);
    expect(clientCFSM.transitions.length).toBeGreaterThan(0);

    // Check that CFSM has send and receive actions for Request/Response
    const clientActions = clientCFSM.transitions
      .filter(t => t.action)
      .map(t => t.action!);

    const sendActions = clientActions.filter(a => a.type === 'send');
    const receiveActions = clientActions.filter(a => a.type === 'receive');

    // Should have at least the Request send and Response receive
    expect(sendActions.some(a => a.label === 'Request')).toBe(true);
    expect(receiveActions.some(a => a.label === 'Response')).toBe(true);

    // Server CFSM should mirror: initial -> receive Request -> send Response -> terminal
    const serverActions = serverCFSM.transitions
      .filter(t => t.action)
      .map(t => t.action!);

    expect(serverActions.some(a => a.type === 'receive' && a.label === 'Request')).toBe(true);
    expect(serverActions.some(a => a.type === 'send' && a.label === 'Response')).toBe(true);
  });

  it('should handle multiple sub-protocol invocations', () => {
    const source = `
      protocol Sub1(role A, role B) {
        A -> B: Msg1();
      }

      protocol Sub2(role A, role B) {
        A -> B: Msg2();
      }

      protocol Main(role A, role B) {
        do Sub1(A, B);
        A -> B: MainMsg();
        do Sub2(A, B);
        A -> B: FinalMsg();
      }
    `;

    const module = parse(source);
    const mainProtocol = module.declarations.find(
      d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
    );
    expect(mainProtocol).toBeDefined();

    if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Main protocol not found');
    }

    const cfg = buildCFG(mainProtocol);
    const cfsmA = project(cfg, 'A');
    const cfsmB = project(cfg, 'B');

    // Role A should have send actions for MainMsg and FinalMsg (sub-protocols tau-eliminated)
    const actionsA = cfsmA.transitions
      .filter(t => t.action)
      .map(t => t.action!);

    expect(actionsA.some(a => a.type === 'send' && a.label === 'MainMsg')).toBe(true);
    expect(actionsA.some(a => a.type === 'send' && a.label === 'FinalMsg')).toBe(true);

    // Role B should have receive actions for MainMsg and FinalMsg
    const actionsB = cfsmB.transitions
      .filter(t => t.action)
      .map(t => t.action!);

    expect(actionsB.some(a => a.type === 'receive' && a.label === 'MainMsg')).toBe(true);
    expect(actionsB.some(a => a.type === 'receive' && a.label === 'FinalMsg')).toBe(true);
  });

  it('should handle nested sub-protocol invocations', () => {
    const source = `
      protocol Inner(role A, role B) {
        A -> B: InnerMsg();
      }

      protocol Middle(role A, role B) {
        do Inner(A, B);
        A -> B: MiddleMsg();
      }

      protocol Outer(role A, role B) {
        do Middle(A, B);
        A -> B: OuterMsg();
      }
    `;

    const module = parse(source);
    const outerProtocol = module.declarations.find(
      d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Outer'
    );
    expect(outerProtocol).toBeDefined();

    if (!outerProtocol || outerProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Outer protocol not found');
    }

    const cfg = buildCFG(outerProtocol);
    const cfsmA = project(cfg, 'A');
    const cfsmB = project(cfg, 'B');

    // CFSMs should be valid (have transitions)
    expect(cfsmA.transitions.length).toBeGreaterThan(0);
    expect(cfsmB.transitions.length).toBeGreaterThan(0);

    // Should have actions for OuterMsg (sub-protocols tau-eliminated)
    const actionsA = cfsmA.transitions
      .filter(t => t.action)
      .map(t => t.action!);

    expect(actionsA.some(a => a.type === 'send' && a.label === 'OuterMsg')).toBe(true);

    const actionsB = cfsmB.transitions
      .filter(t => t.action)
      .map(t => t.action!);

    expect(actionsB.some(a => a.type === 'receive' && a.label === 'OuterMsg')).toBe(true);
  });

  it('should handle sub-protocols with role remapping', () => {
    const source = `
      protocol Auth(role Client, role Server) {
        Client -> Server: Login(String);
        Server -> Client: LoginOk();
      }

      protocol Main(role Alice, role Bob) {
        do Auth(Alice, Bob);
        Alice -> Bob: Done();
      }
    `;

    const module = parse(source);
    const mainProtocol = module.declarations.find(
      d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
    );
    expect(mainProtocol).toBeDefined();

    if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Main protocol not found');
    }

    const cfg = buildCFG(mainProtocol);
    const aliceCFSM = project(cfg, 'Alice');
    const bobCFSM = project(cfg, 'Bob');

    // CFSMs should be valid
    expect(aliceCFSM.transitions.length).toBeGreaterThan(0);
    expect(bobCFSM.transitions.length).toBeGreaterThan(0);

    // Should have actions for Done message (sub-protocol tau-eliminated)
    const aliceActions = aliceCFSM.transitions
      .filter(t => t.action)
      .map(t => t.action!);

    expect(aliceActions.some(a => a.type === 'send' && a.label === 'Done')).toBe(true);

    const bobActions = bobCFSM.transitions
      .filter(t => t.action)
      .map(t => t.action!);

    expect(bobActions.some(a => a.type === 'receive' && a.label === 'Done')).toBe(true);
  });

  it('should create valid CFSMs with terminal states', () => {
    const source = `
      protocol Sub(role A, role B) {
        A -> B: SubMsg();
      }

      protocol Main(role A, role B) {
        do Sub(A, B);
        A -> B: MainMsg();
      }
    `;

    const module = parse(source);
    const mainProtocol = module.declarations.find(
      d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
    );
    expect(mainProtocol).toBeDefined();

    if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Main protocol not found');
    }

    const cfg = buildCFG(mainProtocol);
    const cfsmA = project(cfg, 'A');
    const cfsmB = project(cfg, 'B');

    // Both CFSMs should have an initial state defined
    expect(cfsmA.initialState).toBeDefined();
    expect(cfsmB.initialState).toBeDefined();

    // Both CFSMs should have at least one terminal state
    expect(cfsmA.terminalStates.length).toBeGreaterThan(0);
    expect(cfsmB.terminalStates.length).toBeGreaterThan(0);

    // Both CFSMs should have states and transitions (functional CFSMs)
    expect(cfsmA.states.length).toBeGreaterThan(0);
    expect(cfsmA.transitions.length).toBeGreaterThan(0);
    expect(cfsmB.states.length).toBeGreaterThan(0);
    expect(cfsmB.transitions.length).toBeGreaterThan(0);
  });

  it('should handle sub-protocols in choice branches', () => {
    const source = `
      protocol Auth(role C, role S) {
        C -> S: Login();
        S -> C: LoginOk();
      }

      protocol Main(role C, role S) {
        choice at C {
          do Auth(C, S);
          C -> S: Request1();
        } or {
          C -> S: Request2();
        }
      }
    `;

    const module = parse(source);
    const mainProtocol = module.declarations.find(
      d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
    );
    expect(mainProtocol).toBeDefined();

    if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Main protocol not found');
    }

    const cfg = buildCFG(mainProtocol);
    const cfsmC = project(cfg, 'C');
    const cfsmS = project(cfg, 'S');

    // CFSMs should be valid with choice branches
    expect(cfsmC.transitions.length).toBeGreaterThan(0);
    expect(cfsmS.transitions.length).toBeGreaterThan(0);

    // Client should have send actions for both Request1 and Request2
    const clientActions = cfsmC.transitions
      .filter(t => t.action)
      .map(t => t.action!);

    expect(clientActions.some(a => a.type === 'send' && a.label === 'Request1')).toBe(true);
    expect(clientActions.some(a => a.type === 'send' && a.label === 'Request2')).toBe(true);
  });
});
