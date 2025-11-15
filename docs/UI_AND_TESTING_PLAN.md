# UI/UX and Testing Plan for Safety Implementation

## Overview

The safety implementation (Definition 4.1 from "Less is More") is now complete and all theorem tests pass. This document outlines:

1. **UI/UX Changes** - How users will interact with safety checking
2. **Traditional Testing Strategy** - Integration and regression tests beyond theorem verification

---

## Part 1: UI/UX Changes

### Current UI State

The SMPST IDE currently provides:
- Protocol editor (Scribble syntax)
- CFSM visualization per role
- API code generation
- Basic validation (duplicate roles, undefined roles, etc.)

### Required UI Additions

#### 1. Safety Verification Panel

**Location**: New panel in the right column, below or beside projection view

**Components**:
```tsx
<SafetyPanel>
  <PropertySelector />     // Choose: BasicSafety, DeadlockFree, Live, etc.
  <SafetyStatus />         // ✓ Safe / ✗ Unsafe / ⚠ Unknown
  <ViolationList />        // Show violations if unsafe
  <StateSpaceMetrics />    // States explored, check time
</SafetyPanel>
```

**Features**:
- **Live checking**: As user types, automatically run safety check
- **Property selection**: Dropdown to choose safety level:
  - BasicSafety (type safety only)
  - DeadlockFree (+ no deadlocks)
  - Live (+ all I/O fires)
  - Consistent (classic MPST for comparison)
- **Visual indicators**:
  - Green checkmark: Protocol is safe
  - Red X: Protocol is unsafe
  - Orange warning: Cannot determine (infinite loops, etc.)
- **Violation details**: Click violation to see:
  - Which roles involved
  - Current states of each role
  - Missing send/receive pair
  - Suggested fix

**Mockup**:
```
┌─────────────────────────────────┐
│ Safety Verification             │
├─────────────────────────────────┤
│ Property: [BasicSafety ▼]       │
│                                 │
│ Status: ✓ SAFE                  │
│                                 │
│ States Explored: 6              │
│ Check Time: 12ms                │
│                                 │
│ ℹ This protocol is safe but     │
│   NOT consistent (classic MPST  │
│   would reject it!)             │
└─────────────────────────────────┘
```

**Unsafe Example**:
```
┌─────────────────────────────────┐
│ Safety Verification             │
├─────────────────────────────────┤
│ Property: [BasicSafety ▼]       │
│                                 │
│ Status: ✗ UNSAFE                │
│                                 │
│ Violations (1):                 │
│ ❌ Send/Receive Mismatch        │
│    • Sender: Alice (at q2)      │
│    • Receiver: Bob (at q0)      │
│    • Message: 'approve'         │
│    • Problem: Bob cannot receive│
│      'approve' from Alice at q0 │
│                                 │
│    [Show in FSM] [Explain]      │
└─────────────────────────────────┘
```

#### 2. Reachability Visualization

**Location**: New tab in projection view (FSM, API, **Reachability**)

**Purpose**: Show the state space explored during safety checking

**Visualization**:
```
Initial State (Γ₀)
  Alice: q0, Bob: q0, Carol: q0
  ✓ Safe
  │
  ├─ Alice sends 'login' → Γ₁
  │    Alice: q1, Bob: q1, Carol: q0
  │    ✓ Safe
  │    │
  │    └─ Bob sends 'passwd' → Γ₂
  │         Alice: q1, Bob: q2, Carol: q1
  │         ✓ Safe
  │
  └─ Alice sends 'cancel' → Γ₁'
       Alice: q2, Bob: q2, Carol: q0
       ✓ Safe
       │
       └─ Bob sends 'quit' → Γ₂' (Terminal)
            Alice: qf, Bob: qf, Carol: qf
            ✓ Safe
```

**Features**:
- Expand/collapse nodes
- Highlight unsafe states in red
- Click state to see role states
- Show enabled communications at each state

#### 3. Property Comparison View

**Location**: New section showing multiple property checks side-by-side

**Purpose**: Educational - show that safety is more general than consistency

