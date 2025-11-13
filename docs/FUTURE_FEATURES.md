# Future Features - Temporarily Disabled

This document tracks advanced features that have been temporarily disabled due to parser grammar ambiguities or implementation dependencies.

## Status Summary

| Feature | Phase | Status | Reason | Files Affected |
|---------|-------|--------|--------|----------------|
| Protocol Subtyping | 5 | Disabled | Grammar ambiguity | parser.ts:44, 175-213 |
| Exception Handling | 4 | Disabled | Not yet needed | parser.ts:268-269, 397-426, 525-526 |
| Timed Session Types | 6 | Disabled | Grammar ambiguity | parser.ts:258, 462-481 |
| Timeout Handlers | 6 | Disabled | Part of timed types | parser.ts:273, 496-506 |

## 1. Protocol Subtyping (Phase 5)

### Feature Description
Behavioral subtyping for protocols, allowing protocol refinement and extension through inheritance.

**Syntax:**
```scribble
protocol Enhanced(role A, role B) extends Basic(A, B) {
  // Additional interactions or constraints
}
```

### Why Disabled
**Grammar Ambiguity:** Both `protocolExtension` and `globalProtocolDeclaration` start with identical token sequences:
```
Protocol Identifier TypeParameters? LParen RoleDeclarationList RParen
```

The parser cannot distinguish between:
- `protocol Foo(role A) { ... }` (regular protocol)
- `protocol Foo(role A) extends Bar(A) { ... }` (protocol extension)

Until it encounters the `extends` keyword after the closing parenthesis.

### Resolution Strategies

#### Option 1: Lookahead (Recommended)
Use Chevrotain's GATE feature to peek ahead for `extends` keyword:
```typescript
private moduleDeclaration = this.RULE('moduleDeclaration', () => {
  this.OR([
    {
      GATE: () => this.LA(5).tokenType === tokens.Extends,
      ALT: () => this.SUBRULE(this.protocolExtension)
    },
    { ALT: () => this.SUBRULE(this.globalProtocolDeclaration) },
  ]);
});
```

#### Option 2: Unified Rule
Parse as single rule, then branch based on `extends` presence:
```typescript
private protocolDeclaration = this.RULE('protocolDeclaration', () => {
  this.CONSUME(tokens.Protocol);
  this.CONSUME(tokens.Identifier);
  // ... role parameters ...
  this.OPTION(() => {
    this.CONSUME(tokens.Extends);
    // ... extension-specific parsing ...
  });
  // ... body ...
});
```

#### Option 3: Keyword-First Syntax
Change syntax to distinguish at first token:
```scribble
protocol extends Foo(role A) from Bar(A) { ... }
```

### Dependencies
1. **Theory Implementation**: `docs/theory/asynchronous-subtyping.md`
2. **Subtyping Relation**: Formal definition and checking algorithm
3. **Well-Formedness**: Refinement must preserve base protocol contracts
4. **Projection**: Must preserve subtyping relationships (contravariant inputs, covariant outputs)

### Testing Requirements
- [ ] Grammar disambiguation unit tests
- [ ] Subtyping relation verification (reflexivity, transitivity)
- [ ] Liskov substitution property
- [ ] Projection preserves subtyping
- [ ] Well-formedness for refinements

### References
- "Asynchronous Session Subtyping" (Mostrous & Yoshida, 2015)
- `docs/theory/asynchronous-subtyping.md`

---

## 2. Exception Handling (Phase 4)

### Feature Description
Coordinated exception handling across multiparty protocols with try/catch/throw constructs.

**Syntax:**
```scribble
protocol WithExceptions(role Client, role Server) {
  try {
    Client -> Server: Request();
    Server -> Client: Response();
  } catch Timeout {
    Server -> Client: Error();
  }
}
```

### Why Disabled
**Not Yet Needed:** Core projection implementation (Phase 1-3) must be complete and stable before adding exception semantics.

