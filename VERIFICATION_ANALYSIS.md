# Verification Test Coverage Analysis

**Date**: 2025-01-11
**Purpose**: Identify gaps in verification testing before proceeding to projection

---

## Current Test Coverage

### ✅ What IS Tested (24 tests)

#### Deadlock Detection (5 tests)
1. ✅ Parallel branch deadlock (role in multiple branches)
2. ✅ Role conflict in parallel
3. ✅ Linear protocol (no deadlock)
4. ✅ Recursion with continue (not a deadlock)
5. ⚠️  Simple cyclic deadlock (test incomplete - comment says "NOT a deadlock")

#### Liveness (2 tests)
1. ✅ Infinite loops (valid)
2. ✅ Protocols with choice exit

#### Parallel Deadlock (4 tests)
1. ✅ Independent branches
2. ✅ Same sender in multiple branches
3. ✅ Same receiver in multiple branches (NOT a deadlock)
4. ✅ Three-way parallel

#### Race Conditions (3 tests)
1. ✅ Potential race in parallel
2. ✅ Same role receives in parallel
3. ✅ Shared resource access

#### Progress (1 test)
1. ✅ Basic progress checking

#### Integration (6 tests)
1. ✅ Request-Response
2. ✅ Two-Phase Commit
3. ✅ Streaming with Exit
4. ✅ Complete verification
5. ✅ Empty protocol
6. ✅ Deeply nested constructs

---

## ⚠️ CRITICAL GAPS for Projection

### 1. Choice Determinism (MISSING - CRITICAL!)

**Why critical**: External choices must have distinguishable message labels. If not, receiver can't determine which branch was taken.

**Example of INVALID protocol**:
```scribble
protocol Ambiguous(role A, role B) {
  choice at A {
    A -> B: Msg(Int);      // Label: "Msg"
  } or {
    A -> B: Msg(String);   // Label: "Msg" - SAME!
  }
}
```

**For B's projection**: B receives "Msg" but can't tell which branch! Projection would be invalid.

**What to test**:
- ❌ Same message label with different payloads
- ❌ Same message label to different receivers
- ❌ Distinguishable labels (should pass)

**From Scribble spec 4.1.2**:
> "The messages that A sends should be different in each block."

---

### 2. Choice Mergeability (MISSING - CRITICAL!)

**Why critical**: All branches must have consistent continuations for roles to merge.

**Example of INVALID protocol**:
```scribble
protocol Unmergeable(role A, role B, role C) {
  choice at A {
    A -> B: Option1();
    B -> C: Forward();    // Branch 1: B sends to C
  } or {
    A -> B: Option2();
    // Branch 2: B does NOT send to C
  }
  C -> A: Done();         // C can't know if Forward happened!
}
```

**For C's projection**: In branch 1, C receives Forward. In branch 2, C doesn't. After merge, C doesn't know its state!

**What to test**:
- ❌ Unbalanced choice branches
- ❌ Role appears in only some branches
- ❌ Different roles involved in different branches

**From Honda et al. (2008)**: Projection requires "consistent endpoints" across choice branches.

---

### 3. Connectedness (MISSING)

**Why critical**: All declared roles must participate in the protocol.

**Example of INVALID protocol**:
```scribble
protocol Orphan(role A, role B, role C) {
  A -> B: Msg();
  // C is declared but never used - orphaned!
}
```

**What to test**:
- ❌ Role declared but never used
- ❌ All roles participate (should pass)

**From Scribble spec 4.1.1**:
> "Any role appearing inside the global interaction block must have been previously declared in the global protocol signature."

(Inverse also required: all declared roles should appear)

---

### 4. Nested Recursion (MISSING)

**Why critical**: Multiple recursion labels can be in scope, must verify correct continue targets.

**Example protocol**:
```scribble
protocol Nested(role A, role B) {
  rec Outer {
    A -> B: Start();
    rec Inner {
      choice at A {
        A -> B: InnerContinue();
        continue Inner;       // Loops to Inner
      } or {
        A -> B: InnerExit();
      }
    }
    choice at A {
      A -> B: OuterContinue();
      continue Outer;          // Loops to Outer
    } or {
      A -> B: OuterExit();
    }
  }
}
```

