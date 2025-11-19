# Abstract Syntax Tree (AST) Design Specification

## Purpose

This document specifies the **Abstract Syntax Tree (AST)** structure for Scribble 2.0 protocols. The AST is the **syntactic representation** of parsed Scribble code, serving as the bridge between:

1. **Source Code** (textual Scribble protocols)
2. **CFG** (semantic control flow graph for verification/execution)

---

## Role in the Pipeline

```
Source Code → Lexer → Tokens → Parser → AST → Validator → CFG Builder → CFG
```

**AST Responsibilities:**
- **Syntactic structure**: Represents code as a tree matching the grammar
- **Scope information**: Tracks declared roles, recursion labels, protocols
- **Source locations**: Preserves line/column info for error reporting
- **Type information**: Stores payload types, message labels

**AST Does NOT:**
- Represent control flow (that's CFG's job)
- Perform semantic analysis (validator does that)
- Execute protocols (simulator works on CFG)

---

## Design Principles

### 1. **Grammar Alignment**

The AST structure **directly mirrors** the Scribble 2.0 EBNF grammar:

```ebnf
<GlobalProtocol> ::= ...    ↔    interface GlobalProtocol { ... }
<MessageTransfer> ::= ...   ↔    interface MessageTransfer { ... }
```

This ensures:
- Parser implementation is straightforward
- Grammar changes map directly to AST changes
- Type safety catches structural errors

### 2. **Type Safety**

All AST nodes are **discriminated unions** with a `type` field:

```typescript
type GlobalInteraction = MessageTransfer | Choice | Recursion | Continue | Do | Parallel;
```

This enables:
- Exhaustive pattern matching in TypeScript
- Type-safe node traversal
- Compile-time error checking

### 3. **Source Location Tracking**

Every AST node includes optional `location` metadata:

```typescript
interface SourceLocation {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
}
```

This enables:
- Precise error messages ("Error at line 10, column 5")
- IDE features (go-to-definition, hover info)
- Debugging support

### 4. **Extensibility**

AST nodes include optional `metadata` fields for future extensions:

```typescript
interface AstNode {
    // ...core fields
    metadata?: Record<string, any>;
}
```

---

## Complete AST Type Definitions

### Module (Top-Level)

```typescript
/**
 * Root node representing a complete Scribble file
 */
export interface Module {
    type: 'Module';
    imports: ImportDeclaration[];
    protocols: ProtocolDeclaration[];
    location?: SourceLocation;
}
```

---

### Import Declarations

```typescript
export interface ImportDeclaration {
    type: 'ImportDeclaration';
    typeSystem?: string;        // e.g., "java", "typescript", "xsd"
    qualifiedName: string;      // e.g., "java.util.List"
    alias?: string;             // e.g., "List"
    location?: SourceLocation;
}
```

**Example:**
```scribble
import java.util.List as List;
import typescript String;
```

**AST:**
```typescript
{
    type: 'ImportDeclaration',
    typeSystem: 'java',
    qualifiedName: 'java.util.List',
    alias: 'List'
}
```

---

### Protocol Declarations

```typescript
export type ProtocolDeclaration = GlobalProtocolDeclaration | LocalProtocolDeclaration;

export interface GlobalProtocolDeclaration {
    type: 'GlobalProtocolDeclaration';
    protocolName: string;
    roles: RoleDeclaration[];
    body: GlobalInteraction[];
    location?: SourceLocation;
}

export interface LocalProtocolDeclaration {
    type: 'LocalProtocolDeclaration';
    protocolName: string;
    selfRole: string;           // The role this local protocol is for
    roles: RoleDeclaration[];
    body: LocalInteraction[];
    location?: SourceLocation;
}

export interface RoleDeclaration {
    type: 'RoleDeclaration';
    roleName: string;
    location?: SourceLocation;
}
```

**Example:**
```scribble
global protocol TwoPhaseCommit(role Coordinator, role Participant) {
    // ...
}
```

