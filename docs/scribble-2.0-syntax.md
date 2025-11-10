# Scribble 2.0 Syntax Specification

## Purpose

This document specifies the syntax of Scribble 2.0 as implemented in the Scribble MPST IDE. It serves as both a tutorial for learners and a precise specification for tool builders (including LLMs).

## Document Conventions

- **Grammar**: EBNF notation with `<...>` for non-terminals, `"..."` for literals
- **Examples**: Annotated with `// comments` explaining semantics
- **Extensions**: Marked as ✅ (implemented) or 🚧 (future work)

---

## Language Overview

Scribble is a **protocol description language** based on **Multiparty Session Types (MPST)**. It describes communication protocols between multiple participants (roles) in distributed systems.

**Key Principles:**
1. **Global view first**: Describe the entire protocol from a bird's-eye view
2. **Projection**: Automatically derive what each role must do (local view)
3. **Verification**: Prove properties like deadlock-freedom, liveness

**Execution Model:**
- **Asynchronous** message passing (no blocking sends)
- **Reliable** channels (no message loss, FIFO ordering per pair)
- **Role-to-role** ordering (messages from A to B arrive in order)

---

## Top-Level Structure

### Module (Protocol File)

```ebnf
<Module> ::= <ImportDeclaration>* <ProtocolDeclaration>+
```

A Scribble file contains:
1. **Imports** (optional): Declare external types
2. **Protocols**: One or more global or local protocol definitions

---

## Import Declarations ✅

### Syntax

```ebnf
<ImportDeclaration> ::= "import" <TypeSystem> <QualifiedName> ("as" <SimpleName>)? ";"

<TypeSystem>       ::= ε | <SimpleName>
<QualifiedName>    ::= <SimpleName> ("." <SimpleName>)*
<SimpleName>       ::= [A-Z][a-zA-Z0-9_]*
```

### Semantics

Imports declare **data types** used in message payloads. The type system (e.g., `java`, `xsd`, `typescript`) determines how types are resolved.

### Examples

```scribble
// Import a Java class
import java.util.List as List;
import java.lang.String as String;

// Import without alias
import MyCustomType;

// Import from TypeScript (extension)
import typescript Number;
```

### Notes
- If no type system is specified, a default type namespace is assumed
- Imported types can be used in message payload declarations
- In our IDE, we'll support a built-in type system (`int`, `string`, `bool`, etc.)

---

## Protocol Declarations ✅

### Global Protocol Syntax

```ebnf
<GlobalProtocolDeclaration> ::= "global" "protocol" <ProtocolName> <RoleDeclarationList> "{" <GlobalProtocolBody> "}"

<RoleDeclarationList>       ::= "(" <RoleDeclaration> ("," <RoleDeclaration>)* ")"
<RoleDeclaration>           ::= "role" <RoleName>
<RoleName>                  ::= [A-Z][a-zA-Z0-9_]*
<ProtocolName>              ::= [A-Z][a-zA-Z0-9_]*
```

### Local Protocol Syntax

```ebnf
<LocalProtocolDeclaration> ::= "local" "protocol" <ProtocolName> "at" <RoleName> <RoleDeclarationList> "{" <LocalProtocolBody> "}"
```

### Semantics

- **Global protocols** specify interactions from a bird's-eye view
- **Local protocols** specify behavior for a single role (usually generated via projection)
- **Roles** are participants in the protocol (e.g., Client, Server, Broker)

### Examples

```scribble
global protocol TwoPhaseCommit(role Coordinator, role Participant1, role Participant2) {
    // Protocol body...
}

local protocol TwoPhaseCommit at Coordinator(role Coordinator, role Participant1, role Participant2) {
    // Local interactions for Coordinator...
}
```

---

## Global Interactions

### Message Transfer ✅

#### Syntax

