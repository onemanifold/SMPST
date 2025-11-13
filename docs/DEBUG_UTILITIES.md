# Debug Utilities for CFSM Development

**Location**: `src/__test-utils__/debug.ts`
**Purpose**: Help debug CFSM projection issues and simulator implementation
**For**: Simulator session and integration testing

---

## Overview

These utilities bridge the gap between CFSM theory and practical debugging. They provide:

1. **Human-readable visualization** of CFSMs and CFGs
2. **Comprehensive inspection** tools for state/transition analysis
3. **Trace verification** to validate simulator behavior
4. **Diff tools** to compare expected vs actual CFSMs
5. **CLI inspector** for interactive debugging

---

## Quick Start

### Basic Usage

```typescript
import { createDebugCFSM, visualizeCFSM, snapshotCFSM } from '../__test-utils__/debug';

// Create debuggable CFSM
const { cfsm, debug, helpers } = createDebugCFSM(protocolSource, 'Client');

// Visualize structure
console.log(debug.visualize());

// Find specific transition
const transition = helpers.findTransition('s0', 'send:Request');

// Detect cycles (for recursion)
const cycles = helpers.detectCycles();

// Verify execution trace
const result = helpers.verifyTrace([
  { type: 'send', to: 'Server', label: 'Request' },
  { type: 'receive', from: 'Server', label: 'Response' },
]);
```

---

## Core Functions

### 1. `createDebugCFSM(protocol, role)` ⭐ **PRIMARY ENTRY POINT**

Creates a CFSM with full context and debugging capabilities.

**Returns**:
```typescript
{
  cfsm: CFSM,              // The projected CFSM
  debug: {
    cfgSummary: {...},     // CFG statistics
    verification: {...},   // All 15 verification results
    transitionTable: {...},// Flat table of transitions
    stateSummary: {...},   // Reachability analysis
    visualize: () => string,
    visualizeCFG: () => string,
  },
  helpers: {
    findTransition: (from, action) => Transition,
    findTransitionsFrom: (stateId) => Transition[],
    findTransitionsTo: (stateId) => Transition[],
    getReachableStates: (from) => string[],
    detectCycles: () => string[][],
    verifyTrace: (actions) => { valid, error },
  }
}
```

**When to use**: Start of every simulator test

**Example**:
```typescript
describe('Simulator Step Controls', () => {
  it('should step forward through simple protocol', () => {
    const { cfsm, debug, helpers } = createDebugCFSM(
      `protocol P(role A, role B) { A -> B: Msg(); }`,
      'A'
    );

    // Debug on failure
    if (cfsm.states.length === 0) {
      console.log('CFG Summary:', debug.cfgSummary);
      console.log('Verification:', debug.verification);
      console.log(debug.visualize());
    }

    const simulator = new Simulator(cfsm);
    const result = simulator.stepForward();

    expect(result.success).toBe(true);
  });
});
```

---

### 2. `visualizeCFSM(cfsm)` - ASCII Art Visualization

Renders CFSM as human-readable ASCII art.

**Output example**:
```
CFSM for role: Client

Initial: s0
Terminal: s2

States (3):
  s0 (initial)
  s1 (n42)
  s2 (terminal)

Transitions (2):
  s0 --[!Server⟨Request⟩]--> s1
  s1 --[?Server⟨Response⟩]--> s2
```

**When to use**:
- Test failures - print actual CFSM structure
- Debugging simulator state transitions
- Documentation/examples

**Notation**:
- `!B⟨msg⟩` = send msg to B
- `?A⟨msg⟩` = receive msg from A
- `τ` = tau (silent/structural transition)
- `⊕(branch)` = internal choice

---

### 3. `helpers.findTransition(from, actionPattern)` - Find Specific Transition

Search for transition by state and action pattern.

**Parameters**:
- `from`: State ID (e.g., 's0')
- `actionPattern`: Substring to match in action (e.g., 'send', 'Request', '!Server')

**Returns**: `CFSMTransition | undefined`

**Example**:
```typescript
const { helpers } = createDebugCFSM(protocol, 'Client');

// Find send transition
const sendTrans = helpers.findTransition('s0', 'send');
expect(sendTrans).toBeDefined();
expect(sendTrans!.action.label).toBe('Request');

// Find specific message
const reqTrans = helpers.findTransition('s0', 'Request');
expect(reqTrans).toBeDefined();
```

