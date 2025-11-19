# Development Roadmap - TDD Collaboration Guide

This document outlines how to build and test each layer incrementally.

## Layer 1: Parser (Scribble → AST)

### What We'll Build
- Chevrotain-based parser for Scribble 2.0 syntax
- AST type definitions (already designed in `docs/ast-design.md`)
- Parse basic protocol structures: messages, choice, recursion, parallel

### Tests We'll Write First
```typescript
// src/core/parser/parser.test.ts
describe('Scribble Parser - Basic Messages', () => {
  it('should parse simple message interaction');
  it('should parse message with payload type');
  it('should parse multiple sequential messages');
});

describe('Scribble Parser - Choice', () => {
  it('should parse choice with two branches');
  it('should parse nested choices');
});

describe('Scribble Parser - Parallel', () => {
  it('should parse parallel with two branches');
  it('should parse parallel with three branches');
});

describe('Scribble Parser - Recursion', () => {
  it('should parse simple recursion');
  it('should parse nested recursion');
});
```

### How to Test Together
1. **Run tests in watch mode**: `npm test`
2. **Try parsing examples**:
   ```typescript
   import { parse } from './parser';
   const ast = parse('protocol TwoPhase(role C, role P) { ... }');
   console.log(JSON.stringify(ast, null, 2));
   ```
3. **Verify AST structure**: Check that AST matches design doc
4. **Test error handling**: Try invalid syntax, verify error messages

### Success Criteria
- ✅ All test cases pass
- ✅ Can parse all examples from `docs/scribble-2.0-syntax.md`
- ✅ Error messages show line numbers and helpful descriptions
- ✅ AST structure matches `docs/ast-design.md` types

---

## Layer 2: CFG Builder (AST → CFG)

### What We'll Build
- CFG type definitions (from `docs/cfg-design.md`)
- Transformation rules: messages → action nodes, choice → branch/merge, parallel → fork/join
- CFG visualization utilities

### Tests We'll Write First
```typescript
// src/core/cfg/builder.test.ts
describe('CFG Builder - Basic Structure', () => {
  it('should create initial and terminal nodes');
  it('should create action node for message');
  it('should link nodes with edges');
});

describe('CFG Builder - Choice', () => {
  it('should create branch node with multiple outgoing edges');
  it('should create merge node where branches rejoin');
  it('should label branch edges correctly');
});

describe('CFG Builder - Parallel', () => {
  it('should create fork node with parallel_id');
  it('should create join node matching fork');
  it('should preserve branch labels');
});
```

### How to Test Together
1. **Visualize CFG**: We'll add a function to export DOT format
   ```bash
   npm run dev
   # Paste protocol in editor, click "Show CFG"
   # Or export: node scripts/visualize-cfg.js examples/two-phase.scr
   ```
2. **Inspect CFG structure**:
   ```typescript
   const cfg = buildCFG(ast);
   console.log(`Nodes: ${cfg.nodes.length}`);
   console.log(`Edges: ${cfg.edges.length}`);
   console.log('Fork nodes:', cfg.nodes.filter(n => n.type === 'fork'));
   ```
3. **Verify transformations**: Check each rule from `docs/cfg-design.md`

### Success Criteria
- ✅ All transformation rules implemented correctly
- ✅ Fork nodes have matching join nodes
- ✅ Branch/merge structure correct for choices
- ✅ Can visualize CFG with D3 or export to DOT format
- ✅ Edge labels preserve semantic information

---

## Layer 3: Verification (CFG Analysis)

### What We'll Build
- Deadlock detection algorithm
- Fork-join matching verification
- Parallel deadlock detection
- Liveness checking

### Tests We'll Write First
```typescript
// src/core/verification/deadlock.test.ts
describe('Deadlock Detection', () => {
  it('should detect simple cycle deadlock');
  it('should detect parallel branch deadlock');
  it('should pass for valid protocols');
});

describe('Fork-Join Matching', () => {
  it('should verify every fork has matching join');
  it('should detect orphaned fork');
  it('should detect orphaned join');
});
```

