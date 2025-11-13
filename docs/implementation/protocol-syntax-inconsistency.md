# Protocol Syntax Inconsistency Investigation

**Date**: 2025-11-13
**Issue**: Parser only accepts `protocol Name(...)` instead of `global protocol Name(...)`

## Summary

There is an inconsistency between the documented Scribble 2.0 syntax and the actual parser implementation regarding global protocol declarations.

### Standard Scribble Syntax (from documentation)

```scribble
global protocol TwoPhaseCommit(role Coordinator, role Participant) {
  // ...
}

local protocol TwoPhaseCommit at Coordinator(role Coordinator, role Participant) {
  // ...
}
```

### Actual SMPST Parser Syntax

```scribble
protocol TwoPhaseCommit(role Coordinator, role Participant) {
  // ...
}

local protocol TwoPhaseCommit at Coordinator(role Coordinator, role Participant) {
  // ...
}
```

**Notice**: Global protocols use just `protocol`, not `global protocol`.

## Evidence

### 1. Documentation Says: `global protocol`

**File**: `docs/scribble-2.0-syntax.md`

```ebnf
<GlobalProtocolDeclaration> ::= "global" "protocol" <ProtocolName> <RoleDeclarationList> "{" <GlobalProtocolBody> "}"
```

Line 87 clearly specifies `"global" "protocol"` as the syntax.

**Examples in docs** (lines 110, 152, 178, 211, etc.):
```scribble
global protocol TwoPhaseCommit(role Coordinator, role Participant1, role Participant2) {
    // ...
}
```

### 2. Parser Implementation Says: just `protocol`

**File**: `src/core/parser/parser.ts:84-85`

```typescript
private globalProtocolDeclaration = this.RULE('globalProtocolDeclaration', () => {
  this.CONSUME(tokens.Protocol);  // ❌ No Global token consumed
  this.CONSUME(tokens.Identifier);
  // ...
});
```

The parser rule is named `globalProtocolDeclaration` but only consumes `Protocol`, not `Global` followed by `Protocol`.

**Comparison with local protocols** (lines 221-222):

```typescript
private localProtocolDeclaration = this.RULE('localProtocolDeclaration', () => {
  this.CONSUME(tokens.Local);    // ✅ Local token consumed
  this.CONSUME(tokens.Protocol);
  // ...
});
```

Local protocols correctly consume both `Local` and `Protocol` tokens.

### 3. Lexer Has The Token But It's Unused

**File**: `src/core/parser/lexer.ts:12-14`

```typescript
export const Protocol = createToken({ name: 'Protocol', pattern: /protocol/ });
export const Global = createToken({ name: 'Global', pattern: /global/ });  // ✅ Defined
export const Local = createToken({ name: 'Local', pattern: /local/ });
```

The `Global` token exists in the lexer but is never consumed by the parser for global protocol declarations.

**Token usage check**:
- `Local` token: Used in `localProtocolDeclaration` rule ✅
- `Global` token: Not used anywhere in the parser ❌

### 4. All Example Files Use `protocol` (not `global protocol`)

**Examples checked**:
- `examples/request-response.scr` - Line 10: `protocol RequestResponse(...)`
- `examples/two-phase-commit.scr` - Line 4: `protocol TwoPhaseCommit(...)`
- `examples/buyer-seller-agency.scr` - Line 15: `protocol Purchase(...)`
- `examples/login-or-register.scr` - Line 11: `protocol LoginOrRegister(...)`
- `examples/stream-data.scr` - Line 11: `protocol StreamData(...)`
- `examples/travel-agency.scr` - Line 13: `protocol BookJourney(...)`

All use `protocol` without the `global` keyword.

## Historical Analysis

### Initial Parser Implementation (commit ea23d0c)

```bash
$ git show ea23d0c:src/core/parser/parser.ts | grep -A 10 "globalProtocolDeclaration = this.RULE"
```

```typescript
private globalProtocolDeclaration = this.RULE('globalProtocolDeclaration', () => {
  this.CONSUME(tokens.Protocol);  // ❌ From the start, only consumed Protocol
  this.CONSUME(tokens.Identifier);
  // ...
});
```

**Finding**: From the very first parser implementation, it only consumed `Protocol`, not `Global` followed by `Protocol`.

