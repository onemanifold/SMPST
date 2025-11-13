# LTS Operational Semantics - Formal Theory

**Date**: 2025-11-13
**Source**: Honda, Yoshida, Carbone (JACM 2016) + Existing project documentation synthesis
**Status**: Theory documentation - Foundation

---

## 1. Overview

### What are Operational Semantics?

**Operational semantics** define how protocols **execute** via **reduction rules** (also called transition rules or inference rules).

**Key Components**:
1. **Configurations**: `⟨G, σ⟩` - protocol state + runtime state
2. **Transition relation**: `⟨G, σ⟩ --[α]→ ⟨G', σ'⟩`
3. **Action labels**: What actions appear on transitions
4. **Reduction rules**: Formal rules governing transitions

**Purpose**: Provide **precise** semantics for protocol execution.

---

## 2. Configuration Syntax

### Global Configuration

A **global configuration** is a pair:

$$
\langle G, \sigma \rangle
$$

Where:
- **G**: Current global type (protocol state)
- **σ**: Runtime state (buffers, environments)

**Runtime State σ**:
$$
\sigma = \langle B, \Gamma \rangle
$$

- **B**: Message buffers (FIFO queues per channel)
  - $B: (p, q) \mapsto \text{Queue}[\text{Message}]$
  - Maps sender-receiver pair to message queue

- **Γ**: Environment (recursion variable bindings)
  - $\Gamma: \text{Var} \mapsto \text{GlobalType}$
  - Maps recursion variables to protocol definitions

---

### Local Configuration

A **local configuration** for role **p** is:

$$
\langle T_p, B_p \rangle
$$

Where:
- **T_p**: Local type for role p
- **B_p**: Local buffer state for p
  - $B_p: \text{Role} \mapsto \text{Queue}[\text{Message}]$
  - Maps sender roles to incoming message queues

---

## 3. Action Labels

### Action Syntax

Actions **α** that appear on transitions:

$$
\alpha ::= p \to q : \ell \mid p \to q : \ell! \mid p \leftarrow q : \ell \mid \tau
$$

**Types**:
1. **Send (synchronous view)**: $p \to q : \ell$
   - Role p sends label ℓ to role q

2. **Send (asynchronous)**: $p \to q : \ell!$
   - Message ℓ enqueued to buffer $Q_{p \to q}$

3. **Receive**: $p \leftarrow q : \ell$
   - Role p receives label ℓ from queue $Q_{q \to p}$

4. **Tau (silent)**: $\tau$
   - Internal action, no external effect

---

### LTS Action Notation

In **Labeled Transition Systems** (used in projection):

- **Send**: $!q\langle \ell \rangle$ (role sends ℓ to q)
- **Receive**: $?p\langle \ell \rangle$ (role receives ℓ from p)
- **Internal choice**: $\oplus \{ \ell_1, \ell_2, \ldots \}$
- **External choice**: $\& \{ \ell_1, \ell_2, \ldots \}$
- **Silent**: $\tau$

**Example**:
```
s0 --[!B⟨Request⟩]--> s1 --[?B⟨Response⟩]--> s2
```

---

## 4. Reduction Rules (Global Protocols)

### Rule 1: Message Transfer (Asynchronous)

**Syntax**: $G = p \to q : \ell\langle T \rangle.G'$

**Reduction Rule**:

$$
\frac{
  G = p \to q : \ell\langle T \rangle.G'
}{
  \langle G, B \rangle \xrightarrow{p \to q : \ell!} \langle G', B' \rangle
}
$$

**Where**: $B' = B[(p,q) \mapsto Q_{p \to q} \cdot \ell]$

**Meaning**:
- Enqueue message ℓ to buffer $Q_{p \to q}$
- Protocol continues as $G'$
- **Asynchronous**: Send does not block

---

### Rule 2: Message Receive (From Buffer)

**Consumption Rule**:

$$
\frac{
  Q_{p \to q} = \ell \cdot Q_{\text{rest}}
}{
  \langle T_q, B \rangle \xrightarrow{q \leftarrow p : \ell} \langle T_q', B' \rangle
}
$$

**Where**: $B' = B[(p,q) \mapsto Q_{\text{rest}}]$

**Meaning**:
- Message ℓ must be at **head** of queue (FIFO)
- Dequeue ℓ from buffer
- Protocol continues with ℓ consumed

---

### Rule 3: Choice Selection

**Syntax**:
$$
G = \text{choice at } p \{ \ell_1 : G_1 \;\text{or}\; \ell_2 : G_2 \;\text{or}\; \ldots \}
$$

**Reduction Rule**:

$$
\frac{
  G = \text{choice at } p \{ \ldots, \ell_i : G_i, \ldots \}
}{
  \langle G, \sigma \rangle \xrightarrow{\tau} \langle G_i, \sigma \rangle
}
$$