**AST:**
```typescript
{
    type: 'GlobalProtocolDeclaration',
    protocolName: 'TwoPhaseCommit',
    roles: [
        { type: 'RoleDeclaration', roleName: 'Coordinator' },
        { type: 'RoleDeclaration', roleName: 'Participant' }
    ],
    body: [ /* interactions */ ]
}
```

---

## Global Interactions

```typescript
export type GlobalInteraction =
    | MessageTransfer
    | Choice
    | Recursion
    | Continue
    | Do
    | Parallel;
```

---

### Message Transfer

```typescript
export interface MessageTransfer {
    type: 'MessageTransfer';
    messageSignature: MessageSignature;
    sender: string;             // Role name
    receivers: string[];        // Role names (multiple for multicast)
    location?: SourceLocation;
}

export interface MessageSignature {
    label: string;              // Message label (lowercase identifier)
    payloadTypes: PayloadType[];
}

export interface PayloadType {
    typeName: string;
    typeArguments?: PayloadType[];  // For generics: List<Item>
}
```

**Example:**
```scribble
request(Query) from Client to Server;
broadcast(Event) from Publisher to Sub1, Sub2, Sub3;
fetchItems(List<Item>) from Client to Server;
```

**AST:**
```typescript
{
    type: 'MessageTransfer',
    messageSignature: {
        label: 'request',
        payloadTypes: [{ typeName: 'Query' }]
    },
    sender: 'Client',
    receivers: ['Server']
}

// Multicast example
{
    type: 'MessageTransfer',
    messageSignature: {
        label: 'broadcast',
        payloadTypes: [{ typeName: 'Event' }]
    },
    sender: 'Publisher',
    receivers: ['Sub1', 'Sub2', 'Sub3']
}

// Generic type example
{
    type: 'MessageTransfer',
    messageSignature: {
        label: 'fetchItems',
        payloadTypes: [{
            typeName: 'List',
            typeArguments: [{ typeName: 'Item' }]
        }]
    },
    sender: 'Client',
    receivers: ['Server']
}
```

---

### Choice

```typescript
export interface Choice {
    type: 'Choice';
    decider: string;            // Role making the choice
    branches: ChoiceBranch[];
    location?: SourceLocation;
}

export interface ChoiceBranch {
    type: 'ChoiceBranch';
    body: GlobalInteraction[];
    location?: SourceLocation;
}
```

**Example:**
```scribble
choice at Server {
    success(Data) from Server to Client;
    process() from Client to Server;
} or {
    failure(Error) from Server to Client;
}
```

**AST:**
```typescript
{
    type: 'Choice',
    decider: 'Server',
    branches: [
        {
            type: 'ChoiceBranch',
            body: [
                {
                    type: 'MessageTransfer',
                    messageSignature: { label: 'success', payloadTypes: [{ typeName: 'Data' }] },
                    sender: 'Server',
                    receivers: ['Client']
                },
                {
                    type: 'MessageTransfer',
                    messageSignature: { label: 'process', payloadTypes: [] },
                    sender: 'Client',
                    receivers: ['Server']
                }
            ]
        },
        {
            type: 'ChoiceBranch',
            body: [
                {
                    type: 'MessageTransfer',
                    messageSignature: { label: 'failure', payloadTypes: [{ typeName: 'Error' }] },
                    sender: 'Server',
                    receivers: ['Client']
                }
            ]
        }
    ]
}
```

---

### Recursion & Continue

```typescript
export interface Recursion {
    type: 'Recursion';
    label: string;              // Recursion label (uppercase identifier)
    body: GlobalInteraction[];
    location?: SourceLocation;
}

export interface Continue {
    type: 'Continue';
    label: string;              // Must match a Recursion label in scope
    location?: SourceLocation;
}
```

**Example:**
```scribble
rec Loop {
    chunk(Data) from Producer to Consumer;
    choice at Consumer {
        requestMore() from Consumer to Producer;
        continue Loop;
    } or {
        disconnect() from Consumer to Producer;
    }
}
```