**What to test**:
- ❌ Nested rec with different labels
- ❌ Continue targets correct rec
- ❌ Inner continue doesn't affect outer rec

---

### 5. Recursion in Parallel (MISSING - Well-Formedness!)

**Why critical**: Scribble spec forbids continue spanning parallel boundaries.

**Example of INVALID protocol**:
```scribble
protocol RecInParallel(role A, role B, role C) {
  rec Loop {
    par {
      A -> B: M1();
      continue Loop;    // ❌ INVALID: continue in parallel branch
    } and {
      C -> A: M2();
    }
  }
}
```

**From Scribble spec 4.1.3**:
> "There should not be any `global-continue` in any of the blocki, unless the `global-recursion` is also defined in the same block blocki."

**What to test**:
- ❌ Continue in parallel branch (should fail)
- ✅ Rec fully contained in parallel branch (should pass)

---

### 6. Multicast (MISSING)

**Why critical**: Message to multiple receivers has different semantics.

**Example protocol**:
```scribble
protocol Multicast(role A, role B, role C, role D) {
  A -> B, C, D: Broadcast(String);
}
```

**What to test**:
- ❌ Multicast message verification
- ❌ All receivers get the message

---

### 7. Self-Communication (MISSING - Possibly Invalid?)

**Why critical**: Unclear if valid in Scribble.

**Example**:
```scribble
protocol SelfMsg(role A, role B) {
  A -> A: Reflect();  // Is this allowed?
}
```

**What to test**:
- ❌ Self-communication (should fail?)
- Verify against Scribble spec

---

### 8. Empty Choice Branch (MISSING)

**Why critical**: Can a choice branch be empty?

**Example**:
```scribble
protocol EmptyBranch(role A, role B) {
  choice at A {
    A -> B: Something();
  } or {
    // Empty branch - like "skip"
  }
}
```

**What to test**:
- ❌ Empty choice branch (should fail?)

---

## 🟡 IMPORTANT for Correctness

### 9. Message Label Uniqueness (MISSING)

**Why important**: Same label in sequence might indicate error.

**Example**:
```scribble
protocol DuplicateLabels(role A, role B) {
  A -> B: Request(Int);
  A -> B: Request(String);  // Same label, different type - confusing
}
```

**What to test**:
- ⚠️  Duplicate message labels in sequence (warning?)

---

### 10. FIFO Ordering (MISSING)

**Why important**: Multiple messages same direction assume FIFO.

**Example**:
```scribble
protocol Ordering(role A, role B) {
  A -> B: M1();
  A -> B: M2();
  // Does M2 arrive after M1? (FIFO assumed)
}
```

**What to test**:
- ⚠️  Multiple messages same direction (document assumption)

---

### 11. Fork-Join Structural Matching (PARTIALLY TESTED)

**Why important**: CFG well-formedness requires matching fork-join pairs.

**What to test**:
- ❌ Nested fork-join
- ❌ Multiple parallel blocks in sequence
- ❌ Parallel in choice branches

---

### 12. Merge Node Reachability (MISSING)

**Why important**: All choice branches must reach the same merge node.

**Example of POTENTIALLY INVALID CFG**:
```
branch --opt1--> [actions1] ---> merge1
      --opt2--> [actions2] ---> merge2  // Different merge!
```

**What to test**:
- ❌ All branches reach same merge
- ❌ Merge node has correct incoming edges

---

### 13. Choice with Different Receivers (MISSING)

**Why important**: Can choice branches send to different receivers?

**Example**:
```scribble
protocol DifferentReceivers(role A, role B, role C) {
  choice at A {
    A -> B: ToB();
  } or {
    A -> C: ToC();   // Different receiver
  }
}
```

**Valid or not?** Needs research + test.

---

### 14. Parallel Branch Length Mismatch (MISSING)

