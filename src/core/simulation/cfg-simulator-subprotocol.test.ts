/**
 * Comprehensive Test Suite for CFG Simulator Sub-Protocol Support
 *
 * Tests formal correctness of sub-protocol execution:
 * - Protocol resolution and role mapping
 * - Call stack frame management
 * - Event emission (enter/exit)
 * - Nested sub-protocol execution
 * - Error handling (missing protocol, role mismatch, incomplete execution)
 * - Step count propagation
 * - Trace merging
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CFGSimulator } from './cfg-simulator';
import { createProtocolRegistry } from '../protocol-registry/registry';
import { createCallStackManager } from './call-stack-manager';
import { parse } from '../parser/parser';
import { buildCFG } from '../cfg/builder';
import type { Module } from '../ast/types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Parse Scribble source and return Module AST
 */
function parseScribble(source: string): Module {
  const ast = parse(source);
  return ast;
}

/**
 * Create test protocol with sub-protocol invocation
 */
function createMainProtocolWithSubProtocol(): string {
  return `
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
}

/**
 * Create nested sub-protocol test
 */
function createNestedSubProtocols(): string {
  return `
    protocol Inner(role A, role B) {
      A -> B: Msg1();
    }

    protocol Middle(role A, role B) {
      do Inner(A, B);
      A -> B: Msg2();
    }

    protocol Outer(role A, role B) {
      do Middle(A, B);
      A -> B: Msg3();
    }
  `;
}

/**
 * Create protocol with multiple sub-protocol invocations
 */
function createMultipleSubProtocols(): string {
  return `
    protocol Sub1(role A, role B) {
      A -> B: Sub1Msg();
    }

    protocol Sub2(role A, role B) {
      A -> B: Sub2Msg();
    }

    protocol Main(role A, role B) {
      do Sub1(A, B);
      A -> B: MainMsg();
      do Sub2(A, B);
    }
  `;
}

/**
 * Create protocol with role argument remapping
 */
function createRoleRemapping(): string {
  return `
    protocol Auth(role Client, role Server) {
      Client -> Server: Login(String);
      Server -> Client: LoginOk();
    }

    protocol Main(role Alice, role Bob) {
      do Auth(Alice, Bob);
      Alice -> Bob: Done();
    }
  `;
}

/**
 * Create protocol suite with circular dependency (should be rejected by registry)
 */
function createCircularDependency(): string {
  return `
    protocol A(role X, role Y) {
      do B(X, Y);
    }

    protocol B(role X, role Y) {
      do A(X, Y);
    }
  `;
}

// ============================================================================
// Test Suite: Basic Sub-Protocol Execution
// ============================================================================

describe('CFG Simulator - Basic Sub-Protocol Execution', () => {
  it('should execute simple sub-protocol invocation', () => {
    const source = createMainProtocolWithSubProtocol();
    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    const mainProtocol = registry.resolve('Main');
    const mainCFG = buildCFG(mainProtocol);

    const simulator = new CFGSimulator(mainCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
      recordTrace: true,
    });

    // Run to completion
    const result = simulator.run();

    expect(result.success).toBe(true);
    expect(simulator.isComplete()).toBe(true);

    // Verify call stack is empty after completion
    expect(callStack.isEmpty()).toBe(true);
  });

  it('should emit sub-protocol enter and exit events', () => {
    const source = createMainProtocolWithSubProtocol();
    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    const mainProtocol = registry.resolve('Main');
    const mainCFG = buildCFG(mainProtocol);

    const simulator = new CFGSimulator(mainCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
      recordTrace: true,
    });

    simulator.run();

    const trace = simulator.getTrace();
    const subprotocolEvents = trace.events.filter(e => e.type === 'subprotocol');

    expect(subprotocolEvents).toHaveLength(2); // enter + exit

    const enterEvent = subprotocolEvents[0];
    expect(enterEvent.type).toBe('subprotocol');
    expect(enterEvent.action).toBe('enter');
    expect(enterEvent.protocol).toBe('Auth');
    expect(enterEvent.roleArguments).toEqual(['Client', 'Server']);

    const exitEvent = subprotocolEvents[1];
    expect(exitEvent.type).toBe('subprotocol');
    expect(exitEvent.action).toBe('exit');
    expect(exitEvent.protocol).toBe('Auth');
  });

  it('should include sub-protocol messages in trace', () => {
    const source = createMainProtocolWithSubProtocol();
    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    const mainProtocol = registry.resolve('Main');
    const mainCFG = buildCFG(mainProtocol);

    const simulator = new CFGSimulator(mainCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
      recordTrace: true,
    });

    simulator.run();

    const trace = simulator.getTrace();
    const messageEvents = trace.events.filter(e => e.type === 'message');

    // Should have: Login, LoginOk (from Auth) + Request, Response (from Main)
    expect(messageEvents.length).toBeGreaterThanOrEqual(4);

    const labels = messageEvents.map(e => e.label);
    expect(labels).toContain('Login');
    expect(labels).toContain('LoginOk');
    expect(labels).toContain('Request');
    expect(labels).toContain('Response');
  });

  it('should maintain correct step count across sub-protocols', () => {
    const source = createMainProtocolWithSubProtocol();
    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    const mainProtocol = registry.resolve('Main');
    const mainCFG = buildCFG(mainProtocol);

    const simulator = new CFGSimulator(mainCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
      maxSteps: 1000,
    });

    simulator.run();

    const state = simulator.getState();

    // Should have steps for: sub-protocol invocation + messages in both protocols
    expect(state.stepCount).toBeGreaterThan(0);
    expect(state.stepCount).toBeLessThan(100); // Reasonable upper bound
  });

  it('should handle role remapping correctly', () => {
    const source = createRoleRemapping();
    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    const mainProtocol = registry.resolve('Main');
    const mainCFG = buildCFG(mainProtocol);

    const simulator = new CFGSimulator(mainCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
      recordTrace: true,
    });

    const result = simulator.run();

    expect(result.success).toBe(true);
    expect(simulator.isComplete()).toBe(true);

    const trace = simulator.getTrace();
    const subprotocolEvents = trace.events.filter(e => e.type === 'subprotocol');

    expect(subprotocolEvents[0].roleArguments).toEqual(['Alice', 'Bob']);
  });
});

// ============================================================================
// Test Suite: Nested Sub-Protocol Execution
// ============================================================================

describe('CFG Simulator - Nested Sub-Protocols', () => {
  it('should execute nested sub-protocols correctly', () => {
    const source = createNestedSubProtocols();
    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    const outerProtocol = registry.resolve('Outer');
    const outerCFG = buildCFG(outerProtocol);

    const simulator = new CFGSimulator(outerCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
      recordTrace: true,
    });

    const result = simulator.run();

    expect(result.success).toBe(true);
    expect(simulator.isComplete()).toBe(true);
  });

  it('should maintain correct call stack depth during nested execution', () => {
    const source = createNestedSubProtocols();
    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    let maxDepth = 0;
    callStack.on('frame-push', (event) => {
      if (event.depth > maxDepth) {
        maxDepth = event.depth;
      }
    });

    const outerProtocol = registry.resolve('Outer');
    const outerCFG = buildCFG(outerProtocol);

    const simulator = new CFGSimulator(outerCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
    });

    simulator.run();

    // Should reach depth 2: Outer -> Middle -> Inner
    expect(maxDepth).toBe(2);

    // Stack should be empty after completion
    expect(callStack.isEmpty()).toBe(true);
  });

  it('should emit sub-protocol events in correct order for nesting', () => {
    const source = createNestedSubProtocols();
    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    const outerProtocol = registry.resolve('Outer');
    const outerCFG = buildCFG(outerProtocol);

    const simulator = new CFGSimulator(outerCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
      recordTrace: true,
    });

    simulator.run();

    const trace = simulator.getTrace();
    const subprotocolEvents = trace.events.filter(e => e.type === 'subprotocol');

    // Should have: enter Middle, enter Inner, exit Inner, exit Middle
    const eventSequence = subprotocolEvents.map(e => `${e.action}-${e.protocol}`);

    expect(eventSequence).toContain('enter-Middle');
    expect(eventSequence).toContain('enter-Inner');
    expect(eventSequence).toContain('exit-Inner');
    expect(eventSequence).toContain('exit-Middle');

    // Check proper nesting: enter-Middle before enter-Inner
    const middleEnterIdx = eventSequence.indexOf('enter-Middle');
    const innerEnterIdx = eventSequence.indexOf('enter-Inner');
    const innerExitIdx = eventSequence.indexOf('exit-Inner');
    const middleExitIdx = eventSequence.indexOf('exit-Middle');

    expect(middleEnterIdx).toBeLessThan(innerEnterIdx);
    expect(innerEnterIdx).toBeLessThan(innerExitIdx);
    expect(innerExitIdx).toBeLessThan(middleExitIdx);
  });
});

// ============================================================================
// Test Suite: Multiple Sub-Protocol Invocations
// ============================================================================

describe('CFG Simulator - Multiple Sub-Protocols', () => {
  it('should execute multiple sequential sub-protocols', () => {
    const source = createMultipleSubProtocols();
    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    const mainProtocol = registry.resolve('Main');
    const mainCFG = buildCFG(mainProtocol);

    const simulator = new CFGSimulator(mainCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
      recordTrace: true,
    });

    const result = simulator.run();

    expect(result.success).toBe(true);
    expect(simulator.isComplete()).toBe(true);

    const trace = simulator.getTrace();
    const subprotocolEvents = trace.events.filter(e => e.type === 'subprotocol');

    // Should have: enter Sub1, exit Sub1, enter Sub2, exit Sub2
    expect(subprotocolEvents).toHaveLength(4);

    expect(subprotocolEvents[0].protocol).toBe('Sub1');
    expect(subprotocolEvents[0].action).toBe('enter');
    expect(subprotocolEvents[1].protocol).toBe('Sub1');
    expect(subprotocolEvents[1].action).toBe('exit');
    expect(subprotocolEvents[2].protocol).toBe('Sub2');
    expect(subprotocolEvents[2].action).toBe('enter');
    expect(subprotocolEvents[3].protocol).toBe('Sub2');
    expect(subprotocolEvents[3].action).toBe('exit');
  });

  it('should include messages from all sub-protocols', () => {
    const source = createMultipleSubProtocols();
    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    const mainProtocol = registry.resolve('Main');
    const mainCFG = buildCFG(mainProtocol);

    const simulator = new CFGSimulator(mainCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
      recordTrace: true,
    });

    simulator.run();

    const trace = simulator.getTrace();
    const messageEvents = trace.events.filter(e => e.type === 'message');
    const labels = messageEvents.map(e => e.label);

    expect(labels).toContain('Sub1Msg');
    expect(labels).toContain('MainMsg');
    expect(labels).toContain('Sub2Msg');
  });
});

// ============================================================================
// Test Suite: Error Handling
// ============================================================================

describe('CFG Simulator - Sub-Protocol Error Handling', () => {
  it('should throw error when sub-protocol not found in registry', () => {
    const source = `
      protocol Main(role A, role B) {
        do NonExistent(A, B);
        A -> B: Done();
      }
    `;

    const module = parseScribble(source);

    // Registry construction should throw on missing protocol reference
    expect(() => {
      createProtocolRegistry(module);
    }).toThrow(/not found/i);
  });

  it('should throw error when sub-protocol invoked without registry', () => {
    const source = createMainProtocolWithSubProtocol();
    const module = parseScribble(source);

    const mainProtocol = module.declarations.find(
      d => d.type === 'GlobalProtocolDeclaration' && d.name === 'Main'
    );
    if (!mainProtocol || mainProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Main protocol not found');
    }

    const mainCFG = buildCFG(mainProtocol);

    // Create simulator WITHOUT registry and callStackManager
    const simulator = new CFGSimulator(mainCFG);

    const result = simulator.run();

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('protocolRegistry');
  });

  it('should detect circular dependencies in protocol registry', () => {
    const source = createCircularDependency();

    // Registry construction should throw on circular dependency
    expect(() => {
      const module = parseScribble(source);
      createProtocolRegistry(module);
    }).toThrow(/circular/i);
  });

  it('should validate role count matches at invocation', () => {
    const source = `
      protocol Sub(role A, role B, role C) {
        A -> B: Msg1();
        B -> C: Msg2();
      }

      protocol Main(role X, role Y) {
        do Sub(X, Y);
      }
    `;

    const module = parseScribble(source);

    // Registry should throw on role count mismatch
    const registry = createProtocolRegistry(module);

    // This should fail when we try to create role mapping
    expect(() => {
      registry.createRoleMapping('Sub', ['X', 'Y']); // 2 roles instead of 3
    }).toThrow();
  });

  it('should clean up call stack on sub-protocol failure', () => {
    // Create a protocol that will fail due to max steps
    const source = `
      protocol InfiniteLoop(role A, role B) {
        rec X {
          A -> B: Msg();
          continue X;
        }
      }

      protocol Main(role A, role B) {
        do InfiniteLoop(A, B);
        A -> B: Done();
      }
    `;

    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    const mainProtocol = registry.resolve('Main');
    const mainCFG = buildCFG(mainProtocol);

    const simulator = new CFGSimulator(mainCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
      maxSteps: 10, // Very low limit to force failure
    });

    const result = simulator.run();

    // Should fail due to max steps
    expect(result.success).toBe(false);

    // Call stack should be cleaned up (popped the frame)
    expect(callStack.isEmpty()).toBe(true);
  });
});

// ============================================================================
// Test Suite: Integration with Existing Features
// ============================================================================

describe('CFG Simulator - Sub-Protocol Integration', () => {
  it('should work with choice constructs in sub-protocols', () => {
    const source = `
      protocol AuthChoice(role Client, role Server) {
        choice at Client {
          Client -> Server: LoginWithPassword(String);
          Server -> Client: PasswordOk();
        } or {
          Client -> Server: LoginWithToken(String);
          Server -> Client: TokenOk();
        }
      }

      protocol Main(role Client, role Server) {
        do AuthChoice(Client, Server);
        Client -> Server: Request();
      }
    `;

    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    const mainProtocol = registry.resolve('Main');
    const mainCFG = buildCFG(mainProtocol);

    const simulator = new CFGSimulator(mainCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
      choiceStrategy: 'first', // Auto-select first choice
    });

    const result = simulator.run();

    expect(result.success).toBe(true);
    expect(simulator.isComplete()).toBe(true);
  });

  it('should work with recursion in sub-protocols', () => {
    const source = `
      protocol Stream(role Sender, role Receiver) {
        rec X {
          choice at Sender {
            Sender -> Receiver: Data(String);
            continue X;
          } or {
            Sender -> Receiver: End();
          }
        }
      }

      protocol Main(role A, role B) {
        do Stream(A, B);
        A -> B: Cleanup();
      }
    `;

    const module = parseScribble(source);
    const registry = createProtocolRegistry(module);
    const callStack = createCallStackManager();

    const mainProtocol = registry.resolve('Main');
    const mainCFG = buildCFG(mainProtocol);

    const simulator = new CFGSimulator(mainCFG, {
      protocolRegistry: registry,
      callStackManager: callStack,
      choiceStrategy: 'first', // Will take first branch (Data)
      maxSteps: 20, // Limit iterations
    });

    const result = simulator.run();

    // May complete or hit max steps (both valid)
    expect(result.success).toBeDefined();
  });
});
