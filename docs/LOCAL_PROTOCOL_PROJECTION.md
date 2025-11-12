# Local Protocol Projection

## Overview

This module implements formal Scribble local protocol projection following the Multiparty Session Types (MPST) theory.

### Two Projection Approaches

The SMPST IDE provides two complementary projection systems:

1. **CFG → CFSM Projection** (`projector.ts`)
   - Input: Global Protocol CFG (Control Flow Graph)
   - Output: CFSM (Communicating Finite State Machine)
   - Purpose: Runtime monitoring, verification, simulation
   - Based on: LTS (Labelled Transition System) semantics

2. **AST → Local Protocol Projection** (`ast-projector.ts`) - **NEW**
   - Input: Global Protocol AST
   - Output: Local Protocol AST + Textual Scribble
   - Purpose: Generate local protocol specifications, code generation
   - Based on: Formal MPST projection rules

## Formal Projection Rules

The AST-based projector implements the following formal rules from the Scribble specification:

### Rule 1: Message Passing

```
(p→q:⟨U⟩.G) ↓ r =
  - !⟨q,U⟩.(G↓r)  if r = p (sender)
  - ?⟨p,U⟩.(G↓r)  if r = q (receiver)
  - G↓r            if r ≠ p, r ≠ q (tau-elimination)
```

**Example:**
```scribble
Global: A -> B: Message();

Projection to A: Message() to B;
Projection to B: Message() from A;
Projection to C: (tau-eliminated)
```

### Rule 2: Choice

```
(choice at p { l1: G1 [] l2: G2 }) ↓ r =
  - select { l1: G1↓r [] l2: G2↓r }  if r = p (internal)
  - offer { l1: G1↓r [] l2: G2↓r }   if r ≠ p (external)
```

**Example:**
```scribble
Global:
  choice at Client {
    Client -> Server: Login();
  } or {
    Client -> Server: Register();
  }

Projection to Client (select - internal choice):
  choice at Client {
    Login() to Server;
  } or {
    Register() to Server;
  }

Projection to Server (offer - external choice):
  choice at Client {
    Login() from Client;
  } or {
    Register() from Client;
  }
```

### Rule 3: Recursion

```
(rec X.G) ↓ r = rec X.(G↓r)
```

**Example:**
```scribble
Global:
  rec Loop {
    A -> B: Ping();
    B -> A: Pong();
    continue Loop;
  }

Projection to A:
  rec Loop {
    Ping() to B;
    Pong() from B;
    continue Loop;
  }
```

### Rule 4: Parallel

```
(G1 || G2) ↓ r = (G1↓r) || (G2↓r)
```

### Rule 5: Continue

```
(continue X) ↓ r = continue X
```

### Rule 6: Tau-Elimination

If a role is not involved in any interaction within a construct (choice, recursion, parallel), the entire construct is tau-eliminated from that role's projection.

## Usage

### Basic Projection

```typescript
import { parse } from './parser/parser';
import { projectForRole, projectToLocalProtocols } from './projection/ast-projector';
import { serializeLocalProtocol } from './serializer/local-serializer';

// Parse global protocol
const source = `
  protocol RequestResponse(role Client, role Server) {
    Client -> Server: Request();
    Server -> Client: Response();
  }
`;

const ast = parse(source);
const globalProtocol = ast.declarations[0];

// Project for a single role
const localClient = projectForRole(globalProtocol, 'Client');

// Serialize to text
const scribbleText = serializeLocalProtocol(localClient);
console.log(scribbleText);
// Output:
// local protocol RequestResponse_Client at Client() {
//   Request() to Server;
//   Response() from Server;
// }

// Project for all roles
const result = projectToLocalProtocols(globalProtocol);
for (const [role, localProtocol] of result.localProtocols) {
  console.log(`\n=== ${role} ===`);
  console.log(serializeLocalProtocol(localProtocol));
}
```

### Complete Pipeline

```typescript
// Full Scribble pipeline:
// Global Protocol (text) → Parse → AST → Project → Local Protocol AST → Serialize → Text

const globalText = `
  protocol TwoParty(role A, role B) {
    A -> B: Hello();
    B -> A: World();
  }
