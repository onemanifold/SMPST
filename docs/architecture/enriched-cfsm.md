# Enriched CFSM Design

> **⚠️ ESSENTIAL READING FOR LANGUAGE EXTENSIONS**
>
> If you are implementing language extensions (refinement types, security annotations,
> timed types, etc.), you MUST understand the architectural assumptions in this document.
> See sections:
> - **Essential Architectural Assumptions** (below)
> - **Current Language Features to Preserve** (especially Multicast)
> - **Future Features to Support**

## Motivation

Moving from dual projection (AST → Local Protocol + CFG → CFSM) to single source of truth (CFG → Enriched CFSM → everything).

**Goal**: CFSM must preserve ALL type information from AST for:
1. TypeScript code generation
2. Scribble serialization (back to .scr files)
3. Future features (refinement types, security annotations, etc.)

## Essential Architectural Assumptions

### 🎯 Single Source of Truth
```
Global Protocol (.scr)
  ↓ Parse
AST (syntax)
  ↓ Build CFG
CFG (semantics) ← SINGLE SOURCE OF TRUTH for semantics
  ↓ Verify
Verified CFG
  ↓ Project
CFSM (operational) ← SINGLE SOURCE OF TRUTH for execution
  ↓ Serialize/Codegen
{Local .scr, TypeScript, Runtime execution}
```

**Principle**: CFG/CFSM is authoritative. AST projection (`ast-projector.ts`) is
being deprecated. All new features MUST flow through CFG → CFSM.

### 🎯 Type Preservation (NOT flattening)
All type information must be preserved as structured AST nodes, NOT flattened to strings.

**CORRECT:**
```typescript
message: {
  label: "Data",
  payload: {
    payloadType: ParametricType {
      name: "Map",
      arguments: [
        SimpleType { name: "String" },
        ParametricType {
          name: "List",
          arguments: [SimpleType { name: "User" }]
        }
      ]
    }
  }
}
```

**WRONG (old approach):**
```typescript
payloadType: "Map<String, List<User>>"  // ❌ Lost structure!
```

**Why?** Future extensions like refinements need access to the type structure:
```typescript
// Need to add constraint to inner User type
Map<String, List<User{age > 18}>>
                    ↑ Can't access this if flattened!
```

### 🎯 Multicast Atomicity (NO unrolling)
See detailed explanation in "Current Language Features to Preserve > Multicast" section.

**Key points:**
- Multicast `A -> B, C: Msg()` is ONE atomic action
- Preserved as `to: ["B", "C"]` throughout pipeline
- Do NOT unroll into separate sends
- Future refinements can add per-recipient constraints

### 🎯 CFSM Enrichment (Full Type Information)

**CRITICAL**: CFSMs are enriched to preserve ALL type information from the AST.

**What is enriched:**

1. **Message Actions** - Full `Message` AST node instead of flattened strings:
   ```typescript
   // OLD (pre-enrichment):
   interface SendAction {
     type: 'send';
     to: string;
     label: string;           // ❌ Just the label
     payloadType?: string;    // ❌ Flattened type string
   }

   // NEW (enriched):
   interface SendAction {
     type: 'send';
     to: string | string[];   // Supports multicast
     message: Message;        // ✅ Full AST with structured types
     location?: SourceLocation; // ✅ Error reporting
     // Deprecated fields kept for backward compatibility:
     label?: string;
     payloadType?: string;
   }
   ```

2. **CFSM Metadata** - Protocol information for code generation:
   ```typescript
   // OLD:
   interface CFSM {
     role: string;
     states: CFSMState[];
     transitions: CFSMTransition[];
     // Missing protocol context!
   }

   // NEW (enriched):
   interface CFSM {
     role: string;
     protocolName: string;           // ✅ For code generation
     parameters: ProtocolParameter[]; // ✅ Type/sig parameters
     states: CFSMState[];
     transitions: CFSMTransition[];
     initialState: string;
     terminalStates: string[];
     metadata?: { ... };              // ✅ Extensible
   }
   ```

3. **Type Structure** - Recursive type information preserved:
   ```typescript
   // Can now access nested structure:
   message.payload.payloadType.type === 'ParametricType'
   message.payload.payloadType.name === 'Map'
   message.payload.payloadType.arguments[0].type === 'SimpleType'
   message.payload.payloadType.arguments[0].name === 'String'
   message.payload.payloadType.arguments[1].type === 'ParametricType'
   message.payload.payloadType.arguments[1].name === 'List'
   // ... and so on recursively
   ```

