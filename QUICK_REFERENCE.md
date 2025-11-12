# Quick Reference: SMPST Codebase Navigation

## Key File Locations

### Parser System
| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Lexer | `src/core/parser/lexer.ts` | 141 | Token definitions (Chevrotain) |
| Parser | `src/core/parser/parser.ts` | 694 | LL(k) Grammar + CST→AST visitor |
| Tests | `src/core/parser/parser.test.ts` | 617 | 100+ parser test cases |

### AST Layer
| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| AST Types | `src/core/ast/types.ts` | 318 | Global + Local protocol AST nodes |

### CFG Layer
| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| CFG Types | `src/core/cfg/types.ts` | 176 | 9 node types, 5 edge types |
| CFG Builder | `src/core/cfg/builder.ts` | 500+ | AST → CFG transformation rules |
| Tests | `src/core/cfg/builder.test.ts` | 737 | Comprehensive transformation tests |

### Verification Layer
| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Algorithms | `src/core/verification/verifier.ts` | 1200+ | 15 verification checks (P0-P3) |
| Types | `src/core/verification/types.ts` | 330+ | Result types for each check |
| Tests | `src/core/verification/verifier.test.ts` | 1672 | 47 test cases (100% pass) |

### Projection Layer (CFSMs)
| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| CFSM Types | `src/core/projection/types.ts` | 156 | Formal CFSM definition (LTS semantics) |
| Projector | `src/core/projection/projector.ts` | 600+ | CFG → per-role CFSM algorithm |
| Tests | `src/core/projection/__tests__/` | Multiple | 9 test files covering all constructs |
| Fixtures | `src/core/projection/__fixtures__/protocols.ts` | 200+ | Reusable test protocol definitions |
| Builders | `src/core/projection/__test-utils__/builders.ts` | 100+ | Test helper functions |

### Simulation Layer
| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Simulator | `src/core/simulation/cfg-simulator.ts` | 600+ | Interactive CFG execution engine |
| Types | `src/core/simulation/types.ts` | | Simulation state and event types |
| Tests | `src/core/simulation/cfg-simulator.test.ts` | 682 | 23 test cases (100% pass) |

### Runtime Layer
| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Types | `src/core/runtime/types.ts` | | State machine and message types |
| Executor | `src/core/runtime/executor.ts` | 479 | Runtime protocol orchestration |
| Simulator | `src/core/runtime/simulator.ts` | 504 | Multi-role distributed execution |

### Documentation
| Document | Location | Purpose |
|----------|----------|---------|
| Overview | `docs/architecture-overview.md` | System architecture and pipeline |
| AST Design | `docs/ast-design.md` | AST structure specification |
| CFG Design | `docs/cfg-design.md` | CFG semantics and rules |
| Projection | `docs/projection-design.md` | CFSM projection algorithms |
| Tutorial | `docs/projection-tutorial.md` | Practical examples |
| Foundations | `docs/foundations.md` | Formal MPST theory |
| Status | `docs/STATUS.md` | Implementation progress tracking |

---

## Core Data Structures

### Parsing Pipeline
```
Source (String)
    ↓ Lexer.tokenize()
Tokens (IToken[])
    ↓ Parser.module()
CST (Concrete Syntax Tree)
    ↓ ScribbleToAstVisitor.visit()
AST (Abstract Syntax Tree)
```

### Semantic Pipeline
```
AST
    ↓ buildCFG()
CFG (Control Flow Graph)
    ↓ project(cfg, role)
CFSM (per-role Communicating FSM)
```

### CFG Node Types
- `initial` - Entry point
- `terminal` - Exit point
- `action` - Message send/receive
- `branch` - Choice point
- `merge` - Choice convergence
- `fork` - Parallel split
- `join` - Parallel join
- `recursive` - Recursion label

### CFG Edge Types
- `sequence` - Sequential control flow
- `branch` - Alternative in choice
- `fork` - Parallel branch
- `continue` - Back-edge to recursion
- `epsilon` - Silent transition

---

## Testing Infrastructure

### Test Framework
- **Framework**: Vitest v2.0.0
- **Approach**: TDD (Test-Driven Development)
- **Total Tests**: ~90+ across all layers
- **Pass Rate**: 100% for all implemented layers

