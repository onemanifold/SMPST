# Formal Methods Integration Workflow

**Date**: 2025-11-13
**Purpose**: Complete workflow for integrating formal methods into SMPST IDE development

---

## Overview

This workflow integrates:
1. **Theoretic Completeness Checking** → Find gaps
2. **Perplexity Queries** → Fill gaps
3. **Theory Documentation** → Capture knowledge
4. **Theorem-Driven Testing** → Verify implementation
5. **Implementation** → Grounded in formal properties

---

## Phase 1: Completeness Analysis

### Step 1.1: Extract Claims from Documentation

**Tool**: Use the methodology in `COMPLETENESS_ANALYSIS.md`

**Process**:
```bash
# For each existing doc:
1. Read docs/foundations.md
2. Extract all formal claims
3. Classify: ✅ Proven, 📝 Stated, 🔗 Referenced, ⚠️ Assumed, ❌ Missing
4. Generate Perplexity queries for ❌ and ⚠️
```

**Output**: List of gaps + Perplexity queries

---

### Step 1.2: Identify Implementation Assumptions

**Process**:
```bash
# Search codebase for formal claims
git grep -n "theorem\|lemma\|property\|invariant\|guarantee" src/

# Search for assumption comments
git grep -n "assume\|ASSUMPTION\|TODO.*formal" src/

# Check verification layer
cat src/core/verification/*.ts | grep -i "check\|verify\|validate"
```

**Output**: List of implicit assumptions needing formalization

---

### Step 1.3: Cross-Reference Theory Docs

**Process**:
```bash
# For each theory doc in docs/theory/:
# - What theorems does it reference?
# - Are those theorems verified by tests?
# - Are there implementation-theory gaps?

# Check which theorems have tests
ls tests/formal-properties/

# Check which theorems are referenced in code
git grep -n "Theorem\|Lemma" src/
```

**Output**: Mapping of theorems to tests and implementation

---

## Phase 2: Query Generation & Execution

### Step 2.1: Craft Precise Perplexity Queries

**Template** (from `COMPLETENESS_ANALYSIS.md`):
```
I need [formal definition/theorem/proof] for [concept].

SPECIFIC REQUIREMENTS:
1. [Requirement 1 - be very specific]
2. [Requirement 2 - ask for notation]
3. [Requirement 3 - ask for theorems]
4. [Requirement 4 - ask for decidability]

CONTEXT: [Implementation detail]
CITE: [Specific papers, ask for theorem numbers]
OUTPUT: [What format you want]
LEVEL OF DETAIL: [Comprehensive/proof sketches/examples]
```

**Examples**: See `COMPLETENESS_ANALYSIS.md` Queries 1-4

---

### Step 2.2: Execute Queries in Perplexity

**Best Practices**:
- Run one query at a time
- Review response for completeness
- Iterate if answer lacks theorem numbers or proofs
- Save responses for documentation

---

### Step 2.3: Validate Responses

**Checklist**:
- [ ] Formal definitions provided?
- [ ] Theorems stated precisely with numbers?
- [ ] Proof sketches included?
- [ ] Citations to specific papers/sections?
- [ ] Concrete examples given?
- [ ] Implementation guidance provided?

---

## Phase 3: Theory Documentation

### Step 3.1: Create Theory Document

**Template Structure**:
```markdown
# [Topic] - Formal Theory

**Source**: Perplexity + [Papers]
**Status**: [Implemented/Not Implemented]

## 1. Formal Definitions
   [Precise mathematical definitions]

## 2. Theorems
   ### Theorem X.Y ([Paper, Year])
   **Statement**: [Formal]
   **Proof Sketch**: [High-level]
   **Citation**: [Paper, §X, Theorem Y.Z]

## 3. Implementation Analysis
   ### Current Status
   ### What's Missing
   ### Recommendations

## 4. References
   [Full citations]

## 5. Test Strategy
   [Link to theorem-driven tests]
```

**Location**: `docs/theory/[topic].md`

---

### Step 3.2: Link Documentation

**Create Bi-Directional Links**:

**In theory doc**:
```markdown
## Verified By
- `tests/formal-properties/.../theorem-X.Y.test.ts`
- Implementation: `src/core/.../[file].ts:123`
```

**In code**:
```typescript
/**
 * FORMAL PROPERTY (Theorem X.Y):
 *   [Statement]
 *
 * DOCUMENTED IN: docs/theory/[file].md
 * VERIFIED BY: tests/.../theorem-X.Y.test.ts
 */
```

**In test**:
```typescript
describe('Theorem X.Y', () => {
  const theorem = {
    documentation: 'docs/theory/[file].md',
    implementation: 'src/core/[file].ts',
  };
  // ...
});
```

---

## Phase 4: Theorem-Driven Test Development

