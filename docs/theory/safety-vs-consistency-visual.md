# Safety vs Consistency: Visual Comparison

## The Core Difference

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLASSIC MPST (FAILS ON OAUTH)                │
└─────────────────────────────────────────────────────────────────┘

                    Global Type G
                         │
                         │ Projection
                         ↓
              ┌──────────┴──────────┐
              │                     │
         Type Ss              Type Sa
         (service)            (auth)
              │                     │
              │                     │
         Extract Ss↾a          Extract Sa↾s
              │                     │
              ↓                     ↓
         a&auth(Bool)          UNDEFINED ✗
         OR                    (in cancel branch)
         UNDEFINED ✗
         (in cancel branch)

         ┌──────────────────┐
         │  Duality Check   │
         │  Ss↾a ≟ (Sa↾s)‾  │ ← Can't check undefined!
         │      FAILS ✗     │
         └──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    NEW MPST (ACCEPTS OAUTH)                     │
└─────────────────────────────────────────────────────────────────┘

             CFSMs (one per role)
                     │
                     ↓
         ┌───────────┼───────────┐
         │           │           │
    CFSM_s      CFSM_c      CFSM_a
         │           │           │
         └───────────┴───────────┘
                     │
                     ↓
           ┌─────────────────┐
           │ Safety Checker  │
           │                 │
           │ For each state: │
           │ • Can s send?   │
           │ • Can c receive?│ ← Check actual transitions!
           │   ✓             │
           └─────────────────┘
                     │
                     ↓
              ACCEPTS ✓
```

## Why OAuth Fails Consistency

```
OAuth Protocol:
┌────────────────────────────────────────────────────┐
│  choice at s {                                     │
│    Branch 1: s→c:login  c→a:passwd  a→s:auth       │
│    Branch 2: s→c:cancel c→a:quit                   │
│  }                                                  │
└────────────────────────────────────────────────────┘

Session Types (Projections):
┌────────────────────────────────────────────────────┐
│ Ss = c⊕{                                           │
│        login . a&auth(Bool) ,  ← mentions 'a'      │
│        cancel                   ← no 'a'! ✗        │
│      }                                             │
│                                                    │
│ Sa = c&{                                           │
│        passwd(Str) . s⊕auth(Bool) ,  ← mentions 's'│
│        quit                           ← no 's'! ✗  │
│      }                                             │
└────────────────────────────────────────────────────┘

Partial Projection Problem:
┌────────────────────────────────────────────────────┐
│ Ss ↾ a (project Ss onto 'a')                       │
│                                                    │
│ Branch 1: login.a&auth(Bool) ↾ a                  │
│           = a&auth(Bool)             ✓             │
│                                                    │
│ Branch 2: cancel ↾ a                               │
│           = UNDEFINED                ✗             │
│           ('a' not mentioned!)                     │
│                                                    │
│ Merge: a&auth(Bool) ⊓ UNDEFINED = FAIL!           │
└────────────────────────────────────────────────────┘
```

## How Safety Handles OAuth

```
Safety checks REACHABLE STATES, not syntax:

Initial State (Γ₀):
┌─────────┬─────────┬─────────┐
│ s: q0   │ c: q0   │ a: q0   │
└─────────┴─────────┴─────────┘

s can send 'login' or 'cancel' to c
c can receive 'login' or 'cancel' from s at q0
✓ SAFE

After s sends 'login' (Γ₁):
┌─────────┬─────────┬─────────┐
│ s: q1   │ c: q1   │ a: q0   │
└─────────┴─────────┴─────────┘

c can send 'passwd' to a
a can receive 'passwd' from c at q0
✓ SAFE

After c sends 'passwd' (Γ₂):
┌─────────┬─────────┬─────────┐
│ s: q1   │ c: qf   │ a: q1   │
└─────────┴─────────┴─────────┘

a can send 'auth' to s
s can receive 'auth' from a at q1
✓ SAFE