### Test Organization
```
src/core/
├── parser/parser.test.ts          (617 lines)
├── cfg/builder.test.ts            (737 lines)
├── verification/verifier.test.ts  (1672 lines, 47 tests)
├── simulation/cfg-simulator.test.ts (682 lines, 23 tests)
├── runtime/
│   ├── executor.test.ts           (479 lines)
│   └── simulator.test.ts          (504 lines)
└── projection/__tests__/          (9 test files)
    ├── basic-messaging.test.ts    (116 lines)
    ├── choice-projection.test.ts
    ├── parallel-projection.test.ts
    ├── recursion-projection.test.ts
    ├── formal-correctness.test.ts (180 lines)
    ├── known-protocols.test.ts    (122 lines)
    ├── complex-integration.test.ts
    ├── edge-cases.test.ts
    └── completeness.test.ts
```

### Running Tests
```bash
npm install              # Install dependencies (first time)
npm test               # Run all tests
npm test:ui            # Run with UI dashboard
npm test:coverage      # Generate coverage report
```

---

## Key Algorithms

### Verification (15 total checks)

**P0 - Projection-Critical**:
1. Choice Determinism - External choices must have distinguishable labels
2. Choice Mergeability - Consistent role participation across branches
3. Connectedness - All declared roles participate

**P1 - Correctness & Well-formedness**:
4. Nested Recursion - Valid continue targets and label scoping
5. Recursion in Parallel - Rec/continue in same parallel branch
6. Fork-Join Structure - Matching fork-join pairs

**P2 - Additional Correctness**:
7. Multicast Validation - Array receivers handling
8. Self-Communication Detection - Role ≠ to/from validation
9. Empty Choice Branch Detection - Branches with no actions

**P3 - Structural**:
10. Merge Reachability - All branches converge at same merge

