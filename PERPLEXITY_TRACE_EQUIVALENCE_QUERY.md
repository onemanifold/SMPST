# Perplexity Research Query: DMst Trace Equivalence Implementation

## Context

I'm implementing verification for Dynamically Updatable Multiparty Session Types (DMst) based on:

**Primary Paper:**
- Castro-Perez, D., & Yoshida, N. (2023). "Dynamically Updatable Multiparty Session Protocols: Generating Concurrent Go Code from Unbounded Protocols." ECOOP 2023, Article 8.
- DOI: 10.4230/LIPIcs.ECOOP.2023.8

**Foundation Papers:**
- Honda, K., Yoshida, N., & Carbone, M. (2008). "Multiparty Asynchronous Session Types." POPL 2008.
- Deniélou, P.-M., & Yoshida, N. (2012). "Multiparty Session Types Meet Communicating Automata." ESOP 2012.

## Implementation Details

We represent:
- **Global protocols** as Control Flow Graphs (CFGs) with nodes for actions (messages, choices, recursion)
- **Local projections** as Communicating Finite State Machines (CFSMs) with transitions labeled by send/receive actions
- **Projection** follows standard session type projection (Honda et al. 2008), extended for dynamic participants

## Specific Technical Questions

### Q1: Trace Semantics - Single Trace vs Trace Sets

**Question:** In Castro-Perez & Yoshida (ECOOP 2023), Theorem 20 states trace equivalence as:

```
traces(G) ≈ compose(traces([[G]]_r) for all r)
```

The plural "traces" suggests **sets of traces**. However, practical verification needs concrete algorithms.

**Specific sub-questions:**
1. Does `traces(G)` denote:
   - A **single canonical trace** (deterministic semantics)?
   - A **set of all possible execution traces** (non-deterministic semantics)?
   - A **representative trace** from each equivalence class?

2. How do Castro-Perez & Yoshida actually **implement/verify** trace equivalence in their Go code generation tool?
   - Do they extract all possible traces (exponential complexity)?
   - Do they use symbolic execution or abstraction?
   - Do they check a single representative trace with deterministic branch selection?

3. For protocols with choices like:
```
choice at A {
  A -> B: Left();
} or {
  A -> B: Right();
}
```
Does trace equivalence require checking **both branches** or just ensuring **any valid trace** can be realized?

### Q2: Branch Ordering in CFSM Projection

**Question:** When projecting a choice to a CFSM, the resulting automaton has multiple outgoing transitions from the choice state.

**Our observation:** The CFSM transition array order depends on:
- Source code order of choice branches
- Implementation details of graph traversal during projection
- No semantic metadata about which transition corresponds to which branch

**Specific sub-questions:**
1. In Deniélou & Yoshida (2012) "Multiparty Session Types Meet Communicating Automata":
   - Are CFSMs **deterministic** or **non-deterministic**?
   - Does the formal model impose any **canonical ordering** on transitions from a choice state?
   - How is **choice selection** represented: internal choice vs external choice?

2. For internal choice at role A (A makes the decision), the projected CFSMs should satisfy:
   - [[G]]_A has **sending transitions** for each branch
   - [[G]]_B (other roles) have **receiving transitions** or **tau transitions**

   Does the formal model require that **all roles take the same branch** in a valid trace, and if so, how is this coordination proven?

3. When extracting a local trace from a CFSM with multiple outgoing transitions, is there a **formal criterion** for which transition to follow? Or is the model based on **trace containment** (all executions are valid)?

### Q3: Updatable Recursion and Trace Depth

**Question:** For updatable recursion like:
```
rec X { G; continue X with { G_update } }
```

Castro-Perez & Yoshida discuss **unbounded protocols** and **1-unfolding** (Definition 14).

**Specific sub-questions:**
1. For trace equivalence verification:
   - Should we unfold recursion to a **fixed depth** (e.g., k=10 iterations)?
   - Is there a **coinductive definition** that avoids enumerating all traces?
   - Do Castro-Perez & Yoshida use **symbolic traces** or **regular expressions** to represent infinite trace sets?

2. For a Manager creating Workers in a loop, the global trace has events like:
```
create(w1), invite(w1), msg(Manager, w1, Task), msg(w1, Manager, Result),
create(w2), invite(w2), msg(Manager, w2, Task), msg(w2, Manager, Result),
...
```

The local projection [[G]]_Manager has states/transitions for this pattern.

**How do we ensure** that extracting the Manager's local trace follows the **same number of iterations** as the global trace? Is this:
- Guaranteed by the projection preserving trace structure?
- Something we must check explicitly?
- Irrelevant because we check trace set containment, not exact equivalence?

### Q4: DMst Synchronization Events

**Question:** DMst introduces `create` and `invite` as synchronization events (not standard messages).

In our implementation:
- Global traces include: `participant-creation`, `invitation`, `message`, `update`
- Local projections have: `send`, `receive`, `subprotocol-call`, `tau`

**Our hypothesis:** Creates/invites are **global synchronization primitives** that don't appear in local CFSM transitions, similar to how multicast synchronization is handled.

**Specific sub-questions:**
1. In Castro-Perez & Yoshida (ECOOP 2023), Section 3.2 (Projection of DMst):
   - How are `create` and `invite` projected to CFSMs?
   - Do they become **tau transitions**?
   - Do they become **special actions** in the CFSM alphabet?

2. For trace equivalence, should we:
   - **Filter out** creates/invites from global traces before comparing?
   - **Include** creates/invites as special events in local traces?
   - Compare only the **communication skeleton** (messages only)?

### Q5: Practical Implementation in Existing Tools

**Question:** Are there **open-source implementations** of trace equivalence checking for session types?

**Specific sub-questions:**
1. Does the Scribble protocol language/toolchain implement trace equivalence checking? If so, what algorithm does it use?

2. Does the Go code generator from Castro-Perez & Yoshida (2023) include verification? Is the source code available?

3. Are there other session type verification tools (like Session Types for Rust, Session-Ocaml, etc.) that implement similar checks we could reference?

### Q6: Our Specific Failure Case

**Question:** We have a test failing with:
- Global trace: 99 events (10 recursion iterations)
- Local composed trace: 4 events (1 iteration only)

The protocol is Pipeline with updatable recursion. The Manager CFSM has:
```
State s3 (choice point):
  Transition [0]: send Done to w1 → terminal
  Transition [1]: send Task to w_new → recursion
```

**Our current heuristic:** Prioritize transitions to non-terminal states to favor recursion.

**Question:** In the formal model, when both transitions are valid:
- Is there a **canonical choice** we should make?
- Should we be checking **all possible traces** instead of one?
- How do Castro-Perez & Yoshida resolve this in their implementation?

---

## Summary of What We Need

**Most Important:**
1. **Definitive answer** on single trace vs trace set semantics in Theorem 20
2. **Implementation guidance** from existing tools (Scribble, Castro-Perez's Go tool, etc.)
3. **Formal semantics** of CFSM transition ordering and choice coordination

**Secondary:**
4. How DMst synchronization events (create/invite) are handled in trace equivalence
5. Whether our heuristic approach (representative trace with deterministic branch selection) is sound

---

## Desired Output Format

Please provide:
1. **Direct quotes** from the papers addressing these questions
2. **Citations** to specific sections/theorems/definitions
3. **Algorithmic details** if described in the papers
4. **References** to open-source implementations if available
5. **Expert analysis** of whether our approach is sound or needs fundamental changes