**Example**:
```
┌────────────────────────────────────────────────────────┐
│ Property Comparison: OAuth Protocol                    │
├────────────────────────────────────────────────────────┤
│ Consistent (Classic MPST)    ✗ REJECTED                │
│   Reason: Partial projection undefined (branch 2)      │
│                                                        │
│ BasicSafety (Less is More)   ✓ ACCEPTED                │
│   Reason: All sends match receives semantically        │
│                                                        │
│ DeadlockFree                 ✓ ACCEPTED                │
│   Reason: No circular wait states                     │
│                                                        │
│ Live                         ✓ ACCEPTED                │
│   Reason: All I/O eventually fires                    │
└────────────────────────────────────────────────────────┘
```

#### 4. Example Library Updates

**Add new category**: "Less is More Examples"

**Include protocols from paper**:
- ✅ OAuth (safe but not consistent) - **THE STAR EXAMPLE**
- ✅ Travel Agency (Fig 4.1)
- ✅ Streaming (Fig 4.2)
- ✅ Three Buyer (classic example)
- ✅ HTTP Request (deadlock-free but not live)
- ✅ TCP Handshake (live)

**Each example should show**:
- Protocol code
- Which properties it satisfies
- Educational note explaining why it's interesting

#### 5. Real-time Feedback

**As user types**:
1. Parse protocol (existing)
2. Validate basic properties (existing)
3. Project to CFSMs (existing)
4. **NEW**: Run safety check
5. **NEW**: Update safety panel

**Debouncing**: Only check after 500ms of no typing (avoid slowdown)

**Error highlighting**: Underline problematic interactions in editor

#### 6. Educational Tooltips

**Throughout UI**:
- Hover over "BasicSafety" → "Ensures sends match receives (Definition 4.1)"
- Hover over "Consistent" → "Classic MPST duality (more restrictive)"
- Hover over violation → "Click to see detailed explanation"

---

## Part 2: Traditional Testing Strategy

### Goal

Theorem tests verify our implementation follows formal rules, but we need:
1. **Integration tests** - Real protocols from the paper
2. **Edge case tests** - Boundary conditions
3. **Negative tests** - Protocols that SHOULD fail
4. **Regression tests** - Prevent bugs from coming back
5. **Performance tests** - Ensure scalability

### Test Categories

#### Category 1: Protocol Library Tests

**File**: `src/__tests__/integration/protocol-library.test.ts`

**Purpose**: Test all protocols from the "Less is More" paper

**Tests**:
```typescript
describe('Protocol Library Integration Tests', () => {
  describe('Figure 4.1 - OAuth (The Critical Example)', () => {
    it('should accept OAuth as safe', () => {
      const oauth = parseProtocol(`
        global protocol OAuth(role s, role c, role a) {
          choice at s {
            login() from s to c;
            passwd(Str) from c to a;
            auth(Bool) from a to s;
          } or {
            cancel() from s to c;
            quit() from c to a;
          }
        }
      `);

      const cfsms = project(oauth);
      const context = createInitialContext(cfsms);
      const safety = new BasicSafety();

      const result = safety.check(context);
      expect(result.safe).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should reject OAuth with classic consistency', () => {
      // When we implement ConsistencyChecker
      const oauth = parseProtocol(...);
      const consistency = new ConsistencyChecker();

      const result = consistency.check(context);
      expect(result.safe).toBe(false);
      expect(result.violations[0].type).toBe('partial-projection-undefined');
    });
  });

  describe('Figure 4.2 - Travel Agency', () => {
    it('should accept travel agency as safe', () => {
      const travel = parseProtocol(`
        global protocol TravelAgency(role c, role a, role s) {
          choice at c {
            query() from c to a;
            quote(Int) from a to c;
            choice at c {
              accept() from c to a;
              invoice(Int) from a to c;
              pay() from c to a;
              confirm() from a to s;
            } or {
              reject() from c to a;
            }
          } or {
            cancel() from c to a;
          }
        }
      `);

      // Test safety
      const result = safety.check(createInitialContext(project(travel)));
      expect(result.safe).toBe(true);
    });
  });

  // Add all Fig 4 examples...
});
```

#### Category 2: Edge Cases

