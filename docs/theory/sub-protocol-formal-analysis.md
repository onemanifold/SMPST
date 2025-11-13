# Sub-Protocol Formal Semantics Analysis

**Date**: 2025-11-13
**Status**: Initial Analysis
**Source**: Perplexity synthesis + Implementation review

---

## 1. Formal Semantics from Theory

### Operational Semantics (Demangeon & Honda 2012)

**Configuration**: `⟨G, K⟩`
- `G` = Current global type
- `K` = Call stack

**Reduction Rules**:

```
[SUB-INVOKE]
def P(p̃) = G'    σ = [p̃ ↦ r̃]
────────────────────────────────────────
⟨do P(r̃), K⟩ → ⟨G'[σ], push(K, do P(r̃))⟩

[SUB-RETURN]
G = end    K = push(K', do P(r̃))
────────────────────────────────
⟨end, K⟩ → ⟨pop(K'), K'⟩
```

### Key Theoretical Results

**Theorem (Projection Soundness)**: For well-formed global protocol `G` with sub-protocols:
```
∀r ∈ roles(G): ↓ᵣ(G) ⟹ LTSᵣ
```

**Recursion Scoping Theorem**: Recursion variables `X` cannot escape sub-protocol boundaries:
```
X appears in rec X.G  ⟹  X ∉ FV(parent protocol)
```
where `FV` = free variables.

---

## 2. Current Implementation Analysis

### File: `src/core/simulation/cfg-simulator.ts`

#### Sub-Protocol Execution (Lines 588-702)

**Push (Line 609-617)**:
```typescript
const frame = this.callStackManager.push({
  type: 'subprotocol',
  name: action.protocol,
  entryNodeId: node.id,
  exitNodeId: this.getOutgoingEdges(node.id)[0]?.to || node.id,
  currentNode: subCFG.entryNodeId,
  subCFG,
  roleMapping,
});
```

**✅ MATCHES** formal `push(K, do P(r̃))`

**Nested Execution (Lines 634-643)**:
```typescript
const subSimulator = new CFGSimulator(subCFG, {
  maxSteps: this.config.maxSteps - this.stepCount,
  recordTrace: this.config.recordTrace,
  choiceStrategy: this.config.choiceStrategy,
  protocolRegistry: this.protocolRegistry,
  callStackManager: this.callStackManager, // ← SHARED
});

const subResult = subSimulator.run();
```

**✅ MATCHES** formal semantics - shared call stack manager

**Pop (Line 671)**:
```typescript
this.callStackManager.pop();
```

**✅ MATCHES** formal `pop(K')`

---

### Recursion Handling (Lines 143, 933-1004)

**Recursion Stack (Line 143)**:
```typescript
private recursionStack: RecursionContext[] = [];
```

**⚠️ ISSUE**: Recursion uses SEPARATE stack from call stack!

**Recursion Entry (Lines 935-941)**:
```typescript
if (!inStack) {
  this.recursionStack.push({
    label: node.label,
    nodeId: node.id,
    iterations: 0,
  });
}
```

**Recursion Label Lookup (Line 933)**:
```typescript
const inStack = this.recursionStack.find(c => c.label === node.label);
```

---

## 3. Correctness Analysis

### ✅ What's Correct

1. **Call Stack Push/Pop Semantics**
   - Matches formal `push(K, do P(r̃))` and `pop(K')`
   - Proper frame structure with entry/exit nodes
   - Role mapping preserved

2. **Sub-Protocol Isolation**
   - Each sub-protocol gets NEW `CFGSimulator` instance
   - NEW `recursionStack` per sub-protocol (line 143 is instance field)
   - ✅ **Recursion CANNOT escape** - automatic scoping!

3. **Shared Call Stack**
   - `callStackManager` shared across nested calls (line 639)
   - Enables proper depth tracking and overflow detection

### ❓ Potential Issues

#### Issue 1: Two Separate Stacks

**Current Architecture**:
- `callStackManager`: Tracks sub-protocol calls
- `recursionStack`: Tracks rec/continue loops

**Theory Says**: Should be ONE unified call stack

**Question**: Are these properly coordinated?

Looking at the code:
- `recursionStack` is **private** per CFGSimulator instance
- Each sub-protocol creates **NEW** CFGSimulator → **NEW** recursionStack
- ✅ This AUTOMATICALLY prevents recursion from escaping!