**AST:**
```typescript
{
    type: 'Recursion',
    label: 'Loop',
    body: [
        {
            type: 'MessageTransfer',
            messageSignature: { label: 'chunk', payloadTypes: [{ typeName: 'Data' }] },
            sender: 'Producer',
            receivers: ['Consumer']
        },
        {
            type: 'Choice',
            decider: 'Consumer',
            branches: [
                {
                    type: 'ChoiceBranch',
                    body: [
                        {
                            type: 'MessageTransfer',
                            messageSignature: { label: 'requestMore', payloadTypes: [] },
                            sender: 'Consumer',
                            receivers: ['Producer']
                        },
                        {
                            type: 'Continue',
                            label: 'Loop'
                        }
                    ]
                },
                {
                    type: 'ChoiceBranch',
                    body: [
                        {
                            type: 'MessageTransfer',
                            messageSignature: { label: 'disconnect', payloadTypes: [] },
                            sender: 'Consumer',
                            receivers: ['Producer']
                        }
                    ]
                }
            ]
        }
    ]
}
```

---

### Subprotocol Invocation (Do)

```typescript
export interface Do {
    type: 'Do';
    protocolName: string;
    roleArguments: RoleArgument[];
    location?: SourceLocation;
}

export interface RoleArgument {
    actualRole: string;         // Role in calling context
    formalRole: string;         // Role parameter in called protocol
}
```

**Example:**
```scribble
do Authenticate(Client as Client, AuthServer as AuthServer);
```

**AST:**
```typescript
{
    type: 'Do',
    protocolName: 'Authenticate',
    roleArguments: [
        { actualRole: 'Client', formalRole: 'Client' },
        { actualRole: 'AuthServer', formalRole: 'AuthServer' }
    ]
}
```

---

### Parallel Composition

```typescript
export interface Parallel {
    type: 'Parallel';
    branches: ParallelBranch[];
    location?: SourceLocation;
}

export interface ParallelBranch {
    type: 'ParallelBranch';
    body: GlobalInteraction[];
    location?: SourceLocation;
}
```

**Example:**
```scribble
par {
    requestA(Query) from Client to ServiceA;
    responseA(Data) from ServiceA to Client;
} and {
    requestB(Query) from Client to ServiceB;
    responseB(Data) from ServiceB to Client;
}
```

**AST:**
```typescript
{
    type: 'Parallel',
    branches: [
        {
            type: 'ParallelBranch',
            body: [
                {
                    type: 'MessageTransfer',
                    messageSignature: { label: 'requestA', payloadTypes: [{ typeName: 'Query' }] },
                    sender: 'Client',
                    receivers: ['ServiceA']
                },
                {
                    type: 'MessageTransfer',
                    messageSignature: { label: 'responseA', payloadTypes: [{ typeName: 'Data' }] },
                    sender: 'ServiceA',
                    receivers: ['Client']
                }
            ]
        },
        {
            type: 'ParallelBranch',
            body: [
                {
                    type: 'MessageTransfer',
                    messageSignature: { label: 'requestB', payloadTypes: [{ typeName: 'Query' }] },
                    sender: 'Client',
                    receivers: ['ServiceB']
                },
                {
                    type: 'MessageTransfer',
                    messageSignature: { label: 'responseB', payloadTypes: [{ typeName: 'Data' }] },
                    sender: 'ServiceB',
                    receivers: ['Client']
                }
            ]
        }
    ]
}
```

---

## Local Interactions

```typescript
export type LocalInteraction =
    | Send
    | Receive
    | InternalChoice
    | ExternalChoice
    | LocalRecursion
    | LocalContinue
    | LocalParallel;
```

---

### Send & Receive

```typescript
export interface Send {
    type: 'Send';
    messageSignature: MessageSignature;
    receivers: string[];        // Role names
    location?: SourceLocation;
}

export interface Receive {
    type: 'Receive';
    messageSignature: MessageSignature;
    sender: string;             // Role name
    location?: SourceLocation;
}
```

**Example:**
```scribble
request(Query) to Server;
response(Data) from Server;
```

