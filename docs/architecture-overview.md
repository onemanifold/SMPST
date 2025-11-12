# Architecture Overview: CFG-Based Scribble MPST IDE

## Introduction

This document explains the architectural design of the Scribble MPST IDE, focusing on how different components work together to transform protocol specifications into working distributed systems.

**Project Purpose**: This is a **LIVE tutorial system for teaching Multiparty Session Types (MPST) formal theory in depth**. The architecture is designed not just for correctness, but for educational clarity—enabling interactive visualizations and step-by-step exploration of MPST concepts.

**Key Question**: Why do we need a Control Flow Graph (CFG) when we already have an Abstract Syntax Tree (AST)?

**Answer**: The AST represents *syntax* (what you wrote), while the CFG represents *semantics* (what it means to execute). The CFG is the central artifact that powers both **verification** (proving your protocol is safe) and **runtime execution** (making it work in practice).

**Educational Goal**: Enable students to see and interact with:
- Global choreographies (CFG visualization)
- Local protocols (CFSM visualization)
- Projection correctness (side-by-side comparison)
- Synchronous vs asynchronous semantics (dual simulation modes)
- Static vs dynamic verification (verifier + simulators)

## The Complete Pipeline

```
┌─────────────┐     ┌─────────┐     ┌─────────┐     ┌────────┐     ┌──────────────┐
│  Scribble   │────▶│   AST   │────▶│   CFG   │────▶│  CFSM  │────▶│    State     │
│   Source    │     │         │     │         │     │        │     │   Machine    │
└─────────────┘     └─────────┘     └─────────┘     └────────┘     └──────────────┘
     (Text)          (Syntax)       (Semantics)     (Local Per      (Runtime
                                                       Role)         Execution)
```

### Step-by-Step Explanation

#### 1. **Scribble Source → AST** (Parsing)
- **What**: Your protocol description in Scribble syntax
- **Parser**: Chevrotain-based parser reads the text
- **Output**: Abstract Syntax Tree preserving source structure
- **Why AST?**: Provides type-safe representation with source locations for error reporting

#### 2. **AST → CFG** (Semantic Analysis)
- **What**: Transform syntactic structure into execution flow
- **Process**: Apply transformation rules (see `docs/cfg-design.md`)
- **Output**: Control Flow Graph with nodes (states) and edges (transitions)
- **Why CFG?**:
  - **Explicit control flow**: Shows all possible execution paths
  - **Verification target**: Algorithms detect deadlocks, livelocks, races
  - **Projection source**: Derive local behavior per role
  - **Simulation guide**: Drive interactive protocol execution

**This is the critical transformation.** The CFG makes implicit execution order explicit.

#### 3. **CFG → CFSM** (Projection)
- **What**: Extract one role's view from the global CFG
- **Process**: Project CFG to local Communicating Finite State Machine
- **Output**: Per-role CFSM showing only that role's actions
- **Why CFSM?**: Each participant needs their local protocol, not the global view

#### 4. **CFSM → State Machine** (Runtime Mapping)
- **What**: Map CFSM to executable state machine
- **Process**: States become runtime states, transitions become handlers
- **Output**: State machine that guides execution
- **Why State Machine?**: Bridges verification artifact to runtime behavior

#### 5. **State Machine → Working Code** (Code Generation)
- **What**: Generate implementation from state machine
- **Process**: Use ts-morph to generate TypeScript/JavaScript
- **Output**: Classes, interfaces, runtime logic
- **Why?**: Automated generation ensures implementation matches verified protocol

## Why CFG is Central

### The CFG Serves Two Masters

```
                    ┌─────────────────────┐
                    │        CFG          │
                    │  (Central Artifact) │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
            ┌───────▼────────┐   ┌────────▼────────┐
            │  Verification  │   │     Runtime     │
            │   Algorithms   │   │   Simulation    │
            └────────────────┘   └─────────────────┘
                    │                     │
            ┌───────▼────────┐   ┌────────▼────────┐
            │ • Deadlock     │   │ • CFSM Proj.    │
            │ • Liveness     │   │ • State Mgmt    │
            │ • Progress     │   │ • Msg Routing   │
            │ • Fork-Join    │   │ • Code Gen      │
            └────────────────┘   └─────────────────┘
```

