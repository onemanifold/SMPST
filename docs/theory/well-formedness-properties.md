# Well-Formedness Properties - Formal Theory

**Date**: 2025-11-13
**Source**: Perplexity synthesis + Honda et al. (JACM 2016) + Deniélou & Yoshida (ESOP 2012)
**Status**: Theory documentation - Partially Implemented

---

## 1. Overview

### What is Well-Formedness?

**Well-formedness** is a set of **static properties** that a global protocol must satisfy to guarantee **safety** and **liveness**.

**Key Insight**: Well-formed protocols are **correct by construction** - they cannot deadlock, race, or violate communication safety.

### The Four Pillars

1. **Connectedness**: All participants can communicate
2. **Determinism**: No ambiguous choices
3. **No Races**: No conflicting parallel actions
4. **Progress**: No deadlocks

**Foundation**: These properties are **decidable** and can be **statically verified**.

---

## 2. Connectedness

### Formal Definition

A global type $$G$$ is **connected** if for every action $$p \to q : \ell$$ occurring in $$G$$, there is a communication path connecting $$p$$ and $$q$$:

$$
\forall (p \to q : \ell) \in \text{actions}(G), \quad \exists \text{path} \; p \rightsquigarrow q
$$

where $$\rightsquigarrow$$ is the **transitive closure** of roles interacting either directly or indirectly through other roles.

---

### Intuition

**Bad Example (Not Connected)**:
```scribble
protocol Disconnected(role A, role B, role C) {
  // A and B never interact - why is B even here?
  A -> C: Request();
  C -> A: Response();
}
```

**Problem**: Role `B` declared but never participates → not connected.

**Good Example (Connected)**:
```scribble
protocol Connected(role A, role B, role C) {
  A -> B: Request();
  B -> C: Forward();
  C -> B: Response();
  B -> A: FinalResponse();
}
```

**Property**: Every role interacts with at least one other role.

---

### Decidability and Verification

**Theorem (Honda et al. 2016, Definition 2.5)**:

Connectedness is **decidable** by computing the communication graph of $$G$$ and checking if each edge corresponds to a path.

---

### Verification Algorithm

**Algorithm: Check Connectedness**

**Input**: Global protocol $$G$$, declared roles $$\mathcal{R}$$

**Output**: $$\text{true}$$ if connected, $$\text{false}$$ otherwise

```
1. Extract all actions: actions(G) = {p → q : ℓ | action in G}

2. Build communication graph:
   - Nodes: Roles in R
   - Edges: (p, q) if p → q : ℓ in actions(G)

3. For each role r ∈ R:
   - Check if r appears in at least one edge
   - If not, return false (r is isolated)

4. Optional: Check graph connectivity
   - Compute connected components
   - If multiple components → warn (disconnected subprotocols)

5. Return true
```

**Complexity**: $$O(|\mathcal{R}| + |\text{actions}(G)|)$$ (linear)

---

### Citation

**Honda et al. (JACM 2016)**:
- **Definition 2.5**: Connectedness definition
- **Theorem 3.8**: Connectedness ensures meaningful projection

---

## 3. Determinism (Choice Branches Distinguishable)

### Formal Definition

A global type $$G$$ is **deterministic** if for each choice at a role, branches are distinguishable by unique labels or sender/receiver roles:

$$
\forall \text{choice } p \to q : \{ \ell_i(G_i) \}, \quad \ell_i \neq \ell_j \text{ for } i \neq j
$$

and no ambiguity arises in incoming branch selection.

---

### Intuition

**Bad Example (Ambiguous)**:
```scribble
protocol Ambiguous(role Client, role Server) {
  choice at Client {
    Client -> Server: Request(String);  // Same label!
  } or {
    Client -> Server: Request(Int);     // Same label!
  }
}
```

**Problem**: Server receives `Request` but cannot distinguish which branch was chosen → ambiguous!

**Good Example (Deterministic)**:
```scribble
protocol Deterministic(role Client, role Server) {
  choice at Client {
    Client -> Server: GetUser(String);
  } or {
    Client -> Server: GetPost(Int);
  }
}
```

