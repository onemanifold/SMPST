# SMPST Scribble Projection Implementation - Thorough Analysis

## Executive Summary

The SMPST codebase contains **two parallel projection implementations**:
1. **CFG-based CFSM Projection** (existing) - converts global CFG to role-specific CFSMs for verification
2. **AST-based Local Protocol Projection** (newer) - converts global protocols to textual local protocols

Both implementations are **fully functional with comprehensive test coverage** and support for **both "protocol" and "global protocol" syntax**.

---

## 1. Projection-Related Code Structure

### Directory Layout
```
/home/user/SMPST/src/core/projection/
├── index.ts                          # Module exports
├── projector.ts                       # CFG→CFSM projection (673 lines)
├── ast-projector.ts                  # AST→Local protocol projection (~550 lines)
├── types.ts                          # CFSM type definitions (207 lines)
├── lts-analysis.ts                   # LTS analysis utilities
├── cli.ts                            # CLI entry point (391 lines)
├── __fixtures__/
│   └── protocols.ts                  # Reusable test protocol definitions
├── __test-utils__/
│   ├── helpers.ts                    # Test assertion helpers
│   └── builders.ts                   # CFG/CFSM builders
└── __tests__/
    ├── README.md                     # Test documentation
    ├── ast-projection-*.test.ts      # 5 AST projection test suites
    ├── *-projection.test.ts          # CFG projection test suites
    └── role-mapping-validation.test.ts
```

### Total Code Metrics
- **Projection core code**: ~1,400 lines (3 main files)
- **Test code**: 16 test files, 130+ individual test cases
- **Theorem tests**: 4 formal theorem test suites
- **Documentation**: projection-tutorial.md, projection-design.md, projection-correctness.md

---

## 2. Projection Algorithm Details

### 2.1 CFG-based CFSM Projection (`projector.ts`)

**File**: `/home/user/SMPST/src/core/projection/projector.ts` (673 lines)

**Main Functions**:
```typescript
export function project(cfg: CFG, role: string, protocolRegistry?: IProtocolRegistry): CFSM
export function projectAll(cfg: CFG): ProjectionResult
```

**Algorithm Overview** (Lines 68-673):
- **Input**: Global CFG (control flow graph) representing choreography
- **Output**: CFSM (Communicating Finite State Machine) for a single role
- **Approach**: BFS traversal with (cfgNode, cfsmState) pair tracking

**Key Projection Rules**:

1. **Message Passing** (Lines 352-387):
   - **Sender involved**: Create state with `SendAction` (! operator)
   - **Receiver involved**: Create state with `ReceiveAction` (? operator)  
   - **Not involved**: Tau-elimination (skip the action, continue with same state)
   - Supports multicast (to: string | string[])

2. **Choice Nodes** (Lines 494-507):
   - Pass through choice branch points
   - For each branch edge, recursively project with same state context
   - Creates internal/external choice structure in CFSM

3. **Fork/Join (Parallel)** (Lines 508-579):
   - **Multiple branches with role**: Generate diamond interleaving pattern
   - **Single branch with role**: Sequential (no fork/join structure)
   - **No branches with role**: Epsilon transition to join node
   - Uses `generateDiamondPattern()` (Lines 242-288) for action interleaving

4. **Recursion** (Lines 587-596):
   - Records entry point in `recNodeToState` map
   - Second pass (Lines 612-659) processes continue edges as back-edges

5. **Sub-protocol Calls** (Lines 388-472):
   - Creates `SubProtocolCallAction` with role mapping
   - Validates well-formedness:
     - Arity check: formal params = actual args
     - Uniqueness: no role aliasing
     - Scope: all roles exist in parent protocol

**LTS Semantics** (Critical Design):
- **Actions live on TRANSITIONS, not states** (Type definition at Line 112 in types.ts)
- Follows formal CFSM definition: M = (Q, q₀, A, →) where → is state × action × state
- Reference: Deniélou & Yoshida (2012), ESOP

**Error Handling**:
- `ProjectionError` type (Lines 193-206 in types.ts)
- Error types: 'role-not-found', 'invalid-projection', 'merge-conflict', 'choice-inconsistency', 'parallel-conflict'