### 1. Verification Path

The CFG enables formal verification:

- **Deadlock Detection**: Graph analysis finds cycles where all roles wait
- **Liveness**: Ensures protocols can make progress
- **Fork-Join Matching**: Validates parallel composition correctness
- **Race Detection**: Identifies conflicting concurrent accesses

These algorithms work on the CFG structure, not the AST or source text.

### 2. Runtime Path

The CFG guides execution:

- **CFSM Projection**: Each role gets their local state machine from CFG
- **State Machine Execution**: CFSM states map to runtime states
- **Message Handling**: Edges define valid transitions on message send/receive
- **Simulation**: IDE can step through CFG to show protocol execution

## From Simulation to Production

### Phase 1: Simulation (Development)
```typescript
// IDE simulates protocol using CFG
const simulation = new ProtocolSimulation(cfg);
simulation.step(); // Execute one transition
simulation.state; // Current CFG node per role
```

### Phase 2: Mock Implementation (Testing)
```typescript
// State machine drives mock behavior
class BuyerMock extends StateMachine {
  constructor(cfsm: CFSM) {
    super(cfsm);
    this.registerHandlers();
  }

  // Handlers generated from CFSM
  private async onQuoteReceived(quote: Quote) {
    // Mock: auto-respond based on state machine
    if (this.currentState === "AwaitingQuote") {
      await this.send("Seller", { accept: true });
      this.transition("AwaitingConfirmation");
    }
  }
}
```

### Phase 3: Production Code (Deployment)
```typescript
// ts-morph generates this from state machine
export class BuyerClient implements IBuyer {
  private state: BuyerState = "Initial";

  async requestQuote(item: string): Promise<Quote> {
    assert(this.state === "Initial", "Invalid state");
    await this.channel.send("Seller", { type: "request", item });
    this.state = "AwaitingQuote";
    const quote = await this.channel.receive("Seller");
    return quote;
  }

  async acceptQuote(): Promise<void> {
    assert(this.state === "AwaitingQuote", "Invalid state");
    await this.channel.send("Seller", { type: "accept" });
    this.state = "AwaitingConfirmation";
  }
}
```

**Key Insight**: The same CFSM structure guides all three phases. We go from interactive simulation → automated mocks → production code, all derived from the verified CFG.

## Parallel Composition Example

Let's see how CFG handles parallel composition, which is essential for P2P protocols.

### Scribble Source
```scribble
protocol DataFetch(role Client, role ServerA, role ServerB) {
  par {
    Client -> ServerA: Request(data_id);
    ServerA -> Client: Response(data);
  } and {
    Client -> ServerB: Request(data_id);
    ServerB -> Client: Response(data);
  }
  // After parallel completion, continue...
  Client -> ServerA: Ack();
}
```

### CFG Structure
```
    [Initial]
        │
        ▼
    [Fork] ────┐
      │        │
      │        ▼
      │    [Client->ServerB: Request]
      │        │
      ▼        ▼
  [Client->ServerA: Request] [ServerB->Client: Response]
      │        │
      ▼        │
  [ServerA->Client: Response] │
      │        │
      └────┬───┘
           ▼
        [Join]
           │
           ▼
    [Client->ServerA: Ack]
           │
           ▼
      [Terminal]
```

### How Verification Works

1. **Fork-Join Matching**: Ensures every fork has matching join
2. **Parallel Deadlock**: Checks if branches can deadlock each other
3. **Race Detection**: Identifies if both branches access same resources
4. **Independent Progress**: Verifies branches can execute concurrently

### How Runtime Works

