# Exception Handling in Session Types - Formal Theory

**Date**: 2025-11-13
**Source**: Perplexity synthesis + Fowler et al. 2019
**Status**: Theory documentation - Not Implemented

---

## 1. Overview

### Motivation

**Problem**: Traditional MPST assumes **perfect execution** (no failures).

**Reality**: Distributed systems experience:
- Network failures
- Timeouts
- Resource exhaustion
- Application-level errors

**Solution**: **Exceptional Session Types** integrate exception handling into MPST.

---

## 2. Type System

### Syntax Extensions

**Process Calculus**:
$$
P ::= \ldots \mid \text{try } P \text{ catch } E \mid \text{throw } e
$$

**Session Types** (local):
$$
T ::= \ldots \mid \text{try } T \text{ catch } T' \mid \text{throw}(e)
$$

---

### Typing Judgments with Exception Effects

Extended typing judgments track **exception effects**:

$$
\Gamma \vdash P : T \triangleright E
$$

Where:
- $$\Gamma$$: Typing context
- $$P$$: Process
- $$T$$: Session type
- $$E$$: **Exception effect** (set of exceptions $$P$$ might throw)

**Key Idea**: Exception effects are **tracked in types** like side effects in effect systems.

---

### Typing Rules

#### Try-Catch

$$
\frac{
\Gamma \vdash P : T \triangleright E
\quad
\Gamma \vdash Q : T' \triangleright \emptyset
}{
\Gamma \vdash \text{try } P \text{ catch } Q : T' \triangleright \emptyset
}
$$

**Meaning**:
- $$P$$ may throw exceptions $$E$$
- $$Q$$ handles all exceptions in $$E$$
- Result has **no exceptions** ($$\emptyset$$)

---

#### Throw

$$
\Gamma \vdash \text{throw } e : T \triangleright \{e\}
$$

**Meaning**:
- Raising exception $$e$$
- Effect set contains $$e$$
- Type $$T$$ describes protocol state at throw point

---

#### Effect Subsumption

$$
\frac{
\Gamma \vdash P : T \triangleright E_1
\quad
E_1 \subseteq E_2
}{
\Gamma \vdash P : T \triangleright E_2
}
$$

**Meaning**: Can add more exception possibilities (widening).

---

## 3. Type Safety Theorem

### Theorem (Fowler et al. 2019, Theorem 4.1)

**Statement**: Well-typed processes with exceptions satisfy **communication safety**:

$$
\Gamma \vdash P : T \triangleright E \implies \text{CommSafe}(P)
$$

Where **CommSafe** means:
- No communication mismatches (wrong message type/direction)
- No protocol violations
- Exceptions don't invalidate protocol conformance

---

### Proof Sketch

**Extension of classical MPST safety**:

1. **Subject Reduction**: Typing preserved under transitions
   - Include exception transitions
   - Handle abrupt termination

2. **Exception Effect Soundness**:
   - All thrown exceptions in effect set $$E$$
   - Unhandled exceptions propagate correctly

3. **Protocol Conformance**:
   - Normal execution follows protocol
   - Exception branches follow protocol recovery paths

**Citation**: Fowler et al. (2019), §4, Theorem 4.1, Proof in Appendix A

---

### Progress Property

**Bad News**: Progress **FAILS** in presence of unhandled exceptions.

**Why?**:
$$
P = \text{throw } e \quad \text{(no handler)} \implies \text{stuck}
$$

**Qualified Progress**: Holds if exceptions always caught downstream:

$$
E = \emptyset \implies \text{Progress}(P)
$$

**Practical Implication**: Type system should **require** handling all effects.

---

## 4. Projection Preservation

### Key Lemma (Fowler et al. 2019, Lemma 5.2)

**Statement**: Projection from global types with exceptions to local types preserves exception handling structure:

$$
\downarrow_r(\text{try } G \text{ catch } G') = \text{try } (\downarrow_r(G)) \text{ catch } (\downarrow_r(G'))
$$

**Meaning**: Exception branches in global protocol reflect correctly in local projections.

---

### Proof Sketch

**By induction** on protocol syntax:

**Base Case**: Exception throw/catch primitives
- Direct projection preserves structure

**Inductive Case**: Compositional constructs
- Try-catch distributes over choice, parallel, recursion
- Exception handlers projected independently

**Consistency Conditions**:
- Global types must specify **where** exceptions thrown/caught
- Local types mirror this structure exactly

**Citation**: Fowler et al. (2019), §5, Lemma 5.2

---

### Consistency Requirements

