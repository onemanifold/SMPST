# Enriched CFSM Design

## Motivation

Moving from dual projection (AST → Local Protocol + CFG → CFSM) to single source of truth (CFG → Enriched CFSM → everything).

**Goal**: CFSM must preserve ALL type information from AST for:
1. TypeScript code generation
2. Scribble serialization (back to .scr files)
3. Future features (refinement types, security annotations, etc.)

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
2. → Update CFSM types (this PR)
3. → Update projector to preserve types (this PR)
4. → Add CFSM serialization (next PR)
5. → Update TypeScript codegen (next PR)
6. → Deprecate AST projection (next PR)