**Why important**: When do parallel branches synchronize?

**Example**:
```scribble
protocol UnevenParallel(role A, role B, role C, role D) {
  par {
    A -> B: M1();
    A -> B: M2();     // 2 messages
  } and {
    C -> D: M3();     // 1 message
  }
  // Does join happen after M2 or after M3?
}
```

**What to test**:
- ❌ Uneven parallel branches
- ❌ Join synchronization point

---

### 15. Unreachable Code After Continue (MISSING)

**Why important**: Code after `continue` is unreachable.

**Example of INVALID protocol**:
```scribble
protocol Unreachable(role A, role B) {
  rec Loop {
    A -> B: Msg();
    continue Loop;
    A -> B: NeverExecuted();  // Unreachable!
  }
}
```

**What to test**:
- ❌ Statements after continue (should fail or warn)

---

## 🔍 Research Needed

### 16. Payload Type Checking (NOT IN SCOPE?)

**Question**: Do we verify payload types match across uses?

**Example**:
```scribble
A -> B: Msg(Int);
A -> B: Msg(String);  // Same label, different type
```

**Research**: Is this a verification concern or type-system concern?

---

### 17. Sub-protocol Verification (NOT IN SCOPE?)

**Question**: Do we verify `do` statements?

**Example**:
```scribble
protocol Main(role A, role B) {
  do SubProtocol(A as X, B as Y);
}

protocol SubProtocol(role X, role Y) {
  X -> Y: Msg();
}
```

**Research**: Do we verify sub-protocol is valid? Role mapping correct?

---

## 📋 Test Priority Matrix

| Priority | Category                | Impact on Projection | Tests Needed |
|----------|-------------------------|----------------------|--------------|
| P0       | Choice Determinism      | 🔴 CRITICAL          | 3            |
| P0       | Choice Mergeability     | 🔴 CRITICAL          | 4            |
| P0       | Connectedness           | 🔴 CRITICAL          | 2            |
| P1       | Nested Recursion        | 🟠 HIGH              | 3            |
| P1       | Recursion in Parallel   | 🟠 HIGH              | 2            |
| P1       | Fork-Join Structure     | 🟠 HIGH              | 3            |
| P2       | Multicast               | 🟡 MEDIUM            | 2            |
| P2       | Self-Communication      | 🟡 MEDIUM            | 1            |
| P2       | Empty Choice Branch     | 🟡 MEDIUM            | 1            |
| P3       | Message Label Unique    | 🟢 LOW               | 2            |
| P3       | Uneven Parallel         | 🟢 LOW               | 2            |

**Total new tests needed**: ~25

---

## 🎯 Recommendation

**Before proceeding to projection**:

1. **MUST FIX** (P0): Choice Determinism, Mergeability, Connectedness
   - These will cause projection to produce INVALID CFSMs
   - Silent failures that will manifest as runtime bugs

2. **SHOULD FIX** (P1): Nested Recursion, Recursion in Parallel, Fork-Join
   - These are well-formedness violations per Scribble spec
   - May produce incorrect CFGs

3. **NICE TO HAVE** (P2-P3): Rest
   - Good for completeness
   - Lower risk

**Estimated effort**: 2-3 hours to add P0 tests, verify algorithms handle them

**Risk if skipped**: Projection will be built on shaky foundation, leading to debugging projection when the real bug is in verification.

---

## 📚 References for Missing Tests

1. **Scribble Language Reference v0.3, Section 4.1.2** (Local Choice Conditions)
2. **Honda et al. (2008)**: Projection well-formedness conditions
3. **Deniélou & Yoshida (2012)**: CFG well-formedness for MPST

---

## Next Actions

1. ✅ Review this analysis
2. ⏳ Research choice determinism in Scribble spec
3. ⏳ Implement P0 verification checks
4. ⏳ Write P0 tests (should fail for invalid protocols)
5. ⏳ Run full test suite
6. ⏳ Document verification algorithms
7. ✅ THEN proceed to projection