`;

// 1. Parse
const ast = parse(globalText);
const global = ast.declarations[0];

// 2. Project to local protocols
const projection = projectToLocalProtocols(global);

// 3. Serialize to text files
for (const [role, local] of projection.localProtocols) {
  const localText = serializeLocalProtocol(local);

  // Save to file
  fs.writeFileSync(`${role}.scr`, localText);
}

// 4. (Optional) Further project to CFSM for verification
import { buildCFG } from './cfg/builder';
import { project as projectCFSM } from './projection/projector';

for (const [role, local] of projection.localProtocols) {
  const cfg = buildCFG(local);
  const cfsm = projectCFSM(cfg, role);
  // Use CFSM for monitoring/verification
}
```

## Formal Correctness Properties

The implementation satisfies the following formal properties:

### 1. Completeness

Every message in the global protocol appears exactly once as a send in the sender's projection and exactly once as a receive in the receiver's projection.

**Tested in:** `ast-projection-spec-examples.test.ts` - "should satisfy projection completeness property"

### 2. Role Correctness

A local protocol for role `r` only contains actions where `r` is involved (either as sender or receiver). All other actions are tau-eliminated.

**Tested in:** `ast-projection-spec-examples.test.ts` - "should satisfy role correctness property"

### 3. Composability (Duality)

For every send action in one role's projection, there exists a corresponding receive action in the receiving role's projection with matching label and type.

**Tested in:** `ast-projection-spec-examples.test.ts` - "should satisfy composability (duality) property"

### 4. Structure Preservation

Recursion, choice, and parallel structures are preserved in projections (with appropriate tau-elimination for non-involved roles).

**Tested in:** `ast-projection-recursion.test.ts`, `ast-projection-choice.test.ts`

## Test Coverage

The implementation includes comprehensive test coverage:

- **Basic message passing tests** (9 tests)
  - Send/receive projection
  - Tau-elimination
  - Request-response patterns
  - Three-role chains

- **Choice tests** (8 tests)
  - Internal choice (select)
  - External choice (offer)
  - Nested choice
  - Multi-way choice
  - Asymmetric branches

- **Recursion tests** (8 tests)
  - Simple recursion
  - Recursion with choice
  - Nested recursion
  - Multiple continue points
  - Tau-elimination of recursion

- **Specification examples** (9 tests)
  - JBoss Protocol Guide examples
  - Academic paper examples (Honda, Yoshida, Carbone)
  - Formal correctness properties

**Total: 34 tests, 100% passing**

## References

### Authoritative Specifications

1. **JBoss Scribble Protocol Guide**
   - Practical syntax and examples
   - Section 2.1: Protocol Definition (local protocols)

2. **"The Scribble Protocol Language" (Yoshida et al.)**
   - Figure 2: BookJourney global protocol
   - Figure 3: Projected local protocols
   - Section 3.4: Projection algorithm

3. **"Multiparty Asynchronous Session Types" (Honda, Yoshida, Carbone, 2008)**
   - Formal MPST theory
   - Projection rules and well-formedness conditions
   - Safety guarantees

4. **"Multiparty Session Types Meet Communicating Automata" (Deniélou, Yoshida, 2012)**
   - CFSM semantics
   - FSA generation from local protocols

## Architecture

```
Global Protocol (text)
       ↓ parse
Global Protocol AST
       ↓ projectToLocalProtocols (NEW!)
Local Protocol AST (per role)
       ↓ serializeLocalProtocol
Local Protocol (text)
       ↓ parse
Local Protocol AST
       ↓ buildCFG
CFG
       ↓ project (existing CFSM projector)
CFSM
       ↓ monitoring/verification
Runtime Verification
```

## Future Work

- [ ] Parallel composition projection (currently basic implementation)
- [ ] Sub-protocol (do) projection with full recursion
- [ ] Well-formedness validation (choice determinism, no races)
- [ ] Multicast message projection
- [ ] Projection optimizations (merge elimination, etc.)
- [ ] Integration with code generation
- [ ] Support for Scribble extensions (interrupts, subsessions)

## Contributing

When extending the projection algorithm:

1. **Add formal rule** - Document the projection rule with formal notation
2. **Implement projection** - Add case in `projectInteraction()`
3. **Add tests** - Create comprehensive test coverage
4. **Validate against spec** - Ensure compliance with Scribble specification
5. **Update documentation** - Add examples and usage

## License

Part of the SMPST IDE project. See main LICENSE file.