---

### 4. `helpers.detectCycles()` - Cycle Detection for Recursion

Detects cycles in CFSM using DFS with recursion stack.

**Returns**: `string[][]` - Array of cycles (each cycle is array of state IDs)

**Use case**: Test that recursion creates proper back-edges

**Example**:
```typescript
const protocol = `
  protocol Loop(role A, role B) {
    rec Loop {
      A -> B: Data();
      continue Loop;
    }
  }
`;

const { helpers } = createDebugCFSM(protocol, 'A');
const cycles = helpers.detectCycles();

expect(cycles.length).toBeGreaterThan(0); // Should have cycle
expect(cycles[0]).toContain('s0');         // Initial state in cycle
```

---

### 5. `helpers.verifyTrace(actions)` - Validate Execution Sequence

Verify that a sequence of actions is valid in the CFSM.

**Parameters**: `CFSMAction[]` - Sequence of actions to validate

**Returns**: `{ valid: boolean, error?: string }`

**Use case**: Test simulator executes valid protocol traces

**Example**:
```typescript
const { cfsm, helpers } = createDebugCFSM(protocol, 'Client');

// Valid trace
const validTrace = [
  { type: 'send', to: 'Server', label: 'Request' },
  { type: 'receive', from: 'Server', label: 'Response' },
];
expect(helpers.verifyTrace(validTrace).valid).toBe(true);

// Invalid trace (wrong order)
const invalidTrace = [
  { type: 'receive', from: 'Server', label: 'Response' },  // Can't receive first!
  { type: 'send', to: 'Server', label: 'Request' },
];
const result = helpers.verifyTrace(invalidTrace);
expect(result.valid).toBe(false);
expect(result.error).toContain('No transition from s0');
```

---

### 6. `helpers.getReachableStates(from)` - Reachability Analysis

Compute all states reachable from a given state.

**Returns**: `string[]` - Array of reachable state IDs

**Use case**:
- Verify terminal states are reachable
- Check for orphaned states
- Test simulator can reach all protocol states

**Example**:
```typescript
const { cfsm, helpers } = createDebugCFSM(protocol, 'Client');

const reachable = helpers.getReachableStates(cfsm.initialState);
expect(reachable).toContain(cfsm.terminalStates[0]); // Terminal reachable

// Check all states are reachable
const allStates = new Set(cfsm.states.map(s => s.id));
const unreachable = Array.from(allStates).filter(id => !reachable.includes(id));
expect(unreachable).toHaveLength(0); // No orphaned states
```

---

### 7. `snapshotCFSM(cfsm)` - Regression Testing

Generate formatted snapshot for vitest snapshot testing.

**Output example**:
```
════════════════════════════════════════════════════════════
CFSM SNAPSHOT: Client
════════════════════════════════════════════════════════════

Initial State: s0
Terminal States: s2

States (3):
────────────────────────────────────────────
  s0 │ label: initial
  s1 │ label: n42
  s2 │ label: terminal

Transitions (2):
────────────────────────────────────────────
  s0 --[!Server⟨Request⟩]--> s1
  s1 --[?Server⟨Response⟩]--> s2

════════════════════════════════════════════════════════════
```

**Use case**: Track CFSM changes over time, catch regressions

**Example**:
```typescript
it('should maintain stable projection for known protocol', () => {
  const { cfsm } = createDebugCFSM(twoPhaseCommit, 'Coordinator');
  expect(snapshotCFSM(cfsm)).toMatchSnapshot();
});
```

---

### 8. `diffCFSM(expected, actual)` - Compare CFSMs

Find differences between two CFSMs.

**Returns**:
```typescript
{
  missingStates: string[],
  extraStates: string[],
  missingTransitions: string[],
  extraTransitions: string[],
  actionMismatches: Array<{
    transitionId: string,
    expected: string,
    actual: string,
  }>,
}
```

**Use case**:
- Compare simulator-generated CFSM vs expected
- Regression testing after code changes
- Debugging projection algorithm issues