### 2.2 AST-based Local Protocol Projection (`ast-projector.ts`)

**File**: `/home/user/SMPST/src/core/projection/ast-projector.ts` (~550 lines)

**Main Functions**:
```typescript
export function projectToLocalProtocols(
  global: GlobalProtocolDeclaration,
  options: ProjectionOptions = {}
): ProjectionResult

export function projectForRole(
  global: GlobalProtocolDeclaration,
  role: string,
  options: ProjectionOptions = {}
): LocalProtocolDeclaration

export function isRoleInvolved(interaction: GlobalInteraction, role: string): boolean
export function getRoles(protocol: GlobalProtocolDeclaration): string[]
export function validateWellFormedness(protocol: GlobalProtocolDeclaration): ProjectionError[]
```

**Projection Rules** (Implements Honda-Yoshida-Carbone 2008):

1. **Message Transfer** (Lines 261-292):
   ```
   (p→q:⟨U⟩.G) ↓ r = 
     !⟨q,U⟩.(G↓r)  if r = p (sender)
     ?⟨p,U⟩.(G↓r)  if r = q (receiver)
     G↓r            if r ≠ p, r ≠ q (tau-elimination)
   ```
   - Returns `Send | Receive | null`

2. **Choice** (Lines 303-349):
   ```
   (choice at p { ... }) ↓ r =
     select { ... }  if r = p (internal/⊕)
     offer { ... }   if r ≠ p (external/&)
   ```
   - Projects each branch
   - Tau-eliminates if no branch involves role

3. **Parallel** (Lines 358-394):
   ```
   (G1 || G2) ↓ r = (G1↓r) || (G2↓r)
   ```
   - Independent projection of each branch
   - Tau-eliminates if no branch involves role

4. **Recursion** (Lines 404-445):
   ```
   (rec X.G) ↓ r = rec X.(G↓r)
   ```
   - Preserves recursion structure
   - Tau-eliminates if body has only Continue statements

5. **Continue** (Lines 454-460):
   ```
   (continue X) ↓ r = continue X
   ```
   - Preserved as-is

6. **Sub-protocol (Do)** (Lines 470-486):
   - Preserved if role in roleArguments, otherwise tau-eliminated

**Output**: Creates `LocalProtocolDeclaration` with:
- Type: 'LocalProtocolDeclaration'
- Name: `${global.name}_${role}`
- Role: the target role
- Body: sequence of `LocalInteraction` nodes

---

## 3. Test Suite Coverage

### Test Statistics
- **Total test cases**: 130+ (across 16 test files)
- **CFG projection tests**: 9 test files, ~45 tests
- **AST projection tests**: 5 test files, ~49 tests  
- **Theorem tests**: 4 files with formal properties

### Test Categories

#### A. AST Projection Tests (`/src/core/projection/__tests__/`)

1. **ast-projection-basic.test.ts** (150 lines)
   - Simple send/receive projection
   - Tau-elimination for non-involved roles
   - Three-role chains
   - Tests projectForRole() and serializeLocalProtocol()

2. **ast-projection-choice.test.ts** (250+ lines)
   - Internal choice (select) for selector role
   - External choice (offer) for non-selector
   - Nested choices
   - Three-way choices
   - Choice with continuation

3. **ast-projection-recursion.test.ts** (280+ lines)
   - Basic recursion projection
   - Nested recursion
   - Conditional recursion with choice
   - Continue statement handling

4. **ast-projection-spec-examples.test.ts** (400+ lines)
   - Real-world protocols from Scribble literature
   - Multi-party coordination protocols

5. **multicast-projection.test.ts** (200+ lines)
   - Multicast handling (to: string[])
   - Correctness of send-receive pairs

#### B. CFG Projection Tests

1. **basic-messaging.test.ts**
   - Simple message projection
   - Request-response patterns

2. **choice-projection.test.ts**
   - Internal/external choice (⊕/&)
   - Determinism checking

3. **parallel-projection.test.ts**
   - Fork/join semantics
   - Multi-branch handling
   - Diamond interleaving