**Well-formed global protocols** must ensure:

1. **Exception Labels Consistent**: All roles agree on exception names
2. **Handler Coverage**: All thrown exceptions have matching handlers
3. **Role Assignment**: Clear which role catches each exception

---

## 5. Affine vs Linear Types

### The Fundamental Problem

**Linear Types**: Resources used **exactly once** (no discard, no duplicate)

**Exception Throwing**: Causes **abrupt termination** → discards resources!

**Conflict**: Exceptions violate linearity constraints.

---

### Theorem (Fowler et al. 2019, §6)

**Statement**: **Affine types** (allowing discarding) support exceptions safely, but **linear types** cannot.

**Formal**:
$$
\text{Linear types} + \text{Exceptions} \implies \text{Type System Unsound}
$$

---

### Proof Intuition

**Linear Channel**: Must be used exactly once
```
// Linear channel c
send c "hello"    // Must happen
throw MyError     // Abrupt termination
// c never closed! ← Linearity violation
```

**Affine Channel**: Can be discarded
```
// Affine channel c
send c "hello"    // May happen
throw MyError     // Can discard c safely ✓
```

**Conclusion**: Session types with exceptions require **affine** (not linear) channels.

---

## 6. Exception Propagation

### How Exceptions Propagate Across Roles

**Scenario**: Role $$p$$ throws exception, role $$q$$ must handle.

**Mechanism 1**: **Explicit Exception Message**
```
p throws e → p !q.exception(e) → q receives → q handles
```

**Mechanism 2**: **Protocol Branch**
```
try {
  p -> q: NormalMessage();
} catch {
  p -> q: ErrorMessage();
}
```

**Mechanism 3**: **Ambient Failure**
- Exception causes protocol-level failure
- All roles aware via monitoring/orchestration

---

### Protocol State on Exception

**Before Exception**:
```
State: S1
Protocol: p -> q: Msg(); ...
```

**On Exception**:
```
p throws e
  ↓
State: S_error
Protocol: recovery branch or termination
```

**Recovery Options**:
1. **Rollback**: Return to safe checkpoint
2. **Forward Recovery**: Jump to error handling sub-protocol
3. **Termination**: Protocol aborts

---

## 7. Design Choices

### Which Role Catches Exception?

**Option 1**: **Thrower Catches**
```scribble
protocol SelfHandle(role Client, role Server) {
  try {
    Client -> Server: Request();
  } catch ClientError {
    Client -> Server: Retry();
  }
}
```

**Option 2**: **Receiver Catches**
```scribble
protocol RemoteHandle(role Client, role Server) {
  Client -> Server: Request();

  choice at Server {
    Server -> Client: Success();
  } or {
    Server -> Client: Error();  // Server catches error
  }
}
```

**Option 3**: **Orchestrator Catches**
```scribble
protocol OrchestratorHandle(role C, role S, role Monitor) {
  try {
    C -> S: Request();
  } catch {
    S -> Monitor: ErrorReport();
    Monitor -> C: Abort();
  }
}
```

**Best Practice**: Depends on protocol semantics and recovery strategy.

---

## 8. Intuition and Examples

### Example 1: Simple Try-Catch

**Global Protocol**:
```scribble
protocol FileFetch(role Client, role Server) {
  try {
    Client -> Server: GetFile(String);
    Server -> Client: FileData(Bytes);
  } catch FileNotFound {
    Server -> Client: NotFound();
  }
}
```

**Local Projection (Server)**:
```
try {
  ?Client.GetFile(filename)
  !Client.FileData(data)
} catch FileNotFound {
  !Client.NotFound()
}
```

---

### Example 2: Timeout as Exception

**Global Protocol**:
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

**Semantics**: If Server doesn't respond in 5s, Timeout exception raised.

---

### Example 3: Cascading Exceptions

**Global Protocol**:
```scribble
protocol CascadingFail(role A, role B, role C) {
  try {
    A -> B: Request();
    try {
      B -> C: Forward();
      C -> B: Response();
    } catch CError {
      B -> A: ForwardError();  // Inner catch
    }
    B -> A: Response();
  } catch BError {
    A -> C: Rollback();  // Outer catch
  }
}
```

---

## 9. Implementation Considerations

### Current SMPST IDE Status

**Not implemented**:
- ❌ Try-catch syntax
- ❌ Throw statements
- ❌ Exception effect tracking
- ❌ Affine type checking

**What's needed**:
1. **Parser Extension**: Parse `try { ... } catch { ... }`
2. **Type System**: Track exception effects $$\triangleright E$$
3. **Projection**: Handle exception branches
4. **Verification**: Check handler coverage