**Example**:
```typescript
const expected = project(cfg, 'Client');
const actual = simulatorGeneratedCFSM;

const diff = diffCFSM(expected, actual);

if (diff.missingTransitions.length > 0) {
  console.log('Missing transitions:', diff.missingTransitions);
}
if (diff.actionMismatches.length > 0) {
  console.log('Action mismatches:', diff.actionMismatches);
}

expect(diff.missingStates).toHaveLength(0);
expect(diff.extraStates).toHaveLength(0);
```

---

### 9. `CFSMInspector` - CLI Debugging Tool

Interactive inspector for manual debugging sessions.

**Usage**:
```typescript
import { CFSMInspector } from '../__test-utils__/debug';

const inspector = new CFSMInspector();
const report = inspector.inspect(protocolSource, 'Client');

console.log('Summary:', report.summary);
console.log('Verification:', report.verification);
console.log('Cycles:', report.cycles);
console.log('\nVisualization:\n', report.visualization);
```

**Output**:
```javascript
{
  role: 'Client',
  summary: {
    states: 3,
    transitions: 2,
    hasCycles: false,
    cycleCount: 0,
    reachableStates: 3,
    unreachableStates: 0,
  },
  verification: {
    isValid: true,
    hasDeadlock: false,
    errors: [],
  },
  visualization: '...',
  cfgVisualization: '...',
  cycles: [],
  transitionTable: [
    { id: 't0', from: 's0', action: '!Server⟨Request⟩', to: 's1' },
    { id: 't1', from: 's1', action: '?Server⟨Response⟩', to: 's2' },
  ],
}
```

**When to use**:
- Interactive debugging in REPL/console
- Exploring unfamiliar protocols
- Understanding CFSM structure before writing tests

---

## Common Patterns for Simulator Testing

### Pattern 1: Debug on Failure

```typescript
it('should handle complex protocol', () => {
  const { cfsm, debug, helpers } = createDebugCFSM(protocol, 'Client');

  const simulator = new Simulator(cfsm);
  const result = simulator.execute();

  if (!result.success) {
    // Dump debug info on failure
    console.log('\n=== DEBUG INFO ===');
    console.log('CFSM:', debug.visualize());
    console.log('CFG:', debug.visualizeCFG());
    console.log('Verification:', debug.verification);
    console.log('Reachable:', helpers.getReachableStates(cfsm.initialState));
  }

  expect(result.success).toBe(true);
});
```

### Pattern 2: Validate Simulator State Transitions

```typescript
it('simulator state should match CFSM transitions', () => {
  const { cfsm, helpers } = createDebugCFSM(protocol, 'A');
  const simulator = new Simulator(cfsm);

  // Step 1: Check initial state
  expect(simulator.currentState).toBe(cfsm.initialState);

  // Step 2: Find expected transition
  const expectedTrans = helpers.findTransition(simulator.currentState, 'send');
  expect(expectedTrans).toBeDefined();

  // Step 3: Execute and verify
  simulator.stepForward();
  expect(simulator.currentState).toBe(expectedTrans!.to);
});
```

### Pattern 3: Test Recursion Handling

```typescript
it('simulator should handle recursion', () => {
  const protocol = `rec Loop { A -> B: Data(); continue Loop; }`;
  const { cfsm, helpers } = createDebugCFSM(protocol, 'A');

  // Verify CFSM has cycle
  const cycles = helpers.detectCycles();
  expect(cycles.length).toBeGreaterThan(0);

  // Test simulator follows cycle
  const simulator = new Simulator(cfsm);
  const trace: string[] = [];

  for (let i = 0; i < 5; i++) {
    trace.push(simulator.currentState);
    simulator.stepForward();
  }

  // Should revisit same states (cycle)
  const uniqueStates = new Set(trace);
  expect(uniqueStates.size).toBeLessThan(trace.length);
});
```

### Pattern 4: Snapshot Regression Testing

```typescript
describe('CFSM Projection Stability', () => {
  const protocols = {
    'RequestResponse': `protocol RR(role A, role B) { A -> B: Req(); B -> A: Resp(); }`,
    'TwoPhaseCommit': `...`,
    'Streaming': `...`,
  };

  for (const [name, source] of Object.entries(protocols)) {
    it(`should maintain stable projection for ${name}`, () => {
      const { cfsm } = createDebugCFSM(source, 'Client');
      expect(snapshotCFSM(cfsm)).toMatchSnapshot();
    });
  }
});
```