```ebnf
<MessageTransfer> ::= <MessageSignature> "from" <RoleName> "to" <RoleName> ("," <RoleName>)* ";"

<MessageSignature> ::= <MessageLabel> "(" <PayloadType> ("," <PayloadType>)* ")"
                     | <MessageLabel> "(" ")"

<MessageLabel>     ::= [a-z][a-zA-Z0-9_]*
<PayloadType>      ::= <TypeName> ("<" <TypeArgument> ("," <TypeArgument>)* ">")?
<TypeName>         ::= [A-Z][a-zA-Z0-9_]*
<TypeArgument>     ::= <TypeName>
```

#### Semantics

A message transfer describes:
- **What**: Message label and payload type(s)
- **Who**: Sender and receiver(s)
- **Order**: Sequential composition (`;` separates interactions)

**Multi-receiver**: `to R1, R2, R3` means the sender multicasts to all receivers (same message to each).

#### Examples

```scribble
// Simple message with one payload
request(String) from Client to Server;

// Multiple payload types
coordinate(Int, Timestamp, Data) from Coordinator to Worker;

// Generic types (extension)
fetchItems(List<Item>) from Client to Server;

// No payload (signal only)
ack() from Server to Client;

// Multicast to multiple receivers
broadcast(Event) from Publisher to Sub1, Sub2, Sub3;
```

#### Notes
- **Payload types** must be previously imported or built-in
- **Message labels** distinguish different messages (used in choices)

---

### Choice ✅

#### Syntax

```ebnf
<Choice> ::= "choice" "at" <RoleName> "{" <GlobalProtocolBody> "}" ("or" "{" <GlobalProtocolBody> "}")+
```

#### Semantics

A choice represents a **branching point** where one role (the decider) selects among alternatives. The decider must send distinct messages to initiate each branch.

**Scoping rules:**
- The **first message** in each branch must be sent **by the decider**
- Other roles observe which branch was taken by receiving the corresponding message

#### Examples

```scribble
global protocol BookingService(role Client, role Server, role PaymentGateway) {
    request(BookingDetails) from Client to Server;

    choice at Server {
        // Branch 1: Booking available
        available(Price) from Server to Client;
        payment(CreditCard) from Client to PaymentGateway;
        confirmation(Receipt) from PaymentGateway to Client;
    } or {
        // Branch 2: Booking unavailable
        unavailable(Reason) from Server to Client;
    }
}
```

#### Verification Considerations

- **Determinism**: Each branch must start with a **distinguishable message label**
- **Consistency**: All roles must agree on which branch was taken (communicated via messages)

---

### Recursion ✅

#### Syntax

```ebnf
<Recursion> ::= "rec" <RecursionLabel> "{" <GlobalProtocolBody> "}"
<Continue>  ::= "continue" <RecursionLabel> ";"

<RecursionLabel> ::= [A-Z][a-zA-Z0-9_]*
```

#### Semantics

- **`rec Label { ... }`**: Defines a recursion point named `Label`
- **`continue Label;`**: Jumps back to the recursion point `Label`
- Recursion labels are **lexically scoped** (nested recursions allowed)

#### Examples

```scribble
global protocol StreamingService(role Producer, role Consumer) {
    connect(SessionId) from Consumer to Producer;

    rec Loop {
        chunk(Data) from Producer to Consumer;
        choice at Consumer {
            requestMore() from Consumer to Producer;
            continue Loop;
        } or {
            disconnect() from Consumer to Producer;
        }
    }
}
```

#### Verification Considerations

- **Well-founded recursion**: Must be possible to terminate (at least one branch exits the loop)
- **Progress**: Infinite loops without communication are disallowed

---

### Subprotocol Invocation (`do`) ✅

#### Syntax

```ebnf
<Do> ::= "do" <ProtocolName> <RoleArgumentList> ";"

<RoleArgumentList> ::= "(" <RoleArgument> ("," <RoleArgument>)* ")"
<RoleArgument>     ::= <RoleName> "as" <RoleName>
```

#### Semantics

The `do` statement **invokes another protocol inline**, mapping roles from the calling context to the called protocol.

**Role substitution**: `do Proto(A as X, B as Y)` means:
- Every occurrence of role `X` in `Proto` is replaced by role `A`
- Every occurrence of role `Y` in `Proto` is replaced by role `B`

**Mutual recursion**: Protocols can call each other (must be tail-recursive per role).

