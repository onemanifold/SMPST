# Formal Methods Workflow Quick Reference

**Read full workflow:** `docs/theory/FORMAL_METHODS_WORKFLOW.md`

---

## Core Workflow: Theory → Documentation → Tests → Implementation

### ❌ WRONG Order
1. Write code
2. Add tests
3. Maybe document theory?

### ✅ RIGHT Order
1. **Find theorem** in literature
2. **Document** formal semantics
3. **Write tests** as proof obligations
4. **Implement** to pass tests
5. **Verify** theorems hold

---

## Step-by-Step Process

### Step 1: Literature Review
```bash
# When adding feature X:
1. Search for papers defining X formally
2. Find theorem statements
3. Note citation details
```

**Example:** Adding FIFO verification
- Search: "FIFO ordering multiparty session types"
- Find: Honda et al. JACM 2016, Theorem 5.3
- Note: Section 5, page 42

---

### Step 2: Create Theory Doc
```bash
# Create docs/theory/[feature].md
```

**Template:**
```markdown
# [Feature] - Formal Theory

## Formal Definition
[Mathematical definition]

## Theorem X.Y ([Paper])
**Statement:** [Formal statement]
**Proof Sketch:** [High-level proof]

## Implementation Analysis
- Current status
- What's missing
- Recommendations

## References
[Full citations]
```

---

### Step 3: Write Theorem Tests
```bash
# Use theorem test template
# tests/__tests__/theorems/[category]/[feature].test.ts
```

**Key points:**
- One test file per theorem
- Tests are proof obligations
- Link to theory doc

---

### Step 4: Implement with Annotations
```typescript
/**
 * THEOREM X.Y ([Paper]): [Name]
 *
 * [Formal statement]
 *
 * DOCUMENTED IN: docs/theory/[file].md
 * VERIFIED BY: tests/.../theorem-X.Y.test.ts
 */
function implementFeature() {
  // Implementation
}
```

---

### Step 5: Verify
```bash
# Run theorem tests
npm test -- tests/__tests__/theorems/

# Check all links exist
- Theory doc exists
- Tests reference theorem
- Code references theorem
```

---

## Quick Decision Tree

```
Need to add feature X?
├─ Does theorem exist in literature?
│  ├─ Yes → Document → Test → Implement
│  └─ No → Can't implement (no formal basis)
│
└─ Papers behind paywall / 403 errors?
   └─ Use Perplexity proxy (see CONTRIBUTING.md)
```

---

## Example: Adding Channel Delegation

**1. Literature:**
- Paper: Honda et al. "Higher-Order MPST"
- Theorem 7.2: Delegation preserves linearity

**2. Theory Doc:**
- Create `docs/theory/channel-delegation.md`
- Document Theorem 7.2

**3. Tests:**
```typescript
describe('Theorem 7.2: Delegation Linearity', () => {
  it('proves: delegated channels remain linear', () => {
    // Test implementation
  });
});
```

**4. Implementation:**
```typescript
/**
 * THEOREM 7.2: Delegation preserves channel linearity
 * DOCUMENTED IN: docs/theory/channel-delegation.md
 */
function delegateChannel(ch: Channel, from: Role, to: Role) {
  // Implementation
}
```

**5. Verify:**
- Theory doc: ✓ `docs/theory/channel-delegation.md`
- Tests: ✓ `tests/.../theorem-7.2.test.ts`
- Implementation: ✓ Annotated with theorem

---

## Blocked by Academic Papers?

Use **Perplexity as proxy**:

1. Generate detailed query:
   ```
   I need the formal definition of [X] for implementing [feature].

   Please provide:
   - Formal definition with notation
   - Theorem statement and number
   - Proof sketch
   - Implementation guidance

   Cite: [Paper1], [Paper2]
   ```

2. Run in Perplexity
3. Document response in `docs/theory/`

**See:** `CONTRIBUTING.md` §Perplexity Proxy Workflow

---

## Checklist for New Features

Before merging:
- [ ] Theory doc created
- [ ] Theorem identified and documented
- [ ] Tests written as proof obligations
- [ ] All tests passing
- [ ] Code annotated with theorem references
- [ ] Links verified (theory ↔ test ↔ code)

---

## Files to Update

When adding feature:
1. `docs/theory/[feature].md` - NEW (theory doc)
2. `tests/__tests__/theorems/[category]/[test].test.ts` - NEW (theorem tests)
3. `src/core/[module]/[file].ts` - UPDATE (implementation with annotations)
4. `docs/STATUS.md` - UPDATE (document progress)

---

## Why This Order Matters

**Theory First:**
- Ensures feature is formally sound
- Prevents implementing non-existent semantics
- Provides clear specification

**Tests Second:**
- Tests ARE the formal specification
- Forces understanding of theorems
- Guides implementation

**Implementation Last:**
- Clear target (make tests pass)
- Grounded in formal properties
- Verifiable correctness

**Code without theory = undefined behavior.**