---

## Integration with Simulator

### Expected Workflow

1. **Protocol Definition** → Parse → Build CFG → **Verify** ✅
2. **CFG** → Project → **CFSM** (use debug utils here) ✅
3. **CFSM** → Simulator → **Execution** (your session)

### Debug Utils Help With:

| Simulator Issue | Debug Util Solution |
|----------------|-------------------|
| "Simulator stuck" | `helpers.getReachableStates()` - check if target state reachable |
| "Invalid transition" | `helpers.findTransition()` - verify transition exists |
| "Recursion broken" | `helpers.detectCycles()` - confirm CFSM has cycles |
| "Trace validation" | `helpers.verifyTrace()` - check if sequence is valid |
| "Regression" | `snapshotCFSM()` - track changes over time |
| "CFSM looks wrong" | `visualizeCFSM()` - see structure clearly |

### Key Principle

**Test CFSM correctness BEFORE testing simulator correctness.**

If CFSM is wrong, simulator tests will fail for wrong reasons.

```typescript
// ❌ BAD: Test simulator without validating CFSM
it('simulator should work', () => {
  const cfsm = project(cfg, 'A');
  const sim = new Simulator(cfsm);
  expect(sim.execute()).toBe(true); // Why did this fail?
});

// ✅ GOOD: Validate CFSM structure first
it('simulator should work', () => {
  const { cfsm, helpers } = createDebugCFSM(protocol, 'A');

  // Validate CFSM properties
  expect(cfsm.states.length).toBeGreaterThan(0);
  expect(helpers.getReachableStates(cfsm.initialState)).toContain(cfsm.terminalStates[0]);

  // NOW test simulator
  const sim = new Simulator(cfsm);
  expect(sim.execute()).toBe(true);
});
```

---

## Quick Reference Card

```typescript
// Import
import { createDebugCFSM, visualizeCFSM, snapshotCFSM, CFSMInspector } from '../__test-utils__/debug';

// Create debuggable CFSM
const { cfsm, debug, helpers } = createDebugCFSM(protocol, role);

// Visualize
console.log(debug.visualize());              // ASCII art CFSM
console.log(debug.visualizeCFG());           // ASCII art CFG

// Find transitions
const t = helpers.findTransition('s0', 'send');
const outgoing = helpers.findTransitionsFrom('s0');
const incoming = helpers.findTransitionsTo('s1');

// Analyze structure
const reachable = helpers.getReachableStates(cfsm.initialState);
const cycles = helpers.detectCycles();

// Validate traces
const valid = helpers.verifyTrace([...actions]);

// Snapshot testing
expect(snapshotCFSM(cfsm)).toMatchSnapshot();

// Compare CFSMs
const diff = diffCFSM(expected, actual);

// Interactive debugging
const inspector = new CFSMInspector();
const report = inspector.inspect(protocol, role);
```

---

## FAQ

**Q: When should I use debug utils vs raw CFSM inspection?**

A: Always use debug utils in tests. They provide context (CFG, verification) and helpers that save time.

**Q: Can debug utils detect simulator bugs?**

A: No. They validate CFSM structure. They help isolate whether bugs are in projection or simulator.

**Q: What's the performance impact?**

A: Debug utils are test-only. No impact on production. They're optimized for clarity, not speed.

**Q: Can I use these for sub-protocol testing?**

A: Yes! `createDebugCFSM()` works with any valid Scribble protocol, including sub-protocols.

**Q: How do I debug a failing simulator test?**

A: 1) Add `createDebugCFSM()`, 2) Print `debug.visualize()`, 3) Check CFSM structure is correct, 4) Then debug simulator.

---

## Summary

**Debug utilities provide**:
- ✅ **Visibility**: See CFSM structure clearly
- ✅ **Validation**: Confirm CFSM properties before testing simulator
- ✅ **Isolation**: Separate projection bugs from simulator bugs
- ✅ **Efficiency**: Fast debugging with pre-built helpers

**Key takeaway**: Use `createDebugCFSM()` at the start of every simulator test. It costs one line but saves hours of debugging.

---

**For simulator session**: Copy this document. Start every test with `createDebugCFSM()`. When tests fail, print `debug.visualize()` first.