**AST:**
```typescript
{
    type: 'Send',
    messageSignature: { label: 'request', payloadTypes: [{ typeName: 'Query' }] },
    receivers: ['Server']
}

{
    type: 'Receive',
    messageSignature: { label: 'response', payloadTypes: [{ typeName: 'Data' }] },
    sender: 'Server'
}
```

---

### Internal & External Choice

```typescript
export interface InternalChoice {
    type: 'InternalChoice';
    branches: ChoiceBranch[];   // Reuse ChoiceBranch from global
    location?: SourceLocation;
}

export interface ExternalChoice {
    type: 'ExternalChoice';
    sender: string;             // Role making the choice
    cases: ExternalChoiceCase[];
    location?: SourceLocation;
}

export interface ExternalChoiceCase {
    type: 'ExternalChoiceCase';
    messageSignature: MessageSignature;
    body: LocalInteraction[];
    location?: SourceLocation;
}
```

**Example (Internal Choice):**
```scribble
choice {
    success(Data) to Client;
} or {
    failure(Error) to Client;
}
```

**AST:**
```typescript
{
    type: 'InternalChoice',
    branches: [
        {
            type: 'ChoiceBranch',
            body: [{
                type: 'Send',
                messageSignature: { label: 'success', payloadTypes: [{ typeName: 'Data' }] },
                receivers: ['Client']
            }]
        },
        {
            type: 'ChoiceBranch',
            body: [{
                type: 'Send',
                messageSignature: { label: 'failure', payloadTypes: [{ typeName: 'Error' }] },
                receivers: ['Client']
            }]
        }
    ]
}
```

**Example (External Choice):**
```scribble
choice from Server {
    success(Data): processSuccess();
    failure(Error): handleError();
}
```

**AST:**
```typescript
{
    type: 'ExternalChoice',
    sender: 'Server',
    cases: [
        {
            type: 'ExternalChoiceCase',
            messageSignature: { label: 'success', payloadTypes: [{ typeName: 'Data' }] },
            body: [ /* processSuccess interactions */ ]
        },
        {
            type: 'ExternalChoiceCase',
            messageSignature: { label: 'failure', payloadTypes: [{ typeName: 'Error' }] },
            body: [ /* handleError interactions */ ]
        }
    ]
}
```

---

### Local Recursion & Continue

```typescript
export interface LocalRecursion {
    type: 'LocalRecursion';
    label: string;
    body: LocalInteraction[];
    location?: SourceLocation;
}

export interface LocalContinue {
    type: 'LocalContinue';
    label: string;
    location?: SourceLocation;
}
```

---

### Local Parallel

```typescript
export interface LocalParallel {
    type: 'LocalParallel';
    branches: LocalParallelBranch[];
    location?: SourceLocation;
}

export interface LocalParallelBranch {
    type: 'LocalParallelBranch';
    body: LocalInteraction[];
    location?: SourceLocation;
}
```

**Example:**
```scribble
par {
    req1(Q) to S1;
    res1(D) from S1;
} and {
    req2(Q) to S2;
    res2(D) from S2;
}
```

**AST:**
```typescript
{
    type: 'LocalParallel',
    branches: [
        {
            type: 'LocalParallelBranch',
            body: [
                {
                    type: 'Send',
                    messageSignature: { label: 'req1', payloadTypes: [{ typeName: 'Q' }] },
                    receivers: ['S1']
                },
                {
                    type: 'Receive',
                    messageSignature: { label: 'res1', payloadTypes: [{ typeName: 'D' }] },
                    sender: 'S1'
                }
            ]
        },
        {
            type: 'LocalParallelBranch',
            body: [
                {
                    type: 'Send',
                    messageSignature: { label: 'req2', payloadTypes: [{ typeName: 'Q' }] },
                    receivers: ['S2']
                },
                {
                    type: 'Receive',
                    messageSignature: { label: 'res2', payloadTypes: [{ typeName: 'D' }] },
                    sender: 'S2'
                }
            ]
        }
    ]
}
```

---

## Complete TypeScript Type Definitions

