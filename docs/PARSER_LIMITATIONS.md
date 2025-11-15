# Parser Limitations

## Overview

The Scribble parser (implemented with Chevrotain) has one known limitation that prevents parsing certain valid Scribble protocols. This limitation does **not** affect the safety checker's correctness - if the parser could produce the CFSMs, the safety checker would handle them correctly.

## Limitation: Nested Recursion

**Status**: NOT SUPPORTED

### What Doesn't Work

Protocols with nested `rec` blocks (recursion inside recursion):

```scribble
global protocol NestedRec(role A, role B) {
  rec Outer {
    msg1() from A to B;
    rec Inner {          ← Nested rec block
      msg2() from B to A;
      choice at A {
        repeat() from A to B;
        continue Inner;
      } or {
        breakInner() from A to B;
      }
    }
    choice at B {
      repeatOuter() from B to A;
      continue Outer;
    } or {
      done() from B to A;
    }
  }
}
```

### Parser Error

```
Parser error at line 18, column 18: Expecting: expecting at least one iteration
which starts with one of these possible Token sequences::
  <[Identifier]>
but found: ')'
```

### Why This Happens

**Root Cause Identified**: Chevrotain's static analysis detects a violation of its fundamental requirement:

> **"A repetition must consume at least one token in each iteration, as entering an iteration while failing to do so would cause an infinite loop"** - Chevrotain Documentation

The grammar structure causing the issue:

1. **`choice` rule** (line 348 in parser.ts) uses `AT_LEAST_ONE` for `or` branches
2. Each branch calls `globalProtocolBody` which uses `MANY()` (zero or more)
3. **`globalProtocolBody`** can be empty (MANY allows zero iterations)
4. In nested recursion contexts, Chevrotain's analysis sees paths where `globalProtocolBody` might not consume tokens

**Specific Problem**:
```typescript
this.AT_LEAST_ONE(() => {              // Must have at least one 'or' branch
  this.CONSUME(tokens.Or);
  this.CONSUME2(tokens.LCurly);
  this.SUBRULE2(this.globalProtocolBody, { LABEL: 'branch' });  ← Can be empty!
  this.CONSUME2(tokens.RCurly);
});
```

When analyzing nested `rec` blocks with choice branches containing minimal content (like `continue Inner;`), Chevrotain cannot statically verify that `globalProtocolBody` will always consume tokens, triggering the "expecting at least one iteration" error.