### How to Test Together
1. **Known-bad protocols**: Create protocols with deliberate errors
   ```typescript
   const badProtocol = `protocol Deadlock(role A, role B) {
     A -> B: Req();
     B -> A: WaitForReq();  // Deadlock: B waits before sending
   }`;
   const result = verify(buildCFG(parse(badProtocol)));
   expect(result.errors).toContain('Deadlock detected');
   ```

2. **Known-good protocols**: Test with examples from docs
   ```typescript
   const goodProtocol = readFile('examples/two-phase.scr');
   const result = verify(buildCFG(parse(goodProtocol)));
   expect(result.errors).toHaveLength(0);
   ```

3. **Interactive verification**:
   ```bash
   npm run dev
   # Load protocol, click "Verify"
   # See error markers in editor + CFG visualization highlighting problematic nodes
   ```

### Success Criteria
- ✅ Detects all known deadlock patterns
- ✅ Validates fork-join matching
- ✅ Passes all examples from design docs
- ✅ Error messages explain what's wrong and where
- ✅ Performance acceptable (< 1s for protocols with 100+ nodes)

---

## Layer 4: Projection (CFG → CFSM)

### What We'll Build
- Projection algorithm per role
- CFSM type definitions
- Role-specific state machines

### Tests We'll Write First
```typescript
// src/core/projection/projector.test.ts
describe('CFSM Projection - Basic', () => {
  it('should project message send to local send state');
  it('should project message receive to local receive state');
  it('should include only relevant role actions');
});

describe('CFSM Projection - Parallel', () => {
  it('should project single parallel branch to sequential');
  it('should project multiple parallel branches to concurrent states');
  it('should handle nested parallel correctly');
});
```

### How to Test Together
1. **Compare projections**: Project same protocol for different roles
   ```typescript
   const cfg = buildCFG(parse(twoPhaseProtocol));
   const coordCFSM = project(cfg, 'Coordinator');
   const part1CFSM = project(cfg, 'Participant1');

   console.log('Coordinator states:', coordCFSM.states.length);
   console.log('Participant states:', part1CFSM.states.length);
   ```

2. **Visualize side-by-side**:
   ```bash
   npm run dev
   # Select protocol, choose "Show Projections"
   # See all roles' CFSMs side-by-side
   # Step through execution to see how they synchronize
   ```

3. **Verify completeness**: Ensure all protocol interactions appear in some CFSM

### Success Criteria
- ✅ Each role's CFSM contains only their actions
- ✅ Parallel branches handled correctly per projection rules
- ✅ Choice branches preserved with same labels
- ✅ All roles' CFSMs can be composed back to original CFG
- ✅ Can visualize CFSM per role

---

## Layer 5: Runtime (CFSM → State Machine Execution)

### What We'll Build
- State machine executor
- Message routing (in-memory for simulation)
- Interactive simulation engine
- Execution trace recording

### Tests We'll Write First
```typescript
// src/core/runtime/simulation.test.ts
describe('State Machine Execution', () => {
  it('should execute simple two-message protocol');
  it('should handle choice based on message content');
  it('should execute parallel branches concurrently');
});

describe('Message Routing', () => {
  it('should deliver message to correct recipient');
  it('should queue messages when recipient not ready');
  it('should detect protocol violations');
});
```

### How to Test Together
1. **Run simulation**:
   ```typescript
   const simulation = new ProtocolSimulation(cfg);

   // Step through manually
   await simulation.step(); // Execute one transition
   console.log('Current state:', simulation.getCurrentState());

   // Or run to completion
   const trace = await simulation.run();
   console.log('Message trace:', trace);
   ```

2. **Interactive simulation in UI**:
   ```bash
   npm run dev
   # Load protocol
   # Click "Start Simulation"
   # Step through or auto-play
   # See messages highlighted in CFG
   # View message queue per role
   # Inspect current state per role
   ```

