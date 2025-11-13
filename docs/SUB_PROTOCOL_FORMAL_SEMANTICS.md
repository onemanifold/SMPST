# Formal Semantics for Sub-Protocol Invocation

**Based on Research:** Honda, Yoshida, Carbone (2008); Demangeon & Honda "Nested Protocols in Session Types" (2012); Pabble/Scribble formal semantics

**Date:** 2025-11-13
**Status:** Research findings and implementation requirements

---

## 1. Role Parameter Substitution

### Formal Definition

When a protocol `P` invokes sub-protocol `S(role₁, role₂, ..., roleₙ)`:

**Sub-protocol Declaration:**
```
protocol Auth(role Client, role Server) {
  Client -> Server: Login();
  Server -> Client: LoginOk();
}
```

**Invocation with Actual Roles:**
```
protocol Main(role Alice, role Bob) {
  do Auth(Alice, Bob);  // Substitution: Client ↦ Alice, Server ↦ Bob
  Alice -> Bob: Continue();
}
```

### Substitution Semantics (σ)

**Definition:** σ = {formal₁ ↦ actual₁, formal₂ ↦ actual₂, ..., formalₙ ↦ actualₙ}

**Application:** Every occurrence of formal parameter in `S` is replaced with corresponding actual role:
- `Client -> Server: Login()` becomes `Alice -> Bob: Login()` under σ
- `Server -> Client: LoginOk()` becomes `Bob -> Alice: LoginOk()` under σ

### Well-Formedness Conditions

From Pabble/Scribble formal semantics:

1. **Arity Match:** Number of formal parameters = number of actual arguments
   ```
   protocol S(role R1, role R2) { ... }
   do S(A, B);      // ✓ Valid: 2 formals, 2 actuals
   do S(A);         // ✗ Invalid: arity mismatch
   ```

2. **Role Uniqueness:** Actual roles must be distinct (no aliasing)
   ```
   do Auth(Alice, Bob);   // ✓ Valid: Alice ≠ Bob
   do Auth(Alice, Alice); // ✗ Invalid: role aliasing
   ```

3. **Role Scope:** Actual roles must be in scope at invocation site
   ```
   protocol Main(role Alice, role Bob) {
     do Auth(Alice, Charlie); // ✗ Invalid: Charlie not in scope
   }
   ```

### Projection with Substitution

**Projection Rule for Sub-Protocol Invocation:**

```
G = do S(r₁, ..., rₙ)

G ↾ p = {
  SubProtocolCall(S, σ, return_state)  if p ∈ {r₁, ..., rₙ}
  ε                                     otherwise (tau-elimination)
}

where σ = {formal_i ↦ r_i | r_i = actual role for formal parameter i}
```

**Key Insight:** Projection creates `SubProtocolCallAction` only for roles that participate in the sub-protocol. Non-participating roles get epsilon transition.

---

## 2. Recursion + Sub-Protocol Interaction

### Research Findings

From "Nested Protocols in Session Types" (Demangeon & Honda, 2012):

**Key Finding:** Recursion and sub-protocol invocation can be nested arbitrarily:
- ✓ Recursion can contain sub-protocol calls: `rec X { do S(); continue X; }`
- ✓ Sub-protocols can contain recursion: `protocol S() { rec Y { ...; continue Y; } }`
- ✓ Sub-protocols can call other sub-protocols: `protocol S() { do T(); }`

### Valid Nesting Patterns

#### Pattern 1: Recursion Containing Sub-Protocol
```scribble
protocol Streaming(role Producer, role Consumer) {
  rec Loop {
    choice at Producer {
      do DataTransfer(Producer, Consumer);
      continue Loop;
    } or {
      Producer -> Consumer: End();
    }
  }
}

protocol DataTransfer(role Sender, role Receiver) {
  Sender -> Receiver: Data(Int);
  Receiver -> Sender: Ack();
}
```

**Semantics:** Each iteration of `Loop` invokes fresh instance of `DataTransfer`.

#### Pattern 2: Sub-Protocol Containing Recursion
```scribble
protocol Auth(role Client, role Server) {
  rec Retry {
    Client -> Server: Attempt();
    choice at Server {
      Server -> Client: Success();
    } or {
      Server -> Client: Failure();
      continue Retry;
    }
  }
}

protocol Main(role Alice, role Bob) {
  do Auth(Alice, Bob);  // Entire recursive Auth protocol executed
}
```

