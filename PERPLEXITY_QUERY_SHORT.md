# Condensed Perplexity Query (Copy-Paste Ready)

I'm implementing trace equivalence verification (Theorem 20) from Castro-Perez & Yoshida's "Dynamically Updatable Multiparty Session Protocols" (ECOOP 2023). I have specific technical questions:

## Q1: Trace Set Semantics
Theorem 20 states: `traces(G) ≈ compose(traces([[G]]_r) for all r)`

Does "traces(G)" mean:
- A single canonical trace?
- A set of all possible execution traces?
- How do Castro-Perez & Yoshida actually implement/verify this in their Go code generator?

For a choice protocol with branches, must we verify equivalence for ALL branches or just ensure any valid trace can be realized?

## Q2: CFSM Branch Ordering
When projecting a global choice to a CFSM, the resulting automaton has multiple outgoing transitions.

In Deniélou & Yoshida 2012 "Multiparty Session Types Meet Communicating Automata":
- Are CFSMs deterministic or non-deterministic?
- Is there a canonical ordering on transitions from a choice state?
- When extracting a trace from a CFSM with multiple outgoing transitions, which transition should we follow?

## Q3: DMst Synchronization Events
DMst introduces `create` and `invite` as synchronization events. In ECOOP 2023 Section 3.2:
- How are create/invite projected to CFSMs?
- For trace equivalence, should we filter creates/invites from global traces before comparing?

## Q4: Our Specific Failure
We extract one representative trace using DFS with "take first branch" heuristic. Tests fail with:
- Global trace: 99 events (10 recursion iterations)
- Composed local trace: 4 events (1 iteration)

The local CFSM has two transitions from a choice state (terminate vs continue recursion). Our heuristic picks the wrong branch.

**Question:** Is single representative trace checking sound for Theorem 20, or must we check all possible traces (trace set containment)?

## Q5: Existing Implementations
Are there open-source tools that implement trace equivalence for session types? (Scribble, Session-Rust, Castro-Perez's Go generator?) What algorithms do they use?

---

Please cite specific sections from Castro-Perez & Yoshida ECOOP 2023, Honda et al. POPL 2008, and Deniélou & Yoshida ESOP 2012 that address these questions.
