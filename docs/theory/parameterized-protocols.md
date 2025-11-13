# Parameterized Protocols (Pabble) - Formal Theory

**Date**: 2025-11-13
**Source**: Perplexity synthesis + Hu et al. 2014 + Castro et al. 2016
**Status**: Theory documentation - Not Implemented

---

## 1. Overview

### What is Pabble?

**Pabble** (Parameterized Scribble) extends Scribble to support **variable-sized participant sets**.

**Key Feature**: Roles parameterized by index variables from finite domains.

**Use Cases**:
- Map-reduce protocols (variable number of workers)
- Leader election (N candidates)
- Broadcast/multicast (dynamic participant lists)
- Consensus protocols (flexible quorum sizes)

---

## 2. Type System

### Syntax with Indices/Parameters

**Index Variables**: $$i, j, k, \ldots$$ from index domains $$I \subseteq \mathbb{N}$$

**Parameterized Roles**:
$$
\text{role } p(i) \text{ where } i \in I
$$

**Example**:
```
role Worker(i) where i ∈ [1, N]
```

**Indexed Interactions**:
$$
p(i) \to q(j) : \langle U \rangle; \quad G(i,j)
$$

**Example**:
```scribble
Worker(i) -> Coordinator: Result(Int);
where i ∈ [1, N]
```

---

### Typing Judgments

Extended typing judgments include index contexts:

$$
\Gamma \vdash G : \mathbf{ok}
$$

Where $$\Gamma$$ includes:
- Index domains: $$i \in [1, N]$$
- Constraints: $$i \neq j$$, $$i < j$$, etc.

**Example Judgment**:
```
Γ = {N: ℕ, i ∈ [1,N], j ∈ [1,N], i ≠ j}
──────────────────────────────────────────
Γ ⊢ Worker(i) -> Worker(j): Msg() : ok
```

---

### Index Domains and Constraints

**Finite Domains**: $$I = [1, N]$$ where $$N$$ is bounded

**Constraints**:
- $$i \neq j$$ (distinct participants)
- $$i < j$$ (ordered pairs)
- $$i \equiv k \mod m$$ (modular arithmetic)

**Example Protocol**:
```pabble
protocol RingTopology(role Node(i) where i ∈ [1, N]) {
  Node(i) -> Node((i+1) mod N): Token();
  where i ∈ [1, N]
}
```

---

## 3. Projection Theorem

### Theorem (Hu et al. 2014, Theorem 4.1)

**Statement**: For any well-typed parameterized global protocol $$G$$:

$$
\forall i \in I: \quad \downarrow_{p(i)}(G) \text{ is well-formed}
$$

and projection **preserves typing and protocol semantics** under index substitution.

---

### Key Technical Challenges

1. **Infinite/Large Role Sets**: Parameters may generate many role instances
2. **Index Substitution**: Must carefully track index constraints during projection
3. **Scoping**: Index variables must be properly scoped

---

### Proof Sketch

**By structural induction** on protocol syntax:

**Base Case**: Single parameterized interaction
- Project $$p(i) \to q(j): m$$ to each $$p(k)$$ where $$k \in I$$
- For $$k = i$$: send action
- For $$k = j$$: receive action
- Otherwise: tau-eliminated

**Inductive Case**: Compositional structures
- Projection distributes over choice, parallel, recursion
- Index constraints preserved through projection

**Substitution Correctness**:
- Unfolding parameters respects typing constraints
- Role uniqueness maintained under instantiation

**Citation**: Hu et al. (2014), §4, Theorem 4.1

---

### Properties Preserved

1. **Well-formedness**: Projection respects role uniqueness
2. **Safety**: No communication errors even with parameters
3. **Liveness**: Deadlock-freedom preserved under parameterization
4. **Communication Patterns**: Topology consistency across instances

---

## 4. Decidability

### The Challenge

**Problem**: General parameterization with unrestricted recursion leads to **undecidability**.

**Reason**: Infinite state space or unbounded participants may encode Turing-complete behaviors.

---

### Undecidability Results

**Theorem (Castro et al. 2016)**:

For **unrestricted** parameterized protocols:
- Protocol well-formedness: **UNDECIDABLE**
- Projection correctness: **UNDECIDABLE**

**Proof Intuition**: Reduction from halting problem.

---

### Restrictions Restoring Decidability

**Theorem (Castro et al. 2016, Theorem 6.2)**: Under the following restrictions, well-formedness and projection are **DECIDABLE**:

1. **Finite Index Domains**: $$|I| < \infty$$ and bounded
2. **Guarded Recursion**: Recursion must be guarded to prevent infinite unrolling
3. **Syntactic Constraints**: Disallow arbitrary parameter manipulation (e.g., no unbounded arithmetic)

**Citation**: Castro et al. (2016), §6, Theorem 6.2

---

### Practical Decidability

**For realistic protocols**:
- Bound index domains (e.g., $$N \leq 1000$$)
- Use well-founded recursion
- Avoid complex index expressions

**Result**: ✅ **Decidable** with reasonable performance

---

## 5. Intuition and Examples

### Why Parameterization?

**Without Pabble**:
```scribble
// Hard-coded for 3 workers
protocol MapReduce3(role Master, role W1, role W2, role W3) {
  Master -> W1: Task();
  Master -> W2: Task();
  Master -> W3: Task();
  W1 -> Master: Result();
  W2 -> Master: Result();
  W3 -> Master: Result();
}
```

**With Pabble**:
```pabble
protocol MapReduce(
  role Master,
  role Worker(i) where i ∈ [1, N]
) {
  Master -> Worker(i): Task();  // Broadcast to all workers
  where i ∈ [1, N]

  Worker(i) -> Master: Result();  // Gather from all workers
  where i ∈ [1, N]
}
```

**Advantages**:
- Single protocol for any $$N$$
- Modular and reusable
- Type-safe for all $$N$$

---

### Role Parameter vs Role Argument

**Role Parameter**: Schema with index variable
```
role Worker(i)  // Parameter i is abstract
```

**Role Argument**: Instantiated with concrete value
```
Worker(3)  // Worker instance #3
```

**Analogy**: Like function parameters vs arguments in programming.

---

### Main Implementation Challenge

**Challenge**: Handling **large/infinite role sets** efficiently.

**Solutions**:
1. **Symbolic Representation**: Don't enumerate all instances
2. **Lazy Projection**: Project on-demand for specific indices
3. **Bounded Unrolling**: Limit instantiation depth for verification

---

## 6. Concrete Examples

### Example 1: Broadcast

```pabble
protocol Broadcast(
  role Sender,
  role Receiver(i) where i ∈ [1, N]
) {
  Sender -> Receiver(i): Message();
  where i ∈ [1, N]
}
```

**Projection to Sender**:
```
!Receiver(1).Message()
!Receiver(2).Message()
...
!Receiver(N).Message()
```

**Projection to Receiver(k)**:
```
?Sender.Message()
```

---

### Example 2: All-to-All Communication

```pabble
protocol AllToAll(role Node(i) where i ∈ [1, N]) {
  Node(i) -> Node(j): Data();
  where i ∈ [1, N], j ∈ [1, N], i ≠ j
}
```

**Semantics**: Each node sends to every other node.

**Projection to Node(k)**:
```
// Send to all others
!Node(1).Data() (if k ≠ 1)
!Node(2).Data() (if k ≠ 2)
...
!Node(N).Data() (if k ≠ N)

// Receive from all others
?Node(1).Data() (if k ≠ 1)
?Node(2).Data() (if k ≠ 2)
...
?Node(N).Data() (if k ≠ N)
```

---

### Example 3: Leader Election (Ring)

```pabble
protocol RingElection(role Node(i) where i ∈ [1, N]) {
  rec Loop {
    Node(i) -> Node((i mod N) + 1): ID(Int);
    where i ∈ [1, N]

    choice at Node((i mod N) + 1) {
      // If ID > myID, continue
      continue Loop;
    } or {
      // If ID ≤ myID, become leader
      Node((i mod N) + 1) -> Node(i): Leader();
    }
  }
}
```

---

## 7. Implementation Considerations

### Current SMPST IDE Status

**Not implemented**:
- ❌ Parameterized role syntax
- ❌ Index domain constraints
- ❌ Symbolic projection
- ❌ Bounded unrolling

**What's needed**:
1. **Parser Extension**: Parse `role Worker(i) where i ∈ [1, N]`
2. **Type System**: Track index contexts
3. **Projection**: Handle parameterized roles
4. **Verification**: Check decidability constraints

---

### Design Sketch

```typescript
interface ParameterizedRole {
  name: string;
  parameters: IndexParameter[];
  domain: IndexDomain;
}

interface IndexParameter {
  name: string;  // e.g., "i"
  domain: IndexDomain;
  constraints: Constraint[];  // e.g., i ≠ j, i < N
}

interface IndexDomain {
  type: 'finite' | 'bounded';
  range: [number, number];  // e.g., [1, N]
}

class ParameterizedProjector {
  /**
   * Project parameterized protocol to concrete role instance
   */
  projectParameterized(
    globalProtocol: ParameterizedGlobalType,
    role: string,
    indices: Map<string, number>  // e.g., {i: 3}
  ): LocalType {
    // Substitute indices and project
  }
}
```