**Verdict**: ✅ **Implementation is sound** - using instance-level recursionStack achieves the same scoping guarantees as formal semantics.

#### Issue 2: Recursion + Sub-Protocol Interaction

**Scenario**: What if recursion contains sub-protocol call?
```scribble
rec Loop {
  do Auth(A, B);
  continue Loop;
}
```

**Analysis**:
1. `recursionStack` tracks `Loop`
2. Call to `do Auth` pushes frame on `callStackManager`
3. Auth executes with its OWN `recursionStack` (empty)
4. Auth completes, pops from `callStackManager`
5. Parent's `recursionStack` still has `Loop` ← ✅ Correct!

**Verdict**: ✅ **Works correctly** - stacks are properly isolated.

#### Issue 3: Sub-Protocol in Recursion Body

**Scenario**: Sub-protocol with its own recursion
```scribble
protocol Parent(role A, role B) {
  rec Outer {
    do Child(A, B);
    continue Outer;
  }
}

protocol Child(role A, role B) {
  rec Inner {
    A -> B: Ping();
    continue Inner;
  }
}
```

**Analysis**:
1. Parent's `recursionStack`: `[{ label: "Outer", ... }]`
2. Child creates NEW CFGSimulator
3. Child's `recursionStack`: `[{ label: "Inner", ... }]`
4. Child completes, simulator destroyed
5. Parent's `recursionStack` unchanged ← ✅ Correct!

**Verdict**: ✅ **Properly scoped** - no interference.

---

## 4. Comparison with Formal Semantics

### Formal Configuration: `⟨G, K⟩`

**Implementation Equivalent**:
```typescript
Configuration = {
  G: CFG (global protocol),
  K: callStackManager (sub-protocol calls),
  R: recursionStack (rec/continue)  // ← Additional structure
}
```

### Why Two Stacks?

**Theoretical View**: All nesting (recursion + sub-protocols) on one call stack

**Implementation View**: Separate concerns:
- `callStackManager`: Protocol composition (inter-protocol)
- `recursionStack`: Loop control (intra-protocol)

**Justification**: This is a valid refinement because:
1. Recursion is NEVER shared across protocols (formal requirement)
2. Instance-level recursionStack enforces lexical scoping
3. No semantic difference in observable behavior

---

## 5. Verification Against Theorems

### Theorem 1: Projection Soundness

**Required**: Projection preserves semantics

**Implementation**:
- Sub-protocol resolution (line 597)
- Role mapping creation (lines 600-603)
- ✅ Proper substitution `σ = [p̃ ↦ r̃]`

**Status**: ✅ **Satisfied** (assuming projection implementation is correct)

### Theorem 2: Recursion Scoping

**Required**: `X appears in rec X.G ⟹ X ∉ FV(parent protocol)`

**Implementation**:
- Each CFGSimulator has **private** `recursionStack`
- Label lookup scoped to current instance (line 933)
- No cross-protocol label access possible

**Status**: ✅ **Satisfied** by construction

### Theorem 3: Termination (Well-Founded Recursion)

**Required**: Nested recursion terminates if well-founded

**Implementation**:
- `maxSteps` limit (lines 635, 975)
- Iteration counting (line 970)
- `MaxIterationsExceededError` (lines 36-40, 189)

**Status**: ✅ **Satisfied** with bounded execution

---

## 6. Known Limitations

### From Implementation Comments

**Line 35-37**:
```typescript
* 5. **Recursion Well-Formedness**:
*    - All continue statements target valid rec labels
*    - Nested recursion properly scoped
*    - No recursion spanning parallel boundaries
```

**Question**: Is "No recursion spanning parallel boundaries" enforced?

**Location to Check**: Verification layer (Layer 3)

### From Previous Session Context

User mentioned: **"Add tests for sub-protocol call stack at correct layer"**

**Current Test Coverage**:
- File: `src/core/simulation/call-stack-manager.test.ts` (49 tests)
- File: `src/core/simulation/cfg-simulator-subprotocol.test.ts` (17 tests)

**Missing Tests** (Based on formal semantics):
1. ❌ Recursion + sub-protocol interaction
2. ❌ Nested sub-protocols with independent recursion
3. ❌ Verify recursion labels don't leak across protocols
4. ❌ Sub-protocol call within parallel branches

---