**Client's CFSM** (projected from CFG):
```
State: Initial
  → send Request to ServerA
  → send Request to ServerB
  → transition to AwaitingBoth

State: AwaitingBoth
  → receive Response from ServerA (mark A complete)
  → receive Response from ServerB (mark B complete)
  → when both complete, transition to SendingAck

State: SendingAck
  → send Ack to ServerA
  → transition to Terminal
```

**State Machine Runtime**:
```typescript
class ClientStateMachine {
  private parallelCompletion = { serverA: false, serverB: false };

  async executeParallel() {
    // Fork: initiate both requests concurrently
    await Promise.all([
      this.requestFromServerA(),
      this.requestFromServerB()
    ]);

    // Join: wait for both responses
    while (!this.parallelCompletion.serverA || !this.parallelCompletion.serverB) {
      const msg = await this.channel.receive();
      if (msg.from === "ServerA") this.parallelCompletion.serverA = true;
      if (msg.from === "ServerB") this.parallelCompletion.serverB = true;
    }

    // Continue after join
    await this.sendAck();
  }
}
```

## Layered Architecture

### Layer 1: Syntax (AST)
- **Responsibility**: Parse source, maintain structure
- **Testing**: Parser tests, AST validation
- **Input**: Scribble source text
- **Output**: Typed AST nodes

### Layer 2: Semantics (CFG)
- **Responsibility**: Transform syntax to execution model
- **Testing**: Transformation tests, CFG structure tests
- **Input**: Validated AST
- **Output**: Control Flow Graph

### Layer 3: Verification (CFG Algorithms)
- **Responsibility**: Prove protocol properties
- **Testing**: Algorithm tests with known-good/bad protocols
- **Input**: CFG
- **Output**: Verification results, error reports

### Layer 4: CFG Simulation (COMPLETE ✅)
- **Responsibility**: Execute global protocol synchronously
- **Testing**: 23 simulation tests (all passing)
- **Input**: Verified CFG
- **Output**: Execution traces, step-by-step visualization
- **Status**: PRODUCTION READY

### Layer 5: Projection & CFSM Simulation (COMPLETE ✅)
- **Responsibility**: Project CFG to local CFSMs + execute distributed protocols
- **Testing**: 69 tests (45 projection + 13 CFSM + 11 distributed, all passing)
- **Input**: Verified CFG
- **Output**: Per-role CFSMs + distributed execution traces
- **Components**:
  - **Projector**: CFG → CFSM transformation (45 tests)
  - **CFSM Simulator**: Single-role async execution (13 tests)
  - **Distributed Coordinator**: Multi-role coordination (11 tests)
- **Status**: PRODUCTION READY

### Layer 6: Code Generation (PLANNED ⏸️)
- **Responsibility**: Generate implementation from CFSMs
- **Testing**: Not yet started
- **Input**: CFSM specifications
- **Output**: TypeScript/JavaScript runtime code
- **Status**: PLANNED

## TDD Approach

### Test Each Layer Independently

```typescript
// Layer 1: Parser
describe('Parser', () => {
  it('should parse parallel composition', () => {
    const source = 'par { ... } and { ... }';
    const ast = parse(source);
    expect(ast.type).toBe('Parallel');
  });
});

// Layer 2: CFG Transformation
describe('CFG Builder', () => {
  it('should create fork-join for parallel', () => {
    const ast = /* parallel AST */;
    const cfg = buildCFG(ast);
    expect(cfg.nodes).toContainNodeType('fork');
    expect(cfg.nodes).toContainNodeType('join');
  });
});

// Layer 3: Verification
describe('Deadlock Detection', () => {
  it('should detect parallel deadlock', () => {
    const cfg = /* deadlocking parallel CFG */;
    const result = detectDeadlock(cfg);
    expect(result.hasDeadlock).toBe(true);
  });
});

// Layer 4: Projection
describe('CFSM Projection', () => {
  it('should project parallel to concurrent local states', () => {
    const cfg = /* parallel CFG */;
    const cfsm = project(cfg, 'Client');
    expect(cfsm).toHaveParallelStates();
  });
});

// Layer 5: Runtime
describe('State Machine', () => {
  it('should execute parallel branches concurrently', async () => {
    const cfsm = /* Client CFSM */;
    const sm = new StateMachine(cfsm);
    const trace = await sm.execute();
    expect(trace).toShowConcurrentExecution();
  });
});
```

