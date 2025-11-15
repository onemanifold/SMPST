# Research Query Variants for Different Tools

## For Perplexity AI (General Research)

```
I'm implementing trace equivalence verification (Theorem 20) from Castro-Perez & Yoshida's "Dynamically Updatable Multiparty Session Protocols" (ECOOP 2023, DOI: 10.4230/LIPIcs.ECOOP.2023.8).

Key questions:
1. Does "traces(G)" in Theorem 20 mean a single trace or a SET of all possible traces?
2. How do Castro-Perez & Yoshida actually IMPLEMENT trace equivalence in their Go code generator?
3. In Deniélou & Yoshida 2012 "Multiparty Session Types Meet Communicating Automata", are CFSMs deterministic or non-deterministic for choice projection?
4. For DMst synchronization events (create/invite), how are they projected and compared in trace equivalence?
5. Are there open-source implementations of session type trace equivalence I can reference?

Please cite specific sections from papers and implementation details if available.
```

## For Google Scholar / Semantic Scholar (Paper Search)

Search queries:
```
1. "trace equivalence" "multiparty session types" implementation
2. Castro-Perez Yoshida ECOOP 2023 implementation
3. "CFSM projection" "choice" "branch ordering" session types
4. Scribble protocol verification trace equivalence
5. "communicating automata" "session types" deterministic
```

## For arXiv (Preprints with Implementation Details)

```
Search: session types trace equivalence verification algorithm
Filter: cs.PL (Programming Languages)
Look for: technical reports with implementation sections
```

## For GitHub Code Search

```
1. repo:sessiontypes language:Go "trace equivalence"
2. repo:scribble-protocol/scribble "verify" "trace"
3. "multiparty session types" "projection" language:Haskell OR language:OCaml
4. Castro-Perez OR "dmst" OR "dynamic session types"
```

## For Specific Tools Documentation

### Scribble Protocol
```
Search in: http://www.scribble.org/documentation
Keywords: "verification", "trace", "equivalence", "projection"
Look for: How Scribble verifies protocol correctness
```

### Session Java
```
Search in: https://github.com/sessionj/sessionj
Keywords: "monitor", "trace", "runtime verification"
```

## Key Papers to Deep-Dive

### Primary (Must Read Sections):
1. **Castro-Perez & Yoshida ECOOP 2023**
   - Section 3.2: Projection of DMst
   - Section 4: Semantics and Trace Equivalence
   - Theorem 20: Trace Equivalence statement
   - Section 6: Implementation (Go code generation)

2. **Deniélou & Yoshida ESOP 2012**
   - Section 3: From Global Types to CFSMs
   - Definition of CFSM (deterministic vs non-deterministic)
   - Theorem on projection correctness

3. **Honda, Yoshida, Carbone POPL 2008**
   - Section 4: Projection
   - Theorem 3.1: Soundness of projection

### Secondary (For Implementation):
4. **Neykova et al. "Session Types Go Mainstream" (may exist)**
   - Scribble implementation details

5. **Scalas & Yoshida "Less is More" ECOOP 2016**
   - Practical session type implementation in Scala

## Expert Contacts (If Needed)

- Nobuko Yoshida (Imperial College London) - co-author on all key papers
- David Castro-Perez (Imperial → Kent) - lead author on ECOOP 2023
- Raymond Hu (worked on Scribble implementation)

## Stack Overflow / Research Communities

Post on:
- CSTheory StackExchange (theoretical aspects)
- PL research mailing lists
- Session Types community group

Question template:
```
How is trace equivalence (Theorem 20 in Castro-Perez & Yoshida ECOOP 2023)
implemented in practice for multiparty session types?

Specifically: does "traces(G)" mean extracting all possible execution traces
(exponential) or a representative trace? How do existing tools like Scribble
handle choice/branch ordering in CFSM projection?

Context: Implementing DMst verification, need to know if single-trace checking
with deterministic branch selection is sound or if we need trace set semantics.
```

---

## Quick Reference: What We Need to Know

**Critical (Blocks Implementation):**
1. Single trace vs trace set - which does Theorem 20 require?
2. How are CFSM transitions ordered after projection?
3. How do existing tools (Scribble, Go generator) implement this?

**Important (Affects Correctness):**
4. Are DMst creates/invites in trace comparison?
5. How is recursion unfolding depth determined?

**Nice to Have (Optimization):**
6. Symbolic/abstract trace representations
7. Optimized trace equivalence algorithms