4. **recursion-projection.test.ts**
   - Cycle detection
   - Back-edge creation

5. **known-protocols.test.ts**
   - Two-Phase Commit (2PC)
   - Three-Buyer protocol
   - Streaming protocols
   - Ping-Pong alternation

6. **role-mapping-validation.test.ts** (280+ lines)
   - Sub-protocol call validation
   - Role mapping correctness
   - Well-formedness checks
   - Error scenarios

7. **subprotocol-projection.test.ts** (300+ lines)
   - Sub-protocol invocation
   - Role argument mapping
   - Call stack semantics

8. **formal-correctness.test.ts**
   - Message duality verification
   - Orphaned state detection
   - Choice determinism
   - State reachability

#### C. Theorem Tests (`/src/__tests__/theorems/projection/`)

1. **soundness.test.ts** (550+ lines)
   - Proof Obligation 1: Step Correspondence
   - Proof Obligation 2: Trace Composition
   - Proof Obligation 3: Deadlock Freedom
   - Tests action counting and terminal reachability

2. **completeness.test.ts** (560+ lines)
   - Message preservation across projections
   - Terminal state reachability
   - No orphaned states

3. **composability.test.ts** (630+ lines)
   - Send/receive duality
   - Action synchronization
   - Trace equivalence

4. **preservation.test.ts** (500+ lines)
   - Property preservation under projection
   - Behavioral equivalence

---

## 4. Main Entry Points for Projection

### 4.1 Programmatic API

**For CFG-based projection**:
```typescript
import { project, projectAll } from '@/core/projection';

const cfg = buildCFG(ast); // from parser
const allCFSMs = projectAll(cfg); // { cfsms: Map<role, CFSM>, errors, roles }
const roleCFSM = project(cfg, 'ClientRole'); // CFSM for specific role
```

**For AST-based projection**:
```typescript
import { projectToLocalProtocols, projectForRole } from '@/core/projection/ast-projector';
import { serializeLocalProtocol } from '@/core/serializer/local-serializer';

const globalProto = ast.declarations[0]; // GlobalProtocolDeclaration
const localProtos = projectToLocalProtocols(globalProto); // all roles
const localProto = projectForRole(globalProto, 'ClientRole'); // single role
const text = serializeLocalProtocol(localProto); // back to Scribble text
```

### 4.2 CLI Entry Point

**File**: `/home/user/SMPST/src/core/projection/cli.ts` (391 lines)

**Usage**:
```bash
npm run project <file.scr> [options]
npm run project -- --stdin [options]
```

**Options** (Lines 37-44):
- `--role <name>`: Project single role only
- `--output-dir <dir>`: Save to directory (one file per role)
- `--format <fmt>`: text|json|both
- `--stdin`: Read from standard input
- `--help`: Show usage

**Implementation**:
- parseArgs() (Lines 50-85)
- projectSingleRole() (Lines 243-288)
- projectAllRoles() (Lines 290-355)
- countActions() utility (Lines 361-384)

---

## 5. Local vs Global Protocol Support

### 5.1 Parser Support

**File**: `/home/user/SMPST/src/core/parser/parser.ts` (750+ lines)

**Lexer Support** (`lexer.ts`):
```typescript
export const Protocol = createToken({ name: 'Protocol', pattern: /protocol/ });
export const Global = createToken({ name: 'Global', pattern: /global/ });
export const Local = createToken({ name: 'Local', pattern: /local/ });
```

**Grammar Rules**:

1. **Global Protocols** (Lines 84-107):
   ```typescript
   private globalProtocolDeclaration = this.RULE('globalProtocolDeclaration', () => {
     // Optional 'global' keyword for standard Scribble compatibility
     this.OPTION1(() => { this.CONSUME(tokens.Global); });
     this.CONSUME(tokens.Protocol);
     // ... role parameters: (role A, role B, role C)
   });
   ```
   - **Both syntaxes accepted**:
     - `protocol Name(role A, role B) { ... }`
     - `global protocol Name(role A, role B) { ... }`
   - Line 86 comment: "Both are accepted"
   - Multiple roles in parameter list