```typescript
// ============================================================================
// Module & Top-Level
// ============================================================================

export interface Module {
    type: 'Module';
    imports: ImportDeclaration[];
    protocols: ProtocolDeclaration[];
    location?: SourceLocation;
}

export interface ImportDeclaration {
    type: 'ImportDeclaration';
    typeSystem?: string;
    qualifiedName: string;
    alias?: string;
    location?: SourceLocation;
}

// ============================================================================
// Protocol Declarations
// ============================================================================

export type ProtocolDeclaration = GlobalProtocolDeclaration | LocalProtocolDeclaration;

export interface GlobalProtocolDeclaration {
    type: 'GlobalProtocolDeclaration';
    protocolName: string;
    roles: RoleDeclaration[];
    body: GlobalInteraction[];
    location?: SourceLocation;
}

export interface LocalProtocolDeclaration {
    type: 'LocalProtocolDeclaration';
    protocolName: string;
    selfRole: string;
    roles: RoleDeclaration[];
    body: LocalInteraction[];
    location?: SourceLocation;
}

export interface RoleDeclaration {
    type: 'RoleDeclaration';
    roleName: string;
    location?: SourceLocation;
}

// ============================================================================
// Global Interactions
// ============================================================================

export type GlobalInteraction =
    | MessageTransfer
    | Choice
    | Recursion
    | Continue
    | Do
    | Parallel;

export interface MessageTransfer {
    type: 'MessageTransfer';
    messageSignature: MessageSignature;
    sender: string;
    receivers: string[];
    location?: SourceLocation;
}

export interface Choice {
    type: 'Choice';
    decider: string;
    branches: ChoiceBranch[];
    location?: SourceLocation;
}

export interface ChoiceBranch {
    type: 'ChoiceBranch';
    body: GlobalInteraction[];
    location?: SourceLocation;
}

export interface Recursion {
    type: 'Recursion';
    label: string;
    body: GlobalInteraction[];
    location?: SourceLocation;
}

export interface Continue {
    type: 'Continue';
    label: string;
    location?: SourceLocation;
}

export interface Do {
    type: 'Do';
    protocolName: string;
    roleArguments: RoleArgument[];
    location?: SourceLocation;
}

export interface RoleArgument {
    actualRole: string;
    formalRole: string;
}

export interface Parallel {
    type: 'Parallel';
    branches: ParallelBranch[];
    location?: SourceLocation;
}

export interface ParallelBranch {
    type: 'ParallelBranch';
    body: GlobalInteraction[];
    location?: SourceLocation;
}

// ============================================================================
// Local Interactions
// ============================================================================

export type LocalInteraction =
    | Send
    | Receive
    | InternalChoice
    | ExternalChoice
    | LocalRecursion
    | LocalContinue
    | LocalParallel;

export interface Send {
    type: 'Send';
    messageSignature: MessageSignature;
    receivers: string[];
    location?: SourceLocation;
}

export interface Receive {
    type: 'Receive';
    messageSignature: MessageSignature;
    sender: string;
    location?: SourceLocation;
}

export interface InternalChoice {
    type: 'InternalChoice';
    branches: ChoiceBranch[];
    location?: SourceLocation;
}

export interface ExternalChoice {
    type: 'ExternalChoice';
    sender: string;
    cases: ExternalChoiceCase[];
    location?: SourceLocation;
}

export interface ExternalChoiceCase {
    type: 'ExternalChoiceCase';
    messageSignature: MessageSignature;
    body: LocalInteraction[];
    location?: SourceLocation;
}

export interface LocalRecursion {
    type: 'LocalRecursion';
    label: string;
    body: LocalInteraction[];
    location?: SourceLocation;
}

export interface LocalContinue {
    type: 'LocalContinue';
    label: string;
    location?: SourceLocation;
}

export interface LocalParallel {
    type: 'LocalParallel';
    branches: LocalParallelBranch[];
    location?: SourceLocation;
}

export interface LocalParallelBranch {
    type: 'LocalParallelBranch';
    body: LocalInteraction[];
    location?: SourceLocation;
}

// ============================================================================
// Message Signatures & Types
// ============================================================================

export interface MessageSignature {
    label: string;
    payloadTypes: PayloadType[];
}

export interface PayloadType {
    typeName: string;
    typeArguments?: PayloadType[];
}

// ============================================================================
// Source Location
// ============================================================================

export interface SourceLocation {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
}
```

