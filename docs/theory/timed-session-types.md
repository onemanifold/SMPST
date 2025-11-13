# Timed Session Types - Formal Theory

**Date**: 2025-11-13
**Source**: Perplexity synthesis + Bocchi et al. 2014 + ECOOP 2024
**Status**: Theory documentation - Not Implemented

---

## 1. Overview

### Motivation

**Problem**: Many distributed protocols are **time-sensitive**:
- IoT: Sensor data with freshness requirements
- Real-time systems: Hard deadlines
- Web services: Timeout guarantees
- Quality-of-Service: Response time SLAs

**Solution**: **Timed Multiparty Session Types** integrate time constraints into MPST.

---

## 2. Operational Semantics

### Timed LTS with Clocks

**Configuration**:
$$
\langle G, \mathbf{C} \rangle
$$

Where:
- $$G$$: Global protocol type
- $$\mathbf{C}$$: **Clock valuation** mapping clocks $$c_i \to \mathbb{R}_{\geq 0}$$

**Intuition**: Track elapsed time using explicit clocks.

---

### Time Progression Rule

$$
\frac{
\mathbf{C} \models \varphi \quad d \in \mathbb{R}_{\geq 0} \quad \mathbf{C} + d \models \varphi
}{
\langle G, \mathbf{C} \rangle \xrightarrow{d} \langle G, \mathbf{C} + d \rangle
}
$$

**Meaning**:
- Time $$d$$ elapses
- All clocks advance by $$d$$
- Must preserve clock constraints $$\varphi$$

**Notation**: $$\mathbf{C} + d$$ means add $$d$$ to all clock values.

---

### Action Transition with Clock Constraints

$$
\frac{
G \xrightarrow{a}_{\varphi} G' \quad \mathbf{C} \models \varphi
}{
\langle G, \mathbf{C} \rangle \xrightarrow{a} \langle G', \mathbf{0} \rangle
}
$$

**Meaning**:
- Action $$a$$ (send/receive) happens
- Must satisfy clock constraint $$\varphi$$
- Clocks **reset** to 0 after action

**Key Idea**: Actions are guarded by temporal constraints.

---

### Clock Constraints Syntax

$$
\varphi ::= c \leq d \mid c \geq d \mid c = 0 \mid \varphi_1 \land \varphi_2
$$

Where:
- $$c$$: Clock variable
- $$d$$: Time constant ($$\mathbb{R}_{\geq 0}$$)

**Examples**:
- $$c \leq 5$$: Must happen within 5 time units
- $$c \geq 2$$: Must wait at least 2 time units
- $$c = 0$$: Clock just reset

---

## 3. Time-Error Freedom

### Definition: Time Error

A configuration $$\langle G, \mathbf{C} \rangle$$ has a **time error** if:

1. **Time Cannot Advance**: $$\nexists d > 0: \mathbf{C} + d \models \varphi$$
2. **Protocol Cannot Proceed**: No action enabled due to expired deadlines

**Example**:
```
Constraint: receive within [2, 5] time units
Time elapsed: 6 units
→ Deadline expired, time error!
```

---

### Theorem (Bocchi et al. 2014, Theorem 3.6)

**Statement**: If $$G$$ is well-typed with timed constraints, then:

$$
\forall \langle G', \mathbf{C}' \rangle \text{ reachable}: \quad \text{No time error}
$$

**Meaning**: Well-typed timed protocols **never** get stuck due to timing constraints.

---

### Proof Sketch

**By induction** on protocol transitions:

**Base Case**: Initial configuration
- $$\mathbf{C} = \mathbf{0}$$ (all clocks 0)
- Initial constraints satisfiable

**Inductive Step**:
1. **Time Progression**: $$\mathbf{C} + d \models \varphi$$ ensured by well-formedness
2. **Action Transition**: Clock reset preserves invariants
3. **Clock Regions**: Partition time space into regions, show all reachable

**Key Lemma**: Well-formedness ensures constraints are **satisfiable**.

**Citation**: Bocchi et al. (2014), §3, Theorem 3.6, Proof in Appendix B

---

## 4. Timed Projection

### Key Lemma (Bocchi et al. 2014, Lemma 4.3)

**Statement**: Projection of timed global types preserves timing constraints:

$$
\downarrow_r(G[\varphi]) = T_r[\varphi_r]
$$

Where $$\varphi_r$$ are **role-specific** clock constraints.

**Meaning**: Local protocols inherit relevant timing requirements.

---

### Proof Intuition

**Projection distributes over timed actions**:
```
Global: p --[c ≤ 5]--> q: Msg()
Project(p): ![c ≤ 5] q.Msg()
Project(q): ?[c ≤ 5] p.Msg()
```

**Challenge**: Clock synchronization assumptions.

---

### What Can Go Wrong?

**Unsynchronized Clocks**:
- Role $$p$$ thinks 3 seconds elapsed
- Role $$q$$ thinks 5 seconds elapsed
- Constraint $$c \leq 4$$ satisfied by $$p$$, violated by $$q$$!

**Solution**: Assume **synchronized clocks** or use distributed clock protocols.