---

### Design Sketch

```typescript
interface TryNode extends CFGNode {
  type: 'try';
  body: CFG;               // Try block
  handlers: Handler[];     // Catch blocks
  finally?: CFG;          // Optional finally
}

interface Handler {
  exceptionType: string;   // e.g., "Timeout", "NetworkError"
  body: CFG;               // Handler code
}

interface ExceptionEffect {
  exceptions: Set<string>;  // Set of exception names
}

class ExceptionTypeChecker {
  checkExceptionCoverage(
    tryNode: TryNode,
    thrownExceptions: ExceptionEffect
  ): boolean {
    // Verify all exceptions in thrownExceptions
    // have matching handlers
  }
}
```

---

### Testing Strategy

```typescript
describe('Exception Handling', () => {
  it('should parse try-catch syntax', () => {
    const protocol = `
      protocol Test(role A, role B) {
        try {
          A -> B: Request();
        } catch Error {
          A -> B: Cancel();
        }
      }
    `;
    // Parse and verify AST
  });

  it('should project exceptions to local types', () => {
    // Test projection preserves try-catch structure
  });

  it('should require exception handling', () => {
    const protocol = `
      protocol Uncaught(role A, role B) {
        throw MyError;  // No handler!
      }
    `;
    // Should reject: uncaught exception
  });

  it('should verify handler coverage', () => {
    // All thrown exceptions must have handlers
  });
});
```

---

## 10. Relationship to Other Features

### Exceptions + Timeouts

**Timeouts as Exceptions**:
```scribble
protocol TimedOp(role A, role B) {
  try {
    A -> B: Request();
    B -> A: Response() within 5s;
  } catch Timeout {
    // Handle timeout
  }
}
```

**Integration**: Timed types naturally throw timeout exceptions.

---

### Exceptions + Sub-Protocols

```scribble
protocol Auth(role C, role S) throws AuthError {
  C -> S: Login();
  choice at S {
    S -> C: Success();
  } or {
    throw AuthError;  // Propagates to caller
  }
}

protocol Main(role C, role S) {
  try {
    do Auth(C, S);
  } catch AuthError {
    C -> S: Retry();
  }
}
```

**Challenge**: Exception effects must propagate through sub-protocol calls.

---

## 11. References

### Primary Paper

1. **Fowler et al. (2019)**
   - Title: "Exceptional Asynchronous Session Types"
   - Published: POPL 2019
   - **Typing rules**: §3
   - **Type safety theorem**: Theorem 4.1
   - **Projection lemma**: Lemma 5.2
   - **Affine vs linear discussion**: §6

### Related Work

2. **Carbone, Montesi (2013)**: "Deadlock-freedom-by-design: multiparty asynchronous global programming"
   - Error handling patterns

3. **Capecchi et al. (2016)**: "Global Escape in Multiparty Sessions"
   - Global exception mechanisms

---

## 12. Future Work

### For SMPST IDE

**Phase 1: Basic Exceptions**
- Parse try-catch-throw syntax
- AST representation
- Basic projection

**Phase 2: Effect System**
- Track exception effects
- Verify handler coverage
- Affine type checking

**Phase 3: Integration**
- Exceptions + timeouts
- Exceptions + sub-protocols
- Recovery patterns

---

## 13. Formal Property Tests

### Property 1: Communication Safety

$$
\Gamma \vdash P : T \triangleright E \implies \text{CommSafe}(P)
$$

### Property 2: Effect Soundness

$$
P \rightarrow^* \text{throw } e \implies e \in E
$$

### Property 3: Handler Coverage

$$
E \subseteq \text{Handlers} \implies E = \emptyset \text{ after catch}
$$

---

## 14. Conclusion

### Summary

✅ **Theory Well-Defined**:
- Formal type system with exception effects
- Type safety theorem (Theorem 4.1)
- Projection preservation (Lemma 5.2)
- Affine types requirement

❌ **Not Implemented**:
- Try-catch syntax
- Exception effect tracking
- Handler coverage checking
- Affine type system

### Practical Impact

**Enables**:
- Robust distributed protocols
- Failure recovery patterns
- Production-ready systems
- Timeout integration

### Implementation Priority

**Priority**: 🟡 **Medium** (important for production systems)

**Rationale**:
- Critical for real-world protocols
- Integrates with timeouts
- Moderate complexity

---

**Document Status**: Complete
**Last Updated**: 2025-11-13
**Next Theory Doc**: Timed Session Types
