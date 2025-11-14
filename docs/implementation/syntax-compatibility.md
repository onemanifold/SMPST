# SMPST Syntax Compatibility Analysis

**Date**: 2025-11-13
**Status**: Investigation Complete

## Summary

SMPST currently implements **arrow syntax** for message transfers, which deviates from the standard Scribble specification. This document analyzes the deviation and proposes dual syntax support for backwards compatibility.

---

## Message Transfer Syntax Comparison

### Standard Scribble Syntax (Official Spec)

**Scribble 2.0 Specification** (`docs/scribble-2.0-syntax.md:128`):
```ebnf
<MessageTransfer> ::= <MessageSignature> "from" <RoleName> "to" <RoleName> ("," <RoleName>)* ";"
```

**Scribble 0.3 Reference** (Official, 2013) (`docs/SCRIBBLE_LANGUAGE_REFERENCE.md:233`):
```bnf
global-message-transfer ::= (message-signature | identifier) from role-name to role-name ;
```

**Example:**
```scribble
Request(String) from Client to Server;
Response(Int) from Server to Client;
```

### SMPST Arrow Syntax (Current Implementation)

**Parser Implementation** (`src/core/parser/parser.ts:282-296`):
```typescript
private messageTransfer = this.RULE('messageTransfer', () => {
  this.CONSUME(tokens.Identifier, { LABEL: 'from' });
  this.CONSUME(tokens.Arrow);    // -> operator
  this.CONSUME2(tokens.Identifier, { LABEL: 'to' });
  this.CONSUME(tokens.Colon);    // : separator
  this.SUBRULE(this.message);    // message signature
  this.CONSUME(tokens.Semicolon);
});
```

**Example:**
```scribble
Client -> Server: Request(String);
Server -> Client: Response(Int);
```

**Syntax Pattern:** `Sender -> Receiver: MessageLabel(PayloadTypes);`

---

## Origin of Arrow Syntax

### Investigation Results

**Timeline:**
- **Initial Implementation** (commit `ea23d0c`, 2025-11-10): Parser created with arrow syntax from day one
- **All Tests** (28 test cases): Used arrow syntax exclusively
- **No Documentation**: No design document explains the syntax choice

**Possible Inspirations:**

1. **Session Types Literature**
   - Academic papers often use `A → B: msg` notation
   - More concise and visually clear direction of communication
   - Common in π-calculus and session calculus notation

2. **Network Protocol Diagrams**
   - Sequence diagrams use `A -> B: message` notation
   - UML sequence diagrams follow similar pattern
   - More intuitive for visualizing message flow

3. **Programming Language Influence**
   - Pattern matching syntax in functional languages (e.g., Haskell)
   - Arrow operators common in type systems
   - Aligns with "data flows left-to-right" paradigm

**Hypothesis:** Arrow syntax was chosen for:
- Visual clarity (direction explicit)
- Consistency with sequence diagrams
- Brevity (fewer keywords)
- Left-to-right reading order matches execution flow

### Evidence of Intentional Choice

**Positive Indicators:**
- Lexer has both `Arrow` and `From`/`To` tokens defined
- Parser uses arrow from initial commit
- All examples and tests consistent with arrow syntax
- Visual alignment with CFG/CFSM diagrams

**Missing Documentation:**
- No design rationale document
- No comparison with standard Scribble syntax
- No compatibility notes in original implementation

---

## Compatibility Issues

### ❌ Current Problems

1. **Cannot Parse Standard Scribble Protocols**
   - Official Scribble examples don't work
   - Protocols from other tools incompatible
   - Academic papers using standard syntax won't parse

2. **Documentation Inconsistency**
   - `scribble-2.0-syntax.md` specifies `from/to` syntax
   - `SCRIBBLE_LANGUAGE_REFERENCE.md` has contradictory info:
     - Grammar says `from...to` (line 233)
     - Examples show arrow syntax (lines 251, 274, 297)
   - Parser implements arrow-only

3. **Formal Correctness Violation**
   - SMPST claims "formal correctness above all"
   - But doesn't support formal Scribble specification
   - Creates barrier to adoption and validation

### ✅ Advantages of Arrow Syntax

1. **Visual Clarity**
   ```scribble
   // Arrow syntax - clear direction
   Client -> Server: Login(String);

   // Standard syntax - verb before actors
   Login(String) from Client to Server;
   ```

2. **Sequence Diagram Alignment**
   - Matches UML/PlantUML notation
   - Easier to visualize protocol flow
   - Natural for developers familiar with sequence diagrams

3. **Left-to-Right Reading**
   ```scribble
   A -> B: Msg1();    // Read: A sends to B message Msg1
   B -> C: Msg2();    // Read: B sends to C message Msg2
   ```

4. **Consistency with Formal Notation**
   - Session types papers use `A → B: msg`
   - Common in π-calculus literature
   - Aligns with academic session types community

---

## Proposed Solution: Dual Syntax Support

### Implementation Plan

Support **both** syntaxes for maximum compatibility:

```scribble
// SMPST arrow syntax (current)
Client -> Server: Request(String);

// Standard Scribble syntax (proposed addition)
Request(String) from Client to Server;
```

### Parser Changes Required