#### Examples

```scribble
global protocol Authenticate(role Client, role AuthServer) {
    credentials(Username, Password) from Client to AuthServer;
    choice at AuthServer {
        success(Token) from AuthServer to Client;
    } or {
        failure(Reason) from AuthServer to Client;
    }
}

global protocol SecureTransaction(role Client, role Server, role AuthServer) {
    // First authenticate
    do Authenticate(Client as Client, AuthServer as AuthServer);

    // Then perform transaction
    transaction(Data) from Client to Server;
    result(Response) from Server to Client;
}
```

#### Tail Recursion Constraint

For any role `R` in a protocol, it is **not allowed** to have any actions by `R` **after** a `do` statement that involves `R`.

**Invalid example:**
```scribble
do SubProtocol(A as X);
msg() from A to B;  // ❌ Error: Action by A after do involving A
```

**Valid (tail recursive):**
```scribble
msg() from A to B;
do SubProtocol(A as X);  // ✅ OK: No actions after do
```

---

### Parallel Composition ✅

#### Syntax

```ebnf
<Parallel> ::= "par" "{" <GlobalProtocolBody> "}" ("and" "{" <GlobalProtocolBody> "}")+
```

#### Semantics

Parallel composition allows **independent interaction sequences** to occur concurrently. This is **essential for P2P protocols** where multiple independent communications happen simultaneously.

**Execution Model:**
- Branches execute **concurrently** (interleaved execution)
- Each branch progresses independently
- The parallel block completes when **all branches** reach their end

**Independence Requirement:**
For parallel composition to be well-formed, branches should be **causally independent**:
- No shared causal dependencies between branches
- Roles in different branches can execute actions in any order
- No role should be waiting for actions in multiple branches simultaneously

**Note:** While full causal independence is ideal, practical P2P protocols may have coordinated parallel actions. The verifier will check for potential race conditions and deadlocks.

#### Examples

**Example 1: Parallel Data Fetch**
```scribble
global protocol ParallelFetch(role Client, role ServiceA, role ServiceB) {
    par {
        requestA(Query) from Client to ServiceA;
        responseA(Data) from ServiceA to Client;
    } and {
        requestB(Query) from Client to ServiceB;
        responseB(Data) from ServiceB to Client;
    }
}
```

**Example 2: P2P File Sharing**
```scribble
global protocol P2PFileSharing(role PeerA, role PeerB, role PeerC, role Tracker) {
    // PeerA requests file from Tracker
    request(FileId) from PeerA to Tracker;

    par {
        // Tracker responds to PeerA with peer list
        peers(List) from Tracker to PeerA;
    } and {
        // Meanwhile, PeerB and PeerC exchange chunks independently
        chunkRequest(ChunkId) from PeerB to PeerC;
        chunkData(Bytes) from PeerC to PeerB;
    }
}
```

**Example 3: Distributed Consensus with Parallel Voting**
```scribble
global protocol DistributedConsensus(role Proposer, role Voter1, role Voter2, role Voter3) {
    // Proposer broadcasts proposal
    proposal(Value) from Proposer to Voter1, Voter2, Voter3;

    // Voters respond in parallel
    par {
        vote1(Decision) from Voter1 to Proposer;
    } and {
        vote2(Decision) from Voter2 to Proposer;
    } and {
        vote3(Decision) from Voter3 to Proposer;
    }

    // Proposer aggregates votes
    result(Outcome) from Proposer to Voter1, Voter2, Voter3;
}
```

#### Verification Considerations

**1. Race Conditions**
- Check if roles in different branches can interfere with each other
- Ensure message ordering is preserved within each branch

**2. Deadlock in Parallel Context**
- Verify no role waits for actions in multiple branches simultaneously
- Example violation: Role R receives from branch 1, sends to branch 2, but branch 2 waits for R to receive first

**3. Determinism**
- Parallel branches should be distinguishable by the roles involved
- No ambiguity about which branch a message belongs to

**4. Progress**
- All branches must be able to make progress independently
- No branch should be blocked waiting for another branch indefinitely

#### Projection Behavior

When projecting parallel composition to a local protocol:

**Case 1: Role participates in single branch**
- Keep only that branch (others are eliminated)

**Case 2: Role participates in multiple branches**
- Project becomes a **local parallel** (role must handle concurrent actions)
- Code generation creates concurrent threads/handlers

**Example:**
```scribble
global protocol Multi(role Client, role S1, role S2) {
    par {
        req1(Q) from Client to S1;
        res1(D) from S1 to Client;
    } and {
        req2(Q) from Client to S2;
        res2(D) from S2 to Client;
    }
}
```

**Client's local projection:**
```scribble
local protocol Multi at Client(...) {
    par {
        req1(Q) to S1;
        res1(D) from S1;
    } and {
        req2(Q) to S2;
        res2(D) from S2;
    }
}
```

**S1's local projection:**
```scribble
local protocol Multi at S1(...) {
    req1(Q) from Client;
    res1(D) to Client;
}
```
(No parallel needed - S1 only participates in one branch)

---

## Local Interactions

When a global protocol is **projected** to a local protocol for a specific role, global interactions become local interactions.

### Send ✅

```ebnf
<Send> ::= <MessageSignature> "to" <RoleName> ("," <RoleName>)* ";"
```

Role sends a message to one or more receivers.

### Receive ✅

```ebnf
<Receive> ::= <MessageSignature> "from" <RoleName> ";"
```

Role receives a message from a sender.

### Internal Choice ✅

```ebnf
<InternalChoice> ::= "choice" "{" <LocalProtocolBody> "}" ("or" "{" <LocalProtocolBody> "}")+
```

Role makes a choice (sends different messages to initiate branches).

### External Choice ✅

```ebnf
<ExternalChoice> ::= "choice" "from" <RoleName> "{" <CaseBranch> "}" ("or" "{" <CaseBranch> "}")+

<CaseBranch> ::= <MessageSignature> ":" <LocalProtocolBody>
```

Role reacts to a choice made by another role (receives different messages).

---

## Complete EBNF Grammar