**Meaning**:
- Role p **internally** selects branch i
- Protocol continues as $G_i$
- Silent transition (no external communication yet)

**Note**: First message after choice reveals selection to other roles.

---

### Rule 4: Parallel Fork

**Syntax**: $G = G_1 \mid G_2$

**Reduction Rule (Interleaving)**:

$$
\frac{
  \langle G_1, \sigma \rangle \xrightarrow{\alpha} \langle G_1', \sigma' \rangle
}{
  \langle G_1 \mid G_2, \sigma \rangle \xrightarrow{\alpha} \langle G_1' \mid G_2, \sigma' \rangle
}
$$

**Symmetric rule** for $G_2$ stepping.

**Meaning**:
- Branches execute **concurrently**
- **Interleaving semantics**: one step at a time
- Both branches can make progress independently

---

### Rule 5: Recursion Entry

**Syntax**: $G = \mu X.G'$

**Reduction Rule (Unfolding)**:

$$
\frac{
  G = \mu X.G'
}{
  \langle \mu X.G', \Gamma \rangle \xrightarrow{\tau} \langle G'[X := \mu X.G'], \Gamma[X \mapsto \mu X.G'] \rangle
}
$$

**Meaning**:
- **Unfold** recursion by substituting $X$ with $\mu X.G'$
- Register binding in environment $\Gamma$
- Continue with body $G'$

---

### Rule 6: Continue (Recursion Loop)

**Syntax**: $G = \text{continue } X$

**Reduction Rule**:

$$
\frac{
  \Gamma(X) = \mu X.G'
}{
  \langle \text{continue } X, \Gamma \rangle \xrightarrow{\tau} \langle G', \Gamma \rangle
}
$$

**Meaning**:
- Jump back to recursion body
- Lookup $X$ in environment $\Gamma$
- Continue with body $G'$

---

## 5. Reduction Rules (Local Protocols)

### Send Action

**Syntax**: $T = q!⟨\ell⟩.T'$

**Reduction Rule**:

$$
\frac{
  T = q!⟨\ell⟩.T'
}{
  \langle T, B \rangle \xrightarrow{!q⟨\ell⟩} \langle T', B \rangle
}
$$