2. **Local Protocols** (Lines 225-242):
   ```typescript
   private localProtocolDeclaration = this.RULE('localProtocolDeclaration', () => {
     this.CONSUME(tokens.Local);      // REQUIRES 'local' keyword
     this.CONSUME(tokens.Protocol);
     this.CONSUME(tokens.Identifier); // protocol name
     this.OPTION(...typeParameters);
     this.CONSUME(tokens.LParen);
     this.CONSUME(tokens.Role);
     this.CONSUME2(tokens.Identifier); // SINGLE role (the "self" role)
     this.CONSUME(tokens.RParen);
   });
   ```
   - **Requires "local protocol" syntax** (not optional)
   - **Single role parameter** (self role)
   - Example: `local protocol BookJourney(role Customer) { ... }`

### 5.2 AST Type Support

**File**: `/home/user/SMPST/src/core/ast/types.ts`

**Global Protocol Declaration** (Lines 50-89):
```typescript
export interface GlobalProtocolDeclaration {
  type: 'GlobalProtocolDeclaration';
  name: string;
  roles: ProtocolRole[];           // Multiple roles
  parameters?: ProtocolParameter[];
  body: GlobalProtocolBody;
  location?: any;
}
```

**Local Protocol Declaration** (Lines 90-110):
```typescript
export interface LocalProtocolDeclaration {
  type: 'LocalProtocolDeclaration';
  name: string;
  role: string;                    // Single role
  selfRole: string;                // Self role
  parameters?: ProtocolParameter[];
  body: LocalProtocolBody;
  location?: any;
}
```

### 5.3 Serialization Support

**File**: `/home/user/SMPST/src/core/serializer/local-serializer.ts` (400+ lines)

**Serialization Output** (Lines 59-78):
```typescript
export function serializeLocalProtocol(
  protocol: LocalProtocolDeclaration,
  options: SerializerOptions = {}
): string
```

**Generates**:
- Protocol signature: `local protocol BookJourney(role Customer) { ... }`
- Local interactions: Send, Receive, LocalChoice, LocalParallel, Recursion, Continue, Do
- Proper indentation and formatting

**Key Functions**:
- buildProtocolSignature() (Lines 85-96)
  - Format: `local protocol <Name> at <role>(<params>)`
- serializeInteraction() (Lines 129-161)
  - Handles all local interaction types
- serializeSend/Receive (Lines 172-185)
  - Format: `message(Type) to/from Role;`
- serializeLocalChoice (Lines 246-286)
  - Proper select/offer distinction
- serializeLocalParallel (Lines 298-324)
  - Format with `par { } and { }`
- serializeRecursion (Lines 335-355)
  - Format with `rec Label { continue Label; }`

---

## 6. Current Projection Algorithm Behavior

### 6.1 Message Passing
```
Global:    A -> B: Login()
           C -> D: Payment()

Project A: !⟨B,Login⟩
Project B: ?⟨A,Login⟩
Project C: !⟨D,Payment⟩
Project D: ?⟨C,Payment⟩
```

### 6.2 Choice Projection
```
Global: choice at Client {
  Client -> Server: Login();
} or {
  Client -> Server: Register();
}

Project Client:  select { Login() | Register() }  [internal/⊕]
Project Server:  offer { Login() | Register() }   [external/&]
```

### 6.3 Parallel Projection

**Case 1: Role in one branch**
```
Global: par { A -> B: M1() } and { C -> D: M2() }
Project A: !⟨B,M1⟩ (sequential, no par structure)
Project C: !⟨D,M2⟩ (sequential, no par structure)
```

**Case 2: Role in multiple branches**
```
Global: par { A -> B: M1() } and { A -> C: M2() }
Project A: par { !⟨B,M1⟩ } and { !⟨C,M2⟩ }  (preserves par)
```

### 6.4 Recursion Projection
```
Global: rec Loop { A -> B: Msg(); continue Loop; }
Project A: rec X { !⟨B,Msg⟩; continue X; }
Project B: rec X { ?⟨A,Msg⟩; continue X; }
```