---

### Testing Strategy

```typescript
describe('Parameterized Protocols (Pabble)', () => {
  it('should parse parameterized roles', () => {
    const source = `
      protocol Broadcast(
        role Sender,
        role Receiver(i) where i in [1, 5]
      ) {
        Sender -> Receiver(i): Msg();
      }
    `;
    // Parse and verify parameterized role syntax
  });

  it('should project broadcast to all receivers', () => {
    // Project to Sender: should have 5 sends
    // Project to Receiver(3): should have 1 receive
  });

  it('should handle index constraints (i ≠ j)', () => {
    // Test all-to-all with i ≠ j constraint
  });

  it('should detect undecidability (unbounded recursion)', () => {
    // Protocol with unbounded parameter recursion
    // Should reject or warn
  });
});
```

---

## 8. Relationship to Other Features

### Parameterization + Sub-Protocols

```pabble
protocol Auth(role Client, role Server) {
  Client -> Server: Login();
  Server -> Client: Token();
}

protocol MultiAuth(
  role Coordinator,
  role Client(i) where i ∈ [1, N]
) {
  do Auth(Client(i), Coordinator);
  where i ∈ [1, N]
}
```

**Challenge**: Combining parameterized roles with sub-protocol role mapping.

---

### Parameterization + Recursion

```pabble
protocol CountDown(role Counter(i) where i ∈ [1, N]) {
  rec Loop {
    Counter(i) -> Counter(i-1): Dec();
    where i > 1

    choice at Counter(1) {
      continue Loop;
    } or {
      Counter(1) -> Counter(N): Done();
    }
  }
}
```

**Challenge**: Index-dependent recursion patterns.

---

## 9. References

### Primary Papers

1. **Hu et al. (2014)**
   - Title: "Pabble: parameterised Scribble"
   - Published: Service Oriented Computing and Applications
   - **Type system and indexing**: §3-4
   - **Projection theorem**: Theorem 4.1
   - **Decidability constraints**: §5

2. **Castro et al. (2016)**
   - Title: "Parameterised Multiparty Session Types"
   - Published: LMCS (Logical Methods in Computer Science)
   - **Dependent types for sessions**: §3-5
   - **Projection and decidability**: Theorem 6.2
   - **Undecidability results**: §6

### Related Work

3. **Deniélou, Yoshida (2013)**: "Multiparty Compatibility in Communicating Automata"
   - Dynamic role sets

4. **Scalas, Yoshida (2019)**: "Less is More: Multiparty Session Types Revisited"
   - Simplified parameterization

---

## 10. Future Work

### For SMPST IDE

**Phase 1: Basic Parameterization**
- Parse parameterized role syntax
- Finite index domains
- Simple projection (enumerate instances)

**Phase 2: Symbolic Handling**
- Symbolic projection (don't enumerate)
- Constraint solving for index expressions
- Decidability checking

**Phase 3: Advanced Features**
- Parameterized sub-protocols
- Index-dependent recursion
- Optimization for large N

---

## 11. Formal Property Tests

### Property 1: Projection Soundness

**For all parameterized protocols**:
$$
\forall i \in I: \quad \downarrow_{p(i)}(G) \text{ well-formed}
$$

### Property 2: Decidability Bounds

**With finite domains**:
$$
|I| < \infty \implies \text{projection decidable}
$$

### Property 3: Index Constraint Consistency

**Constraints preserved through projection**:
$$
i \neq j \text{ in } G \implies \text{no message } p(i) \to p(i)
$$

---

## 12. Conclusion

### Summary

✅ **Theory Well-Defined**:
- Formal parameterized syntax and semantics
- Projection theorem (Theorem 4.1)
- Decidability results (Theorem 6.2)

❌ **Not Implemented**:
- Parameterized role parsing
- Index domain tracking
- Symbolic projection
- Decidability checking

### Practical Impact

**Enables**:
- Scalable protocol specifications
- Single protocol for variable participants
- Map-reduce, broadcast, consensus protocols
- Type-safe for any N

### Implementation Priority

**Priority**: 🟢 **Lower** (nice-to-have, not blocking)

**Rationale**:
- Complex feature requiring substantial work
- Most protocols use fixed role sets
- Can work around with protocol templates

---

**Document Status**: Complete
**Last Updated**: 2025-11-13
**Next Theory Doc**: Exception Handling