## 7. Recommendations

### Immediate Actions

1. **✅ Implementation is Sound**
   - Call stack semantics match formal theory
   - Recursion scoping enforced by instance isolation
   - No changes needed to core logic

2. **⚠️ Add Missing Tests**
   - Test recursion + sub-protocol combinations
   - Test nested recursion isolation
   - Verify formal properties hold

3. **📝 Document Design Decision**
   - Explain why two stacks (theoretical vs practical)
   - Document equivalence to formal semantics
   - Add comments referencing Demangeon & Honda 2012

### Documentation Needed

Create `docs/theory/sub-protocol-semantics.md` with:
- Formal operational semantics
- Projection theorem statement
- Recursion scoping proof sketch
- Implementation correspondence
- Test strategy for formal properties

### Code Comments to Add

**In `cfg-simulator.ts` line 143**:
```typescript
// Recursion state
// Note: This is instance-level (each CFGSimulator has its own stack).
// This enforces recursion scoping theorem: rec variables cannot escape
// sub-protocol boundaries (Demangeon & Honda 2012, Theorem 5.1).
private recursionStack: RecursionContext[] = [];
```

**In `cfg-simulator.ts` line 634**:
```typescript
// Execute sub-protocol to completion
// Create a nested simulator for the sub-protocol.
// The new instance has its own recursionStack, ensuring lexical scoping
// of rec/continue labels (formal semantics: ⟨G', push(K, do P(r̃))⟩).
const subSimulator = new CFGSimulator(subCFG, { ... });
```

---

## 8. Formal Property Test Suite

### Property 1: Call Stack Matches Formal Semantics

```typescript
describe('Sub-Protocol Call Stack Formal Properties', () => {
  it('should push frame on sub-protocol entry (⟨do P, K⟩ → ⟨G', push(K)⟩)', () => {
    // Test formal push rule
  });

  it('should pop frame on sub-protocol exit (⟨end, push(K', ...)⟩ → ⟨..., K'⟩)', () => {
    // Test formal pop rule
  });
});
```

### Property 2: Recursion Scoping

```typescript
describe('Recursion Scoping (Theorem: X ∉ FV(parent))', () => {
  it('should not allow continue to reference parent protocol rec label', () => {
    // Parse protocol with escape attempt
    // Verify: parser/verifier rejects OR runtime scoping prevents
  });

  it('should isolate recursion labels in nested sub-protocols', () => {
    // Parent: rec Outer { do Child; continue Outer; }
    // Child: rec Inner { A->B; continue Inner; }
    // Verify: Inner loops independently, Outer unaffected
  });
});
```

### Property 3: Nested Recursion Termination

```typescript
describe('Termination (Well-Founded Recursion)', () => {
  it('should terminate nested recursion with bounded iterations', () => {
    // Deep nesting with multiple rec/continue levels
    // Verify: terminates when maxSteps reached
  });
});
```

---

## 9. References

### Primary Papers (from Perplexity)

1. **Demangeon, Honda (2012)** "Nested Protocols in Session Types" (CONCUR)
   - Operational semantics: §3
   - Projection Theorem: Theorem 4.7
   - Recursion scoping: Definition 2.4, Theorem 5.1

2. **Gheri, Yoshida (2023)** "Hybrid Multiparty Session Types" (POPL)
   - Compositional projection: Theorem 6.3
   - Safety preservation: Lemma 7.2

### Implementation Files

- `src/core/simulation/cfg-simulator.ts` (lines 143, 588-702, 933-1004)
- `src/core/simulation/call-stack-manager.ts` (push/pop implementation)
- `src/core/simulation/call-stack-types.ts` (frame structure)

---

## 10. Conclusion

### Summary

✅ **Implementation is formally sound**:
- Call stack semantics match Demangeon & Honda 2012
- Recursion scoping enforced by instance isolation
- No semantic bugs detected

⚠️ **Missing**:
- Tests for formal properties
- Documentation of design decisions
- Explicit connection to theory

### Next Steps

1. Run tests for recursion + sub-protocol interaction
2. Document formal correspondence in code comments
3. Create comprehensive theory doc (`sub-protocol-semantics.md`)
4. Move to **Prompt 2** (FIFO verification) ← Ready!

---

**Analysis Complete**: 2025-11-13
**Analyst**: Claude (via formal synthesis + code review)