**File**: `src/__tests__/integration/edge-cases.test.ts`

**Tests**:
```typescript
describe('Edge Case Tests', () => {
  it('should handle empty protocol (no interactions)', () => {
    const empty = parseProtocol(`
      global protocol Empty(role A, role B) {
        // No interactions
      }
    `);

    const result = safety.check(createInitialContext(project(empty)));
    expect(result.safe).toBe(true); // Vacuously safe
  });

  it('should handle single role protocol', () => {
    const single = parseProtocol(`
      global protocol Single(role A) {
        // Single role cannot have interactions with self
      }
    `);

    const result = safety.check(createInitialContext(project(single)));
    expect(result.safe).toBe(true);
  });

  it('should handle protocol with only tau transitions', () => {
    // Role that observes but doesn't participate
    const observer = parseProtocol(`
      global protocol Observer(role A, role B, role C) {
        msg() from A to B;
        // C is observer - has only tau transitions
      }
    `);

    const cfsms = project(observer);
    const cfsmC = cfsms.get('C')!;

    // Verify C has tau transition
    expect(cfsmC.transitions.some(t => t.action.type === 'tau')).toBe(true);

    const result = safety.check(createInitialContext(cfsms));
    expect(result.safe).toBe(true);
  });

  it('should handle recursion with multiple unfoldings', () => {
    const recursive = parseProtocol(`
      global protocol Ping(role A, role B) {
        rec Loop {
          ping() from A to B;
          pong() from B to A;
          continue Loop;
        }
      }
    `);

    const context = createInitialContext(project(recursive));

    // Should detect as safe (infinite but well-formed loop)
    const result = safety.check(context);
    expect(result.safe).toBe(true);
  });

  it('should detect cycle in reachability (and not loop forever)', () => {
    const cyclic = parseProtocol(`
      global protocol Cyclic(role A, role B) {
        rec Loop {
          msg() from A to B;
          ack() from B to A;
          continue Loop;
        }
      }
    `);

    const context = createInitialContext(project(cyclic));

    // Should terminate reachability computation despite cycle
    const startTime = Date.now();
    const result = safety.check(context);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(1000); // Should finish quickly
    expect(result.safe).toBe(true);
  });
});
```

#### Category 3: Negative Tests (Should Fail)

**File**: `src/__tests__/integration/unsafe-protocols.test.ts`

**Tests**:
```typescript
describe('Unsafe Protocol Tests', () => {
  it('should reject protocol with mismatched send/receive', () => {
    const mismatched = parseProtocol(`
      global protocol Mismatched(role A, role B) {
        foo() from A to B;
        // B expects 'bar', not 'foo'!
      }
    `);

    // Manually construct CFSMs with mismatch
    const cfsmA = createCFSM('A', [
      { from: 'q0', to: 'q1', action: { type: 'send', to: 'B', message: { label: 'foo' } } }
    ]);
    const cfsmB = createCFSM('B', [
      { from: 'q0', to: 'q1', action: { type: 'receive', from: 'A', message: { label: 'bar' } } }
    ]);

    const context = createInitialContext(new Map([['A', cfsmA], ['B', cfsmB]]));
    const result = safety.check(context);

    expect(result.safe).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].type).toBe('send-receive-mismatch');
    expect(result.violations[0].roles).toEqual(['A', 'B']);
    expect(result.violations[0].details?.messageLabel).toBe('foo');
  });

  it('should reject protocol with orphan receive', () => {
    const orphan = parseProtocol(`
      global protocol Orphan(role A, role B) {
        // A never sends, but B tries to receive!
      }
    `);

    const cfsmA = createCFSM('A', [
      { from: 'q0', to: 'q1', action: { type: 'tau' } }
    ]);
    const cfsmB = createCFSM('B', [
      { from: 'q0', to: 'q1', action: { type: 'receive', from: 'A', message: { label: 'msg' } } }
    ]);

    const context = createInitialContext(new Map([['A', cfsmA], ['B', cfsmB]]));
    const result = safety.check(context);

    expect(result.safe).toBe(false);
    expect(result.violations[0].type).toBe('orphan-receive');
  });

  it('should detect stuck state (no enabled communications, not terminal)', () => {
    // Protocol where roles end up waiting for each other
    const stuck = createStuckProtocol(); // Helper to create stuck CFSMs

    const context = createInitialContext(stuck);
    const reducer = new ContextReducer();

    // Advance to stuck state
    const next = reducer.reduce(context);
    const enabled = reducer.findEnabledCommunications(next);

    expect(enabled.stuck).toBe(true);
    expect(enabled.terminal).toBe(false);
    expect(enabled.communications).toHaveLength(0);
  });
});
```