**Property**: Server can distinguish branches by label: `GetUser` vs `GetPost`.

---

### Decidability and Verification

**Theorem**: Determinism is **decidable** by syntactic check of labels and branching structure.

**Verification**: Check uniqueness of labels and distinct source roles in choice constructs.

---

### Verification Algorithm

**Algorithm: Check Determinism**

**Input**: Global protocol $$G$$

**Output**: $$\text{true}$$ if deterministic, $$\text{false}$$ otherwise

```
1. For each choice construct in G:
   choice at p {
     branch₁: p → q : ℓ₁(T₁).G₁
     branch₂: p → q : ℓ₂(T₂).G₂
     ...
   }

2. Extract first action of each branch:
   - actions = [(q₁, ℓ₁), (q₂, ℓ₂), ...]

3. Check label uniqueness:
   - For all i ≠ j:
     - If qᵢ = qⱼ and ℓᵢ = ℓⱼ → return false (ambiguous!)

4. Check external choice determinism:
   - If choice is external (role q reacts to p):
     - All labels from p must be distinct
     - Ensure q can distinguish branches

5. Return true
```

**Complexity**: $$O(|\text{branches}|^2)$$ per choice (quadratic in branches)

---

### Citation

**Honda et al. (JACM 2016)**:
- Determinism ensures no communication ambiguity
- Decidable via label disjointness

---

## 4. No Races (Parallel Conflicts)

### Formal Definition

A global type has **no races** if no two actions in parallel communicate on the same channel or interfere.

Formally, for any parallel composition $$G_1 \mid G_2$$:

$$
\mathrm{channels}(G_1) \cap \mathrm{channels}(G_2) = \emptyset
$$

and no overlapping interactions involving the same role.

---

### Intuition

**Bad Example (Race Condition)**:
```scribble
protocol Race(role A, role B, role C) {
  par {
    A -> B: Msg1();
  } and {
    A -> B: Msg2();  // RACE! Both send to same channel A→B
  }
}
```

**Problem**: Both branches send `A → B` concurrently → ordering undefined → race condition!

**Good Example (No Race)**:
```scribble
protocol NoRace(role A, role B, role C) {
  par {
    A -> B: Msg1();  // Channel: A→B
  } and {
    A -> C: Msg2();  // Channel: A→C (different!)
  }
}
```

**Property**: Parallel branches use **disjoint channels** → no interference.

---

### Decidability and Verification

**Theorem (Deniélou & Yoshida 2012, Theorem 4.5)**: No-race property is **decidable** via disjointness checks.

**Verification**: Static analysis of communication prefixes and roles.

---

### Verification Algorithm

**Algorithm: Check No Races**

**Input**: Global protocol $$G$$

**Output**: $$\text{true}$$ if race-free, $$\text{false}$$ otherwise

```
1. For each parallel construct in G:
   par {
     G₁
   } and {
     G₂
   }

2. Extract channel sets:
   - channels(G₁) = {(p, q) | p → q : ℓ in G₁}
   - channels(G₂) = {(p, q) | p → q : ℓ in G₂}

3. Check disjointness:
   - If channels(G₁) ∩ channels(G₂) ≠ ∅:
     - return false (race detected!)

4. Alternative: Check role disjointness (stronger):
   - roles(G₁) = {p | p appears in G₁}
   - roles(G₂) = {p | p appears in G₂}
   - If roles(G₁) ∩ roles(G₂) ≠ ∅:
     - return false (role conflict!)

5. Recursively check nested parallel constructs

6. Return true
```

**Complexity**: $$O(|\text{actions}(G)|)$$ (linear)

---

### Citation

**Deniélou & Yoshida (ESOP 2012)**:
- **Theorem 4.5**: No-race decidability theorem
- Guarantees no conflicting concurrent message usage

---

## 5. Progress (Deadlock-Freedom)

### Formal Definition

A global type $$G$$ satisfies **progress** if for every reachable state, either:
1. The protocol has **terminated**, OR
2. Some **interaction is enabled**

Formally, no configuration exists where all roles are blocked and no messages are in transit:

$$
\forall \text{reachable state } \sigma: \quad \text{terminated}(\sigma) \vee \text{enabled}(\sigma)
$$

**Meaning**: Protocol never gets **stuck** - always can make progress.

---

### Intuition

**Bad Example (Deadlock)**:
```scribble
protocol Deadlock(role A, role B) {
  // Both wait for each other - classic deadlock!
  par {
    A -> B: Msg1();
    B -> A: Msg2();  // A waits for B
  } and {
    B -> A: Msg3();  // B waits for A
    A -> B: Msg4();
  }
}
```

**Problem**: Circular dependency → both roles blocked → deadlock!

**Good Example (Progress)**:
```scribble
protocol NoDeadlock(role A, role B) {
  A -> B: Request();
  B -> A: Response();
  // Linear flow - no circular waits
}
```

**Property**: No circular dependencies → progress guaranteed.

---

### Decidability and Verification

**Theorem (Honda et al. JACM 2016, Theorem 5.10)**:

Progress checking is **decidable** for MPST thanks to boundedness and deterministic constraints.

$$
\text{Well-formed } G \implies \text{MPST progress and deadlock-freedom}
$$

**Key Result**: Well-formedness (all 4 properties) **implies** deadlock-freedom!

---

### Proof Sketch (Theorem 5.10)

**By contradiction** - assume well-formed $$G$$ reaches deadlock state $$\sigma$$:

1. **Connectedness**: All roles can communicate → no isolated roles
2. **Determinism**: Choices well-defined → no ambiguity blocks transitions
3. **No Races**: Parallel branches disjoint → no conflicts prevent progress
4. **Asynchronous Buffers**: Messages in transit → eventually consumed

**Conclusion**: If all roles blocked, must be circular wait.

**But**: Well-formedness prevents circular dependencies → contradiction!

**Therefore**: Well-formed protocols cannot deadlock. ∎

---

### Verification Algorithm

**Algorithm: Check Progress (Deadlock Detection)**

**Input**: Global protocol $$G$$

**Output**: $$\text{true}$$ if deadlock-free, $$\text{false}$$ otherwise

**Approach**: Model checking via state space exploration.

```
1. Construct global transition system:
   - States: Protocol configurations ⟨G', σ⟩
   - Transitions: Operational semantics rules

2. Build state graph:
   - Start from initial configuration ⟨G, ∅⟩
   - Apply all possible transitions
   - Explore reachable states

3. Identify stuck states:
   - State σ is stuck if:
     - NOT terminated (G' ≠ end)
     - NO transitions enabled
     - Buffers empty (no pending messages)

4. Check for deadlocks:
   - If any stuck state found → return false
   - Otherwise → return true

5. Optimization: Use partial order reduction
   - Exploit independence of parallel actions
   - Prune equivalent interleavings
```

**Complexity**:
- **Worst case**: Exponential in number of roles and message types
- **Practical**: Bounded by protocol size and buffer bounds

**Tools**: SPIN, Uppaal, or custom CFSM analysis

---

### Citation

**Honda et al. (JACM 2016)**:
- **Theorem 5.10**: Progress and deadlock-freedom theorem
- **Proof**: Appendix C

---

## 6. Relationships Between Properties

### Dependency Graph

```
Connectedness ─┐
               ├──> Well-Formedness ──> Progress (Deadlock-Freedom)
Determinism ───┤
               │
No Races ──────┘
```

**Key Insight**: All four properties **together** guarantee correctness.

---

### Theorem Summary

**Theorem (Honda et al. 2016, Composite Correctness)**:

If global protocol $$G$$ satisfies:
1. ✅ Connectedness
2. ✅ Determinism
3. ✅ No Races
4. (Progress follows from 1-3)

Then $$G$$ is **well-formed** and guarantees:
- **Communication Safety**: No type errors
- **Deadlock Freedom**: No stuck states
- **Progress**: Always advances or terminates

$$
\text{Connected}(G) \land \text{Deterministic}(G) \land \text{NoRace}(G) \implies \text{Progress}(G)
$$

---

## 7. Implementation Status in SMPST IDE

### Current Implementation