**1. Add Alternative Grammar Rule**

```typescript
private messageTransfer = this.RULE('messageTransfer', () => {
  this.OR([
    // Arrow syntax: Sender -> Receiver: Message();
    { ALT: () => {
      this.CONSUME(tokens.Identifier, { LABEL: 'from' });
      this.CONSUME(tokens.Arrow);
      this.CONSUME2(tokens.Identifier, { LABEL: 'to' });
      this.CONSUME(tokens.Colon);
      this.SUBRULE(this.message);
      this.CONSUME(tokens.Semicolon);
    }},
    // Standard Scribble: Message() from Sender to Receiver;
    { ALT: () => {
      this.SUBRULE2(this.message);
      this.CONSUME(tokens.From);
      this.CONSUME3(tokens.Identifier, { LABEL: 'from' });
      this.CONSUME(tokens.To);
      this.CONSUME4(tokens.Identifier, { LABEL: 'to' });
      // Support multicast
      this.MANY(() => {
        this.CONSUME(tokens.Comma);
        this.CONSUME5(tokens.Identifier, { LABEL: 'toAdditional' });
      });
      this.CONSUME2(tokens.Semicolon);
    }}
  ]);
});
```

**2. Update AST Visitor**

Handle both syntax variants in `messageTransfer()` visitor method.

**3. Add Test Cases**

```typescript
describe('Dual Message Syntax Support', () => {
  it('should parse arrow syntax: A -> B: Msg();', () => {
    const source = `protocol Test(role A, role B) {
      A -> B: Hello(String);
    }`;
    const ast = parse(source);
    expect(ast.declarations[0].body[0].type).toBe('MessageTransfer');
  });

  it('should parse from/to syntax: Msg() from A to B;', () => {
    const source = `protocol Test(role A, role B) {
      Hello(String) from A to B;
    }`;
    const ast = parse(source);
    expect(ast.declarations[0].body[0].type).toBe('MessageTransfer');
  });

  it('should support multicast in from/to syntax', () => {
    const source = `protocol Test(role A, role B, role C) {
      Broadcast(Int) from A to B, C;
    }`;
    const ast = parse(source);
    // Verify multicast recipients
  });
});
```

---

## Benefits of Dual Syntax

### For Users

1. **Choice**: Use preferred syntax
2. **Compatibility**: Parse standard Scribble files
3. **Migration**: Easy transition from other Scribble tools
4. **Learning**: Can learn from any Scribble resource

### For SMPST Project

1. **Formal Correctness**: Supports official specification
2. **Adoption**: Lower barrier to entry
3. **Academic Credibility**: Aligns with published standards
4. **Tool Interoperability**: Can exchange protocols with other tools

### For Formal Methods

1. **Validation**: Can compare with reference implementations
2. **Research**: Use protocols from academic papers
3. **Benchmarking**: Test against standard protocol suites
4. **Reproducibility**: Support protocols from published research

---

## Recommendation

**Implement dual syntax support immediately** for the following reasons:

1. ✅ **Formal Correctness Priority**: SMPST's core principle
2. ✅ **Backward Compatible**: No breaking changes to arrow syntax
3. ✅ **Standard Compliance**: Supports official Scribble 2.0 spec
4. ✅ **Low Implementation Cost**: ~50 lines of code changes
5. ✅ **High Value**: Enables standard protocol compatibility

### Default Recommendation

- **Accept both syntaxes** in parser (always)
- **Use arrow syntax** in examples and generated code (for clarity)
- **Document both** in language reference
- **Preserve arrow syntax** for IDE users (more intuitive)

---

## Other Deviations to Investigate

While investigating syntax compatibility, several other potential deviations were noted:

1. **`global` keyword optional** (already fixed in commit `5adb06a`)
2. **Package declaration optional** (documented as intentional simplification)
3. **Message signature position** (this document's focus)
4. **Future features disabled** (exception handling, timed types, subtyping)

See full analysis in next sections.

---

## Implementation Checklist

- [ ] Update `messageTransfer` rule with OR alternatives
- [ ] Update AST visitor to handle both syntax variants
- [ ] Add comprehensive test cases for both syntaxes
- [ ] Test multicast in both syntaxes
- [ ] Update `SCRIBBLE_LANGUAGE_REFERENCE.md` to document both
- [ ] Update `scribble-2.0-syntax.md` with dual syntax note
- [ ] Add migration guide for users
- [ ] Update Monaco syntax highlighting (already supports both keywords)

---

## Conclusion

Arrow syntax was an undocumented design choice, likely inspired by session types literature and sequence diagram notation. While it provides visual clarity, it creates compatibility issues with standard Scribble.

**Solution:** Implement dual syntax support to maintain SMPST's arrow syntax benefits while achieving formal correctness through standard Scribble compatibility.

**Priority:** HIGH - Addresses core formal correctness principle.

---

**References:**
- Official Scribble 2.0 Spec: `docs/scribble-2.0-syntax.md`
- Scribble 0.3 Reference (2013): `docs/SCRIBBLE_LANGUAGE_REFERENCE.md`
- Parser Implementation: `src/core/parser/parser.ts`
- Initial Parser Commit: `ea23d0c` (2025-11-10)