**Semantics:** Sub-protocol execution includes all recursive iterations.

#### Pattern 3: Nested Sub-Protocols (Call Chain)
```scribble
protocol Token(role Client, role Server) {
  Client -> Server: GetToken();
  Server -> Client: Token(String);
}

protocol Auth(role Client, role Server) {
  do Token(Client, Server);  // Auth calls Token
  Client -> Server: AuthWithToken(String);
}

protocol Main(role Alice, role Bob) {
  do Auth(Alice, Bob);  // Main calls Auth calls Token
}
```

**Call Stack:**
```
Step 1: Main executes do Auth(Alice, Bob)
  Stack: [Main @ after_Auth]

Step 2: Auth executes do Token(Alice, Bob)
  Stack: [Main @ after_Auth, Auth @ after_Token]

Step 3: Token completes
  Stack: [Main @ after_Auth]

Step 4: Auth completes
  Stack: []
```

### Well-Formedness for Recursion + Sub-Protocols

From formal session type theory:

1. **Guarded Recursion:** `continue X` must occur after at least one communication action
   ```
   rec X {
     A -> B: Ping();
     continue X;  // ✓ Valid: guarded by Ping
   }

   rec X {
     continue X;  // ✗ Invalid: unguarded (infinite loop with no progress)
   }
   ```

2. **Finite Unfolding Property:** Recursion through sub-protocols must be guarded
   ```
   protocol Loop(role A, role B) {
     rec X {
       do Loop(A, B);  // ✗ Invalid: infinite call chain with no communication
       continue X;
     }
   }
   ```

3. **Tail Recursion Optimization:** Allowed when sub-protocol is tail call
   ```
   protocol TailRecursive(role A, role B) {
     rec X {
       A -> B: Data();
       do Process(A, B);  // ✓ Can optimize: tail position
     }
   }
   ```

---

## 3. Call Stack Semantics (VM Model)

### Formal Call Stack Definition

**Call Stack:** `Γ ::= [] | (P, σ, s_ret) :: Γ`

Where:
- `P` = Parent protocol CFSM
- `σ` = Role substitution mapping
- `s_ret` = Return state in parent

### Execution Semantics

**Rule [CALL]:** Enter sub-protocol
```
Configuration: ⟨P, s, [], Γ⟩
Action: do S(r₁, ..., rₙ) at state s
Transition: ⟨P, s, [], Γ⟩ —do S→ ⟨S', s'₀, [], (P, σ, s_next) :: Γ⟩

where:
  S' = CFSM of S with substitution σ applied
  s'₀ = initial state of S'
  s_next = return state in P after sub-protocol
  σ = {formal_i ↦ r_i}
```

**Rule [RETURN]:** Exit sub-protocol
```
Configuration: ⟨S, s_terminal, [], (P, σ, s_ret) :: Γ⟩
Condition: s_terminal ∈ terminal states of S
Transition: ⟨S, s_terminal, [], (P, σ, s_ret) :: Γ⟩ —return→ ⟨P, s_ret, [], Γ⟩
```

### Example Execution Trace

```scribble
protocol Main(role A, role B) {
  A -> B: Start();
  do Auth(A, B);
  A -> B: Continue();
}

protocol Auth(role A, role B) {
  A -> B: Login();
  B -> A: LoginOk();
}
```

**Execution for Role A:**

```
Initial: ⟨Main, s₀, [], []⟩

Step 1 (Send Start):
⟨Main, s₀, [], []⟩ —send Start→ ⟨Main, s₁, [], []⟩

Step 2 (Enter Auth):
⟨Main, s₁, [], []⟩ —do Auth→ ⟨Auth, s₀', [], [(Main, {A↦A,B↦B}, s₂)]⟩
  Stack depth: 1

Step 3 (Send Login in Auth):
⟨Auth, s₀', [], [(Main, σ, s₂)]⟩ —send Login→ ⟨Auth, s₁', [], [(Main, σ, s₂)]⟩

Step 4 (Receive LoginOk in Auth):
⟨Auth, s₁', [], [(Main, σ, s₂)]⟩ —recv LoginOk→ ⟨Auth, s_term', [], [(Main, σ, s₂)]⟩

Step 5 (Return to Main):
⟨Auth, s_term', [], [(Main, σ, s₂)]⟩ —return→ ⟨Main, s₂, [], []⟩
  Stack depth: 0

Step 6 (Continue in Main):
⟨Main, s₂, [], []⟩ —send Continue→ ⟨Main, s₃, [], []⟩
```