### Step 4.1: Decompose Theorem into Proof Obligations

**Process**:
```
Theorem: [Statement]

Proof Sketch:
1. Show property A
2. Show property B
3. Show A ∧ B ⟹ Theorem

↓ Decompose into test cases:

Test 1: Verify property A
Test 2: Verify property B
Test 3: Verify implication
```

**Example**: See `THEOREM_DRIVEN_TESTING.md` Theorem 5.1 example

---

### Step 4.2: Write Test Skeleton

**Use Template**:
```typescript
/**
 * THEOREM [Number]: [Name]
 * SOURCE: [Paper]
 * STATEMENT: [Formal]
 * PROOF OBLIGATIONS:
 *   1. [Obligation 1]
 *   2. [Obligation 2]
 */
describe('Theorem [Number]: [Name]', () => {
  const theorem = { /* metadata */ };

  describe('Proof Obligation 1: [Name]', () => {
    it('proves: [property]', () => {
      // Test implementation
    });
  });

  // ... more obligations

  describe('Documentation Link', () => {
    it('references theory doc', () => {
      // Verify docs/theory/[file].md exists
    });
  });
});
```

---

### Step 4.3: Implement Tests (TDD)

**Red-Green-Refactor**:
```
1. RED: Write test (fails)
2. GREEN: Implement minimal code to pass
3. REFACTOR: Improve while keeping tests green
```

**Focus**: Tests verify formal properties, not implementation details

---

## Phase 5: Implementation Guided by Formal Properties

### Step 5.1: Code with Formal Annotations

**Example**:
```typescript
/**
 * Project global protocol to local type for role r.
 *
 * THEOREM 4.7 (Honda et al. JACM 2016): Projection Soundness
 *   ∀G, ∀r: G ↓r ⟹ Tr ∧ [[G]] ≈ ⊗r[[Tr]]
 *
 * ENSURES:
 *   - Every role gets projection (completeness)
 *   - Projections preserve semantics (soundness)
 *   - Projections are composable (duality)
 *
 * VERIFIED BY: tests/formal-properties/projection/theorem-4.7.test.ts
 */
function projectForRole(G: GlobalType, r: Role): LocalType {
  // Implementation
}
```

---

### Step 5.2: Maintain Formal-Code Correspondence

**Checklist for Each Function**:
- [ ] What formal property does this implement?
- [ ] Which theorem guarantees correctness?
- [ ] Is there a test verifying this property?
- [ ] Are assumptions documented?
- [ ] Are preconditions checked?

---

## Phase 6: Verification & Validation

### Step 6.1: Run Formal Property Tests

```bash
# Run theorem verification tests
npm test -- tests/formal-properties/

# Check coverage for formal properties
npm run test:coverage -- tests/formal-properties/

# Verify all theorems have tests
./scripts/check-theorem-coverage.sh
```

---

### Step 6.2: Validate Against Theory Docs

**For each theorem**:
- [ ] Theory doc exists?
- [ ] Test verifies all proof obligations?
- [ ] Implementation annotated with theorem?
- [ ] Links are bi-directional?

---

## Phase 7: Continuous Integration

### Step 7.1: CI Checks

**Add to `.github/workflows/test.yml`**:
```yaml
- name: Formal Property Tests
  run: npm test -- tests/formal-properties/

- name: Theorem Coverage Check
  run: npm run check:theorem-coverage

- name: Theory Documentation Links
  run: npm run check:theory-links
```

---

### Step 7.2: Pre-commit Hooks

```bash
# .git/hooks/pre-commit
# Check that modified code has formal annotations
# Check that new features have theorem tests
```

---

## Complete Example Workflow

### Scenario: Implementing FIFO Verification

#### Step 1: Identify Gap (Completeness Analysis)
```
Gap Found: VERIFICATION_ANALYSIS.md line 262
"FIFO Ordering (MISSING) - Multiple messages assume FIFO"

→ Need formal verification of FIFO property
```

#### Step 2: Generate Query
```
Query: "Formal verification algorithm for FIFO ordering in MPST"
- Need: Decidability result
- Need: Algorithm
- Cite: Honda et al. (JACM 2016)
```

#### Step 3: Execute Query → Get Response
```
Response: Theorem 5.3 (Honda et al.)
- Statement: FIFO guarantee
- Algorithm: Track message order in projection
- Decidable: Yes
```

#### Step 4: Create Theory Doc
```bash
# Create docs/theory/fifo-verification.md
# Document Theorem 5.3
# Provide verification algorithm
```