### Token Definition History

```bash
$ git show ea23d0c:src/core/parser/lexer.ts | grep -A 2 "export const Global"
```

```typescript
export const Global = createToken({ name: 'Global', pattern: /global/ });
export const Local = createToken({ name: 'Local', pattern: /local/ });
export const Role = createToken({ name: 'Role', pattern: /role/ });
```

**Finding**: The `Global` token was defined from the start but never used.

## Impact

### What Works
- ✅ `protocol Name(role A, role B) { ... }`
- ✅ `local protocol Name at A(role A, role B) { ... }`

### What Doesn't Work
- ❌ `global protocol Name(role A, role B) { ... }` - Parser error
- ❌ Standard Scribble protocol files from other tools

### Compatibility Issues

1. **Documentation vs Implementation**: Docs show syntax that doesn't work
2. **Standard Scribble Incompatibility**: Official Scribble uses `global protocol`
3. **Migration Issues**: Users coming from standard Scribble will get errors

## Root Cause

The parser was designed with asymmetric keywords:
- **Local protocols**: `local protocol` (explicit qualifier)
- **Global protocols**: `protocol` (implicit default)

This design choice was never explicitly documented or justified. It differs from standard Scribble which uses:
- **Local protocols**: `local protocol`
- **Global protocols**: `global protocol`

The `Global` token was defined in the lexer (perhaps for future use or consistency with `Local`) but never integrated into the grammar.

## Recommendations

### Option 1: Support Both Syntaxes (Backward Compatible)

Make `global` optional:

```typescript
private globalProtocolDeclaration = this.RULE('globalProtocolDeclaration', () => {
  this.OPTION(() => {
    this.CONSUME(tokens.Global);  // Optional "global" keyword
  });
  this.CONSUME(tokens.Protocol);
  this.CONSUME(tokens.Identifier);
  // ...
});
```

**Pros**:
- Backward compatible with existing `.scr` files
- Forward compatible with standard Scribble
- No breaking changes

**Cons**:
- Two ways to write the same thing

### Option 2: Require `global protocol` (Breaking Change)

Update parser to require `global`:

```typescript
private globalProtocolDeclaration = this.RULE('globalProtocolDeclaration', () => {
  this.CONSUME(tokens.Global);   // Required
  this.CONSUME(tokens.Protocol);
  this.CONSUME(tokens.Identifier);
  // ...
});
```

Then update all example files and documentation.

**Pros**:
- Matches standard Scribble
- Symmetric with `local protocol`
- Clear distinction between global and local

**Cons**:
- Breaking change
- Must update all `.scr` examples
- Must update all tests

### Option 3: Document Current Behavior (No Code Change)

Update documentation to reflect that SMPST uses `protocol` not `global protocol`.

**Pros**:
- No code changes
- No breaking changes

**Cons**:
- Incompatible with standard Scribble
- Confusing for users familiar with Scribble

## Recommended Action

**I recommend Option 1: Support Both Syntaxes**

This provides the best migration path:
1. Users can continue using existing `protocol` syntax
2. New users can use standard `global protocol` syntax
3. Full compatibility with standard Scribble
4. No breaking changes

### Implementation Steps

1. Update parser to make `global` optional
2. Update documentation to show both syntaxes are accepted
3. Gradually migrate examples to use `global protocol` in new files
4. Add test cases for both syntaxes

## Related Files

- `src/core/parser/parser.ts` - Parser implementation
- `src/core/parser/lexer.ts` - Token definitions
- `docs/scribble-2.0-syntax.md` - Official syntax documentation
- `examples/*.scr` - All protocol examples

## Test Cases Needed

```typescript
describe('Protocol Declaration Syntax', () => {
  it('should accept: protocol Name(...)', () => {
    const protocol = `protocol Test(role A, role B) {}`;
    expect(() => parse(protocol)).not.toThrow();
  });

  it('should accept: global protocol Name(...)', () => {
    const protocol = `global protocol Test(role A, role B) {}`;
    expect(() => parse(protocol)).not.toThrow();
  });

  it('should accept: local protocol Name at A(...)', () => {
    const protocol = `local protocol Test at A(role A, role B) {}`;
    expect(() => parse(protocol)).not.toThrow();
  });
});
```
