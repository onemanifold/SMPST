# Handover: Phase 0 - Theorem-Driven Testing Implementation

## Context

This session continues work on the SMPST IDE project to implement **Phase 0: Theorem-Driven Testing** - a critical foundation for formal verification of the MPST implementation.

---

## What Was Completed (Previous Session)

### Theory Documentation (9 documents, ~10,500 lines)

Created comprehensive formal theory documentation in `docs/theory/`:

1. **THEORY_INTEGRATION_PLAN.md** - Master plan with 20 papers and roadmap
2. **COMPLETENESS_ANALYSIS.md** - Gap identification methodology
3. **THEOREM_DRIVEN_TESTING.md** - Testing as proof obligations framework
4. **FORMAL_METHODS_WORKFLOW.md** - 7-phase integration workflow
5. **sub-protocol-formal-analysis.md** - Sub-protocol operational semantics (verified ✅)
6. **fifo-verification.md** - FIFO buffer semantics (Theorems 4.8, 5.3)
7. **asynchronous-subtyping.md** - Protocol refinement (future feature)
8. **parameterized-protocols.md** - Pabble (future feature)
9. **exception-handling.md** - Try-catch-throw (future feature)
10. **timed-session-types.md** - Temporal constraints (future feature)
11. **well-formedness-properties.md** - 4 formal properties with algorithms
12. **cfg-lts-equivalence.md** - Architectural justification (Theorem 3.1)
13. **projection-correctness.md** - 4 correctness theorems

### Development Path Defined

8-phase roadmap created (see previous analysis):
- **Phase 0**: Theorem-Driven Testing (THIS SESSION)
- **Phase 1**: Well-Formedness Enhancement
- **Phase 2**: FIFO Verification
- **Phase 3**: Projection Correctness
- **Phase 4-7**: New features (subtyping, exceptions, timed types, Pabble)

### Branch Status

- **Branch**: `claude/initial-setup-011CV5wHUepgThYL1GEJgWot`
- **Status**: Merged from `main` (no conflicts), all commits pushed
- **PR Description**: Available in `PR_DESCRIPTION.md`
- **Ready for**: New branch for theorem-testing implementation

---

## Your Task: Phase 0 - Theorem-Driven Testing

### Objective

Transform the test suite from **behavioral tests** ("it works") to **theorem-driven tests** ("it proves Theorem X").

**Why Critical:**
- Validates current implementation against formal theory
- Catches subtle bugs that behavioral tests miss
- Establishes methodology for all future features
- Tests become executable specifications

**Duration**: 2-3 weeks (~1,500 lines of tests)

---

## Implementation Plan

### Step 1: Create Test Infrastructure

**Directory structure** to create:

```
src/__tests__/theorems/
├── README.md                           # Overview linking tests to theory
├── well-formedness/
│   ├── connectedness.test.ts           # Honda 2016, Def 2.5
│   ├── determinism.test.ts             # Honda 2016
│   ├── no-races.test.ts                # Deniélou 2012, Theorem 4.5
│   └── progress.test.ts                # Honda 2016, Theorem 5.10
├── projection/
│   ├── completeness.test.ts            # Honda 2016, Theorem 4.7
│   ├── soundness.test.ts               # Deniélou 2012, Theorem 3.1
│   ├── composability.test.ts           # Honda 2016, Theorem 5.3
│   └── preservation.test.ts            # Honda 2016, Lemma 3.6
├── equivalence/
│   └── cfg-lts.test.ts                 # Deniélou 2012, Theorem 3.1
└── operational-semantics/
    ├── sub-protocols.test.ts           # Formal reduction rules
    └── fifo-buffers.test.ts            # Theorems 4.8, 5.3
```

---

### Step 2: Theorem Test Template

**Every test file should follow this structure:**