**Complexity:** Exception handling requires:
- Exception propagation semantics across roles
- Coordinated handler execution
- Session cleanup on exception paths
- Integration with subtyping and projection

### Implementation Requirements

#### Theory Foundation
Based on "Exception Handling in Session Types" (Capecchi et al., 2010):
- Exceptions must be coordinated across all participants
- All roles must handle or explicitly propagate exceptions
- Exception handlers must preserve session integrity

#### Projection Rules
```
Γ ⊢ try { G } catch l { H } ↓_p =
  try { [G ↓_p] } catch l { [H ↓_p] }  if p ∈ roles(G) ∪ roles(H)
  τ                                     otherwise
```

#### Well-Formedness
1. **Handler Coverage**: All exception labels thrown must be caught
2. **Role Participation**: All roles involved in try block must participate in handlers
3. **Session Safety**: Exceptions don't leave dangling message queues

### Dependencies
1. **Core Projection**: Phase 1-3 complete (CFG projection, well-formedness)
2. **Control Flow Analysis**: Exception paths must be well-formed
3. **Deadlock Freedom**: Exception handlers must not introduce deadlocks

### Testing Requirements
- [ ] Exception propagation correctness
- [ ] Handler reachability analysis
- [ ] Session cleanup verification
- [ ] Interaction with recursion and choice
- [ ] Deadlock freedom with exceptions

### Files to Modify
- `src/core/parser/parser.ts`: Re-enable tryStatement, throwStatement
- `src/core/ast/types.ts`: Add TryStatement, ThrowStatement nodes
- `src/core/projection/ast-projector.ts`: Add exception projection rules
- `src/core/wellformedness/`: Add exception-specific checks

### References
- "Exception Handling in Session Types" (Capecchi et al., 2010)
- `docs/theory/exception-handling.md`

---

## 3. Timed Session Types (Phase 6)

### Feature Description
Time-constrained protocols with deadlines, timeouts, and timed automata semantics.

**Syntax:**
```scribble
protocol TimedProtocol(role Client, role Server) {
  Client -> Server: Request() within 5s;

  timeout(10s) {
    Server -> Client: Timeout();
  }

  Server -> Client: Response() within 2s;
}
```

### Why Disabled
**Grammar Ambiguity:** Both `timedMessage` and `messageTransfer` share prefix:
```
Identifier Arrow Identifier Colon Message
```

Parser cannot distinguish until it sees `within` keyword.

### Resolution Strategies

#### Option 1: Post-Parse Modifier (Recommended)
Parse as regular `messageTransfer`, then check for `within` clause:
```typescript
private messageTransfer = this.RULE('messageTransfer', () => {
  // ... existing parsing ...
  this.OPTION(() => {
    this.CONSUME(tokens.Within);
    this.SUBRULE(this.timeConstraint);
  });
});
```

#### Option 2: Lookahead
Use GATE to check for `within` keyword after message:
```typescript
{
  GATE: () => this.LA(5).tokenType === tokens.Within,
  ALT: () => this.SUBRULE(this.timedMessage)
}
```

#### Option 3: AST Transformation
Parse as messageTransfer, transform to TimedMessage in AST visitor.

### Implementation Requirements

#### Theory Foundation
Based on "Timed Session Types" (Bocchi et al., 2014):
- Timed automata semantics with clocks
- Clock constraints and zones
- Deadline satisfaction checking
- Timeout handler execution

#### Semantics
- **Timed Actions**: Each action has deadline constraint
- **Clock Zones**: Reachability analysis with timing constraints
- **Model Checking**: Verify timing properties (deadline satisfaction, timeout reachability)

#### Projection Rules
```
[A -> B: Msg() within t] ↓_A = !(B, Msg) within t
[A -> B: Msg() within t] ↓_B = ?(A, Msg) within t
[A -> B: Msg() within t] ↓_C = τ  (for C ≠ A, B)
```