**Citation**: Bocchi et al. (2014), §4, Lemma 4.3

---

## 5. Decidability

### Theorem (Bocchi et al. 2014, Theorem 4.2)

**Statement**: Timed deadlock detection for MPST is **DECIDABLE** via region graph exploration.

---

### Complexity

**Result**: **EXPSPACE** (exponential space)

**Why?**:
- Timed automata region construction
- Classic result from Alur & Dill (1994)

**Practical Impact**: Feasible for protocols with:
- Bounded number of clocks (< 10)
- Reasonable time constants (< 1000s)

---

### Verification Technique

**Algorithm**:
1. Construct **region graph** (partition clock space)
2. Explore reachable configurations
3. Check for:
   - Time errors
   - Deadlocks
   - Constraint violations

**Citation**: Bocchi et al. (2014), §4, Theorem 4.2

---

## 6. Timeout Semantics

### Does Timeout Apply to Send, Receive, or Both?

**Answer**: Typically **RECEIVE** (waiting for input)

**Rationale**:
- Sending is non-blocking (async semantics)
- Receiving blocks until message arrives
- Timeouts prevent indefinite waiting

---

### Receive with Timeout

**Syntax**:
```scribble
Server -> Client: Response() within 5s;
```

**Semantics**:
```
?[c ≤ 5] Server.Response()
```

**Meaning**:
- Client waits up to 5 seconds for Response
- If timeout expires → take timeout branch

---

### Send with Timeout (Less Common)

**Syntax**:
```scribble
Client -> Server: Request() before 10s;
```

**Semantics**:
```
![c ≤ 10] Server.Request()
```

**Meaning**:
- Request must be sent within 10 seconds (e.g., after some event)

---

## 7. What Happens When Timeout Expires?

### Option 1: Exception Branch

```scribble
protocol TimedRequest(role Client, role Server) {
  try {
    Client -> Server: Request();
    Server -> Client: Response() within 5s;
  } catch Timeout {
    Client -> Server: Cancel();
  }
}
```

**Semantics**: Timeout raises exception, handled by catch block.

---

### Option 2: Choice Branch

```scribble
protocol TimedChoice(role Client, role Server) {
  Client -> Server: Request();

  choice at Server {
    Server -> Client: Response() within 5s;
  } or {
    // Implicit timeout branch
    Server -> Client: Timeout();
  }
}
```

**Semantics**: Timeout becomes explicit protocol choice.

---

### Option 3: Protocol Failure

```scribble
protocol HardDeadline(role Client, role Server) {
  Client -> Server: Request();
  Server -> Client: Response() within 5s;
  // No timeout handler → protocol fails
}
```

**Semantics**: Time error → protocol aborts.

---

## 8. Relationship to Exception Handling

### Timeouts as Exceptions

**Insight**: Timeouts are a **specific kind of exception**.

**Integration**:
```scribble
protocol Integrated(role Client, role Server) {
  try {
    Client -> Server: Request();
    Server -> Client: Response() within 5s;
  } catch Timeout {
    // Handle timeout exception
  } catch NetworkError {
    // Handle other exceptions
  }
}
```

**Design**: Exception handling subsumes timeout handling.

---

## 9. Concrete Examples

### Example 1: Simple Timeout

**Global Protocol**:
```scribble
protocol HttpRequest(role Client, role Server) {
  Client -> Server: GET(URL);

  choice at Server {
    Server -> Client: Response(HTML) within 30s;
  } or {
    Server -> Client: Timeout();
  }
}
```

**Local Projection (Client)**:
```
!Server.GET(url)

choice {
  ?[c ≤ 30] Server.Response(html)
} or {
  ?Server.Timeout()
}
```

---

### Example 2: Cascading Timeouts

```scribble
protocol Chain(role A, role B, role C) {
  A -> B: Request() within 5s;
  B -> C: Forward() within 3s;
  C -> B: Response() within 7s;
  B -> A: Response() within 2s;
}
```

**Semantics**: Nested time constraints (total: 5+3+7+2 = 17s max).

---

### Example 3: Retry with Backoff

```scribble
protocol RetryBackoff(role Client, role Server) {
  rec Retry {
    Client -> Server: Request();

    choice at Server {
      Server -> Client: Response() within 5s;
    } or {
      // Timeout → retry with exponential backoff
      wait 2^retries seconds;
      continue Retry;
    }
  }
}
```

---

## 10. Implementation Considerations

### Current SMPST IDE Status

**Not implemented**:
- ❌ Clock variables
- ❌ Temporal constraints
- ❌ Timeout syntax
- ❌ Time-error checking

**What's needed**:
1. **Parser Extension**: Parse `within <time>` syntax
2. **Clock System**: Track clock valuations
3. **Constraint Checker**: Verify clock constraints satisfiable
4. **Timeout Branches**: Generate exception/choice branches

---

### Design Sketch