---

## Complete Example: AST for TwoPhaseCommit

### Scribble Protocol

```scribble
import java.util.UUID as UUID;

global protocol TwoPhaseCommit(role Coordinator, role Participant) {
    prepare(UUID) from Coordinator to Participant;

    choice at Participant {
        vote_commit() from Participant to Coordinator;
        commit() from Coordinator to Participant;
    } or {
        vote_abort() from Participant to Coordinator;
        abort() from Coordinator to Participant;
    }
}
```

### Complete AST

```typescript
{
    type: 'Module',
    imports: [
        {
            type: 'ImportDeclaration',
            typeSystem: 'java',
            qualifiedName: 'java.util.UUID',
            alias: 'UUID'
        }
    ],
    protocols: [
        {
            type: 'GlobalProtocolDeclaration',
            protocolName: 'TwoPhaseCommit',
            roles: [
                { type: 'RoleDeclaration', roleName: 'Coordinator' },
                { type: 'RoleDeclaration', roleName: 'Participant' }
            ],
            body: [
                {
                    type: 'MessageTransfer',
                    messageSignature: {
                        label: 'prepare',
                        payloadTypes: [{ typeName: 'UUID' }]
                    },
                    sender: 'Coordinator',
                    receivers: ['Participant']
                },
                {
                    type: 'Choice',
                    decider: 'Participant',
                    branches: [
                        {
                            type: 'ChoiceBranch',
                            body: [
                                {
                                    type: 'MessageTransfer',
                                    messageSignature: { label: 'vote_commit', payloadTypes: [] },
                                    sender: 'Participant',
                                    receivers: ['Coordinator']
                                },
                                {
                                    type: 'MessageTransfer',
                                    messageSignature: { label: 'commit', payloadTypes: [] },
                                    sender: 'Coordinator',
                                    receivers: ['Participant']
                                }
                            ]
                        },
                        {
                            type: 'ChoiceBranch',
                            body: [
                                {
                                    type: 'MessageTransfer',
                                    messageSignature: { label: 'vote_abort', payloadTypes: [] },
                                    sender: 'Participant',
                                    receivers: ['Coordinator']
                                },
                                {
                                    type: 'MessageTransfer',
                                    messageSignature: { label: 'abort', payloadTypes: [] },
                                    sender: 'Coordinator',
                                    receivers: ['Participant']
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}
```

---

## AST Validation

After parsing, the AST must be validated before CFG construction. The validator checks:

### Scope Rules

**1. Role References**
```typescript
// All roles in messages must be declared
for (const interaction of ast.body) {
    if (interaction.type === 'MessageTransfer') {
        if (!declaredRoles.has(interaction.sender)) {
            error(`Undeclared role: ${interaction.sender}`);
        }
        for (const receiver of interaction.receivers) {
            if (!declaredRoles.has(receiver)) {
                error(`Undeclared role: ${receiver}`);
            }
        }
    }
}
```

**2. Recursion Labels**
```typescript
// Continue must reference a declared recursion label in scope
for (const interaction of ast.body) {
    if (interaction.type === 'Continue') {
        if (!recursionLabelsInScope.has(interaction.label)) {
            error(`Undefined recursion label: ${interaction.label}`);
        }
    }
}
```

**3. Protocol References (for `do`)**
```typescript
// Do statements must reference defined protocols
for (const interaction of ast.body) {
    if (interaction.type === 'Do') {
        if (!definedProtocols.has(interaction.protocolName)) {
            error(`Undefined protocol: ${interaction.protocolName}`);
        }
    }
}
```

### Structural Rules