**Why CFSM enrichment matters:**

- ✅ **TypeScript Codegen**: Can generate exact interface types from CFSM
- ✅ **Runtime Validation**: Can check nested type constraints
- ✅ **Scribble Serialization**: Can reconstruct exact syntax including nested types
- ✅ **Future Extensions**: Can add refinements/annotations to any level of type nesting

**Example usage in codegen:**
```typescript
function generateTypeScriptInterface(cfsm: CFSM): string {
  // Can now use full type information!
  for (const transition of cfsm.transitions) {
    if (transition.action.type === 'send') {
      const msgType = transition.action.message.payload?.payloadType;
      if (msgType.type === 'ParametricType') {
        // Generate proper TypeScript generic type
        const tsType = generateTSType(msgType); // e.g., "Map<string, User[]>"
      }
    }
  }
}
```

### 🎯 Enrichment is Orthogonal to Structure
When adding new features, enrich the **content** (types, constraints, annotations),
NOT the **communication structure** (which messages, what order).

**Examples:**
- ✅ Add refinement predicate to `Message.payload.payloadType`
- ✅ Add security annotation to `Message.metadata`
- ✅ Add timing constraint to `SendAction.deadline`
- ❌ Don't split multicast into multiple messages
- ❌ Don't change CFSM state machine structure unless semantically required

## Current Language Features to Preserve

### 1. Message Types
**Current**: `payloadType?: string` (loses structure)
**Need**: Full `Type` AST node

```typescript
// AST has:
interface Message {
  label: string;
  payload?: Payload;
}

interface Payload {
  payloadType: Type;  // Can be SimpleType or ParametricType
}

type Type = SimpleType | ParametricType;

interface SimpleType {
  name: string;  // "Int", "String", "Bool"
}

interface ParametricType {
  name: string;        // "List", "Option"
  arguments: Type[];   // Recursive!
}
```

**Example lost information**:
- `List<Int>` → flattened to string "List<Int>"
- `Map<String, List<User>>` → loses nested structure

### 2. Source Locations
**Current**: Not preserved in CFSM actions
**Need**: `SourceLocation` for error messages

```typescript
interface SourceLocation {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}
```

### 3. Protocol Metadata
**Current**: Only role name in CFSM
**Need**: Protocol name, parameters for code generation

### 4. Multicast
**Current**: ✅ Already supported `to: string | string[]`
**Status**: No changes needed

**CRITICAL ARCHITECTURAL ASSUMPTION:**
Multicast is preserved as **atomic** throughout the pipeline. We do NOT unroll `A -> B, C: Msg()` into separate messages.

```
AST:     A -> B, C: Msg(Int)
         ↓
CFG:     MessageAction { from: "A", to: ["B", "C"], ... }  ← Array preserved
         ↓
CFSM:    SendAction { to: ["B", "C"], ... }                ← Still atomic
         ↓
Scribble: Msg(Int) to B, C;                                 ← Reconstructed atomically
```

**Why NOT unroll?**
1. **Semantics**: Multicast in session types is a single atomic action
2. **Verification**: Deadlock/race detection requires atomic view
3. **Serialization**: Can reconstruct original `to B, C;` syntax
4. **Runtime**: Execution layer can optimize (parallel sends, async, etc.)