```ebnf
(* Module *)
<Module> ::= <ImportDeclaration>* <ProtocolDeclaration>+

(* Imports *)
<ImportDeclaration> ::= "import" <TypeSystem>? <QualifiedName> ("as" <SimpleName>)? ";"

(* Protocols *)
<ProtocolDeclaration> ::= <GlobalProtocolDeclaration> | <LocalProtocolDeclaration>

<GlobalProtocolDeclaration> ::= "global" "protocol" <ProtocolName> <RoleDeclarationList> "{" <GlobalProtocolBody> "}"

<LocalProtocolDeclaration> ::= "local" "protocol" <ProtocolName> "at" <RoleName> <RoleDeclarationList> "{" <LocalProtocolBody> "}"

<RoleDeclarationList> ::= "(" <RoleDeclaration> ("," <RoleDeclaration>)* ")"
<RoleDeclaration>     ::= "role" <RoleName>

(* Global Interactions *)
<GlobalProtocolBody> ::= <GlobalInteraction>*

<GlobalInteraction> ::= <MessageTransfer>
                      | <Choice>
                      | <Recursion>
                      | <Continue>
                      | <Do>
                      | <Parallel>

<MessageTransfer> ::= <MessageSignature> "from" <RoleName> "to" <RoleName> ("," <RoleName>)* ";"

<Choice> ::= "choice" "at" <RoleName> "{" <GlobalProtocolBody> "}" ("or" "{" <GlobalProtocolBody> "}")+

<Recursion> ::= "rec" <RecursionLabel> "{" <GlobalProtocolBody> "}"

<Continue> ::= "continue" <RecursionLabel> ";"

<Do> ::= "do" <ProtocolName> <RoleArgumentList> ";"

<Parallel> ::= "par" "{" <GlobalProtocolBody> "}" ("and" "{" <GlobalProtocolBody> "}")+

(* Local Interactions *)
<LocalProtocolBody> ::= <LocalInteraction>*

<LocalInteraction> ::= <Send>
                     | <Receive>
                     | <InternalChoice>
                     | <ExternalChoice>
                     | <LocalRecursion>
                     | <LocalContinue>
                     | <LocalParallel>

<Send>    ::= <MessageSignature> "to" <RoleName> ("," <RoleName>)* ";"
<Receive> ::= <MessageSignature> "from" <RoleName> ";"

<InternalChoice> ::= "choice" "{" <LocalProtocolBody> "}" ("or" "{" <LocalProtocolBody> "}")+

<ExternalChoice> ::= "choice" "from" <RoleName> "{" <CaseBranch> "}" ("or" "{" <CaseBranch> "}")+
<CaseBranch>     ::= <MessageSignature> ":" <LocalProtocolBody>

<LocalRecursion> ::= "rec" <RecursionLabel> "{" <LocalProtocolBody> "}"
<LocalContinue>  ::= "continue" <RecursionLabel> ";"

<LocalParallel> ::= "par" "{" <LocalProtocolBody> "}" ("and" "{" <LocalProtocolBody> "}")+

(* Messages *)
<MessageSignature> ::= <MessageLabel> "(" <PayloadType> ("," <PayloadType>)* ")"
                     | <MessageLabel> "(" ")"

(* Role Arguments *)
<RoleArgumentList> ::= "(" <RoleArgument> ("," <RoleArgument>)* ")"
<RoleArgument>     ::= <RoleName> "as" <RoleName>

(* Types *)
<PayloadType>  ::= <TypeName> ("<" <TypeArgument> ("," <TypeArgument>)* ">")?
<TypeArgument> ::= <TypeName>

(* Identifiers *)
<ProtocolName>    ::= [A-Z][a-zA-Z0-9_]*
<RoleName>        ::= [A-Z][a-zA-Z0-9_]*
<RecursionLabel>  ::= [A-Z][a-zA-Z0-9_]*
<MessageLabel>    ::= [a-z][a-zA-Z0-9_]*
<TypeName>        ::= [A-Z][a-zA-Z0-9_]*
<QualifiedName>   ::= <SimpleName> ("." <SimpleName>)*
<SimpleName>      ::= [A-Z][a-zA-Z0-9_]*
<TypeSystem>      ::= [a-z][a-zA-Z0-9_]*
```

---

## Implementation Priority

### Phase 1 (Core Features) ✅
- [x] Message transfers with basic payload types
- [x] Choice
- [x] Recursion/Continue
- [ ] **Parallel composition** (essential for P2P protocols)
- [ ] **Do statements** (subprotocol invocation)
- [ ] **Import declarations**
- [ ] **Rich payload types** (generics)

### Phase 2 (Extensions) 🚧
- [ ] Local protocol declarations (manual authoring)
- [ ] Nested parallel with complex interleaving
- [ ] Multicast optimizations

### Phase 3 (Advanced) 🔮
- [ ] Role parameters
- [ ] Dynamic role creation (DMPST)
- [ ] Session delegation

---

## Feature Complexity Analysis

### Core Features (Phase 1)

**Low Complexity:**
1. ✅ **`do` statements**: Inline expansion during CFG construction
2. ✅ **Import declarations**: Metadata only, doesn't affect control flow
3. ✅ **Rich payload types**: Parsing extension, doesn't affect semantics
4. ✅ **Multicast messages**: `to R1, R2, R3` → multiple edges in CFG

**Medium Complexity:**
5. ✅ **Parallel composition**:
   - **CFG**: Fork/join nodes with interleaving semantics
   - **Verification**: Product automaton for deadlock detection across branches
   - **Projection**: Role may participate in multiple branches concurrently
   - **Worth the complexity**: Essential for P2P and distributed protocols

### Advanced Features (Phase 3)

**High Complexity (deferred):**
- ❌ **Role parameters**: Requires instantiation logic, type system changes
- ❌ **Dynamic roles**: Fundamentally changes execution model, unbounded state space

---

## Next Steps

With this syntax specification in place, we can now design:
1. **AST structure** (concrete syntax tree matching this grammar)
2. **CFG structure** (semantic representation for verification/execution)
3. **Transformation rules** (AST → CFG)

See `cfg-design.md` for the Control Flow Graph specification.