3. **Violation testing**: Try sending wrong message at wrong time
   ```typescript
   simulation.step(); // Coordinator sends VoteRequest
   simulation.injectMessage('Participant', 'Vote', { vote: true });
   simulation.step(); // Should work
   simulation.injectMessage('Wrong', 'Invalid', {});
   expect(() => simulation.step()).toThrow('Protocol violation');
   ```

### Success Criteria
- ✅ Can execute all example protocols end-to-end
- ✅ Parallel branches execute concurrently
- ✅ Choice branches follow expected paths
- ✅ Detects protocol violations (wrong message, wrong sender, wrong state)
- ✅ Message trace matches expected protocol flow
- ✅ Can pause/resume/step through simulation

---

## Layer 6: Code Generation (State Machine → TypeScript)

### What We'll Build
- ts-morph-based code generator
- TypeScript interfaces per role
- Runtime classes with type guards
- Integration with message channels (WebRTC, WebSocket, etc.)

### Tests We'll Write First
```typescript
// src/core/codegen/generator.test.ts
describe('Code Generation', () => {
  it('should generate interface for each role');
  it('should generate methods for each state transition');
  it('should include type guards for messages');
  it('should generate assertion checks');
});

describe('Generated Code Execution', () => {
  it('should compile without errors');
  it('should pass type checking');
  it('should execute protocol correctly');
});
```

### How to Test Together
1. **Generate and inspect**:
   ```typescript
   const code = generateCode(cfg, 'TypeScript');
   console.log(code['Coordinator.ts']);
   console.log(code['Participant.ts']);

   // Write to files
   writeCodeToFiles(code, './generated/');
   ```

2. **Compile generated code**:
   ```bash
   npm run generate examples/two-phase.scr
   cd generated/two-phase
   npm install
   npm run build
   npm test
   ```

3. **Run generated implementation**:
   ```typescript
   import { Coordinator } from './generated/Coordinator';
   import { Participant } from './generated/Participant';
   import { InMemoryChannel } from './runtime/channel';

   const channel = new InMemoryChannel();
   const coord = new Coordinator(channel);
   const part1 = new Participant(channel);

   await Promise.all([
     coord.execute(),
     part1.execute()
   ]);

   console.log('Protocol completed successfully!');
   ```

### Success Criteria
- ✅ Generated code compiles without errors
- ✅ Generated code passes TypeScript strict mode
- ✅ Generated implementations execute protocol correctly
- ✅ Type guards prevent invalid message types
- ✅ Assertions catch protocol violations at runtime
- ✅ Can integrate with real message channels (WebRTC, WebSocket)

---

## Testing Workflow Summary

For each layer:

1. **Write tests first** ✍️
   ```bash
   npm test -- --watch
   # Tests fail (red) - expected!
   ```

2. **Implement to pass tests** 💻
   ```typescript
   // Implement feature...
   // Tests pass (green) ✅
   ```

3. **Manual testing** 🧪
   ```bash
   npm run dev
   # Interactive testing in UI
   # Console experiments
   ```

4. **Integration check** 🔗
   ```typescript
   // Test layer N with layer N-1
   // End-to-end test through all layers so far
   ```

5. **Document & commit** 📝
   ```bash
   git add .
   git commit -m "feat: implement <layer>"
   git push
   ```

## How We'll Proceed

**I'll propose we start with Layer 1 (Parser).** Here's how we'll work:

1. I'll create the test file with concrete test cases
2. You run `npm test` to see them fail
3. I'll implement the parser step by step
4. We verify together that tests pass
5. I'll add a simple CLI tool so you can parse protocols and see AST output
6. We test with examples from design docs
7. When you're satisfied Layer 1 works, we move to Layer 2

**Sound good?** Ready to start with the parser?

### Quick Reference Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm test                 # Run tests in watch mode
npm run build            # Build for production

# Testing specific files
npm test parser          # Run only parser tests
npm test cfg             # Run only CFG tests
npm test -- --ui         # Open Vitest UI in browser

# Useful for debugging
node -e "console.log(require('./src/core/parser').parse('protocol ...'))"
```

Let me know when you're ready to start, or if you'd like to adjust the approach!