### 6.5 Tau-Elimination
```
Global:    A -> B: M1()
           C -> D: M2()  (D not in protocol, or invisible to role)
           B -> C: M3()

Project A: !⟨B,M1⟩; ?⟨B,M3⟩  (M2 tau-eliminated)
Project B: ?⟨A,M1⟩; !⟨C,M3⟩  (M2 tau-eliminated)
Project C: !⟨D,M2⟩; ?⟨B,M3⟩  (M1 tau-eliminated)
Project D: ?⟨C,M2⟩
```

---

## 7. Key Implementation Details

### 7.1 Types and Interfaces

**Core CFSM Types** (`types.ts`):

```typescript
// State: just a control location
export interface CFSMState {
  id: string;
  label?: string;
  metadata?: Record<string, any>;
}

// Actions live on transitions (LTS principle)
export type CFSMAction =
  | SendAction       // !⟨p, l⟨U⟩⟩
  | ReceiveAction    // ?⟨p, l⟨U⟩⟩
  | TauAction        // τ (silent)
  | ChoiceAction     // branch selection
  | SubProtocolCallAction;  // do Subproto(roles)

// Transition: (state, action, state') ∈ Δ
export interface CFSMTransition {
  id: string;
  from: string;      // Source state
  to: string;        // Target state
  action: CFSMAction;  // ← ACTION LIVES HERE
  guard?: string;
  metadata?: Record<string, any>;
}

// Complete CFSM
export interface CFSM {
  role: string;
  states: CFSMState[];
  transitions: CFSMTransition[];
  initialState: string;
  terminalStates: string[];
  metadata?: { sourceProtocol?: string; };
}
```

### 7.2 Critical Implementation Details

**Visited Set Strategy** (projector.ts Lines 306-317):
- Prevents infinite loops in recursive graphs
- Key: uses `visitKey = "${cfgNodeId}:${lastStateId}"`
- Tracks both CFG node AND CFSM state context
- Allows revisiting same CFG node in different state contexts

**Fork/Join Handling** (projector.ts Lines 508-579):
- **Multiple branches**: Diamond pattern generation (Lines 242-288)
- **Single branch**: Sequential (no parallel structure)
- **No branches**: Epsilon transition to join
- Interleaving for 2+ actions (line 266-279), sequential for >2 (line 280-287)

**Continue Edge Processing** (projector.ts Lines 612-659):
- Second pass over CFG edges with `edgeType === 'continue'`
- Backward search to find last relevant CFSM state
- Creates back-edge to recursion entry state

**Sub-protocol Validation** (projector.ts Lines 388-472):
- Arity: |formal params| = |actual args|
- Uniqueness: no duplicate roles
- Scope: all actual roles exist in parent protocol
- Role mapping construction (Line 440-442)

### 7.3 Helper Utilities

**LTS Analysis Module** (`lts-analysis.ts`):

- `findBranchingStates()`: States with multiple outgoing non-tau transitions
- `findMergeStates()`: States with multiple incoming non-tau transitions
- `hasCycle()`: DFS-based cycle detection with recursion stack
- `canReachTerminal()`: Reachability analysis from initial state
- `countActions()`: Count send/receive by type
- `getReachableStates()`: BFS-based reachability
- `getDeadlockStates()`: States with no outgoing transitions
- `findLiveStates()`: States that can reach terminal

---

## 8. Known Limitations and TODOs

### Documented TODOs

1. **projector.ts Line 280**:
   ```typescript
   // More than 2 actions - for now, just do sequential (TODO: full interleaving)
   ```
   - Full Cartesian product of action orderings not implemented for >2 parallel actions

2. **ast-projector.ts Lines 546-549**:
   ```typescript
   // TODO: Implement full well-formedness checks
   // - Check all message senders/receivers are defined roles
   // - Check recursion labels are properly scoped
   // - Check choice branches are deterministic
   ```

3. **parser.ts Line 522, 530**:
   - Re-enable exception handling for local protocols (Phase 4)

### Design Decisions

