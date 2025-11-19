# Scribble Language Reference

**Version 0.3** (Official Specification)
**Adapted for SMPST IDE**

This document provides a complete reference for the Scribble protocol language syntax and semantics. It is based on the official Scribble Language Reference Version 0.3 by the Scribble team (January 28, 2013).

---

## Table of Contents

1. [Introduction](#introduction)
2. [Lexical Structure](#lexical-structure)
3. [Syntax](#syntax)
4. [Well-Formed Protocols](#well-formed-protocols)
5. [Examples](#examples)

---

## 1. Introduction

### 1.1 Notation

Scribble syntax is specified using a BNF-like notation:
- **Terminal symbols**: purple with typewriter font (shown as `code` in this document)
- **Non-terminal symbols**: *italic* (shown as *italic* in this document)
- **Grouping**: `( )`
- **Optional**: `[ ]`
- **Alternatives**: `|`
- **Zero or more**: `*`
- **One or more**: `+`
- **Character ranges**: `a … z` (inclusive ASCII range)

### 1.2 Terminology

| Term | Definition |
|------|------------|
| **Principal** | An identifiable network entity that can function as a conversation endpoint |
| **Conversation** | A communication session between principals |
| **Role** | An abstract principal inside a conversation representing one endpoint |
| **Global protocol** | Abstract specification of a conversation from a global (neutral) perspective |
| **Local protocol** | Specification of local behaviour from the perspective of a single role |
| **Message** | A unit of communication between principals |
| **Network** | The interconnect between principals responsible for message delivery |
| **Message dispatch** | The event of a principal committing a message to the network |
| **Message delivery** | The event of delivering a dispatched message to the target principal |
| **Message consume** | The event of a principal consuming a delivered message |

---

## 2. Lexical Structure

### 2.1 White Space

White space consists of:
- ASCII space (U+0020)
- Horizontal tab (U+0009)
- Line terminators: LF (U+000A), CR (U+000D), or CRLF

White space delimits lexical tokens and is otherwise ignored.

### 2.2 Comments

```bnf
// Single-line comment (ends at line terminator)
/* Block comment (can span multiple lines) */
```

**Rules:**
- Comments do not nest
- Block comments have no special meaning within single-line comments and vice versa
- Comments delimit lexical tokens similarly to white space

### 2.3 Identifiers

```bnf
identifier      ::= (letter | _) (letter | digit | _)*
extidentifier   ::= (letter | _ | symbol) (letter | digit | _ | symbol)*
letter          ::= a … z | A … Z
digit           ::= 0 … 9
symbol          ::= { | } | ( | ) | [ | ] | : | / | \ | . | # | & | ? | !
```

**Rules:**
- Identifiers cannot start with a digit
- Identifiers cannot be reserved keywords
- Maximum recommended length: 256 characters

### 2.4 Keywords

Reserved keywords (cannot be used as identifiers):

```
and          as           at           by           catches
choice       continue     create       do           enter
from         global       import       instantiates interruptible
local        or           package      par          protocol
rec          role         sig          throws       to
with
```

---

## 3. Syntax

### 3.1 Packages and Modules

#### 3.1.1 Package Names

```bnf
package-name ::= (identifier .)* identifier
```

**Fully Qualified Name:** Dot-separated sequence of simple package names forming a path from root to the package.

#### 3.1.2 Module Structure

```bnf
module            ::= package-decl (import-decl)* (payload-type-decl)* (protocol-decl)*
package-decl      ::= package package-name ;
```

**Rules:**
- Module filename must be `<simple-package-name>.spr`
- Package declaration is mandatory in full Scribble specification
- **Note:** Our simplified parser implementation makes package declaration optional

#### 3.1.3 Module Import

```bnf
import-decl ::= import package-name ;
```

The `package-name` specifies the fully qualified name of the module to import.

#### 3.1.4 Module Visibility

**Visible members within a module:**
1. Members of the current module (simple or fully qualified names)
2. Members of imported modules (fully qualified names)
3. Imported members with aliases (alias or fully qualified names)

---

### 3.2 Payload Type Declarations

```bnf
payload-type-decl ::= type < identifier > "extidentifier" from "extidentifier" as identifier ;
```

**Components:**
- **Schema type**: Identifier in angle brackets (`<identifier>`)
- **Type name**: First `extidentifier` (type defined in external schema)
- **Source file**: Second `extidentifier` (schema source filename)
- **Alias**: Final `identifier` (name used within module)

**Example:**
```scribble
type <xsd> "Person" from "schema.xsd" as Person;
```

---

### 3.3 Message Signatures

```bnf
message-operator  ::= (letter | digit | _)*
message-signature ::= message-operator ([payload-type (, payload-type)*])
payload-type      ::= [identifier :] identifier
```

**Components:**
- **Operator**: Sequence of letters, digits, and underscores (cannot be a keyword)
- **Payload list**: Optional comma-separated payload types
- **Payload annotation**: Optional variable name followed by colon

**Examples:**
```scribble
Login(String)
Authenticate(username: String, password: String)
Response(Int)
Ack()
```

---

### 3.4 Protocol Declarations

```bnf
protocol-decl ::= global-protocol-decl | local-protocol-decl
```

---

### 3.5 Global Protocols

#### 3.5.1 Global Protocol Declaration

```bnf
global-protocol-decl       ::= global protocol identifier global-protocol-definition
global-protocol-definition ::= [< parameter-list >] (role-list) global-interaction-block
                             | (role-list) instantiates identifier [< argument-list >] ;
role-list                  ::= role role-name (, role role-name)*
role-name                  ::= identifier
parameter-list             ::= sig identifier (, sig identifier)*
argument-list              ::= message-signature (, message-signature)*
```

**Example:**
```scribble
global protocol TwoPhaseCommit(role Coordinator, role Participant1, role Participant2) {
  // protocol body
}
```

#### 3.5.2 Global Interaction Block

```bnf
global-interaction-block    ::= { global-interaction-sequence }
global-interaction-sequence ::= (global-interaction)*
global-interaction          ::= global-message-transfer
                              | global-choice
                              | global-parallel
                              | global-recursion
                              | global-continue
                              | global-interruptible
                              | global-do
```

#### 3.5.3 Point-to-Point Message Transfer

```bnf
global-message-transfer ::= (message-signature | identifier) from role-name to role-name ;
```

**Example:**
```scribble
Request(String) from Client to Server;
Response(Int) from Server to Client;
```

#### 3.5.4 Choice

```bnf
global-choice ::= choice at role-name global-interaction-block (or global-interaction-block)*
```

**Example:**
```scribble
choice at Client {
  Client -> Server: Login(String);
  Server -> Client: LoginOk();
} or {
  Client -> Server: Register(String);
  Server -> Client: RegisterOk();
}
```

**Well-formedness conditions:**
- Must have more than one branch
- Choosing role must send first message in each branch
- All participants must receive distinguishable messages
- Messages sent by choosing role must be different in each branch

#### 3.5.5 Parallel

```bnf
global-parallel ::= par global-interaction-block (and global-interaction-block)*
```

**Example:**
```scribble
par {
  Client -> ServiceA: RequestA();
  ServiceA -> Client: ResponseA();
} and {
  Client -> ServiceB: RequestB();
  ServiceB -> Client: ResponseB();
}
```

**Well-formedness (Linearity):**
- No message with the same label can appear in multiple parallel branches if sent by same sender to same receiver
- `continue` can only appear in a branch if the corresponding `rec` is also in that branch

#### 3.5.6 Recursion

```bnf
global-recursion ::= rec identifier global-interaction-block
global-continue  ::= continue identifier ;
```

**Example:**
```scribble
rec Loop {
  choice at Client {
    Client -> Server: Data(String);
    Server -> Client: Ack();
    continue Loop;
  } or {
    Client -> Server: End();
  }
}
```

**Rules:**
- `continue` must reference a `rec` label in scope
- Nested `rec` blocks: `continue` refers to innermost matching label

#### 3.5.7 Interruptible

```bnf
global-interruptible ::= interruptible global-interaction-block
                         with { (global-interrupt)+ }
global-interrupt     ::= message-signature (, message-signature)*
                         by role-name (, role-name)* ;
```

**Example:**
```scribble
interruptible {
  Client -> Server: Process(Data);
  Server -> Client: Result(Int);
} with {
  Cancel() by Client;
}
```

**Well-formedness:**
- Nothing should follow an interruptible block
- All interrupt messages must be sent from the same role
- No `continue` unless inside a matching `rec` block

#### 3.5.8 Do (Sub-Protocol Invocation)

```bnf
global-do                ::= do identifier [< argument-list >] (role-instantiation-list) ;
role-instantiation-list  ::= role-name as role-name (, role-name as role-name)*
```

**Example:**
```scribble
// Invoke Auth sub-protocol
do Auth(Client, Server);

// With role remapping
do Auth(Alice as Client, Bob as Server);
```

**Rules:**
- Protocol identifier must reference a known protocol
- Argument list length must match parameter list of target protocol
- Role instantiation list must match role list of target protocol
- In `R1 as R2`: `R1` is role in current protocol, `R2` is role in target protocol

---

### 3.6 Local Protocols

#### 3.6.1 Local Protocol Declaration

```bnf
local-protocol-decl       ::= local protocol identifier at role-name local-protocol-definition
local-protocol-definition ::= [< parameter-list >] (role-list) local-interaction-block
```

**Example:**
```scribble
local protocol TwoPhaseCommit at Coordinator(role Participant1, role Participant2) {
  // local protocol body
}
```

#### 3.6.2 Local Interaction Block

```bnf
local-interaction-block    ::= { local-interaction-sequence }
local-interaction-sequence ::= (local-interaction)*
local-interaction          ::= local-send
                             | local-receive
                             | local-choice
                             | local-parallel
                             | local-recursion
                             | local-continue
                             | local-interruptible
                             | local-do
```

#### 3.6.3 Point-to-Point Message Transfer

```bnf
local-send    ::= (message-signature | identifier) to role-name ;
local-receive ::= (message-signature | identifier) from role-name ;
```

**Example:**
```scribble
Request(String) to Server;
Response(Int) from Server;
```

#### 3.6.4 Choice

```bnf
local-choice ::= choice at role-name local-interaction-block (or local-interaction-block)*
```

**Example:**
```scribble
choice at Client {
  Login(String) to Server;
  LoginOk() from Server;
} or {
  Register(String) to Server;
  RegisterOk() from Server;
}
```

#### 3.6.5 Parallel

```bnf
local-parallel ::= par local-interaction-block (and local-interaction-block)*
```

#### 3.6.6 Recursion

```bnf
local-recursion ::= rec identifier local-interaction-block
local-continue  ::= continue identifier ;
```

#### 3.6.7 Interruptible

```bnf
local-interruptible ::= interruptible local-interaction-block with
                        { (throw | catch | throw catch) }
throw               ::= throws message-signature (, message-signature)* ;
catch               ::= catches message-signature from role-name
                        (, message-signature from role-name)* ;
```

**Example:**
```scribble
interruptible {
  Process(Data) to Server;
  Result(Int) from Server;
} with {
  throws Cancel();
  catches Timeout() from Server;
}
```

#### 3.6.8 Do

```bnf
local-do                 ::= do identifier [< argument-list >] (role-instantiation-list) ;
role-instantiation-list  ::= role-name as role-name (, role-name as role-name)*
```

---

## 4. Well-Formed Protocols

### 4.1 Global Protocols

#### 4.1.1 General Conditions

**Syntax:**
- Roles in protocol declaration must be distinct
- All payload types must be imported before use
- All roles appearing in interaction block must be declared in protocol signature

**Naming:**
- Multiple bindings to same name are allowed (last definition in scope takes precedence)

#### 4.1.2 Local Choice Conditions

For `choice at A block1 or … or blockn`:

1. Must have **n > 1** (strictly more than one branch)
2. In each `blocki`, role `A` must send the first message
3. All other participants must appear first as receivers before being senders
4. Any participant `B` (≠ `A`) receiving a message in `blocki` must also receive a message in all other blocks
5. Messages received by `B` in different blocks must be distinguishable if `B`'s following actions differ
6. Messages sent by `A` must be different in each block

#### 4.1.3 Parallel Conditions (Linearity)

For `par block1 and … and blockn`:

1. No `continue` can appear in any `blocki` unless the corresponding `rec` is also in the same `blocki`
2. If a message with label `msg` is sent from `A` to `B` in `blocki`, such a message cannot appear in any other `blockj`

#### 4.1.4 Recursion Conditions

1. A `continue label` must only appear within a `rec label` block
2. If `continue label` is within several nested `rec label` blocks, it refers to the innermost one

#### 4.1.5 Interruptible Conditions

1. Nothing should follow an interruptible block (must be last element in sequence)
2. All interrupt messages must be sent from the same role
3. No `continue` should appear inside an interruptible block unless it's inside a matching `rec` block

---

## 5. Examples

### 5.1 Simple Request-Response

```scribble
global protocol RequestResponse(role Client, role Server) {
  Request(String) from Client to Server;
  Response(Int) from Server to Client;
}
```

### 5.2 Choice with Authentication

```scribble
global protocol LoginOrRegister(role Client, role Server) {
  choice at Client {
    Login(username: String, password: String) from Client to Server;
    LoginOk() from Server to Client;
  } or {
    Register(username: String, password: String) from Client to Server;
    RegisterOk() from Server to Client;
  }
}
```

### 5.3 Recursion with Streaming

```scribble
global protocol Streaming(role Sender, role Receiver) {
  rec Loop {
    choice at Sender {
      Data(String) from Sender to Receiver;
      Ack() from Receiver to Sender;
      continue Loop;
    } or {
      End() from Sender to Receiver;
    }
  }
}
```

### 5.4 Parallel Data Fetch

```scribble
global protocol ParallelFetch(role Client, role ServiceA, role ServiceB) {
  par {
    RequestA() from Client to ServiceA;
    ResponseA(Data) from ServiceA to Client;
  } and {
    RequestB() from Client to ServiceB;
    ResponseB(Data) from ServiceB to Client;
  }
}
```

### 5.5 Sub-Protocol Composition

```scribble
global protocol Auth(role Client, role Server) {
  Login(String) from Client to Server;
  LoginOk() from Server to Client;
}

global protocol SecureTransaction(role Client, role Server) {
  do Auth(Client, Server);
  Request(Data) from Client to Server;
  Response(Result) from Server to Client;
}
```

### 5.6 Two-Phase Commit

```scribble
global protocol TwoPhaseCommit(role Coordinator, role P1, role P2) {
  Prepare() from Coordinator to P1;
  Prepare() from Coordinator to P2;

  par {
    Vote(Bool) from P1 to Coordinator;
  } and {
    Vote(Bool) from P2 to Coordinator;
  }

  choice at Coordinator {
    Commit() from Coordinator to P1;
    Commit() from Coordinator to P2;
  } or {
    Abort() from Coordinator to P1;
    Abort() from Coordinator to P2;
  }
}
```

### 5.7 Local Protocol Projection

```scribble
// Global protocol
global protocol RequestResponse(role Client, role Server) {
  Request(String) from Client to Server;
  Response(Int) from Server to Client;
}

// Local projection for Client
local protocol RequestResponse at Client(role Server) {
  Request(String) to Server;
  Response(Int) from Server;
}

// Local projection for Server
local protocol RequestResponse at Server(role Client) {
  Request(String) from Client;
  Response(Int) to Client;
}
```

---

## References

1. **Official Scribble Language Reference Version 0.3** - The Scribble Team, January 28, 2013
2. **Scribble Protocol Language** - Yoshida, K., & Hu, R. (2013). *Proceedings of FORTE 2013*
3. **Scribble GitHub Repository** - https://github.com/scribble/scribble-spec
4. **Multiparty Session Types** - Honda, K., Yoshida, N., & Carbone, M. (2008). *Multiparty asynchronous session types*. POPL 2008.

---

## Implementation Notes for SMPST IDE

### Parser Implementation

Our parser (`src/core/parser/parser.ts`) implements a **simplified** version of the Scribble grammar:

1. **Optional Package Declaration:** Unlike the official spec which requires `package-decl`, our parser makes it optional
2. **Module Structure:** Top-level rule accepts zero or more declarations (imports, types, protocols)
3. **Supported Constructs:** All core Scribble features are supported except:
   - `instantiates` (protocol inheritance)
   - `interruptible` blocks
   - Payload type declarations with external schemas

### Supported Syntax

✅ **Fully Supported:**
- Global protocols with all interaction types
- Local protocols (via projection)
- Message signatures with payloads
- Choice at role
- Parallel composition
- Recursion and continue
- Sub-protocol invocation (`do`)
- Role remapping in sub-protocols

⚠️ **Partially Supported:**
- Package/import declarations (parsed but not enforced)
- Payload type declarations (parsed but external schemas not loaded)

❌ **Not Supported:**
- Protocol instantiation (`instantiates` keyword)
- Interruptible blocks
- Generic message parameters (`sig`)

### File Extensions

- Scribble source files: `.scr` (we use this convention, spec suggests `.spr`)
- Both extensions work with our parser

### Compatibility

Our implementation prioritizes:
1. **Formal Correctness:** MPST theory compliance
2. **Scribble Compatibility:** Parse standard Scribble protocols
3. **Pragmatic Extensions:** Additional features for interactive IDE (CFG, CFSM, simulation)

---

*This document is maintained as part of the SMPST IDE project. For implementation details, see other documentation in `/docs`.*