```typescript
/**
 * Theorem X.Y (Author Year): Theorem Name
 *
 * STATEMENT: [Formal statement from theory doc]
 *
 * SOURCE: docs/theory/[relevant-doc].md
 * CITATION: [Paper citation]
 */

import { describe, it, expect } from 'vitest';
import { /* relevant imports */ } from '../../core/...';

describe('Theorem X.Y: Theorem Name (Author Year)', () => {
  it('proves: [property statement]', () => {
    // Arrange: Setup protocol/cfg
    const protocol = `...`;

    // Act: Apply implementation
    const result = implementationFunction(protocol);

    // Assert: Verify theorem holds
    expect(result).toSatisfy([theorem property]);
  });

  it('proves: [edge case or corollary]', () => {
    // Additional proof obligations
  });

  it('counterexample: [violation case]', () => {
    // Show theorem correctly rejects invalid cases
  });
});
```

---

### Step 3: Priority Test Suites

Implement in this order:

#### 3.1 Well-Formedness Tests (4 theorems)

**Source**: `docs/theory/well-formedness-properties.md`

**Theorem 5.10 (Honda 2016): Progress**
```typescript
// File: src/__tests__/theorems/well-formedness/progress.test.ts

describe('Theorem 5.10: Progress (Honda 2016)', () => {
  it('proves: well-formed protocols are deadlock-free', () => {
    const protocol = `
      protocol TwoPhase(role Coordinator, role Worker1, role Worker2) {
        Coordinator -> Worker1: Prepare();
        Coordinator -> Worker2: Prepare();
        Worker1 -> Coordinator: Vote();
        Worker2 -> Coordinator: Vote();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);

    // Check well-formedness
    const wf = verifyProtocol(cfg);
    expect(wf.connected).toBe(true);
    expect(wf.deterministic).toBe(true);
    expect(wf.raceFree).toBe(true);

    // Theorem 5.10: Well-formed → No deadlocks
    expect(wf.hasProgress).toBe(true);
    expect(wf.deadlockStates).toHaveLength(0);
  });

  it('counterexample: circular dependency violates progress', () => {
    const protocol = `
      protocol Deadlock(role A, role B) {
        par {
          A -> B: Msg1();
          B -> A: Msg2();
        } and {
          B -> A: Msg3();
          A -> B: Msg4();
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);
    const wf = verifyProtocol(cfg);

    // Should detect deadlock
    expect(wf.hasProgress).toBe(false);
    expect(wf.deadlockStates.length).toBeGreaterThan(0);
  });
});
```

**Theorem 4.5 (Deniélou 2012): No Races**
```typescript
// File: src/__tests__/theorems/well-formedness/no-races.test.ts

describe('Theorem 4.5: No Races (Deniélou 2012)', () => {
  it('proves: parallel branches use disjoint channels', () => {
    const protocol = `
      protocol NoRace(role A, role B, role C) {
        par {
          A -> B: Msg1();
        } and {
          A -> C: Msg2();
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectRaceConditions(cfg);

    // Theorem 4.5: Disjoint channels → no races
    expect(result.hasRaces).toBe(false);
    expect(result.races).toHaveLength(0);
  });

  it('counterexample: same channel in parallel violates no-race', () => {
    const protocol = `
      protocol Race(role A, role B) {
        par {
          A -> B: Msg1();
        } and {
          A -> B: Msg2();  // Same channel!
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);
    const result = detectRaceConditions(cfg);

    // Should detect race
    expect(result.hasRaces).toBe(true);
    expect(result.races.length).toBeGreaterThan(0);
  });
});
```

**Connectedness (Honda 2016, Def 2.5)**
```typescript
// File: src/__tests__/theorems/well-formedness/connectedness.test.ts

describe('Definition 2.5: Connectedness (Honda 2016)', () => {
  it('proves: all declared roles participate', () => {
    const protocol = `
      protocol Connected(role A, role B, role C) {
        A -> B: Msg1();
        B -> C: Msg2();
        C -> A: Msg3();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkConnectedness(cfg);

    expect(result.connected).toBe(true);
    expect(result.isolatedRoles).toHaveLength(0);
  });

  it('counterexample: unused role violates connectedness', () => {
    const protocol = `
      protocol Disconnected(role A, role B, role C) {
        A -> B: Msg1();
        // C never used!
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkConnectedness(cfg);

    expect(result.connected).toBe(false);
    expect(result.isolatedRoles).toContain('C');
  });
});
```

**Determinism (Honda 2016)**
```typescript
// File: src/__tests__/theorems/well-formedness/determinism.test.ts

describe('Determinism Property (Honda 2016)', () => {
  it('proves: choice branches have unique labels', () => {
    const protocol = `
      protocol Deterministic(role Client, role Server) {
        choice at Client {
          Client -> Server: Login();
        } or {
          Client -> Server: Register();
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkChoiceDeterminism(cfg);

    expect(result.deterministic).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('counterexample: duplicate labels violate determinism', () => {
    const protocol = `
      protocol Ambiguous(role A, role B) {
        choice at A {
          A -> B: Request();
        } or {
          A -> B: Request();  // Duplicate!
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);
    const result = checkChoiceDeterminism(cfg);

    expect(result.deterministic).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});
```

---

#### 3.2 Projection Correctness Tests (4 theorems)

**Source**: `docs/theory/projection-correctness.md`

**Theorem 4.7 (Honda 2016): Completeness**
```typescript
// File: src/__tests__/theorems/projection/completeness.test.ts

describe('Theorem 4.7: Projection Completeness (Honda 2016)', () => {
  it('proves: all global actions appear in some projection', () => {
    const protocol = `
      protocol Test(role A, role B, role C) {
        A -> B: Msg1();
        B -> C: Msg2();
        C -> A: Msg3();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);

    // Extract global actions
    const globalActions = extractGlobalActions(cfg);
    expect(globalActions).toHaveLength(3);

    // Project to all roles
    const projections = projectAll(cfg);

    // Theorem 4.7: Every action appears in at least one projection
    for (const action of globalActions) {
      const appearsIn = [];

      for (const [role, cfsm] of projections.cfsms) {
        if (containsAction(cfsm, action)) {
          appearsIn.push(role);
        }
      }

      expect(appearsIn.length).toBeGreaterThan(0);
      expect(appearsIn).toContain(action.from);
      expect(appearsIn).toContain(action.to);
    }
  });
});
```

**Theorem 3.1 (Deniélou 2012): Soundness**
```typescript
// File: src/__tests__/theorems/projection/soundness.test.ts

describe('Theorem 3.1: Projection Soundness (Deniélou 2012)', () => {
  it('proves: local steps correspond to global steps', () => {
    const protocol = `
      protocol Test(role A, role B) {
        A -> B: Request();
        B -> A: Response();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);

    // Create simulators
    const globalSim = new CFGSimulator(cfg);
    const projections = projectAll(cfg);
    const localSims = new Map();

    for (const [role, cfsm] of projections.cfsms) {
      localSims.set(role, new CFSMSimulator(cfsm, role));
    }

    // Theorem 3.1: Global step ⟹ Local steps correspond
    while (!globalSim.isComplete()) {
      const globalStep = globalSim.step();

      for (const [role, localSim] of localSims) {
        if (involvesRole(globalStep, role)) {
          const localStep = localSim.step();
          expect(corresponds(globalStep, localStep, role)).toBe(true);
        }
      }
    }

    // All local simulators should be complete
    for (const localSim of localSims.values()) {
      expect(localSim.isComplete()).toBe(true);
    }
  });
});
```

**Theorem 5.3 (Honda 2016): Composability (Duality)**
```typescript
// File: src/__tests__/theorems/projection/composability.test.ts

describe('Theorem 5.3: Composability (Honda 2016)', () => {
  it('proves: projections are mutually dual', () => {
    const protocol = `
      protocol Test(role A, role B) {
        A -> B: Request();
        B -> A: Response();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);
    const projections = projectAll(cfg);

    const projA = projections.cfsms.get('A')!;
    const projB = projections.cfsms.get('B')!;

    // Theorem 5.3: Projections are dual
    const dualityChecker = new DualityChecker();
    const result = dualityChecker.check(projA, projB, 'A', 'B');

    expect(result.isDual).toBe(true);
    expect(result.violations).toHaveLength(0);

    // Specific checks:
    // - A sends Request ↔ B receives Request
    // - B sends Response ↔ A receives Response
  });
});
```

**Lemma 3.6 (Honda 2016): Well-Formedness Preservation**
```typescript
// File: src/__tests__/theorems/projection/preservation.test.ts

describe('Lemma 3.6: Well-Formedness Preservation (Honda 2016)', () => {
  it('proves: well-formed global → well-formed local', () => {
    const protocol = `
      protocol Auth(role Client, role Server) {
        choice at Client {
          Client -> Server: Login();
          Server -> Client: Token();
        } or {
          Client -> Server: Register();
          Server -> Client: Confirmation();
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);

    // Verify global well-formedness
    const globalWF = verifyProtocol(cfg);
    expect(globalWF.connected).toBe(true);
    expect(globalWF.deterministic).toBe(true);
    expect(globalWF.hasProgress).toBe(true);

    // Project to local types
    const projections = projectAll(cfg);

    // Lemma 3.6: Local projections also well-formed
    for (const [role, cfsm] of projections.cfsms) {
      const localWF = verifyLocalProtocol(cfsm);
      expect(localWF.deterministic).toBe(true);
      expect(localWF.hasProgress).toBe(true);
    }
  });
});
```

---

#### 3.3 CFG-LTS Equivalence Tests

**Source**: `docs/theory/cfg-lts-equivalence.md`

**Theorem 3.1 (Deniélou 2012): CFG ↔ LTS Equivalence**
```typescript
// File: src/__tests__/theorems/equivalence/cfg-lts.test.ts

describe('Theorem 3.1: CFG ↔ LTS Equivalence (Deniélou 2012)', () => {
  it('proves: node-labeled CFG equivalent to edge-labeled LTS', () => {
    const protocol = `
      protocol Test(role A, role B) {
        A -> B: Request();
        B -> A: Response();
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);

    // Extract trace from CFG
    const cfgTrace = extractCFGTrace(cfg);

    // Translate CFG to LTS
    const lts = translateCFGtoLTS(cfg);

    // Extract trace from LTS
    const ltsTrace = extractLTSTrace(lts);

    // Theorem 3.1: Traces are equivalent
    expect(cfgTrace).toEqual(ltsTrace);
    expect(cfgTrace).toEqual([
      'A → B: Request',
      'B → A: Response',
    ]);
  });

  it('proves: trace equivalence for choice protocols', () => {
    const protocol = `
      protocol Choice(role A, role B) {
        choice at A {
          A -> B: Login();
        } or {
          A -> B: Register();
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0]);
    const lts = translateCFGtoLTS(cfg);

    // Both should have 2 traces (one per branch)
    const cfgTraces = getAllCFGTraces(cfg);
    const ltsTraces = getAllLTSTraces(lts);

    expect(cfgTraces.size).toBe(2);
    expect(ltsTraces.size).toBe(2);
    expect(cfgTraces).toEqual(ltsTraces);
  });
});
```

---

#### 3.4 Operational Semantics Tests

**Sub-Protocol Semantics**
```typescript
// File: src/__tests__/theorems/operational-semantics/sub-protocols.test.ts

describe('Sub-Protocol Operational Semantics', () => {
  it('proves: call stack push/pop matches formal semantics', () => {
    const protocol = `
      protocol Main(role A, role B) {
        do SubProtocol(A, B);
      }

      protocol SubProtocol(role X, role Y) {
        X -> Y: Msg();
      }
    `;

    // Verify implementation matches formal reduction rules
    // from docs/theory/sub-protocol-formal-analysis.md
  });

  it('proves: recursion scoping within sub-protocols', () => {
    // Verify Theorem 5.1: rec X.G binds X only within G
    // Not across sub-protocol boundaries
  });
});
```

**FIFO Buffer Semantics**
```typescript
// File: src/__tests__/theorems/operational-semantics/fifo-buffers.test.ts

describe('Theorem 5.3: FIFO Guarantee (Honda 2016)', () => {
  it('proves: messages received in send order', () => {
    const protocol = `
      protocol Test(role Sender, role Receiver) {
        Sender -> Receiver: Msg1();
        Sender -> Receiver: Msg2();
        Sender -> Receiver: Msg3();
      }
    `;

    // Verify Theorem 5.3: i < j ⟹ receive(mᵢ) ≺ receive(mⱼ)
  });
});

describe('Theorem 4.8: Causal Delivery (Honda 2016)', () => {
  it('proves: causal ordering preserved', () => {
    // Verify causal delivery theorem
  });
});
```

---

### Step 4: Helper Utilities

Create test utilities in `src/__tests__/theorems/__utils__/`:

```typescript
// trace-extraction.ts
export function extractCFGTrace(cfg: CFG): string[];
export function extractLTSTrace(lts: LTS): string[];
export function getAllCFGTraces(cfg: CFG): Set<string[]>;

// action-matching.ts
export function containsAction(cfsm: CFSM, action: Action): boolean;
export function involvesRole(step: SimulationStep, role: string): boolean;
export function corresponds(globalStep: Step, localStep: Step, role: string): boolean;

// duality-checking.ts
export class DualityChecker {
  check(proj1: CFSM, proj2: CFSM, role1: string, role2: string): DualityResult;
}

// translation.ts
export function translateCFGtoLTS(cfg: CFG): LTS;
export function translateLTStoCFG(lts: LTS): CFG;
```

---

### Step 5: CI Integration

Update `package.json` or test config:

```json
{
  "scripts": {
    "test:theorems": "vitest run src/__tests__/theorems",
    "test:theorems:watch": "vitest watch src/__tests__/theorems",
    "test:coverage:theorems": "vitest run --coverage src/__tests__/theorems"
  }
}
```

Add to CI pipeline:
```yaml
- name: Run Theorem Tests
  run: npm run test:theorems
```

---

### Step 6: Documentation

Create `src/__tests__/theorems/README.md`:

```markdown
# Theorem-Driven Test Suite

This directory contains tests that verify formal properties from MPST theory.

## Test Organization

Each test file corresponds to a specific theorem from academic papers:

### Well-Formedness (Honda 2016)
- `well-formedness/connectedness.test.ts` - Definition 2.5
- `well-formedness/determinism.test.ts` - Determinism property
- `well-formedness/no-races.test.ts` - Theorem 4.5 (Deniélou 2012)
- `well-formedness/progress.test.ts` - Theorem 5.10

### Projection Correctness
- `projection/completeness.test.ts` - Theorem 4.7 (Honda 2016)
- `projection/soundness.test.ts` - Theorem 3.1 (Deniélou 2012)
- `projection/composability.test.ts` - Theorem 5.3 (Honda 2016)
- `projection/preservation.test.ts` - Lemma 3.6 (Honda 2016)

### Equivalence
- `equivalence/cfg-lts.test.ts` - Theorem 3.1 (Deniélou 2012)

### Operational Semantics
- `operational-semantics/sub-protocols.test.ts` - Formal reduction rules
- `operational-semantics/fifo-buffers.test.ts` - Theorems 4.8, 5.3 (Honda 2016)

## Theory Documentation

All theorems reference formal specifications in:
- `docs/theory/well-formedness-properties.md`
- `docs/theory/projection-correctness.md`
- `docs/theory/cfg-lts-equivalence.md`
- `docs/theory/sub-protocol-formal-analysis.md`
- `docs/theory/fifo-verification.md`

## Running Tests

```bash
npm run test:theorems              # Run all theorem tests
npm run test:theorems:watch        # Watch mode
npm run test:coverage:theorems     # Coverage report
```
```

---

## Key Theory Documents to Reference

All located in `docs/theory/`:

1. **THEOREM_DRIVEN_TESTING.md** - Framework and methodology
2. **well-formedness-properties.md** - 4 theorems with algorithms
3. **projection-correctness.md** - 4 correctness properties
4. **cfg-lts-equivalence.md** - Architectural justification
5. **sub-protocol-formal-analysis.md** - Operational semantics
6. **fifo-verification.md** - FIFO guarantees

---

## Implementation Notes

### Existing Test Infrastructure

**Current tests** in `src/core/projection/__tests__/`:
- `formal-correctness.test.ts` - Has some theorem tests but not explicitly linked
- Other test files - Behavioral tests to potentially refactor

**Current verification** in `src/core/verification/verifier.ts`:
- Functions exist: `detectDeadlock()`, `checkLiveness()`, etc.
- Need to link to theorems explicitly

### New Code to Write

**Test utilities** (~300 lines):
- Trace extraction helpers
- Duality checker
- CFG ↔ LTS translation

**Test suites** (~1,200 lines):
- Well-formedness: 4 files × ~100 lines = 400 lines
- Projection: 4 files × ~150 lines = 600 lines
- Equivalence: 1 file × ~100 lines = 100 lines
- Operational semantics: 2 files × ~50 lines = 100 lines

**Total**: ~1,500 lines

---

## Success Criteria

### Must Have
- [ ] All 4 well-formedness theorems tested
- [ ] All 4 projection correctness theorems tested
- [ ] CFG-LTS equivalence theorem tested
- [ ] Sub-protocol semantics verified
- [ ] FIFO guarantees verified
- [ ] All tests pass ✅
- [ ] CI integration complete

### Should Have
- [ ] Test coverage report showing theorem coverage
- [ ] Documentation linking tests to theory
- [ ] Helper utilities for future theorem tests

### Nice to Have
- [ ] Refactor existing behavioral tests using theorem framework
- [ ] Generate theorem verification certificate
- [ ] Counterexample generation for failed theorems

---

## Deliverables for Next Session

1. **Test suite** in `src/__tests__/theorems/` (~1,500 lines)
2. **Helper utilities** in `src/__tests__/theorems/__utils__/` (~300 lines)
3. **Documentation** in `src/__tests__/theorems/README.md`
4. **CI integration** (updated scripts)
5. **Bug fixes** if any theorems reveal implementation errors

---

## Branch Management

### Starting Point
- **Current branch**: `claude/initial-setup-011CV5wHUepgThYL1GEJgWot`
- **Status**: Merged from main, theory docs committed

### For This Session
**Create new branch** for theorem testing:
```bash
git checkout -b claude/theorem-testing-SESSIONID
```

When complete:
1. Commit all test files
2. Push to remote
3. Create PR to `main`
4. Reference previous theory integration PR

---

## Questions to Resolve

1. **Duality Checker**: Does one exist? If not, implement from scratch
2. **LTS Translation**: Do we need actual LTS data structure or just trace equivalence?
3. **Test Priority**: If 1,500 lines too much, which theorems are most critical?
   - **Suggestion**: Start with well-formedness (4 theorems) as foundation

---

## Resources

### Key Papers (cited in theory docs)
- Honda, Yoshida, Carbone (JACM 2016) - "Multiparty Asynchronous Session Types"
- Deniélou, Yoshida (ESOP 2012) - "Multiparty Session Types Meet Communicating Automata"

### Internal Documentation
- `docs/theory/THEOREM_DRIVEN_TESTING.md` - Complete framework
- `docs/THEORY_INTEGRATION_PLAN.md` - Overall plan
- `docs/theory/FORMAL_METHODS_WORKFLOW.md` - 7-phase workflow

### Existing Code to Study
- `src/core/verification/verifier.ts` - Existing verification functions
- `src/core/projection/__tests__/formal-correctness.test.ts` - Existing formal tests
- `src/core/simulation/cfg-simulator.ts` - Simulation semantics

---

## Summary

**Goal**: Transform test suite to verify formal theorems, not just behavior

**Approach**: Create theorem-specific tests with explicit citations

**Value**: Validates implementation correctness, catches subtle bugs, establishes methodology

**Priority**: Critical foundation - all future features depend on this

**Estimated Effort**: 2-3 weeks, ~1,500 lines

---

Ready to begin! Start with well-formedness theorems as they're the foundation for everything else.