### Dependencies
1. **Exception Handling**: Timeouts often trigger exception paths
2. **Timed Automata Library**: Clock zones, reachability
3. **Model Checker**: UPPAAL or custom implementation
4. **Runtime System**: Timer management for implementation

### Testing Requirements
- [ ] Grammar disambiguation
- [ ] Timing constraint parsing
- [ ] Clock zone reachability
- [ ] Deadline satisfaction checking
- [ ] Timeout handler coverage
- [ ] Integration with exception handling

### Files to Modify
- `src/core/parser/parser.ts`: Modify messageTransfer, re-enable timeout
- `src/core/ast/types.ts`: Add timing information to MessageTransfer
- `src/core/projection/`: Add timed projection rules
- `src/core/verification/`: Timed automata model checking

### References
- "Timed Session Types" (Bocchi et al., 2014)
- "Timed Multiparty Session Types" (Bocchi et al., 2015)
- `docs/theory/timed-session-types.md`

---

## Re-enabling Process

### Step 1: Resolve Grammar Ambiguity
For each disabled feature:
1. Implement chosen resolution strategy
2. Add unit tests for parser disambiguation
3. Verify no regression in existing tests

### Step 2: Complete Dependencies
1. Ensure core projection is complete (Phase 1-3)
2. Implement required theory foundations
3. Add well-formedness checks

### Step 3: Implement Feature
1. Uncomment grammar rules
2. Implement AST visitors
3. Add projection rules
4. Implement type checking

### Step 4: Testing
1. Unit tests for parsing
2. Projection correctness tests
3. Well-formedness tests
4. Integration tests
5. Theorem-driven property tests

### Step 5: Documentation
1. Update language reference
2. Add examples
3. Document formal semantics
4. Update roadmap

---

## Current Priority: Core Projection (Phase 1-3)

Before re-enabling any future features, we must complete:

1. ✅ **Phase 0**: Theorem-driven testing infrastructure
2. 🔄 **Phase 1**: Complete CFG projection implementation
   - Current: 87/107 tests passing (81%)
   - Remaining: 20 projection tests failing
   - Issues: Empty projections, action count mismatches, complex constructs
3. ⏳ **Phase 2**: Choice and recursion projection
4. ⏳ **Phase 3**: Parallel composition and sub-protocols

**Current Focus**: Fix remaining 20 projection test failures before considering future features.

---

## Grammar Ambiguity Lessons Learned

### Why Ambiguities Occur
Chevrotain's LL(k) parser uses fixed lookahead. Ambiguity occurs when multiple rules share long prefixes and diverge only after k tokens.

### Prevention Strategies
1. **Keyword-First Design**: Put distinguishing keywords early
2. **Unified Rules**: Parse common prefix once, branch later
3. **Optional Modifiers**: Make extensions optional within existing rules
4. **AST Transformation**: Parse conservatively, transform later

### When to Use GATE
GATE is expensive (linear scan). Use only when:
- Lookahead distance is bounded and small
- No unified rule is possible
- AST transformation is complex

### Testing Grammar Changes
Always test with ambiguity examples:
```typescript
// Good: Fails before feature, passes after
it('should distinguish protocol from protocol extension', () => {
  parse('protocol Foo(role A) { }');           // regular
  parse('protocol Foo(role A) extends Bar(A) { }'); // extension
});
```

---

## Roadmap Timeline

| Phase | Feature | Target | Status |
|-------|---------|--------|--------|
| 0 | Theorem Testing | ✅ Q4 2024 | Complete |
| 1-3 | Core Projection | 🔄 Q4 2024 | In Progress |
| 4 | Exception Handling | Q1 2025 | Planned |
| 5 | Protocol Subtyping | Q1 2025 | Planned |
| 6 | Timed Session Types | Q2 2025 | Planned |

**Last Updated**: November 2024
**Status**: Core projection in progress (81% tests passing)