#### Category 4: Regression Tests

**File**: `src/__tests__/integration/regression.test.ts`

**Purpose**: Tests for specific bugs found during development

**Example**:
```typescript
describe('Regression Tests', () => {
  it('issue #1: multicast sends should check all receivers', () => {
    // Bug: Only checked first receiver in multicast
    const multicast = parseProtocol(`
      global protocol Multicast(role s, role r1, role r2) {
        broadcast() from s to r1;
        broadcast() from s to r2;
      }
    `);

    const cfsms = project(multicast);
    // Both r1 and r2 should have receive transitions
    expect(cfsms.get('r1')!.transitions[0].action.type).toBe('receive');
    expect(cfsms.get('r2')!.transitions[0].action.type).toBe('receive');

    const result = safety.check(createInitialContext(cfsms));
    expect(result.safe).toBe(true);
  });

  it('issue #2: context key should sort roles for consistency', () => {
    // Bug: Context key generated different keys for same state
    const context1 = createContext({ A: 'q0', B: 'q1', C: 'q2' });
    const context2 = createContext({ C: 'q2', A: 'q0', B: 'q1' });

    const key1 = safety['contextKey'](context1);
    const key2 = safety['contextKey'](context2);

    expect(key1).toBe(key2); // Should be equal
  });
});
```

#### Category 5: Performance Tests

**File**: `src/__tests__/integration/performance.test.ts`

**Tests**:
```typescript
describe('Performance Tests', () => {
  it('should handle protocol with 10 roles in reasonable time', () => {
    const large = generateLargeProtocol(10, 20); // 10 roles, 20 messages

    const startTime = Date.now();
    const result = safety.check(createInitialContext(project(large)));
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000); // 5 seconds max
    expect(result.safe).toBe(true);
  });

  it('should cache reachability computation', () => {
    const protocol = parseProtocol(...);
    const context = createInitialContext(project(protocol));

    // First check
    const start1 = Date.now();
    safety.check(context);
    const duration1 = Date.now() - start1;

    // Second check (should be faster if cached)
    const start2 = Date.now();
    safety.check(context);
    const duration2 = Date.now() - start2;

    // Note: This test might need caching implementation
    expect(duration2).toBeLessThanOrEqual(duration1);
  });

  it('should handle deeply nested choices without stack overflow', () => {
    const nested = generateDeeplyNestedChoices(20); // 20 levels deep

    expect(() => {
      const result = safety.check(createInitialContext(project(nested)));
      expect(result).toBeDefined();
    }).not.toThrow();
  });
});
```

#### Category 6: Property Hierarchy Tests

**File**: `src/__tests__/integration/property-hierarchy.test.ts`

**Purpose**: Verify Lemma 5.9 (property hierarchy) with concrete examples

**Tests**:
```typescript
describe('Property Hierarchy Tests (Lemma 5.9)', () => {
  it('consistent implies safe (positive case)', () => {
    const twobuyer = parseProtocol(...); // Classic consistent protocol

    const consistent = new ConsistencyChecker();
    const safe = new BasicSafety();

    const context = createInitialContext(project(twobuyer));

    expect(consistent.check(context).safe).toBe(true);
    expect(safe.check(context).safe).toBe(true);

    // Consistent ⊂ Safe ✓
  });

  it('safe does not imply consistent (OAuth counterexample)', () => {
    const oauth = parseProtocol(...);

    const consistent = new ConsistencyChecker();
    const safe = new BasicSafety();

    const context = createInitialContext(project(oauth));

    expect(safe.check(context).safe).toBe(true);
    expect(consistent.check(context).safe).toBe(false);

    // Safe ⊄ Consistent ✓
    // This proves the hierarchy is strict!
  });

  // When we implement deadlock-freedom and liveness:
  it.skip('deadlock-free implies safe', () => {
    const df = new DeadlockFreedom();
    const safe = new BasicSafety();

    // Test on various protocols...
  });
});
```