**1. Choice First Message**
```typescript
// Each choice branch must start with a message from the decider
for (const branch of choice.branches) {
    const firstInteraction = branch.body[0];
    if (firstInteraction.type !== 'MessageTransfer') {
        error('Choice branch must start with a message');
    }
    if (firstInteraction.sender !== choice.decider) {
        error(`Choice branch must start with message from decider ${choice.decider}`);
    }
}
```

**2. Distinct Choice Labels**
```typescript
// All branches in a choice must have distinct message labels
const labels = new Set<string>();
for (const branch of choice.branches) {
    const firstMsg = branch.body[0] as MessageTransfer;
    const label = firstMsg.messageSignature.label;
    if (labels.has(label)) {
        error(`Duplicate choice label: ${label}`);
    }
    labels.add(label);
}
```

**3. Tail Recursion for `do`**
```typescript
// No actions by a role after a do statement involving that role
for (let i = 0; i < interactions.length - 1; i++) {
    if (interactions[i].type === 'Do') {
        const doStmt = interactions[i] as Do;
        const involvedRoles = new Set(doStmt.roleArguments.map(r => r.actualRole));

        for (let j = i + 1; j < interactions.length; j++) {
            const nextInteraction = interactions[j];
            const actingRoles = getActingRoles(nextInteraction);
            for (const role of actingRoles) {
                if (involvedRoles.has(role)) {
                    error(`Role ${role} has action after do statement`);
                }
            }
        }
    }
}
```

---

## AST Traversal Utilities

### Visitor Pattern

```typescript
export interface AstVisitor<T> {
    visitModule?(node: Module): T;
    visitImport?(node: ImportDeclaration): T;
    visitGlobalProtocol?(node: GlobalProtocolDeclaration): T;
    visitLocalProtocol?(node: LocalProtocolDeclaration): T;
    visitMessageTransfer?(node: MessageTransfer): T;
    visitChoice?(node: Choice): T;
    visitRecursion?(node: Recursion): T;
    visitContinue?(node: Continue): T;
    visitDo?(node: Do): T;
    visitParallel?(node: Parallel): T;
    // ... etc for all node types
}

export function traverse<T>(node: AstNode, visitor: AstVisitor<T>): T {
    switch (node.type) {
        case 'Module':
            return visitor.visitModule?.(node) ?? visitor.default?.(node);
        case 'GlobalProtocolDeclaration':
            return visitor.visitGlobalProtocol?.(node) ?? visitor.default?.(node);
        // ... etc
    }
}
```

### Example: Collecting All Message Labels

```typescript
const messageLabels = new Set<string>();

traverse(ast, {
    visitMessageTransfer(node) {
        messageLabels.add(node.messageSignature.label);
    }
});

console.log('All message labels:', Array.from(messageLabels));
```

---

## AST Transformation: Desugaring

Before CFG construction, some AST nodes can be "desugared" (transformed into simpler equivalents):

### Example: Multicast Desugaring

**Source:**
```scribble
broadcast(Event) from Publisher to Sub1, Sub2, Sub3;
```

**AST (original):**
```typescript
{
    type: 'MessageTransfer',
    sender: 'Publisher',
    receivers: ['Sub1', 'Sub2', 'Sub3']
}
```

**Desugared to Sequential:**
```typescript
[
    {
        type: 'MessageTransfer',
        sender: 'Publisher',
        receivers: ['Sub1']
    },
    {
        type: 'MessageTransfer',
        sender: 'Publisher',
        receivers: ['Sub2']
    },
    {
        type: 'MessageTransfer',
        sender: 'Publisher',
        receivers: ['Sub3']
    }
]
```

**Or Desugared to Parallel:**
```typescript
{
    type: 'Parallel',
    branches: [
        {
            type: 'ParallelBranch',
            body: [{
                type: 'MessageTransfer',
                sender: 'Publisher',
                receivers: ['Sub1']
            }]
        },
        {
            type: 'ParallelBranch',
            body: [{
                type: 'MessageTransfer',
                sender: 'Publisher',
                receivers: ['Sub2']
            }]
        },
        {
            type: 'ParallelBranch',
            body: [{
                type: 'MessageTransfer',
                sender: 'Publisher',
                receivers: ['Sub3']
            }]
        }
    ]
}
```