Let me check what's already implemented:

**Layer 1: Parser & AST** (src/parser/)
- ✅ Parses global protocols
- ✅ Detects syntax errors
- ❓ Well-formedness checking?

**Layer 2: CFG Construction** (src/core/cfg/)
- ✅ Builds control flow graph
- ❓ Connectedness validation?
- ❓ Determinism checking?
- ❓ Race detection?

**Layer 3: Verification** (src/core/verification/)
- ❓ Explicit well-formedness verifier?

---

### What's Implemented ✅

**Implicit Checks** (may exist):
1. **Determinism**: Parser likely rejects duplicate labels
2. **Connectedness**: Role usage tracking may detect unused roles
3. **No Races**: CFG construction may enforce channel disjointness

**Need to verify by searching codebase**.

---

### What's Missing ❌

**Explicit verification layer** with:
1. **Connectedness Checker**: Build communication graph, verify connectivity
2. **Determinism Checker**: Validate choice label uniqueness
3. **Race Detector**: Check parallel composition channel disjointness
4. **Progress Checker**: State space exploration for deadlocks

**Recommendation**: Create `src/core/verification/well-formedness-checker.ts`

---

## 8. Verification Examples

### Example 1: Check Connectedness

**Protocol**:
```scribble
protocol TwoPhaseCommit(role Coordinator, role Worker1, role Worker2) {
  Coordinator -> Worker1: Prepare();
  Coordinator -> Worker2: Prepare();
  Worker1 -> Coordinator: Vote();
  Worker2 -> Coordinator: Vote();

  choice at Coordinator {
    Coordinator -> Worker1: Commit();
    Coordinator -> Worker2: Commit();
  } or {
    Coordinator -> Worker1: Abort();
    Coordinator -> Worker2: Abort();
  }
}
```

**Communication Graph**:
```
Coordinator <---> Worker1
     |
     v
  Worker2
```

**Result**: ✅ **Connected** (all roles interact)

---

### Example 2: Check Determinism

**Protocol**:
```scribble
protocol AuthService(role Client, role Server) {
  choice at Client {
    Client -> Server: Login(String, String);
  } or {
    Client -> Server: Register(String, String, String);
  } or {
    Client -> Server: Logout();
  }
}
```

**Branch Labels**: `{Login, Register, Logout}`

**Check**: All labels unique → ✅ **Deterministic**

---

### Example 3: Check No Races

**Protocol**:
```scribble
protocol ParallelFetch(role Client, role DB, role Cache) {
  par {
    Client -> DB: QueryDB();
    DB -> Client: DBResult();
  } and {
    Client -> Cache: QueryCache();
    Cache -> Client: CacheResult();
  }
}
```

**Channels**:
- Branch 1: `{(Client, DB), (DB, Client)}`
- Branch 2: `{(Client, Cache), (Cache, Client)}`

**Check**: Disjoint channels → ✅ **No Races**

---

### Example 4: Check Progress (Deadlock Detection)

**Protocol**:
```scribble
protocol Pipeline(role A, role B, role C) {
  A -> B: Start();
  B -> C: Process();
  C -> A: Done();
}
```

**Dependency Chain**: `A → B → C → A` (cycle!)

**Analysis**:
- ✅ **Not a deadlock** - messages flow sequentially
- Cycle exists but no circular **wait** (async semantics)

**Result**: ✅ **Progress** guaranteed

---

## 9. Testing Strategy (Theorem-Driven)

### Property 1: Connectedness

```typescript
describe('Theorem: Connectedness (Honda 2016, Def 2.5)', () => {
  it('proves: all declared roles must participate', () => {
    const protocol = `
      protocol Test(role A, role B, role C) {
        A -> B: Msg();
        // C never used!
      }
    `;

    const checker = new WellFormednessChecker();
    const result = checker.checkConnectedness(protocol);

    expect(result.connected).toBe(false);
    expect(result.isolatedRoles).toContain('C');
  });
});
```

---

### Property 2: Determinism