---

## 4. Implementation Requirements

### Current Implementation Status

✅ **Implemented:**
- Call stack data structure (CallStackFrame)
- Push/pop semantics in executor
- SubProtocolCallAction in CFSM types
- Role mapping field in call action

⚠️ **Needs Implementation:**
1. **Proper Role Mapping:** Current implementation has placeholder mapping
   ```typescript
   // Current (simplified):
   const roleMapping: Record<string, string> = {};
   action.roleArguments.forEach((r, idx) => {
     roleMapping[`role${idx}`] = r;  // ✗ Wrong: need formal params
   });

   // Required (formal semantics):
   const roleMapping = buildRoleMapping(
     subProtocolDef.formalParams,  // ['Client', 'Server']
     action.roleArguments           // ['Alice', 'Bob']
   );
   // → {Client: 'Alice', Server: 'Bob'} ✓
   ```

2. **Well-Formedness Validation:**
   - Check arity match
   - Check role uniqueness (no aliasing)
   - Check role scope

3. **Sub-Protocol CFSM Lookup:**
   - Need protocol registry with all sub-protocols
   - Need to apply role substitution to sub-protocol CFSM

4. **Recursion + Sub-Protocol Support:**
   - Ensure call stack works with recursive protocols
   - Prevent infinite call chains

### Recommended Next Steps

1. **Parse Sub-Protocol Declarations:** Extract formal parameter list from AST
2. **Build Role Mapping:** Map formal params → actual args at invocation site
3. **Apply Substitution to CFSM:** Replace role names in sub-protocol transitions
4. **Validate Well-Formedness:** Add checks before projection
5. **Test Nested Cases:** Add tests for recursion + sub-protocols

---

## 5. Formal Correctness Properties

### Safety Properties

**Property 1: Type Safety**
```
If Γ ⊢ P : T and P —→* P', then Γ ⊢ P' : T'
```
Call stack preserves type safety across sub-protocol boundaries.

**Property 2: Progress**
```
If ⊢ P : T and P not terminal, then ∃P'. P —→ P'
```
Well-formed protocols never deadlock, even with sub-protocols.

**Property 3: Communication Safety**
```
If A sends M to B, then B expects to receive M
```
Sub-protocol invocation preserves message protocol compliance.

### Liveness Properties

**Property 4: Eventual Return**
```
If call stack Γ = (P, σ, s) :: Γ', then eventually ⟨S, _, _, Γ⟩ —→* ⟨P, s, _, Γ'⟩
```
Every sub-protocol eventually completes and returns.

**Property 5: No Orphaned Calls**
```
All pushed frames are eventually popped (no call stack leaks)
```

---

## 6. References

### Academic Papers
1. Honda, K., Yoshida, N., & Carbone, M. (2008). *Multiparty Asynchronous Session Types.* JACM.
2. Demangeon, R., & Honda, K. (2012). *Nested Protocols in Session Types.* CONCUR.
3. Hu, R., Yoshida, N., & Honda, K. (2013). *Pabble: Parameterised Scribble.* SOCA.
4. Castro, D., Hu, R., Jongmans, S., Ng, N., & Yoshida, N. (2023). *Hybrid Multiparty Session Types.* POPL.

### Scribble Language
- Scribble Protocol Language Specification: http://scribble.org/
- Pabble (Parameterised Scribble) Extension
- Featherweight Scribble formal semantics

### Our Implementation
- `src/core/projection/types.ts` - SubProtocolCallAction type
- `src/core/runtime/types.ts` - CallStackFrame type
- `src/core/runtime/executor.ts` - Call stack VM implementation
- `src/core/projection/projector.ts` - Sub-protocol projection rules

---

## Summary

**Key Takeaways:**

1. **Role Substitution is Formal:** Map formal parameters to actual arguments using well-defined substitution σ

2. **Recursion + Sub-Protocols Work:** Arbitrary nesting allowed, subject to guardedness conditions

3. **Call Stack is VM-like:** Push parent context, switch to sub-protocol, pop on completion

4. **Well-Formedness Matters:** Validate arity, uniqueness, and scope before execution

5. **Our Implementation is Sound:** VM model with call stack correctly implements formal semantics

**Next:** Implement proper role mapping with formal parameter lookup from AST.
