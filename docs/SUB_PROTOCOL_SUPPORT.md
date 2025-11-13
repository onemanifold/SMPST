# Sub-Protocol Support in SMPST

**Complete Guide to Protocol Modularity and Composition**

This document explains sub-protocol support in SMPST, covering both the theoretical foundations from Multiparty Session Types (MPST) theory and the practical implementation details.

---

## Table of Contents

1. [Theory: What are Sub-Protocols?](#theory-what-are-sub-protocols)
2. [Formal Semantics](#formal-semantics)
3. [Architecture Overview](#architecture-overview)
4. [Implementation Guide](#implementation-guide)
5. [Testing Strategy](#testing-strategy)
6. [UI Integration](#ui-integration)
7. [Examples](#examples)
8. [Troubleshooting](#troubleshooting)

---

## Theory: What are Sub-Protocols?

### Motivation

In real-world distributed systems, protocols often need to be **modular** and **reusable**. Sub-protocols allow you to:

1. **Decompose complex protocols** into smaller, manageable units
2. **Reuse common patterns** (e.g., authentication, heartbeat)
3. **Maintain formal correctness** while supporting composition
4. **Enable separate verification** of each protocol component

### Scribble Syntax

In Scribble, sub-protocols are invoked using the `do` statement:

```scribble
protocol Auth(role Client, role Server) {
  Client -> Server: Login(String);
  Server -> Client: LoginOk();
}

protocol Main(role Client, role Server) {
  do Auth(Client, Server);  // Sub-protocol invocation
  Client -> Server: Request(String);
  Server -> Client: Response(Int);
}
```

### Key Concepts

**Protocol Declaration**: Defines a reusable protocol template with formal parameters (roles).

**Sub-Protocol Invocation**: Instantiates a protocol template with actual role arguments.

**Role Mapping**: Maps formal parameters to actual roles at invocation site.
- Formal roles: `Client`, `Server` (in Auth definition)
- Actual roles: `Alice`, `Bob` (at invocation site)
- Mapping: `{Client → Alice, Server → Bob}`

**Execution Semantics**: Sub-protocol execution is **synchronous and atomic**:
1. Caller protocol suspends at `do` statement
2. Sub-protocol executes to completion
3. Control returns to caller protocol
4. Execution continues from next statement

---

## Formal Semantics

### Projection Rules

Sub-protocol projection follows the standard MPST projection rules from **Honda, Yoshida, Carbone (2008)**:

**Global Protocol Projection**:
```
G ::= ... | do P(r₁, ..., rₙ)

Project(do P(r₁, ..., rₙ), rᵢ) = do P_rⱼ(r₁, ..., rₙ)
  where rⱼ is the formal role that maps to rᵢ
```

**Local Protocol Projection**:
```
L ::= ... | do P_r(r₁, ..., rₙ)

The local protocol P_r is the projection of global protocol P to role r
```

### Type Safety

Sub-protocol invocation preserves type safety through:

1. **Role Count Matching**: `|formal_roles| = |actual_roles|`
2. **Bijective Role Mapping**: Each formal role maps to exactly one actual role
3. **Acyclic Dependencies**: No circular protocol references
4. **Complete Resolution**: All referenced protocols must exist in registry

### Operational Semantics

**Call Stack Semantics**:

```
Configuration: (G, σ, κ)
  G = Current global protocol
  σ = Current state (node in CFG)
  κ = Call stack (list of frames)

Transition Rules:

[SUB-ENTER]
σ = do P(r₁, ..., rₙ)
────────────────────────────────────────
(G, σ, κ) → (P, entry(P), push(κ, frame))

[SUB-EXIT]
σ = terminal(P)
κ = frame :: κ'
────────────────────────────────────────
(P, σ, κ) → (G, exit(frame), κ')
```

**Frame Structure**:
```typescript
Frame = {
  type: 'subprotocol',
  name: string,              // Protocol name
  entryNode: NodeId,         // Where we entered from
  exitNode: NodeId,          // Where to return to
  roleMapping: Mapping,      // Formal ↔ Actual
  subCFG: CFG,              // Sub-protocol CFG
}
```

---

## Architecture Overview

### Components

```
┌─────────────────────────────────────────────────────┐
│                  CFG Simulator                       │
│  ┌────────────────────────────────────────────┐    │
│  │ executeSubProtocol()                        │    │
│  │  1. Resolve protocol from registry          │    │
│  │  2. Create role mapping                     │    │
│  │  3. Build CFG for sub-protocol              │    │
│  │  4. Push call stack frame                   │    │
│  │  5. Execute sub-protocol (recursive)        │    │
│  │  6. Pop call stack frame                    │    │
│  │  7. Continue parent execution               │    │
│  └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
           │                          │
           │                          │
           ↓                          ↓
┌──────────────────────┐  ┌───────────────────────┐
│  Protocol Registry    │  │  Call Stack Manager   │
│  ─────────────────   │  │  ──────────────────   │
│  - resolve()         │  │  - push()             │
│  - validateDeps()    │  │  - pop()              │
│  - createMapping()   │  │  - getState()         │
│  - getCFG()          │  │  - emit events        │
└──────────────────────┘  └───────────────────────┘
```

### Data Flow

1. **Protocol Resolution**:
   ```
   do Auth(Alice, Bob)
     → registry.resolve("Auth")
     → GlobalProtocolDeclaration
   ```

2. **Role Mapping**:
   ```
   formal: [Client, Server]
   actual: [Alice, Bob]
     → mapping: {Client→Alice, Server→Bob}
     → reverse: {Alice→Client, Bob→Server}
   ```

3. **CFG Construction**:
   ```
   GlobalProtocolDeclaration
     → buildCFG()
     → CFG (Control Flow Graph)
   ```

4. **Call Stack Management**:
   ```
   Frame {
     name: "Auth",
     entry: "main_node_5",
     exit: "main_node_6",
     roleMapping: {...},
     subCFG: {...}
   }
   ```

5. **Recursive Execution**:
   ```
   new CFGSimulator(subCFG, {
     protocolRegistry: parent.registry,
     callStackManager: parent.callStack,
     ...config
   })
   ```

---

## Implementation Guide

### For Application Developers

#### Basic Usage

```typescript
import { parse } from './parser/parser';
import { buildCFG } from './cfg/builder';
import { CFGSimulator } from './simulation/cfg-simulator';
import { createProtocolRegistry } from './protocol-registry/registry';
import { createCallStackManager } from './simulation/call-stack-manager';

// 1. Parse your protocol suite
const source = `
  protocol Auth(role Client, role Server) {
    Client -> Server: Login(String);
    Server -> Client: LoginOk();
  }

  protocol Main(role Client, role Server) {
    do Auth(Client, Server);
    Client -> Server: Request();
  }
`;
const ast = parse(source);

// 2. Create registry (validates dependencies)
const registry = createProtocolRegistry(ast);

// 3. Create call stack manager
const callStack = createCallStackManager({
  maxDepth: 100,        // Maximum nesting depth
  maxIterations: 1000,  // For recursion limits
});

// 4. Build CFG for main protocol
const mainProtocol = registry.resolve('Main');
const cfg = buildCFG(mainProtocol);

// 5. Create simulator with sub-protocol support
const simulator = new CFGSimulator(cfg, {
  protocolRegistry: registry,
  callStackManager: callStack,
  recordTrace: true,  // Enable event recording
});

// 6. Run simulation
const result = simulator.run();

if (result.success) {
  console.log('Protocol completed successfully!');

  // Access trace events
  const trace = simulator.getTrace();
  const subprotocolEvents = trace.events.filter(e => e.type === 'subprotocol');

  console.log('Sub-protocol invocations:', subprotocolEvents.length / 2);
} else {
  console.error('Protocol failed:', result.error);
}
```

#### Event Handling

Subscribe to call stack events for UI updates:

```typescript
// Monitor call stack changes
callStack.on('frame-push', (event) => {
  console.log(`Entering ${event.frame.name}`);
  console.log(`Call depth: ${event.depth}`);

  // Update UI: highlight sub-protocol node
  ui.highlightNode(event.frame.entryNodeId);
});

callStack.on('frame-pop', (event) => {
  console.log(`Exiting ${event.frame.name}`);
  console.log(`Duration: ${event.duration}ms`);

  // Update UI: return to parent protocol
  ui.highlightNode(event.frame.exitNodeId);
});

callStack.on('frame-step', (event) => {
  console.log(`Step in ${event.frame.name}: ${event.nodeId}`);

  // Update UI: show current position
  ui.updatePosition(event.nodeId);
});
```

### For Library Developers

#### Extending Protocol Registry

Add custom validation rules:

```typescript
class CustomProtocolRegistry extends ProtocolRegistry {
  validate(protocol: GlobalProtocolDeclaration): ValidationResult {
    const baseResult = super.validateDependencies();

    // Add custom checks
    const customErrors: ValidationError[] = [];

    // Example: Check naming conventions
    if (!/^[A-Z]/.test(protocol.name)) {
      customErrors.push({
        type: 'custom',
        protocolName: protocol.name,
        message: 'Protocol names must start with uppercase',
      });
    }

    return {
      valid: baseResult.valid && customErrors.length === 0,
      errors: [...baseResult.errors, ...customErrors],
    };
  }
}
```

#### Custom Call Stack Frame Metadata

Add domain-specific metadata to frames:

```typescript
const callStack = createCallStackManager();

// Add custom metadata when pushing frames
callStack.push({
  type: 'subprotocol',
  name: 'Auth',
  entryNodeId: 'node_5',
  exitNodeId: 'node_6',
  currentNode: 'entry',
  subCFG: authCFG,
  roleMapping: mapping,
  metadata: {
    // Custom fields
    securityLevel: 'high',
    timeout: 5000,
    retryCount: 0,
  },
});
```

---

## Testing Strategy

### Unit Tests

Test individual components in isolation:

```typescript
describe('Protocol Registry', () => {
  it('should detect circular dependencies', () => {
    const source = `
      protocol A(role X, role Y) { do B(X, Y); }
      protocol B(role X, role Y) { do A(X, Y); }
    `;

    expect(() => {
      const ast = parse(source);
      createProtocolRegistry(ast);
    }).toThrow(/circular/i);
  });

  it('should validate role counts', () => {
    const registry = createProtocolRegistry(ast);

    expect(() => {
      registry.createRoleMapping('Auth', ['Alice']); // Too few roles
    }).toThrow(/mismatch/i);
  });
});
```

### Integration Tests

Test complete sub-protocol execution:

```typescript
describe('Sub-Protocol Execution', () => {
  it('should execute nested sub-protocols', () => {
    const source = `
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

    const ast = parse(source);
    const registry = createProtocolRegistry(ast);
    const callStack = createCallStackManager();

    const cfg = buildCFG(registry.resolve('Outer'));
    const simulator = new CFGSimulator(cfg, {
      protocolRegistry: registry,
      callStackManager: callStack,
    });

    const result = simulator.run();

    expect(result.success).toBe(true);
    expect(callStack.isEmpty()).toBe(true); // Stack cleaned up
  });
});
```

### Test Coverage Goals

Aim for 100% coverage of:
- ✅ Protocol resolution and validation
- ✅ Role mapping creation and validation
- ✅ Call stack operations (push/pop/step)
- ✅ Event emission
- ✅ Error handling (missing protocols, role mismatches)
- 🔄 Nested sub-protocol execution (in progress)
- ⏳ Trace merging across protocol boundaries

---

## UI Integration

### Visualization Strategy

**CFG View**: Show sub-protocols as **collapsible nodes**

```
┌──────────────────────────────────────┐
│  Main Protocol CFG                    │
│  ┌─────────┐                         │
│  │ Initial │                         │
│  └─────────┘                         │
│      ↓                                │
│  ┌─────────────────────┐             │
│  │ 📦 do Auth(...)     │ ← Collapsed │
│  │   [Click to expand] │             │
│  └─────────────────────┘             │
│      ↓                                │
│  ┌─────────┐                         │
│  │ Request │                         │
│  └─────────┘                         │
└──────────────────────────────────────┘

When expanded:
┌──────────────────────────────────────┐
│  Main Protocol CFG                    │
│  ┌─────────┐                         │
│  │ Initial │                         │
│  └─────────┘                         │
│      ↓                                │
│  ┌─────────────────────────────────┐ │
│  │ 📂 do Auth(Client, Server)      │ │
│  │  ┌─────────┐                    │ │
│  │  │  Login  │                    │ │
│  │  └─────────┘                    │ │
│  │      ↓                           │ │
│  │  ┌─────────┐                    │ │
│  │  │ LoginOk │                    │ │
│  │  └─────────┘                    │ │
│  └─────────────────────────────────┘ │
│      ↓                                │
│  ┌─────────┐                         │
│  │ Request │                         │
│  └─────────┘                         │
└──────────────────────────────────────┘
```

**Call Stack Panel**: Show active protocol hierarchy

```
┌──────────────────────────────────────────────────┐
│ Protocol Call Stack                   [Collapse] │
├──────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐│
│ │ 1. Main Protocol                             ││
│ │    at node: main_5                           ││
│ │    Step 5/12                                 ││
│ └──────────────────────────────────────────────┘│
│                       ↓                          │
│ ┌──────────────────────────────────────────────┐│
│ │ 2. 📞 Auth(Client→Alice, Server→Bob)         ││ ← Active
│ │    at node: auth_2                           ││
│ │    Step 2/4                                  ││
│ └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

### Event Stream Integration

Subscribe to events for real-time UI updates:

```typescript
// CFG Simulator events
simulator.on('subprotocol-enter', (event) => {
  ui.callStack.push({
    name: event.protocol,
    roles: event.roleArguments,
    depth: callStack.getDepth(),
  });
});

simulator.on('subprotocol-exit', (event) => {
  ui.callStack.pop();
  ui.highlightNode(event.nodeId); // Return to parent
});

// Call Stack Manager events
callStack.on('frame-step', (event) => {
  ui.cfgView.highlightNode(event.nodeId);
  ui.updateStepCounter(event.frame.stepCount);
});
```

### Trace Visualization

Show execution timeline with sub-protocol boundaries:

```
Timeline:
├─ [Main] Initial
├─ [Main] ──► Enter Auth ───────────┐
│                                    │
├─ [Auth] Login                      │  Sub-protocol
├─ [Auth] LoginOk                    │  execution
│                                    │
├─ [Main] ◄── Exit Auth ─────────────┘
├─ [Main] Request
├─ [Main] Response
└─ [Main] Terminal
```

---

## Examples

### Example 1: Authentication Protocol

```scribble
// Reusable authentication sub-protocol
protocol Auth(role Client, role Server) {
  Client -> Server: Username(String);
  choice at Server {
    Server -> Client: AuthSuccess();
  } or {
    Server -> Client: AuthFailed();
  }
}

// Main protocol using authentication
protocol SecureDataTransfer(role Client, role Server) {
  do Auth(Client, Server);

  // Only reached if auth succeeds
  rec DataLoop {
    choice at Client {
      Client -> Server: Data(String);
      Server -> Client: Ack();
      continue DataLoop;
    } or {
      Client -> Server: Finish();
    }
  }
}
```

### Example 2: Three-Party Protocol with Sub-Protocols

```scribble
// Two-party negotiation
protocol Negotiate(role Buyer, role Seller) {
  Buyer -> Seller: Offer(Int);
  choice at Seller {
    Seller -> Buyer: Accept();
  } or {
    Seller -> Buyer: Counter(Int);
    Buyer -> Seller: FinalDecision(Bool);
  }
}

// Three-party purchase with negotiation
protocol Purchase(role Buyer, role Seller, role Bank) {
  // Negotiation phase (Buyer ↔ Seller)
  do Negotiate(Buyer, Seller);

  // Payment phase (Buyer ↔ Bank)
  Buyer -> Bank: PaymentRequest(Int);
  Bank -> Buyer: PaymentConfirm();

  // Delivery phase (Seller → Buyer)
  Seller -> Buyer: DeliverGoods();
}
```

### Example 3: Nested Sub-Protocols

```scribble
// Lowest level: Simple ping-pong
protocol Ping(role A, role B) {
  A -> B: Ping();
  B -> A: Pong();
}

// Middle level: Heartbeat with ping
protocol Heartbeat(role A, role B) {
  rec Beat {
    choice at A {
      do Ping(A, B);
      continue Beat;
    } or {
      A -> B: Stop();
    }
  }
}

// Top level: Connection with heartbeat
protocol Connection(role A, role B) {
  A -> B: Connect();
  do Heartbeat(A, B);
  A -> B: Disconnect();
}
```

---

## Troubleshooting

### Common Issues

#### Issue: "Protocol not found" during simulation

**Cause**: Protocol registry doesn't have the referenced protocol.

**Solution**: Ensure all protocols are declared in the same module:

```typescript
// ✗ Wrong - protocols in separate parses
const auth = parse('protocol Auth(...)');
const main = parse('protocol Main(...) { do Auth(...); }');

// ✓ Correct - protocols in same module
const source = `
  protocol Auth(...) { ... }
  protocol Main(...) { do Auth(...); }
`;
const ast = parse(source);
```

#### Issue: "Role count mismatch"

**Cause**: Number of actual roles doesn't match formal parameters.

**Solution**: Check role arguments at invocation site:

```scribble
// Protocol declaration
protocol Auth(role Client, role Server) { ... }

// ✗ Wrong - only 1 role
do Auth(Alice);

// ✓ Correct - 2 roles
do Auth(Alice, Bob);
```

#### Issue: "Circular dependency detected"

**Cause**: Protocols reference each other in a cycle.

**Solution**: Refactor to eliminate cycles:

```scribble
// ✗ Wrong - circular
protocol A(role X, role Y) { do B(X, Y); }
protocol B(role X, role Y) { do A(X, Y); }

// ✓ Correct - hierarchical
protocol Base(role X, role Y) { X -> Y: Msg(); }
protocol A(role X, role Y) { do Base(X, Y); }
protocol B(role X, role Y) { do Base(X, Y); }
```

#### Issue: Call stack not empty after completion

**Cause**: Sub-protocol didn't complete successfully.

**Solution**: Check for errors in sub-protocol execution:

```typescript
const result = simulator.run();

if (!result.success) {
  console.error('Simulation failed:', result.error);

  // Check call stack state
  const stackState = callStack.getState();
  console.log('Stack depth:', stackState.depth);
  console.log('Current frame:', stackState.currentFrame);
}
```

#### Issue: Maximum stack depth exceeded

**Cause**: Too many nested sub-protocols or recursion.

**Solution**: Increase max depth or check for unintended nesting:

```typescript
const callStack = createCallStackManager({
  maxDepth: 200, // Increase from default 100
});

// Or check for recursive sub-protocol calls
```

### Performance Considerations

**CFG Caching**: Protocol registry caches built CFGs:

```typescript
// First call builds CFG
const cfg1 = registry.getCFG('Auth');

// Subsequent calls return cached CFG
const cfg2 = registry.getCFG('Auth'); // Fast!
```

**Event Handler Overhead**: Minimize event handlers in hot paths:

```typescript
// ✗ Slow - many handlers
callStack.on('frame-step', heavyLoggingFunction);

// ✓ Fast - batch processing
const events = [];
callStack.on('frame-step', (e) => events.push(e));
// Process events.length after simulation
```

---

## References

### Academic Papers

1. **Honda, Yoshida, Carbone (2008)**: "Multiparty Asynchronous Session Types"
   - Defines formal semantics for MPST
   - Projection rules for local protocols
   - Type safety proofs

2. **Scribble Language Specification**: http://www.scribble.org/
   - Official syntax and semantics
   - Sub-protocol composition rules

3. **Carbone, Honda, Yoshida (2012)**: "Structured Communication-Centered Programming for Web Services"
   - Practical applications of MPST
   - Protocol modularity patterns

### Implementation References

- **Protocol Registry**: `src/core/protocol-registry/registry.ts`
- **Call Stack Manager**: `src/core/simulation/call-stack-manager.ts`
- **CFG Simulator**: `src/core/simulation/cfg-simulator.ts`
- **Type Definitions**: `src/core/simulation/call-stack-types.ts`

### Test Suites

- **Registry Tests**: `src/core/protocol-registry/registry.test.ts` (34 tests)
- **Call Stack Tests**: `src/core/simulation/call-stack-manager.test.ts` (49 tests)
- **Sub-Protocol Tests**: `src/core/simulation/cfg-simulator-subprotocol.test.ts` (17 tests)

---

## Future Work

### Planned Enhancements

1. **CFSM Projection with Sub-Protocols** ⏳
   - Project sub-protocol invocations to local CFSMs
   - Maintain modularity in CFSM view

2. **Parameterized Protocols** 🔮
   - Support for protocol parameters beyond roles
   - Message type parameterization

3. **Protocol Libraries** 🔮
   - Standard library of common patterns
   - Import/export between modules

4. **Performance Optimizations** 🔮
   - Parallel sub-protocol execution (when safe)
   - Incremental CFG construction

5. **Advanced Visualization** 🔮
   - Protocol dependency graphs
   - Interactive call tree exploration

### Known Limitations

- **Nested Sub-Protocols**: Current implementation has issues with deeply nested sub-protocols sharing call stack state. Requires refactoring to use separate call stack contexts.

- **Cross-Module References**: Currently limited to single-module protocols. Multi-module support planned.

- **Dynamic Protocol Selection**: No runtime protocol selection. All protocols must be statically defined.

---

## Contributing

When extending sub-protocol support:

1. **Follow TDD**: Write tests first, then implementation
2. **Maintain formal correctness**: Validate against MPST theory
3. **Document thoroughly**: Update this guide with new features
4. **Test edge cases**: Focus on error conditions and boundaries
5. **Preserve backward compatibility**: Existing tests must pass

---

**Last Updated**: 2025-01-12
**Version**: 1.0.0
**Author**: SMPST Team