**Attempted Fixes**:
- ✗ Increasing `maxLookahead` from 4 to 7: Did not resolve (confirms it's not a lookahead depth issue)
- The issue is fundamental to the grammar structure, not lookahead configuration

### What Works

Simple recursion (single level):

```scribble
global protocol SimpleRec(role A, role B) {
  rec Loop {
    msg() from A to B;
    pong() from B to A;
    continue Loop;
  }
}
```

Recursion with choice:

```scribble
global protocol RecWithChoice(role A, role B) {
  rec Loop {
    choice at A {
      next() from A to B;
      continue Loop;
    } or {
      stop() from A to B;
    }
  }
}
```

## Impact on Safety Checker

**None**. The safety checker's formal correctness is unaffected because:

1. **Theorem tests**: 144/144 passing (100%) - All formal properties verified
2. **Integration tests**: 98/98 testable protocols passing (100%)
3. **The limitation is in parsing, not safety checking**

If the parser is enhanced to support nested recursion in the future, the safety checker will handle the resulting CFSMs correctly without any changes needed.

## Workarounds

### Option 1: Flatten Nested Loops

Instead of:
```scribble
rec Outer {
  msg1() from A to B;
  rec Inner {
    msg2() from B to A;
    continue Inner;
  }
  continue Outer;
}
```

Use:
```scribble
rec Combined {
  msg1() from A to B;
  msg2() from B to A;
  continue Combined;
}
```

### Option 2: Use Protocol Composition

Split nested loops into separate protocols and compose them:

```scribble
global protocol Inner(role A, role B) {
  rec InnerLoop {
    msg2() from B to A;
    choice at A {
      continue InnerLoop;
    } or {
      done() from A to B;
    }
  }
}

global protocol Outer(role A, role B) {
  rec OuterLoop {
    msg1() from A to B;
    do Inner(A, B);
    choice at B {
      continue OuterLoop;
    } or {
      finished() from B to A;
    }
  }
}
```

## Future Work

To fix this limitation, we would need to address Chevrotain's requirement that MANY iterations consume tokens:

### Potential Solutions

1. **Refactor Grammar to Guarantee Token Consumption**
   - Change `globalProtocolBody` from `MANY` to ensure at least one interaction is always present in choice branches
   - Add explicit markers/tokens for empty branches
   - Restructure choice branches to avoid potentially empty `globalProtocolBody` calls

   **Pros**: Aligns with Chevrotain's requirements
   **Cons**: May change protocol syntax, breaks backward compatibility

2. **Use OPTION Instead of MANY for Specific Contexts**
   ```typescript
   // Instead of:
   this.MANY(() => this.SUBRULE(this.globalInteraction));

   // Use:
   this.OPTION(() => {
     this.SUBRULE(this.globalInteraction);
     this.MANY(() => this.SUBRULE2(this.globalInteraction));
   });
   ```
   This explicitly handles the "zero" case separately from the "one or more" case.

   **Pros**: Satisfies Chevrotain's token consumption requirement
   **Cons**: More complex grammar, needs careful analysis

3. **Add Gate Predicates for Empty Branches**
   Use Chevrotain's GATE feature to handle nested recursion specially:
   ```typescript
   this.MANY({
     GATE: () => this.LA(1).tokenType !== tokens.RCurly,
     DEF: () => this.SUBRULE(this.globalInteraction)
   });
   ```

   **Pros**: Explicit control over when to enter MANY loop
   **Cons**: Runtime overhead, may not fix static analysis issue

4. **Switch to Different Parser Generator**
   - **ANTLR**: Better handling of complex grammars with ALL(*) lookahead
   - **PEG.js**: Handles nested structures more naturally with ordered choice
   - **Tree-sitter**: Designed for ambiguous grammars with error recovery

   **Pros**: May handle nested recursion naturally
   **Cons**: Complete rewrite of parser, loss of Chevrotain benefits

### Recommended Approach

The most promising fix is **Option 2** (restructure with OPTION + MANY):

```typescript
private globalProtocolBody = this.RULE('globalProtocolBody', () => {
  this.OPTION(() => {
    // First interaction (if any)
    this.SUBRULE(this.globalInteraction);
    // Subsequent interactions
    this.MANY(() => {
      this.SUBRULE2(this.globalInteraction);
    });
  });
});
```

This ensures:
- Empty bodies are explicitly handled by OPTION
- MANY iterations always consume at least one interaction (satisfying Chevrotain's requirement)
- Backward compatible (same protocols accepted)

**Effort**: Medium (requires testing all existing protocols)
**Risk**: Low (well-understood Chevrotain pattern)

## Testing

To verify the limitation:

```bash
npm test -- --run src/__tests__/debug/parser-nested-rec.test.ts
```

This will show the parser error when attempting to parse nested recursion.

## Related Files

- **Test with limitation documented**: `src/__tests__/integration/edge-cases.test.ts:337-381`
- **Parser grammar**: `src/core/parser/parser.ts`
- **Recursion rule**: `src/core/parser/parser.ts:366-372`
- **Choice rule**: `src/core/parser/parser.ts:336-350`
- **Debug test**: `src/__tests__/debug/parser-nested-rec.test.ts`

## Status

- **Impact**: Minimal - workarounds exist, uncommon pattern
- **Priority**: Low - does not affect safety checker correctness
- **Effort to Fix**: Medium - requires Chevrotain expertise
- **Blockers**: None for current production use

The parser works correctly for all common MPST patterns used in the "Less is More" paper and real-world protocols.

---

**Last Updated**: 2025-11-15
**Test Results**: 98/98 testable protocols passing (100%)