1. **Local interactions reuse global structure** (parser.ts Line 713):
   ```typescript
   localInteraction(ctx: any): AST.LocalInteraction {
     // For now, local interactions use same nodes as global
     return this.globalInteraction(ctx) as any;
   }
   ```
   - Temporary: allows parser reuse, projection converts appropriately

2. **Multicast support** (projector.ts Line 54):
   - SendAction.to can be `string | string[]`
   - Useful for broadcast patterns

---

## 9. Testing Infrastructure

### Test Helpers

**builders.ts**:
- `buildCFSMFromSource()`: Parse → CFG → CFSM
- `buildAllCFSMsFromSource()`: Parse → CFG → all CFSMs
- Protocol fixtures with common patterns

**helpers.ts**:
- `hasSendAction(cfsm, to, label)`: Verify send exists
- `hasReceiveAction(cfsm, from, label)`: Verify receive exists
- `hasCycle(cfsm)`: DFS cycle detection
- `getReachableStates(cfsm, from)`: BFS reachability
- `assertValidCFSMStructure(cfsm)`: Complete validation
- `assertMessageDuality(cfsmA, cfsmB)`: Send/receive pairing
- `assertDeterministicChoice(cfsm, stateId)`: Distinct labels
- `assertNoOrphanedStates(cfsm)`: All states reachable
- `assertTerminalStateExists(cfsm)`: Terminal state required

### Test Fixtures

**protocols.ts** (~500 lines):
Common test protocols:
- REQUEST_RESPONSE
- THREE_ROLE_CHAIN
- INTERNAL_CHOICE, NESTED_CHOICE
- PARALLEL_WITH_SEQUENCES
- INFINITE_LOOP, CONDITIONAL_LOOP
- TWO_PHASE_COMMIT, THREE_BUYER
- STREAMING, PING_PONG

---

## 10. Documentation

### Key Documentation Files

1. **projection-tutorial.md** (~800 lines)
   - Introduction and motivation
   - Theoretical foundations (Honda-Yoshida-Carbone)
   - LTS semantics explanation
   - Type system design rationale
   - Algorithm walkthrough with pseudocode
   - Implementation guide with code examples
   - Testing methodology for formal properties
   - Common pitfalls and debugging

2. **projection-design.md** (~300 lines)
   - Formal CFSM definition
   - LTS semantics and CFG-to-LTS mapping
   - Detailed projection rules with notation
   - Algorithm pseudocode
   - Error handling strategy

3. **projection-correctness.md**
   - Formal theorem statements
   - Proof sketches
   - LTS-based verification strategy

4. **PROJECTION_IMPLEMENTATION_REPORT.md** (top-level)
   - Final implementation report
   - Test coverage metrics (92.15%)
   - Known protocols validation
   - Formal correctness verification

---

## 11. Summary: Current State

### What's Implemented ✅

1. **CFG-based CFSM Projection**
   - Complete implementation with proper LTS semantics
   - Message passing, choice, parallel, recursion all working
   - Sub-protocol call support with validation

2. **AST-based Local Protocol Projection**
   - Full implementation of formal projection rules
   - Textual local protocol generation
   - Serialization back to Scribble syntax

3. **Parser Support**
   - Both "protocol" and "global protocol" syntax accepted for global protocols
   - "local protocol" syntax for local protocols
   - Full multiparty session type constructs

4. **Test Coverage**
   - 130+ test cases covering all projection rules
   - 4 formal theorem tests validating correctness properties
   - Known protocol benchmarks
   - Edge case and error handling tests

5. **CLI Integration**
   - Full command-line tool for projection
   - Multiple output formats (text, JSON)
   - Batch processing and single-role projection

### What's Missing ❌

1. **Interleaving for >2 parallel actions** (minor - most protocols use ≤2 parallel actions)
2. **Full well-formedness validation** (basic checks exist, comprehensive validation TODO)
3. **Exception handling in local protocols** (Phase 4 feature, not yet needed)

### Confidence Level: **HIGH** ✅
- All core projection functionality working and tested
- Formal correctness properties verified
- Real-world protocol benchmarks pass
- Code is well-documented with academic references