### Integration Tests

```typescript
describe('End-to-End', () => {
  it('should go from source to working simulation', async () => {
    // Parse
    const ast = parse(twoPhaseCommitSource);

    // Build CFG
    const cfg = buildCFG(ast);

    // Verify
    const verification = verify(cfg);
    expect(verification.errors).toHaveLength(0);

    // Project
    const coordinatorCFSM = project(cfg, 'Coordinator');
    const participant1CFSM = project(cfg, 'Participant1');

    // Execute
    const simulation = new Simulation({
      Coordinator: coordinatorCFSM,
      Participant1: participant1CFSM
    });

    const result = await simulation.run();
    expect(result.success).toBe(true);
  });
});
```

## Technology Stack

### Core Libraries
- **Chevrotain**: Parser (LL(k), TypeScript-first, no grammar build step)
- **ts-morph**: Code generation (TypeScript AST manipulation)
- **D3.js**: CFG and CFSM visualization
- **Dexie.js**: IndexedDB wrapper for persisting protocols

### Framework
- **Svelte**: UI framework (no hooks, LLM-friendly, reactive)
- **Vite**: Build tool (fast, TypeScript-native)
- **Vitest**: Testing (Vite-native, Jest-compatible API)

### Deployment
- **GitHub Pages**: Static site hosting
- **GitHub Actions**: CI/CD for automated builds

## Development Workflow

### 1. Write Test First
```typescript
it('should parse do statement with parameters', () => {
  const source = 'do SubProtocol<Int>(A, B);';
  const ast = parse(source);
  expect(ast.type).toBe('Do');
  expect(ast.protocol).toBe('SubProtocol');
  expect(ast.typeArgs).toEqual(['Int']);
});
```

### 2. Implement to Pass Test
```typescript
class ScribbleParser {
  doStatement() {
    this.CONSUME(Do);
    const protocol = this.CONSUME(Identifier);
    const typeArgs = this.typeArguments();
    const roles = this.roleArguments();
    this.CONSUME(Semicolon);

    return {
      type: 'Do',
      protocol: protocol.image,
      typeArgs,
      roles
    };
  }
}
```

### 3. Visualize in IDE
- Load protocol in editor
- View AST structure
- See CFG visualization
- Step through execution
- Inspect CFSM per role

### 4. Generate Code
- Export state machine
- Generate TypeScript interfaces
- Create runtime classes
- Include type guards and assertions

## Next Steps

Now that you understand the architecture:

1. **Parser Development** (Layer 1)
   - Write tests for Scribble 2.0 syntax
   - Implement Chevrotain parser
   - Test AST validation

2. **CFG Builder** (Layer 2)
   - Implement transformation rules
   - Test CFG structure
   - Visualize with D3

3. **Verification** (Layer 3)
   - Implement deadlock detection
   - Add parallel-specific checks
   - Test with known protocols

4. **Projection** (Layer 4)
   - Implement projection rules
   - Handle parallel cases
   - Test CFSM correctness

5. **Runtime** (Layer 5)
   - Build state machine executor
   - Implement message routing
   - Create simulation engine

6. **UI** (Layer 6)
   - Svelte components for editor
   - D3 visualizations
   - Interactive simulation

## Summary

The CFG is not just an intermediate representation—it's the **central semantic artifact** that enables both formal verification and practical execution. By separating syntax (AST) from semantics (CFG), we can:

- **Verify protocols** before implementing them
- **Project global protocols** to local state machines
- **Simulate execution** interactively
- **Generate code** that provably matches the protocol

This architecture ensures that what you verify is what you execute, and what you execute is what you deploy.
