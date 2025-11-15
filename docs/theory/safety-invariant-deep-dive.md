# Safety Invariant: Deep Dive

**Date**: 2025-11-14
**Source**: Scalas & Yoshida (2019) "Less is More: Multiparty Session Types Revisited"
**Context**: Understanding Definition 4.1 in the context of SMPST architecture

---

## Table of Contents

1. [The Problem We're Solving](#1-the-problem-were-solving)
2. [What is Safety? (Simple Explanation)](#2-what-is-safety-simple-explanation)
3. [Definition 4.1: Formal Safety Property](#3-definition-41-formal-safety-property)
4. [Mapping Safety to SMPST Architecture](#4-mapping-safety-to-smpst-architecture)
5. [Why This Solves the OAuth Problem](#5-why-this-solves-the-oauth-problem)
6. [Safety vs Consistency](#6-safety-vs-consistency)
7. [Implementation Strategy](#7-implementation-strategy)

---

## 1. The Problem We're Solving

### Your OAuth Example (Currently Broken in Classic MPST)

```scribble
protocol OAuth(role s, role c, role a) {
  choice at s {
    s -> c: login();
    c -> a: passwd(Str);
    a -> s: auth(Bool);
  } or {
    s -> c: cancel();
    c -> a: quit();
  }
}
```

**Projections** (what your system already computes):
```
Ss = c⊕{login.a&auth(Bool), cancel}
Sc = s&{login.a⊕passwd(Str), cancel.a⊕quit}
Sa = c&{passwd(Str).s⊕auth(Bool), quit}
```

**In your existing CFSM representation**, these become three CFSMs:

```typescript
// Service CFSM (role s)
CFSM {
  role: "s",
  states: [
    { id: "q0" },    // Initial
    { id: "q1" },    // After sending login
    { id: "q2" },    // After sending cancel
    { id: "qf" }     // Terminal
  ],
  transitions: [
    { from: "q0", to: "q1", action: { type: 'send', to: 'c', message: {label: 'login'} } },
    { from: "q1", to: "qf", action: { type: 'receive', from: 'a', message: {label: 'auth'} } },
    { from: "q0", to: "q2", action: { type: 'send', to: 'c', message: {label: 'cancel'} } },
    { from: "q2", to: "qf", action: { type: 'tau' } }
  ]
}

// Similar CFSMs for c and a...
```

### The Classic MPST Problem

**Classic MPST requires**: These three session types must be **consistent**.

**Consistency check** (Definition 3.8 from paper):
```
For all pairs s[p]:Sp, s[q]:Sq in Γ:
  Sp↾q must be dual to Sq↾p
```

**Partial projection** Ss↾a (Definition 3.6):
- Look at Ss = c⊕{login.a&auth(Bool), cancel}
- Project onto role 'a'
- **First branch**: login.a&auth(Bool) → a&auth(Bool) ✓
- **Second branch**: cancel → ??? (undefined! 'a' not mentioned)
- **Merging**: Need to merge a&auth(Bool) with undefined → **FAILS!**

**Result**: OAuth is **not consistent** → Classic MPST **rejects** it!

---

## 2. What is Safety? (Simple Explanation)

**Safety** asks a much simpler question:

> "If role p wants to send message m to role q, can q actually receive it?"

That's it! No complex projection. No duality checks. Just:
1. Check that sends match receives
2. Check that this property is preserved as the protocol runs

### Intuition

Think of it like checking a conversation:

```
Alice says to Bob: "Would you like coffee or tea?"
Bob must be listening for either "coffee" or "tea" from Alice.
```

**Safety says**:
- ✓ If Alice can say "coffee", then Bob must accept "coffee"
- ✓ If Alice can say "tea", then Bob must accept "tea"
- ✗ If Alice says "juice", but Bob only accepts "coffee" or "tea" → **NOT SAFE**

**Classic MPST consistency says**:
- Must analyze the entire conversation structure
- Must check all roles' conversations with each other
- Must verify complex "duality" properties
- **Often rejects valid conversations** (like OAuth!)

---

## 3. Definition 4.1: Formal Safety Property

From the paper, **φ is a safety property** if it satisfies three rules:

### Rule [S-⊕&]: Send/Receive Matching

```
IF  Γ contains s[p]:q⊕{m₁(S₁), ..., mₙ(Sₙ)}.S'    (p can send to q)
AND Γ contains s[q]:p&{m₁(T₁), ..., mₖ(Tₖ)}.T'    (q receives from p)

THEN:
  1. All messages p sends must be in q's branching: {m₁...mₙ} ⊆ {m₁...mₖ}
  2. Payload types must be compatible: ∀i. Sᵢ ≤ Tᵢ (subtyping)
```

**In SMPST terms** (using your CFSM representation):

```typescript
// Check all pairs of CFSMs
for (const cfsmP of cfsms) {
  for (const cfsmQ of cfsms) {
    // Find send transitions from p to q
    for (const sendTrans of cfsmP.transitions) {
      if (sendTrans.action.type === 'send' && sendTrans.action.to === cfsmQ.role) {
        const messageLabel = sendTrans.action.message.label;

        // Check: Does q have a matching receive transition?
        const hasMatchingReceive = cfsmQ.transitions.some(recvTrans =>
          recvTrans.action.type === 'receive' &&
          recvTrans.action.from === cfsmP.role &&
          recvTrans.action.message.label === messageLabel
        );

        if (!hasMatchingReceive) {
          return false; // NOT SAFE!
        }
      }
    }
  }
}
```

### Rule [S-μ]: Recursion Unfolding

```
IF  φ(Γ, s[p]:μt.S)  (φ holds with recursive type)
THEN φ(Γ, s[p]:S{μt.S/t})  (φ holds with unfolded type)
```

**Why needed**: Recursive types like `μt.q⊕m.t` must be unfolded to check the send/receive at the top level.

**In SMPST**: Your CFSMs already handle this! Recursive transitions create cycles in the state graph.

### Rule [S-→]: Preserved by Reduction

```
IF  φ(Γ)           (Γ is safe now)
AND Γ → Γ'         (Γ reduces to Γ')
THEN φ(Γ')         (Γ' is still safe)
```

**Why needed**: As the protocol executes, safety must continue to hold.

**In SMPST terms**: After a message exchange between two CFSMs, the remaining protocol must still be safe.

```typescript
// Simulate one communication step
function reduce(cfsms: Map<Role, CFSM>): Map<Role, CFSM> {
  // Find a send/receive pair
  const sender = findReadySender(cfsms);
  const receiver = findMatchingReceiver(cfsms, sender);

  // Fire transitions
  const newCFSMs = advanceState(cfsms, sender, receiver);

  // Safety must still hold!
  if (!isSafe(newCFSMs)) {
    throw new Error("Safety violated after reduction!");
  }

  return newCFSMs;
}
```

---

## 4. Mapping Safety to SMPST Architecture

Your existing architecture already has most pieces needed!

### Current Architecture (Recap)

```
Scribble Source → Parser → AST → CFG Builder → CFG
                                                 ↓
                                          Verification
                                                 ↓
                                            Projector
                                                 ↓
                                   CFSMs (one per role)
                                                 ↓
                                            Simulator
```

### Where Safety Fits

```
Scribble Source → Parser → AST → CFG Builder → CFG
                                                 ↓
                                          Verification (current)
                                                 ↓
                                            Projector
                                                 ↓
                                   CFSMs (one per role)
                                                 ↓
                                   🆕 SAFETY CHECKER ← NEW!
                                                 ↓
                                            Simulator
```

### Key Insight: Safety Operates on CFSMs

**Classic MPST consistency**: Operates on **session types** (syntax trees)

**Safety**: Operates on **typing contexts** = **CFSMs with current states**

In your architecture:
- **CFSM** = The automaton (states + transitions)
- **Typing Context Γ** = CFSMs with current execution state

```typescript
// Typing context in SMPST
interface TypingContext {
  session: string;
  cfsms: Map<Role, {
    machine: CFSM,           // The automaton
    currentState: string     // Current position
  }>;
}

// Example for OAuth
const Γ_oauth: TypingContext = {
  session: "s",
  cfsms: new Map([
    ["s", {
      machine: cfsm_service,
      currentState: "q0"  // Initial state
    }],
    ["c", {
      machine: cfsm_client,
      currentState: "q0"
    }],
    ["a", {
      machine: cfsm_auth,
      currentState: "q0"
    }]
  ])
};
```

### Safety Check Algorithm (Pseudocode)

```typescript
function checkSafety(Γ: TypingContext): boolean {
  // Rule [S-⊕&]: Check all send/receive pairs
  for (const [role_p, {machine: cfsmP, currentState: stateP}] of Γ.cfsms) {
    // Get enabled transitions from current state
    const enabledSends = cfsmP.transitions.filter(t =>
      t.from === stateP && t.action.type === 'send'
    );

    for (const sendTrans of enabledSends) {
      const role_q = sendTrans.action.to;
      const message_m = sendTrans.action.message.label;

      // Get q's CFSM
      const {machine: cfsmQ, currentState: stateQ} = Γ.cfsms.get(role_q);

      // Check: Can q receive m from p at current state?
      const canReceive = cfsmQ.transitions.some(t =>
        t.from === stateQ &&
        t.action.type === 'receive' &&
        t.action.from === role_p &&
        t.action.message.label === message_m
      );

      if (!canReceive) {
        return false;  // UNSAFE!
      }
    }
  }

  // Rule [S-→]: Check preserved by all reductions
  const reachable = computeReachableContexts(Γ);
  for (const Γ_prime of reachable) {
    if (!checkSafetyBase(Γ_prime)) {  // Check [S-⊕&] only
      return false;
    }
  }

  return true;  // SAFE!
}
```

---

## 5. Why This Solves the OAuth Problem

Let's trace through OAuth with the safety check:

### OAuth CFSMs (Simplified)

```
Service (s):
  q0 --send(c, login)--> q1 --receive(a, auth)--> qf
  q0 --send(c, cancel)--> q2 --tau--> qf

Client (c):
  q0 --receive(s, login)--> q1 --send(a, passwd)--> qf
  q0 --receive(s, cancel)--> q2 --send(a, quit)--> qf

Auth (a):
  q0 --receive(c, passwd)--> q1 --send(s, auth)--> qf
  q0 --receive(c, quit)--> qf
```

### Safety Check (Initial State)

**Γ₀**: All at q0

**Check s → c**:
- s can send: `login` or `cancel`
- c can receive from s at q0: `login` ✓ or `cancel` ✓
- **PASS** ✓

**Check c → a**:
- c cannot send from q0 (must receive first)
- **SKIP**

**Check a → s**:
- a cannot send from q0
- **SKIP**

**Conclusion**: Γ₀ is safe! ✓

### After Reduction (s sends login to c)

**Γ₁**: s at q1, c at q1, a at q0

**Check c → a**:
- c can send: `passwd`
- a can receive from c at q0: `passwd` ✓ or `quit` ✓
- **PASS** ✓

**Check a → s** (after c sends passwd):
- a can send: `auth`
- s can receive from a at q1: `auth` ✓
- **PASS** ✓

**Conclusion**: OAuth is **safe** through all reductions! ✓✓✓

### Why Classic MPST Failed

Classic MPST tried to check **duality** between **types**, ignoring execution order:

- "Does s's type to a match a's type from s?"
- s's type mentions a only in branch 1
- But s doesn't know which branch it's in until runtime!
- Syntactic check fails

**Safety checks execution semantics**, not just syntax!

---

## 6. Safety vs Consistency

| Aspect | Consistency (Classic) | Safety (New) |
|--------|----------------------|--------------|
| **What it checks** | Syntactic duality of types | Runtime compatibility of actions |
| **Based on** | Binary session types | Behavioural semantics |
| **Operates on** | Session type syntax | CFSM transitions |
| **Considers** | All possible paths at once | Reachable states |
| **OAuth example** | ❌ Rejected (Ss↾a undefined) | ✅ Accepted (all sends match receives) |
| **Complexity** | Syntactic (fast) | Semantic (reachability) |
| **Decidability** | Decidable | Decidable (finite state) |
| **Generality** | Restrictive | General |

### Key Insight

**Consistency is a syntactic over-approximation of safety.**

```
Consistent ⊂ Safe
```

From Lemma 5.9(1) in paper:
```
consistent(Γ) ==> safe(Γ)  ✓
safe(Γ) ==/=> consistent(Γ)  ✗
```

This means:
- All consistent contexts are safe
- But many safe contexts (like OAuth!) are not consistent

---

## 7. Implementation Strategy

### Phase 1: Basic Safety Checker

Create a new module: `src/core/safety/safety-checker.ts`

```typescript
/**
 * Definition 4.1: Safety property for typing contexts
 *
 * A property φ is a safety property if:
 * [S-⊕&]: Sends match receives
 * [S-μ]:  Handles recursion unfolding
 * [S-→]:  Preserved by reduction
 */
export class SafetyChecker {
  /**
   * Check if a typing context (CFSMs at current states) is safe
   *
   * @param context - CFSMs with current states
   * @returns true if safe, false otherwise
   */
  check(context: TypingContext): boolean {
    // Rule [S-⊕&]: Check all enabled send/receive pairs
    if (!this.checkSendReceiveCompatibility(context)) {
      return false;
    }

    // Rule [S-→]: Check preserved by all reductions
    if (!this.checkPreservationByReduction(context)) {
      return false;
    }

    return true;
  }

  private checkSendReceiveCompatibility(Γ: TypingContext): boolean {
    // For each CFSM at its current state
    for (const [roleP, {machine, currentState}] of Γ.cfsms) {
      // Get enabled send transitions
      const sends = this.getEnabledSends(machine, currentState);

      for (const send of sends) {
        // Check corresponding receive exists
        if (!this.hasMatchingReceive(Γ, roleP, send)) {
          return false;
        }
      }
    }
    return true;
  }

  private checkPreservationByReduction(Γ: TypingContext): boolean {
    // Compute all reachable contexts from Γ
    const reachable = this.computeReachable(Γ);

    // Check safety holds for all reachable contexts
    for (const Γ_prime of reachable) {
      if (!this.checkSendReceiveCompatibility(Γ_prime)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Compute reachable typing contexts via communication transitions
   * This is finite because CFSMs have finite states
   */
  private computeReachable(Γ: TypingContext): Set<TypingContext> {
    const visited = new Set<TypingContext>();
    const queue = [Γ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      // Find all possible communications
      const successors = this.getSuccessors(current);
      queue.push(...successors);
    }

    return visited;
  }
}
```

### Phase 2: Integration with Type System

Modify your typing rule for session restriction:

```typescript
// src/core/typing/session-checker.ts

/**
 * Type check session restriction with parametric safety
 * Implements [TGen-ν] from Definition 4.4
 */
function checkSessionRestriction(
  Γ: TypingContext,
  Γ_prime: TypingContext,  // Session-local context
  P: Process,
  φ: SafetyProperty = new BasicSafety()  // ← Parametric!
): TypeCheckResult {
  // Rule [TGen-ν]:
  //   Γ' = {s[p]:Sp | p ∈ roles}
  //   φ(Γ')  ← Check safety property
  //   s ∉ Γ
  //   Θ·Γ,Γ'⊢P
  //   ─────────────────────
  //   Θ·Γ ⊢ (νs:Γ')P

  if (!φ.check(Γ_prime)) {
    return {
      valid: false,
      error: `Safety property ${φ.name} violated`
    };
  }

  // Continue type checking...
  return { valid: true };
}
```

### Phase 3: Extend to Parametric φ

Allow different safety properties:

```typescript
// Different levels of guarantees
const φ_minimal = new BasicSafety();        // Just type safety
const φ_deadlock = new DeadlockFreedom();   // + No deadlocks
const φ_live = new LivenessProperty();      // + All I/O eventually fires
const φ_classic = new Consistency();        // Classic MPST (for comparison)

// Type check with different guarantees
typeCheck(protocol, φ_minimal);   // Most permissive
typeCheck(protocol, φ_live);      // Stricter
typeCheck(protocol, φ_classic);   // Strictest (may reject OAuth)
```

---

## Summary

**Safety is:**
1. A **behavioral** property (not syntactic)
2. Checking **sends match receives** at each state
3. **Weaker** than consistency (accepts more protocols)
4. **Sufficient** for type safety (Theorem 4.6)
5. **Decidable** for finite CFSMs
6. **Compositional** (can split contexts)

**In SMPST:**
- Operates on your existing CFSMs
- Checks enabled transitions at current states
- Verified by reachability analysis
- Enables OAuth and other "non-consistent" protocols

**Next steps:**
1. Implement `SafetyChecker` class
2. Test on OAuth example
3. Integrate with type system ([TGen-ν])
4. Extend to parametric φ (deadlock-freedom, liveness)

---

**Document Status**: Complete
**Ready for Implementation**: Yes
**Prerequisites**: Understanding of CFSM/LTS semantics ✓