```typescript
interface TimedConstraint {
  clock: string;        // e.g., "c1"
  operator: '≤' | '≥' | '=';
  value: number;        // Time in seconds/ms
}

interface TimedAction extends Action {
  constraints: TimedConstraint[];
  onTimeout?: CFG;      // Timeout handler
}

class TimedSimulator {
  private clocks: Map<string, number> = new Map();

  progressTime(delta: number): void {
    // Advance all clocks by delta
    for (const [clock, value] of this.clocks) {
      this.clocks.set(clock, value + delta);
    }
  }

  checkConstraints(constraints: TimedConstraint[]): boolean {
    // Verify all constraints satisfied
    return constraints.every(c => this.checkConstraint(c));
  }

  resetClock(clock: string): void {
    this.clocks.set(clock, 0);
  }
}
```

---

### Testing Strategy

```typescript
describe('Timed Session Types', () => {
  it('should parse timeout constraints', () => {
    const protocol = `
      protocol Test(role A, role B) {
        A -> B: Request();
        B -> A: Response() within 5s;
      }
    `;
    // Parse and verify temporal constraint
  });

  it('should detect time errors', () => {
    // Protocol with unsatisfiable constraints
    // Should reject during verification
  });

  it('should handle timeout branches', () => {
    // Simulate timeout expiration
    // Verify correct branch taken
  });

  it('should verify time-error freedom', () => {
    // Test Theorem 3.6: no reachable time errors
  });
});
```

---

## 11. Advanced Features (ECOOP 2024)

### Fearless Async Communication with Timed Protocols

**Paper**: Hou et al. (ECOOP 2024)

**Key Innovation**: Combine **affinity + timeouts + failures** in single framework.

**Features**:
1. **Affine types** (resources can be discarded)
2. **Time constraints** (deadlines, timeouts)
3. **Failure handling** (exceptions, crashes)
4. **Static Guarantees**:
   - Deadlock-free
   - Communication-safe
   - Time-error free
   - **Fearless**: Never blocked indefinitely

---

### "Fearless" Property

**Definition**: Process never stuck waiting indefinitely due to:
- Missing message (timeout rescues)
- Failed participant (exception rescues)
- Deadlock (static checking prevents)

**Formal**:
$$
\forall P: \text{WellTyped}(P) \implies \text{Fearless}(P)
$$

---

## 12. References

### Primary Papers

1. **Bocchi et al. (2014)**
   - Title: "Timed Multiparty Session Types"
   - Published: CONCUR 2014
   - **Operational semantics**: §3
   - **Time-error freedom**: Theorem 3.6
   - **Timed projection**: Lemma 4.3
   - **Decidability**: Theorem 4.2

2. **Hou et al. (ECOOP 2024)**
   - Title: "Fearless Asynchronous Communications with Timed Multiparty Session Protocols"
   - Published: ECOOP 2024
   - **Fearless property**: §4
   - **Affine + timed integration**: §5
   - **Practical implementations**: §6

3. **Bocchi et al. (2013)**
   - Title: "Timed Runtime Monitoring for Multiparty Conversations"
   - Published: FMOODS/FORTE 2013
   - Runtime monitoring for timed protocols

---

### Related Work

4. **Alur, Dill (1994)**: "A Theory of Timed Automata"
   - Foundational theory for timed systems

5. **Neykova, Yoshida (2014)**: "Let It Recover: Multiparty Protocol-Induced Recovery"
   - Recovery mechanisms in MPST

---

## 13. Future Work

### For SMPST IDE

**Phase 1: Basic Timeouts**
- Parse `within <time>` syntax
- Simple timeout branches
- No clock variables (implicit clocks)

**Phase 2: Clock System**
- Explicit clock variables
- Clock constraints ($$c \leq d$$, $$c \geq d$$)
- Time progression simulation

**Phase 3: Verification**
- Time-error freedom checking
- Region graph construction
- Decidability checking

**Phase 4: Integration**
- Timeouts + exceptions (unified)
- Fearless property checking
- Affine types + timeouts

---

## 14. Formal Property Tests

### Property 1: Time-Error Freedom

$$
\text{WellTyped}(G) \implies \text{NoTimeError}(G)
$$

### Property 2: Projection Preserves Timing

$$
\downarrow_r(G[\varphi]) = T_r[\varphi_r]
$$

### Property 3: Decidability

$$
\text{TimedDeadlockFree}(G) \text{ is decidable}
$$

### Property 4: Fearless Property (ECOOP 2024)

$$
\text{WellTyped}(P) \implies \text{Fearless}(P)
$$

---

## 15. Conclusion

### Summary

✅ **Theory Well-Defined**:
- Timed LTS operational semantics
- Time-error freedom theorem (Theorem 3.6)
- Timed projection (Lemma 4.3)
- Decidability (EXPSPACE, Theorem 4.2)

❌ **Not Implemented**:
- Clock variables and constraints
- Timeout syntax
- Time-error checking
- Fearless verification

### Practical Impact

**Enables**:
- Real-time protocol specifications
- Timeout guarantees
- Quality-of-service enforcement
- IoT and embedded systems

### Implementation Priority

**Priority**: 🟢 **Lower** (advanced feature)

**Rationale**:
- Complex (requires clock system)
- Less critical than core MPST features
- Can approximate with exceptions

---

**Document Status**: Complete
**Last Updated**: 2025-11-13
**All Theory Docs Complete**: ✅