```typescript
describe('Theorem: Determinism (Honda 2016)', () => {
  it('proves: choice branches have unique labels', () => {
    const protocol = `
      protocol Test(role A, role B) {
        choice at A {
          A -> B: Request();
        } or {
          A -> B: Request();  // Duplicate!
        }
      }
    `;

    const checker = new WellFormednessChecker();
    const result = checker.checkDeterminism(protocol);

    expect(result.deterministic).toBe(false);
    expect(result.ambiguousLabels).toContain('Request');
  });
});
```

---

### Property 3: No Races

```typescript
describe('Theorem 4.5: No Races (Deniélou & Yoshida 2012)', () => {
  it('proves: parallel branches use disjoint channels', () => {
    const protocol = `
      protocol Test(role A, role B) {
        par {
          A -> B: Msg1();
        } and {
          A -> B: Msg2();  // Same channel!
        }
      }
    `;

    const checker = new WellFormednessChecker();
    const result = checker.checkNoRaces(protocol);

    expect(result.raceFree).toBe(false);
    expect(result.conflictingChannels).toContain('(A, B)');
  });
});
```

---

### Property 4: Progress

```typescript
describe('Theorem 5.10: Progress (Honda 2016)', () => {
  it('proves: well-formed protocols are deadlock-free', () => {
    const protocol = `
      protocol Test(role A, role B) {
        A -> B: Request();
        B -> A: Response();
      }
    `;

    const checker = new WellFormednessChecker();
    const result = checker.checkProgress(protocol);

    expect(result.hasProgress).toBe(true);
    expect(result.deadlockStates).toHaveLength(0);
  });
});
```

---

## 10. Design Sketch: Well-Formedness Checker

```typescript
interface WellFormednessResult {
  connected: boolean;
  deterministic: boolean;
  raceFree: boolean;
  hasProgress: boolean;
  errors: WellFormednessError[];
}

interface WellFormednessError {
  property: 'connectedness' | 'determinism' | 'races' | 'progress';
  severity: 'error' | 'warning';
  message: string;
  location?: SourceLocation;
}

class WellFormednessChecker {
  /**
   * Check all well-formedness properties
   */
  check(protocol: GlobalProtocol): WellFormednessResult {
    const result: WellFormednessResult = {
      connected: true,
      deterministic: true,
      raceFree: true,
      hasProgress: true,
      errors: [],
    };

    // Check each property
    this.checkConnectedness(protocol, result);
    this.checkDeterminism(protocol, result);
    this.checkNoRaces(protocol, result);

    // Progress follows from others (Theorem 5.10)
    if (result.connected && result.deterministic && result.raceFree) {
      result.hasProgress = true;
    } else {
      // Need explicit check if other properties fail
      this.checkProgress(protocol, result);
    }

    return result;
  }

  /**
   * Check Connectedness (Honda 2016, Def 2.5)
   */
  private checkConnectedness(
    protocol: GlobalProtocol,
    result: WellFormednessResult
  ): void {
    // Build communication graph
    const graph = this.buildCommunicationGraph(protocol);

    // Check each role participates
    for (const role of protocol.roles) {
      if (!graph.hasNode(role)) {
        result.connected = false;
        result.errors.push({
          property: 'connectedness',
          severity: 'error',
          message: `Role '${role}' is declared but never participates`,
        });
      }
    }
  }

  /**
   * Check Determinism
   */
  private checkDeterminism(
    protocol: GlobalProtocol,
    result: WellFormednessResult
  ): void {
    // Find all choice constructs
    const choices = this.extractChoices(protocol);

    for (const choice of choices) {
      const labels = new Set<string>();

      for (const branch of choice.branches) {
        const firstAction = this.getFirstAction(branch);
        const label = firstAction.label;

        if (labels.has(label)) {
          result.deterministic = false;
          result.errors.push({
            property: 'determinism',
            severity: 'error',
            message: `Duplicate label '${label}' in choice at ${choice.decider}`,
            location: branch.location,
          });
        }

        labels.add(label);
      }
    }
  }

  /**
   * Check No Races (Deniélou & Yoshida 2012, Theorem 4.5)
   */
  private checkNoRaces(
    protocol: GlobalProtocol,
    result: WellFormednessResult
  ): void {
    // Find all parallel constructs
    const parallels = this.extractParallels(protocol);

    for (const par of parallels) {
      const channels1 = this.extractChannels(par.branch1);
      const channels2 = this.extractChannels(par.branch2);

      // Check channel disjointness
      const intersection = this.intersect(channels1, channels2);

      if (intersection.size > 0) {
        result.raceFree = false;
        for (const channel of intersection) {
          result.errors.push({
            property: 'races',
            severity: 'error',
            message: `Race condition on channel ${channel}`,
            location: par.location,
          });
        }
      }
    }
  }

  /**
   * Check Progress (Honda 2016, Theorem 5.10)
   */
  private checkProgress(
    protocol: GlobalProtocol,
    result: WellFormednessResult
  ): void {
    // Build state space
    const stateSpace = this.buildStateSpace(protocol);

    // Find stuck states
    const stuckStates = stateSpace.states.filter(state =>
      !state.isTerminal && state.enabledTransitions.length === 0
    );

    if (stuckStates.length > 0) {
      result.hasProgress = false;
      for (const state of stuckStates) {
        result.errors.push({
          property: 'progress',
          severity: 'error',
          message: `Deadlock detected at state ${state.id}`,
        });
      }
    }
  }
}
```