---

## Part 3: Implementation Roadmap

### Phase 1: Traditional Tests (This PR)

1. ✅ Create `src/__tests__/integration/` directory
2. ✅ Implement protocol library tests (OAuth, Travel, etc.)
3. ✅ Implement edge case tests
4. ✅ Implement negative tests (unsafe protocols)
5. ⬜ All integration tests passing

**Goal**: Catch any bugs in theorem→code translation

### Phase 2: UI Foundation (Next PR)

1. ⬜ Add safety checking to ScribbleCore API
2. ⬜ Create `<SafetyPanel>` component
3. ⬜ Integrate safety check into App.tsx
4. ⬜ Add OAuth to examples library
5. ⬜ Basic visual indicators (✓/✗)

**Goal**: Users can see if protocol is safe

### Phase 3: Rich UI (Future PR)

1. ⬜ Reachability visualization
2. ⬜ Property comparison view
3. ⬜ Violation explanations with suggestions
4. ⬜ Educational tooltips
5. ⬜ Real-time checking with debouncing

**Goal**: Educational and developer-friendly UX

### Phase 4: Advanced Properties (Future PR)

1. ⬜ Implement DeadlockFreedom checker
2. ⬜ Implement Liveness checker
3. ⬜ Property selector in UI
4. ⬜ Full property hierarchy verification

**Goal**: Complete "Less is More" implementation

---

## Part 4: Testing Checklist

Before merging safety implementation:

- [x] Theorem tests pass (30/30) ✓
- [ ] Integration tests pass (Protocol library)
- [ ] Edge case tests pass
- [ ] Negative tests pass
- [ ] Performance tests pass (< 5s for 10 roles)
- [ ] Regression suite established
- [ ] Property hierarchy verified with examples

Before merging UI:

- [ ] Safety panel displays correctly
- [ ] Live checking works without lag
- [ ] Violations show helpful messages
- [ ] Examples library includes OAuth
- [ ] Mobile-responsive design
- [ ] Accessibility (ARIA labels, keyboard nav)

---

## Part 5: Example UI Workflow

### User Story: Discovering OAuth is Safe

1. User selects "OAuth" from examples
2. Safety panel automatically checks protocol
3. Panel shows:
   - ✓ BasicSafety: SAFE
   - ✗ Consistent: REJECTED
   - ℹ "This protocol is safe but not consistent!"
4. User clicks "Why is consistency rejected?"
5. Tooltip explains:
   - "Classic MPST checks all branches together (syntax)"
   - "Branch 1: s↔a interact ✓"
   - "Branch 2: s↔a don't interact (UNDEFINED)"
   - "Safety checks branches separately (semantics) ✓"
6. User clicks "Show Reachability"
7. Visualization shows two execution paths:
   - Path 1: login → passwd → auth (s↔a interact)
   - Path 2: cancel → quit (s↔a don't interact)
8. Each state marked ✓ Safe
9. User understands: "Ah! Branches are mutually exclusive at runtime!"

---

## Summary

### UI Changes
1. **Safety Panel** - Real-time verification status
2. **Reachability View** - State space visualization
3. **Property Selector** - Choose safety level
4. **Violation Details** - Actionable error messages
5. **Example Library** - OAuth and Fig 4 protocols

### Testing Strategy
1. **Integration Tests** - All protocols from paper
2. **Edge Cases** - Empty, single role, recursion
3. **Negative Tests** - Protocols that should fail
4. **Performance** - Large protocols, caching
5. **Regression** - Prevent bugs from returning
6. **Property Hierarchy** - Verify Lemma 5.9

### Next Steps
1. Implement integration tests (this session)
2. Create UI components (next session)
3. Polish UX with visualizations
4. Deploy to users!

**Goal**: Make "Less is More" MPST accessible and understandable to developers!