**If we unrolled (DON'T DO THIS):**
```typescript
// WRONG: Would create two separate actions
CFG: ActionNode1 { from: "A", to: "B", ... }  ← Lost atomicity!
     ActionNode2 { from: "A", to: "C", ... }  ← Arbitrary ordering!
```

**Problems with unrolling:**
- ❌ Lost atomicity - can't verify simultaneous send
- ❌ Arbitrary ordering - which comes first? Breaks semantics
- ❌ State explosion - need intermediate states in CFSM
- ❌ Can't reconstruct original multicast for serialization
- ❌ Verification becomes complex (need grouping metadata)

**Future extensibility with atomic multicast:**
```typescript
// Per-recipient refinements WITHOUT unrolling
protocol MulticastRefined(role Pub, role Sub1, role Sub2) {
  Pub -> Sub1, Sub2: Data<T>() where {
    T <: Int for Sub1,      // Sub1 gets Int constraint
    T <: String for Sub2    // Sub2 gets String constraint
  };
}

// Store in enriched message:
message: {
  label: "Data",
  refinements: Map<string, Constraint> {
    "Sub1": { constraint: "T <: Int" },
    "Sub2": { constraint: "T <: String" }
  }
}
```

### 5. Sub-protocols
**Current**: ✅ Already has `SubProtocolCallAction` with role mapping
**Status**: No changes needed

## Future Features to Support

### 1. Exception Handling (AST already has Try/Throw)
```typescript
// Will need:
interface ThrowAction {
  type: 'throw';
  exceptionLabel: string;
}

interface CatchTransition {
  // Links to exception handler states
  exceptionLabel: string;
  handlerState: string;
}
```

### 2. Timed Session Types (AST already has TimedMessage/Timeout)
```typescript
// Will need:
interface TimedSendAction extends SendAction {
  deadline?: Duration;
}
```

### 3. Refinement Types (user mentioned)
```typescript
// Example: x: Int{x > 0 && x < 100}
interface RefinedType {
  baseType: Type;
  predicate: Expression;  // AST node for constraint
}
```

### 4. Security Annotations (user mentioned)
```typescript
// Example: password: String@Encrypted
interface AnnotatedType {
  baseType: Type;
  annotations: Annotation[];
}

interface Annotation {
  name: string;  // "Encrypted", "Authenticated", "Signed"
  arguments?: any[];
}
```

## Enriched CFSM Schema

### Phase 1: Immediate (Preserve Current Features)

```typescript
// Replace string payloadType with full Message
interface SendAction {
  type: 'send';
  to: string | string[];
  message: Message;  // ← Full AST node, not just label
  location?: SourceLocation;  // ← For error reporting
}

interface ReceiveAction {
  type: 'receive';
  from: string;
  message: Message;  // ← Full AST node
  location?: SourceLocation;
}

// Enrich CFSM with protocol metadata
interface CFSM {
  role: string;
  protocolName: string;  // ← NEW: For code generation
  parameters: ProtocolParameter[];  // ← NEW: Type/sig parameters

  states: CFSMState[];
  transitions: CFSMTransition[];
  initialState: string;
  terminalStates: string[];

  metadata?: {
    sourceProtocol?: string;
    projectionTime?: Date;
  };
}
```

### Phase 2: Future (Extensible for New Features)

```typescript
// Extensible action types
type CFSMAction =
  | SendAction
  | ReceiveAction
  | TauAction
  | ChoiceAction
  | SubProtocolCallAction
  | ThrowAction       // ← Future: exceptions
  | TimeoutAction;    // ← Future: timed types

// All actions get location
interface BaseAction {
  location?: SourceLocation;
  metadata?: ActionMetadata;  // Extensible
}

interface ActionMetadata {
  // Future extensibility
  refinements?: RefinementPredicate[];
  securityLevel?: SecurityAnnotation[];
  timing?: TimingConstraint;
}
```

## Migration Strategy

### Step 1: Update Types (Breaking Change)
- Change `payloadType?: string` to `message: Message`
- Add `location?: SourceLocation` to all actions
- Add `protocolName` and `parameters` to CFSM

### Step 2: Update Projector
- Pass full `Message` object instead of extracting label
- Preserve `SourceLocation` from AST
- Add protocol metadata to CFSM

### Step 3: Update Consumers
- TypeScript codegen: Use `message.payload.payloadType` instead of `payloadType` string
- CFSM serializer: Use full `Message` to regenerate Scribble
- Simulators: Extract `message.label` for display

### Step 4: Deprecate AST Projection
- Remove `ast-projector.ts`
- Implement CFSM serialization
- Update CLI to use CFG → CFSM → serialize

## Benefits

✅ **Single source of truth**: One projection algorithm
✅ **Type preservation**: Full type information for codegen
✅ **Error reporting**: Source locations preserved
✅ **Future-proof**: Extensible for refinements, security, timed types
✅ **Correctness**: Projection after verification, not before

## Implementation Order

1. ✅ Add well-formedness validation (already done in current PR)
2. ✅ Update CFSM types (this PR)
3. ✅ Update projector to preserve types (this PR)
4. ✅ Add CFSM serialization (this PR)
5. → Update TypeScript codegen (next PR)
6. → Deprecate AST projection (next PR)

---

## Guide for Implementing Language Extensions

This section provides specific guidance on WHERE to add code when implementing new language features.

### Adding Refinement Types

**Example:** `x: Int{x > 0 && x < 100}`

**Steps:**
1. **AST** (`src/core/ast/types.ts`):
   ```typescript
   interface RefinedType {
     type: 'RefinedType';
     baseType: Type;
     predicate: Expression;  // New AST for constraints
     location?: SourceLocation;
   }

   type Type = SimpleType | ParametricType | RefinedType;  // Add here
   ```

2. **Parser** (`src/core/parser/parser.ts`):
   - Add grammar rules for refinement syntax `{...}`
   - Build `RefinedType` AST nodes

3. **CFG Builder** (`src/core/cfg/builder.ts`):
   - NO CHANGES NEEDED (passes through Message with RefinedType)

4. **CFSM** (`src/core/projection/types.ts`):
   - NO CHANGES NEEDED (Message already has full Type AST)

5. **Verification** (`src/core/verification/`):
   - Add refinement checking (type constraints satisfied?)
   - Validate predicate expressions

6. **Serializer** (`src/core/serializer/cfsm-serializer.ts`):
   - Update `serializeType()` to handle `RefinedType`:
   ```typescript
   if (type.type === 'RefinedType') {
     return `${serializeType(type.baseType)}{${serializePredicate(type.predicate)}}`;
   }
   ```

7. **TypeScript Codegen**:
   - Generate TypeScript type guards from refinements

### Adding Security Annotations

**Example:** `password: String@Encrypted`

**Steps:**
1. **AST** (`src/core/ast/types.ts`):
   ```typescript
   interface Message {
     type: 'Message';
     label: string;
     payload?: Payload;
     securityAnnotations?: SecurityAnnotation[];  // Add here
   }

   interface SecurityAnnotation {
     name: string;  // "Encrypted", "Signed", "Authenticated"
     arguments?: Expression[];
   }
   ```

2. **Parser**: Add `@Annotation` syntax

3. **CFG/CFSM**: NO CHANGES (annotations flow through Message)

4. **Verification**:
   - Check security levels (can't send Encrypted to Untrusted role)
   - Validate annotation compatibility

5. **Serializer**:
   ```typescript
   function serializeMessage(message: Message): string {
     let result = `${message.label}(${serializeType(...)})`;
     if (message.securityAnnotations) {
       result += message.securityAnnotations.map(a => `@${a.name}`).join('');
     }
     return result;
   }
   ```

6. **Runtime**: Add encryption/decryption middleware

### Adding Timed Session Types

**Example:** `A -> B: Request(Data) within 5s;`

**Steps:**
1. **AST** (already has `TimedMessage`!):
   ```typescript
   interface TimedMessage {
     type: 'TimedMessage';
     message: Message;
     from: string;
     to: string | string[];
     duration: Duration;
   }
   ```

2. **CFG Builder**:
   - Create `TimedMessageAction` (extends `MessageAction`)

3. **CFSM**:
   ```typescript
   interface TimedSendAction extends SendAction {
     deadline: Duration;  // Add timing constraint
   }
   ```

4. **Verification**:
   - Check timing compatibility (no deadlocks due to timeouts)
   - Validate deadline ordering

5. **Runtime**:
   - Add timer-based execution
   - Throw timeout exceptions

### Adding Higher-Order Session Types

**Example:** Passing protocol references as values

**Requires more design:**
- Protocol as first-class values
- Dynamic role instantiation
- Type safety for protocol substitution

**Not just enrichment - requires semantic extension!**

### Key Principle: Enrich Message, Not Structure

When in doubt:
- ✅ Add field to `Message` or `Type`
- ✅ Update parser, serializer, codegen
- ✅ CFG/CFSM projection usually needs NO changes
- ⚠️ Only change CFSM structure if semantics fundamentally change (e.g., exception handling adds new transition types)

---

## Testing Requirements for Extensions

When adding language extensions, ensure:

1. **Parser tests**: Syntax correctly parsed to AST
2. **Projection tests**: CFG → CFSM preserves extension data
3. **Serialization tests**: CFSM → Scribble reconstructs syntax
4. **Round-trip test**: Parse → Project → Serialize ≈ Original
5. **Verification tests**: New semantic checks work correctly
6. **Integration test**: Full pipeline including codegen

**Example test structure:**
```typescript
describe('Refinement Types', () => {
  it('should parse refinement syntax', () => { /* AST test */ });
  it('should preserve refinement through projection', () => { /* CFSM test */ });
  it('should serialize refinement back to Scribble', () => { /* Serializer test */ });
  it('should verify refinement constraints', () => { /* Verifier test */ });
  it('should generate TypeScript guards', () => { /* Codegen test */ });
});
```