---

## 11. References

### Primary Papers

1. **Honda, Yoshida, Carbone (JACM 2016)**
   - Title: "Multiparty Asynchronous Session Types"
   - **Connectedness**: Definition 2.5, Theorem 3.8
   - **Progress**: Theorem 5.10
   - **Proof**: Appendix C

2. **Deniélou, Yoshida (ESOP 2012)**
   - Title: "Multiparty Session Types Meet Communicating Automata"
   - **No Race**: Theorem 4.5
   - **CFSM Verification**: Section 4

### Related Work

3. **Lange, Tuosto, Yoshida (2015)**: "From Communicating Machines to Graphical Choreographies"
   - Verification algorithms for MPST

4. **Yoshida, Vasconcelos (2007)**: "Language Primitives and Type Discipline for Structured Communication-Based Programming"
   - Binary session type well-formedness

---

## 12. Future Work

### For SMPST IDE

**Phase 1: Basic Checkers**
- Implement connectedness checker (communication graph)
- Implement determinism checker (label uniqueness)
- Implement race detector (channel disjointness)

**Phase 2: Progress Verification**
- Build state space explorer
- Implement deadlock detection
- Optimize with partial order reduction

**Phase 3: Integration**
- Wire into verification layer (Layer 3)
- Show diagnostics in UI
- Generate well-formedness reports

---

## 13. Formal Property Tests

### Property 1: Connectedness

$$
\forall (p \to q : \ell) \in \text{actions}(G), \quad \exists \text{path} \; p \rightsquigarrow q
$$

### Property 2: Determinism

$$
\forall \text{choice } p \to q : \{ \ell_i(G_i) \}, \quad \ell_i \neq \ell_j \text{ for } i \neq j
$$

### Property 3: No Races

$$
G_1 \mid G_2 \implies \mathrm{channels}(G_1) \cap \mathrm{channels}(G_2) = \emptyset
$$

### Property 4: Progress (Theorem 5.10)

$$
\text{Well-formed } G \implies \text{Progress}(G)
$$

---

## 14. Conclusion

### Summary

✅ **Theory Well-Defined**:
- Four formal well-formedness properties
- Decidability results for each property
- Progress theorem (Theorem 5.10)

❓ **Implementation Status**:
- Need to verify what's implemented
- Likely need explicit well-formedness checker layer

### Practical Impact

**Enables**:
- Static protocol verification
- Early error detection (before runtime)
- Correctness guarantees (deadlock-freedom)
- Safe protocol composition

### Implementation Priority

**Priority**: 🔴 **HIGH** (foundational for correctness)

**Rationale**:
- Core safety guarantees depend on this
- Relatively straightforward to implement
- High impact on user confidence

---

**Document Status**: Complete
**Last Updated**: 2025-11-13
**Next Steps**: Verify current implementation, create well-formedness checker