**Meaning**:
- Send ℓ to role q
- **Asynchronous**: Send always enabled
- Local buffer unchanged (message goes to q's buffer)

---

### Receive Action

**Syntax**: $T = p?⟨\ell⟩.T'$

**Reduction Rule**:

$$
\frac{
  T = p?⟨\ell⟩.T' \quad Q_p = \ell \cdot Q_{\text{rest}}
}{
  \langle T, B \rangle \xrightarrow{?p⟨\ell⟩} \langle T', B[(p \mapsto Q_{\text{rest}})] \rangle
}
$$

**Meaning**:
- Receive ℓ from role p's queue
- **Blocking**: Only enabled if ℓ at head of $Q_p$
- Dequeue ℓ from buffer

---

### Internal Choice

**Syntax**: $T = p \oplus \{ \ell_1 : T_1, \ell_2 : T_2, \ldots \}$

**Reduction Rule**:

$$
\frac{
  T = p \oplus \{ \ldots, \ell_i : T_i, \ldots \}
}{
  \langle T, B \rangle \xrightarrow{!p⟨\ell_i⟩} \langle T_i, B \rangle
}
$$

**Meaning**:
- **Internal choice**: This role decides
- Select branch i, send $\ell_i$ to p
- Continue with $T_i$

---

### External Choice

**Syntax**: $T = p \& \{ \ell_1 : T_1, \ell_2 : T_2, \ldots \}$

**Reduction Rule**:

$$
\frac{
  T = p \& \{ \ldots, \ell_i : T_i, \ldots \} \quad Q_p = \ell_i \cdot Q_{\text{rest}}
}{
  \langle T, B \rangle \xrightarrow{?p⟨\ell_i⟩} \langle T_i, B[(p \mapsto Q_{\text{rest}})] \rangle
}
$$

**Meaning**:
- **External choice**: Role p decides
- Wait for message $\ell_i$ from p
- Branch determined by which ℓ received

---

## 6. FIFO Buffer Semantics

### Buffer Operations

**Enqueue** (on send):
$$
B[(p,q) \mapsto Q_{p \to q} \cdot m]
$$
- Append message m to **tail** of queue

**Dequeue** (on receive):
$$
B[(p,q) \mapsto Q_{\text{rest}}] \quad \text{where } Q_{p \to q} = m \cdot Q_{\text{rest}}
$$
- Remove message m from **head** of queue

---

### FIFO Property (Theorem 5.3, Honda 2016)

**Statement**:
$$
\forall (m_i, m_j) \in Q_{p \to q}: \quad i < j \implies \text{receive}(m_i) \prec \text{receive}(m_j)
$$

**Meaning**: Messages received in **send order**.

**Guarantee**: FIFO queues + asynchronous semantics → causal delivery.

---

## 7. Well-Formed Execution

### Progress Property

**Definition**: A configuration `⟨G, σ⟩` has **progress** if:
$$
\text{terminated}(G) \vee \exists G', \sigma', \alpha : \langle G, \sigma \rangle \xrightarrow{\alpha} \langle G', \sigma' \rangle
$$

**Meaning**: Either protocol finished OR some transition enabled.

**Theorem 5.10 (Honda 2016)**: Well-formed protocols have progress (deadlock-free).

---

### Termination

A protocol **terminates** when:
$$
G = \text{end}
$$

All roles reach terminal states simultaneously (global termination).

---

## 8. Examples

### Example 1: Simple Send-Receive

**Protocol**:
```scribble
A -> B: Request();
B -> A: Response();
```

**Global Type**:
$$
G = A \to B : \text{Request}.B \to A : \text{Response}.\text{end}
$$

**Execution Trace**:

1. **Initial**: $\langle G, \emptyset \rangle$

2. **Step 1** (A sends):
   $$
   \langle G, \emptyset \rangle \xrightarrow{A \to B : \text{Request}!} \langle G_1, B_1 \rangle
   $$
   - $G_1 = B \to A : \text{Response}.\text{end}$
   - $B_1 = [(A,B) \mapsto [\text{Request}]]$

3. **Step 2** (B receives):
   $$
   \langle G_1, B_1 \rangle \xrightarrow{B \leftarrow A : \text{Request}} \langle G_1, B_2 \rangle
   $$
   - $B_2 = [(A,B) \mapsto []]$ (consumed)

4. **Step 3** (B sends):
   $$
   \langle G_1, B_2 \rangle \xrightarrow{B \to A : \text{Response}!} \langle G_2, B_3 \rangle
   $$
   - $G_2 = \text{end}$
   - $B_3 = [(B,A) \mapsto [\text{Response}]]$

5. **Step 4** (A receives):
   $$
   \langle G_2, B_3 \rangle \xrightarrow{A \leftarrow B : \text{Response}} \langle \text{end}, \emptyset \rangle
   $$

**Result**: Protocol terminates successfully.

---

### Example 2: Choice

**Protocol**:
```scribble
choice at Client {
  Client -> Server: Login();
} or {
  Client -> Server: Register();
}
```

**Global Type**:
$$
G = \text{choice at Client} \{ \text{Login} : G_1 \;\text{or}\; \text{Register} : G_2 \}
$$

**Execution Trace** (Login branch):

1. **Initial**: $\langle G, \emptyset \rangle$

2. **Step 1** (Client chooses):
   $$
   \langle G, \emptyset \rangle \xrightarrow{\tau} \langle G_1, \emptyset \rangle
   $$
   - $G_1 = \text{Client} \to \text{Server} : \text{Login}.\text{end}$

3. **Step 2** (Client sends):
   $$
   \langle G_1, \emptyset \rangle \xrightarrow{\text{Client} \to \text{Server} : \text{Login}!} \langle \text{end}, B \rangle
   $$

**Alternative**: Could choose Register branch instead.

---

### Example 3: Recursion

**Protocol**:
```scribble
rec Loop {
  Client -> Server: Request();
  Server -> Client: Response();
  continue Loop;
}
```

**Global Type**:
$$
G = \mu X.(C \to S : \text{Req}.S \to C : \text{Resp}.\text{continue } X)
$$

**Execution Trace** (first iteration):

1. **Initial**: $\langle G, \emptyset \rangle$

2. **Step 1** (Unfold):
   $$
   \langle \mu X.G', \Gamma \rangle \xrightarrow{\tau} \langle G'[X := \mu X.G'], \Gamma[X \mapsto \mu X.G'] \rangle
   $$

3. **Steps 2-3** (Request/Response exchange)

4. **Step 4** (Continue):
   $$
   \langle \text{continue } X, \Gamma \rangle \xrightarrow{\tau} \langle G', \Gamma \rangle
   $$
   - Jump back to loop body

**Result**: Infinite loop (unless bounded externally).

---

## 9. Relationship to Implementation

### CFG vs LTS

**This project uses** node-labeled CFG:
- Actions on **nodes** (control points)
- Edges represent control flow

**Theory uses** edge-labeled LTS:
- Actions on **transitions** (edges)
- States are control points

**Theorem 3.1 (Deniélou & Yoshida 2012)**: CFG ↔ LTS are **behaviorally equivalent** (bisimilar).

**Implication**: Operational semantics defined for LTS **apply** to our CFG implementation.

See: `docs/theory/cfg-lts-equivalence.md`

---

### Implementation Files

**Simulation Layer**:
- `src/core/simulation/cfg-simulator.ts` - Global execution
- `src/core/simulation/cfsm-simulator.ts` - Local execution (LTS semantics)
- `src/core/simulation/distributed-simulator.ts` - Multi-role coordination

**Semantics Implemented**:
- ✅ Asynchronous send (always enabled)
- ✅ Blocking receive (FIFO consumption)
- ✅ Choice selection (internal/external)
- ✅ Parallel interleaving
- ✅ Recursion unfolding
- ✅ FIFO buffers with verification (Theorem 5.3)

---

## 10. Formal Properties

### Theorem 4.8 (Honda 2016): Causal Delivery

**Statement**: Asynchronous semantics with FIFO queues guarantee **causal delivery**:
$$
m_1 \xrightarrow{\text{causally}} m_2 \implies m_1 \text{ delivered before } m_2
$$

**Proof Sketch**:
- FIFO queues preserve send order per channel
- Causality is transitive closure of send-before
- FIFO per channel + async semantics → global causal delivery

---

### Theorem 5.3 (Honda 2016): FIFO Guarantee

**Statement**:
$$
\forall p,q, (m_i, m_j) \in Q_{p \to q}: \quad i < j \implies \text{receive}(m_i) \prec \text{receive}(m_j)
$$

**Meaning**: Messages received in **exact send order**.

**Implementation**: Verified at runtime in `cfsm-simulator.ts` (optional).

---

### Theorem 5.10 (Honda 2016): Progress

**Statement**: Well-formed global type $G$ satisfies progress:
$$
\text{well-formed}(G) \implies \forall \sigma, \langle G, \sigma \rangle \text{ has progress}
$$

**Meaning**: No deadlocks in well-formed protocols.

**Proof**: Connectedness + determinism + no-races → progress.

---

## 11. Syntax Summary

### Global Types

```
G ::= p → q: ℓ⟨T⟩.G                     (message)
    | choice at p { ℓ₁: G₁ or ... }    (choice)
    | G₁ | G₂                          (parallel)
    | μX.G                             (recursion)
    | continue X                       (loop)
    | end                              (termination)
```

---

### Local Types

```
T ::= q!⟨ℓ⟩.T                         (send)
    | p?⟨ℓ⟩.T                         (receive)
    | p ⊕ { ℓ₁: T₁ ⊕ ... }            (internal choice)
    | p & { ℓ₁: T₁ & ... }            (external choice)
    | T₁ | T₂                         (parallel)
    | μX.T                            (recursion)
    | continue X                      (loop)
    | end                             (termination)
```

---

### Actions

```
α ::= p → q: ℓ!                       (async send)
    | p ← q: ℓ                        (receive)
    | τ                               (silent)
```

---

## 12. References

### Primary Paper

1. **Honda, Yoshida, Carbone (JACM 2016)**
   - Title: "Multiparty Asynchronous Session Types"
   - **Section 3**: Operational semantics
   - **Section 4**: Asynchronous semantics with buffers
   - **Section 5**: FIFO guarantees (Theorems 4.8, 5.3)
   - **Section 6**: Progress theorem (Theorem 5.10)

### Related Work

2. **Deniélou, Yoshida (ESOP 2012)**
   - Title: "Multiparty Session Types Meet Communicating Automata"
   - **Section 2**: LTS semantics for CFSM
   - **Theorem 3.1**: CFG ↔ LTS equivalence

3. **Honda, Vasconcelos, Kubo (1998)**
   - "Language Primitives and Type Discipline for Structured Communication-Based Programming"
   - Binary session type operational semantics

---

## 13. Related Theory Documents

- `well-formedness-properties.md` - Theorem 5.10 (Progress)
- `fifo-verification.md` - Theorems 4.8, 5.3 (FIFO guarantees)
- `cfg-lts-equivalence.md` - Theorem 3.1 (CFG ↔ LTS)
- `projection-correctness.md` - Projection soundness (Theorem 3.1)
- `sub-protocol-formal-analysis.md` - Sub-protocol operational semantics

---

## 14. Conclusion

### Summary

✅ **Complete operational semantics** defined:
- Configuration syntax (`⟨G, σ⟩`)
- Reduction rules for all constructs
- Action labels (send, receive, tau)
- FIFO buffer semantics
- Progress properties

### Implementation Status

✅ **Implemented** in simulation layer:
- Asynchronous message passing
- FIFO buffers with verification
- Choice, parallel, recursion semantics
- Runtime progress checks

### Key Theorems

1. **Theorem 4.8**: Causal delivery
2. **Theorem 5.3**: FIFO guarantee
3. **Theorem 5.10**: Progress (deadlock-freedom)

---

**Document Status**: Complete
**Last Updated**: 2025-11-13
**Implementation**: `src/core/simulation/`