**Base Checks** (5 total):
- Deadlock Detection (Tarjan's SCC algorithm)
- Liveness Checking (reachability to terminal)
- Parallel Deadlock (multiple senders)
- Race Conditions (concurrent access conflicts)
- Progress (all nodes have outgoing edges)

### CFG Transformation Rules

| AST Node | CFG Translation |
|----------|-----------------|
| MessageTransfer | ActionNode with MessageAction |
| Choice | BranchNode → body → MergeNode |
| Parallel | ForkNode → branches → JoinNode |
| Recursion | RecursiveNode with back-edges via continue |
| Continue | Back-edge to corresponding RecursiveNode |
| Do | Sub-protocol substitution |

### CFSM Projection Rules

| Global Action | Role Involvement | Local Action |
|---------------|------------------|--------------|
| A→B: msg() | Sender (A) | SendAction(!⟨B,msg⟩) |
| A→B: msg() | Receiver (B) | ReceiveAction(?⟨A,msg⟩) |
| A→B: msg() | Not involved | TauAction (τ) |
| choice at A | Role A | ChoiceAction (branch selection) |
| choice at A | Other role | Receive branch signals (?) |
| par { } and { } | Any role | tau actions between branches |
| rec l { } | Any role | Cyclic transitions via back-edges |

---

## Current Implementation Status

| Layer | Component | Status | Tests | Quality |
|-------|-----------|--------|-------|---------|
| 1 | Parser | ✅ Complete | 617 | Production-ready |
| 2 | CFG Builder | ✅ Complete | 737 | Production-ready |
| 3 | Verification | ✅ Complete | 1672 (47 checks) | Exhaustive |
| 4 | Simulator | ✅ Complete | 682 (23 tests) | Verified |
| 5 | Projection | 🚧 In Progress | 9 tests | Partial |
| 6 | Code Generation | ⏸️ Planned | - | Not started |

---

## Dependencies

### Runtime Dependencies
- **chevrotain**: v11.0.0 - Parser generator
- **d3**: v7.9.0 - Visualization
- **dexie**: v4.0.0 - Client-side database
- **ts-morph**: v24.0.0 - Code generation

### Development Dependencies
- **typescript**: v5.0.0 - Type safety
- **vitest**: v2.0.0 - Testing framework
- **vite**: v5.0.0 - Build tool
- **svelte**: v4.2.0 - UI framework

---

## Key Design Principles

### 1. CFG as Central Artifact
- **Why**: CFG represents executable semantics, not just syntax
- **Benefits**: Enables verification, projection, and simulation from single representation
- **Usage**: All downstream layers (verification, projection, simulation) work on CFG

### 2. Actions on Transitions (LTS Semantics)
- **Why**: Formal CFSM definition uses labeled transition systems
- **Implementation**: CFSMTransition.action (not state-based)
- **Implication**: Precise formal semantics, easier proof of correctness

### 3. Layered Architecture
- **Benefits**: Clear separation of concerns, independent testing
- **Dependency**: Each layer depends only on previous layers
- **Rule**: Complete + test + document each layer before next

### 4. Comprehensive Verification
- **P0 Checks**: Prevent projection failures
- **P1 Checks**: Ensure correctness
- **P2-P3 Checks**: Catch additional issues
- **Coverage**: 100% for all 4 priority levels

### 5. Test-Driven Development
- **Pattern**: RED → GREEN → REFACTOR
- **Discipline**: Write tests before code
- **Coverage**: 100% for implemented layers

---

## Common Tasks

### Parse a Protocol
```typescript
import { parse } from 'src/core/parser/parser';

const source = `
  protocol Ping(role Client, role Server) {
    Client -> Server: Ping();
    Server -> Client: Pong();
  }
`;

const ast = parse(source);
console.log(ast.declarations[0].name); // "Ping"
```

### Build CFG
```typescript
import { buildCFG } from 'src/core/cfg/builder';

const cfg = buildCFG(ast.declarations[0]);
console.log(cfg.nodes.length); // Number of CFG nodes
```

### Verify Protocol
```typescript
import { verifyComplete } from 'src/core/verification/verifier';

const result = verifyComplete(cfg);
console.log(result.isValid); // true if passes all checks
console.log(result.violations); // Detailed violations
```

### Project to CFSM
```typescript
import { project } from 'src/core/projection/projector';

const cfsm = project(cfg, 'Client');
console.log(cfsm.states.length); // Number of states
console.log(cfsm.transitions.length); // Number of transitions
```

### Run Simulator
```typescript
import { CFGSimulator } from 'src/core/simulation/cfg-simulator';

const sim = new CFGSimulator(cfg);
sim.step();  // Execute one action
console.log(sim.getTrace()); // Get execution trace
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Scribble Source Code                     │
└────────────────────────┬────────────────────────────────────┘
                         │ Lexer
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   Tokens (from Chevrotain)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ Parser (CST)
                         ↓
┌─────────────────────────────────────────────────────────────┐
│         Abstract Syntax Tree (AST) - Layer 1                │
│  • GlobalProtocolDeclaration                                │
│  • LocalProtocolDeclaration (defined for projection)       │
│  • MessageTransfer, Choice, Parallel, Recursion             │
└────────────────────────┬────────────────────────────────────┘
                         │ buildCFG()
                         ↓
┌─────────────────────────────────────────────────────────────┐
│   Control Flow Graph (CFG) - Layer 2 - Central Artifact    │
│  • 9 Node Types (initial, action, branch, fork, join...)  │
│  • 5 Edge Types (sequence, branch, fork, continue, epsilon)│
│  • Powers both verification and simulation                  │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                │ Verification               │ Simulation/Projection
                │ (15 checks, 47 tests)     │ (9 tests, expanding)
                ↓                             ↓
         ┌─────────────┐              ┌──────────────┐
         │  Verifier   │              │  CFSM        │
         │  (Layer 3)  │              │  Projector   │
         └─────────────┘              │  (Layer 5)   │
                                      └──────────────┘
                                             │
                                             ↓
                                      ┌──────────────┐
                                      │  CFSM Array  │
                                      │  (per-role)  │
                                      └──────────────┘
                                             │
                                     ┌───────┴────────┐
                                     │                │
                                     ↓                ↓
                                  Runtime      Code Generation
                               Execution       (Layer 6)
```

---

## Extension Points

### Adding New Verification Check
1. Define check function in `src/core/verification/verifier.ts`
2. Add result type in `src/core/verification/types.ts`
3. Add test case in `src/core/verification/verifier.test.ts`
4. Update `CompleteVerification` type to include check

### Adding New Protocol Construct
1. Update lexer tokens in `src/core/parser/lexer.ts`
2. Add grammar rule in `src/core/parser/parser.ts`
3. Define AST type in `src/core/ast/types.ts`
4. Implement transformation in `src/core/cfg/builder.ts`
5. Add tests in `src/core/parser/parser.test.ts` and `src/core/cfg/builder.test.ts`
6. Update projection in `src/core/projection/projector.ts`

### Adding New Test Protocol
1. Add to `src/core/projection/__fixtures__/protocols.ts`
2. Reference in test files
3. Use builders from `src/core/projection/__test-utils__/builders.ts`

---

**Last Updated**: 2025-11-12
**Maintainer**: SMPST Development Team