#### Step 5: Write Theorem Test
```typescript
// tests/formal-properties/buffers/theorem-5.3-fifo-guarantee.test.ts

describe('Theorem 5.3: FIFO Ordering Guarantee', () => {
  it('proves: messages from p→q received in send order', () => {
    const protocol = `
      protocol FIFO(role A, role B) {
        A -> B: M1();
        A -> B: M2();
        A -> B: M3();
      }
    `;

    const cfg = buildCFG(parse(protocol));
    const verifier = new FIFOVerifier();
    const result = verifier.verify(cfg);

    // Formal property: send order = receive order
    expect(result.valid).toBe(true);
  });
});
```

#### Step 6: Implement Verifier
```typescript
// src/core/verification/fifo-verifier.ts

/**
 * THEOREM 5.3 (Honda et al. JACM 2016): FIFO Ordering
 *
 * Verifies that messages from same sender to same receiver
 * are received in send order.
 *
 * ALGORITHM:
 *   1. For each (sender, receiver) pair:
 *   2. Extract all messages in protocol order
 *   3. Verify receives match send order
 *
 * VERIFIED BY: tests/.../theorem-5.3-fifo-guarantee.test.ts
 */
export class FIFOVerifier {
  verify(cfg: CFG): VerificationResult {
    // Implementation
  }
}
```

#### Step 7: Validate
```bash
# Run test
npm test -- tests/formal-properties/buffers/theorem-5.3

# Check links
cat docs/theory/fifo-verification.md | grep "theorem-5.3"
cat src/core/verification/fifo-verifier.ts | grep "Theorem 5.3"

# Update status
vim docs/VERIFICATION_ANALYSIS.md
# Mark FIFO Ordering as ✅ Implemented
```

---

## Tools & Scripts

### Script: Check Theorem Coverage

```bash
#!/bin/bash
# scripts/check-theorem-coverage.sh

echo "Checking theorem coverage..."

# Find all theorems in theory docs
THEOREMS=$(grep -rh "^### Theorem" docs/theory/ | sort -u)

# For each theorem, check if test exists
while IFS= read -r theorem; do
  THEOREM_NUM=$(echo "$theorem" | sed 's/.*Theorem \([0-9.]*\).*/\1/')

  if ! grep -rq "Theorem $THEOREM_NUM" tests/formal-properties/; then
    echo "❌ Missing test for: $theorem"
  fi
done <<< "$THEOREMS"

echo "Done."
```

---

### Script: Generate Test Skeleton

```javascript
// scripts/generate-theorem-test.js

const theorem = {
  number: '5.3',
  name: 'FIFO Ordering Guarantee',
  source: 'Honda et al. (JACM 2016)',
  statement: 'Messages from p→q received in send order',
  proofObligations: [
    'Send order is total',
    'Receive order matches send order',
    'No message overtaking',
  ],
};

generateTestSkeleton(theorem);
// → Creates tests/formal-properties/.../theorem-5.3.test.ts
```

---

## Benefits

### For Development

- 🎯 **Clear goals**: Know what properties to implement
- 📖 **Better reasoning**: Understand why code exists
- 🐛 **Easier debugging**: Failures indicate theorem violations
- ✅ **Confidence**: Tests verify formal correctness

### For Maintenance

- 📚 **Documentation**: Theory docs + tests explain system
- 🔗 **Traceability**: Code ↔ theory ↔ tests linked
- 🔄 **Refactoring**: Theorems guide safe changes
- 👥 **Onboarding**: New contributors understand formal basis

### For Research

- 🎓 **Academic rigor**: Implementation grounded in theory
- 📄 **Publications**: Can cite verified theorems
- 🔬 **Experimentation**: Theory guides what to test
- 🏆 **Credibility**: Formal verification increases trust

---

## Next Actions

### Immediate (This Session)

1. ✅ Created completeness analysis methodology
2. ✅ Defined theorem-driven testing framework
3. ✅ Created integrated workflow
4. ⏭️ Run 4 completeness queries in Perplexity
5. ⏭️ Create 4 new theory docs
6. ⏭️ Refactor one test suite as example

### Short-term (This Week)

1. Refactor existing tests → theorem-driven format
2. Add formal annotations to critical code
3. Create theorem coverage script
4. Update CONTRIBUTING.md with workflow

### Long-term (Ongoing)

1. All new features: theory-first approach
2. All new tests: theorem-driven format
3. Continuous: maintain theory-code-test links
4. Periodic: completeness analysis reviews

---

## Resources

### Documentation
- `COMPLETENESS_ANALYSIS.md` - Gap identification
- `THEOREM_DRIVEN_TESTING.md` - Testing methodology
- `docs/theory/` - Formal theory documents

### Templates
- Perplexity query template
- Theory doc template
- Theorem test template

### Scripts
- `check-theorem-coverage.sh`
- `generate-theorem-test.js`
- `check-theory-links.sh`

---

**Status**: Workflow defined and ready to execute

**Next**: Run 4 completeness queries → Create 4 theory docs → Refactor tests