---

## AST → CFG Transformation

The AST is the input to the CFG builder. The transformation follows these steps:

1. **Parse** source code → AST
2. **Validate** AST (scope, structure, tail recursion)
3. **Desugar** (optional) complex constructs → simpler AST
4. **Build CFG** from AST using construction rules (see `cfg-design.md`)

**Mapping:**

| AST Node | CFG Construction |
|----------|------------------|
| `MessageTransfer` | Action node + edges |
| `Choice` | Branch node + merge node |
| `Recursion` | Recursive node + back-edges |
| `Continue` | Back-edge to recursive node |
| `Parallel` | Fork node + join node |
| `Do` | Inline expansion of subprotocol CFG |

---

## Implementation Checklist

### Phase 1: AST Types

- [ ] Define all AST interfaces in `src/parser/ast-types.ts`
- [ ] Add JSDoc comments for each type
- [ ] Export all types from module

### Phase 2: Parser

- [ ] Implement lexer (tokenization)
- [ ] Implement recursive descent parser
- [ ] Generate AST nodes with source locations
- [ ] Handle parse errors gracefully

### Phase 3: Validator

- [ ] Implement scope validation (roles, recursion labels)
- [ ] Implement structural validation (choice, do, etc.)
- [ ] Generate helpful error messages with source locations
- [ ] Write comprehensive validation tests

### Phase 4: AST Utilities

- [ ] Implement visitor pattern
- [ ] Implement traversal functions
- [ ] Implement pretty-printer (AST → Scribble)
- [ ] Implement JSON serialization/deserialization

### Phase 5: Integration

- [ ] Connect parser to CFG builder
- [ ] Test end-to-end: source → AST → CFG
- [ ] Add error recovery and debugging tools

---

## Testing Strategy

### Unit Tests

**1. Parser Tests**
```typescript
test('parse message transfer', () => {
    const source = 'msg(Type) from A to B;';
    const ast = parse(source);
    expect(ast.type).toBe('MessageTransfer');
    expect(ast.sender).toBe('A');
    expect(ast.receivers).toEqual(['B']);
});
```

**2. Validator Tests**
```typescript
test('detect undeclared role', () => {
    const ast = parse('global protocol P(role A) { msg() from B to A; }');
    const errors = validate(ast);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Undeclared role: B');
});
```

### Integration Tests

**1. End-to-End**
```typescript
test('parse complex protocol', () => {
    const source = fs.readFileSync('examples/two-phase-commit.scr');
    const ast = parse(source);
    const errors = validate(ast);
    expect(errors).toHaveLength(0);

    const cfg = buildCfg(ast);
    expect(cfg.nodes).toHaveLength(9); // Expected node count
});
```

---

## Error Reporting

### Good Error Messages

**Bad:**
```
Parse error at line 10
```

**Good:**
```
Error: Undeclared role 'Worker'
  --> example.scr:10:15
   |
10 |     task(Job) from Worker to Manager;
   |                    ^^^^^^
   |
Note: Available roles: Manager, Client
Help: Did you mean to declare 'Worker' in the protocol header?
```

### Error Structure

```typescript
export interface AstError {
    type: 'ParseError' | 'ValidationError';
    message: string;
    location: SourceLocation;
    suggestions?: string[];
    notes?: string[];
}
```

---

## Next Steps

With the AST design complete, we can now:

1. **Implement the parser** in `src/parser/parser.ts`
2. **Implement the validator** in `src/parser/validator.ts`
3. **Implement the CFG builder** in `src/cfg/builder.ts`
4. **Write comprehensive tests** for each component

See `cfg-design.md` for CFG construction rules and `scribble-2.0-syntax.md` for the complete grammar.

---

## References

1. **Crafting Interpreters** by Robert Nystrom - AST design patterns
2. **Modern Compiler Implementation** by Andrew Appel - AST transformations
3. **TypeScript Handbook** - Discriminated unions and type guards
4. **The Scribble Protocol Language** (Yoshida et al.) - Session type AST structures