Alternatively, if s sends 'cancel' (Γ₁'):
┌─────────┬─────────┬─────────┐
│ s: q2   │ c: q2   │ a: q0   │
└─────────┴─────────┴─────────┘

c can send 'quit' to a
a can receive 'quit' from c at q0
✓ SAFE

All reachable states are SAFE!
```

## The Reachability Graph

```
          Γ₀ (all at q0)
           │
           │ s sends
           ↓
    ┌──────┴──────┐
    │             │
'login'       'cancel'
    │             │
    ↓             ↓
   Γ₁            Γ₁'
(s:q1,         (s:q2,
 c:q1,          c:q2,
 a:q0)          a:q0)
    │             │
    │c sends      │c sends
    │'passwd'     │'quit'
    ↓             ↓
   Γ₂            Γ₂'
(s:q1,         (s:qf,
 c:qf,          c:qf,
 a:q1)          a:qf)
    │
    │a sends 'auth'
    ↓
   Γ₃
(s:qf,
 c:qf,
 a:qf)

Safety Check:
✓ Γ₀  safe
✓ Γ₁  safe
✓ Γ₁' safe
✓ Γ₂  safe
✓ Γ₂' safe
✓ Γ₃  safe

RESULT: OAuth is SAFE!
```

## Key Insight: Syntax vs Semantics

```
┌──────────────────────────────────────────────────────┐
│               CONSISTENCY (SYNTACTIC)                │
├──────────────────────────────────────────────────────┤
│ Looks at TYPE STRUCTURE:                            │
│                                                      │
│ "Does the type Ss mention role 'a' in ALL branches?"│
│  → NO! Only in 'login' branch                       │
│  → REJECT                                           │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                 SAFETY (SEMANTIC)                    │
├──────────────────────────────────────────────────────┤
│ Looks at EXECUTION STATES:                          │
│                                                      │
│ "In each reachable state, do sends match receives?" │
│  → State Γ₁: s,a interact after 'login' chosen      │
│  → State Γ₁': s,a DON'T interact after 'cancel'     │
│  → Both states are safe!                            │
│  → ACCEPT                                           │
└──────────────────────────────────────────────────────┘
```

## The Hierarchy (Lemma 5.9)

```
                    ┌─────────────┐
                    │     Safe    │ ← Largest (most protocols)
                    │             │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │ Deadlock-   │
                    │   Free      │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │    Live     │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   Live+     │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │  Live++     │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
  ┌──────┴──────┐   ┌──────┴──────┐   ┌─────┴──────┐
  │ Terminating │   │   Projected │   │ Consistent │ ← Smallest
  │             │   │   from      │   │            │   (fewest protocols)
  │             │   │   Global G  │   │            │
  └─────────────┘   └─────────────┘   └────────────┘
                           │
                           └── Classic MPST lives here
                               (rejects OAuth!)
```

## Implementation in SMPST

```typescript
// OLD (Classic MPST - breaks on OAuth)
function checkProtocol(protocol: GlobalProtocol): boolean {
  const types = project(protocol);  // Get session types
  return consistent(types);         // Check duality ← FAILS on OAuth!
}

// NEW (Safety-based - accepts OAuth)
function checkProtocol(
  protocol: GlobalProtocol,
  φ: SafetyProperty = new BasicSafety()
): boolean {
  const cfsms = projectToCFSMs(protocol);  // Get CFSMs
  const Γ = initialContext(cfsms);         // Set all at q0
  return φ.check(Γ);                       // Check safety ← WORKS on OAuth!
}
```

## Summary Table

| Property | What it checks | OAuth? | Decidable? | Complexity |
|----------|---------------|--------|------------|------------|
| **Consistency** | Syntactic duality | ✗ Reject | ✓ | O(n) |
| **Safety** | Send/receive match | ✓ Accept | ✓ | O(2^n) states |
| **Deadlock-free** | No circular waits | ✓ Accept | ✓ | O(2^n) |
| **Live** | All I/O fires | ✓ Accept | ✓ | O(2^n) |
| **Live+** | Fair scheduling | ✓ Accept | ✓ | O(2^n) |

Where n = number of states in all CFSMs combined.

Note: Although complexity is exponential, in practice:
- CFSMs are small (< 100 states typically)
- Model checkers handle this efficiently
- Can cache reachability computation

---

**Conclusion**: Safety is MORE GENERAL and MORE PRACTICAL than consistency!
