# Safety Check: OAuth Walkthrough

**Example**: Step-by-step safety verification of the OAuth protocol

---

## The OAuth Protocol

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

## Step 1: Build CFSMs (What SMPST Already Does)

### Service CFSM (role s)

```typescript
const cfsm_s: CFSM = {
  role: "s",
  protocolName: "OAuth",
  states: [
    { id: "q0" },  // Initial
    { id: "q1" },  // After sending login
    { id: "q2" },  // After sending cancel
    { id: "qf" }   // Terminal
  ],
  transitions: [
    // Branch 1: login path
    {
      id: "t1",
      from: "q0",
      to: "q1",
      action: {
        type: 'send',
        to: 'c',
        message: { label: 'login' }
      }
    },
    {
      id: "t2",
      from: "q1",
      to: "qf",
      action: {
        type: 'receive',
        from: 'a',
        message: { label: 'auth', payload: { payloadType: 'Bool' } }
      }
    },
    // Branch 2: cancel path
    {
      id: "t3",
      from: "q0",
      to: "q2",
      action: {
        type: 'send',
        to: 'c',
        message: { label: 'cancel' }
      }
    },
    {
      id: "t4",
      from: "q2",
      to: "qf",
      action: { type: 'tau' }  // No interaction with 'a' in this branch!
    }
  ],
  initialState: "q0",
  terminalStates: ["qf"]
};
```

### Client CFSM (role c)

```typescript
const cfsm_c: CFSM = {
  role: "c",
  protocolName: "OAuth",
  states: [
    { id: "q0" },  // Initial
    { id: "q1" },  // After receiving login
    { id: "q2" },  // After receiving cancel
    { id: "qf" }   // Terminal
  ],
  transitions: [
    // Branch 1: login path
    {
      id: "t1",
      from: "q0",
      to: "q1",
      action: {
        type: 'receive',
        from: 's',
        message: { label: 'login' }
      }
    },
    {
      id: "t2",
      from: "q1",
      to: "qf",
      action: {
        type: 'send',
        to: 'a',
        message: { label: 'passwd', payload: { payloadType: 'Str' } }
      }
    },
    // Branch 2: cancel path
    {
      id: "t3",
      from: "q0",
      to: "q2",
      action: {
        type: 'receive',
        from: 's',
        message: { label: 'cancel' }
      }
    },
    {
      id: "t4",
      from: "q2",
      to: "qf",
      action: {
        type: 'send',
        to: 'a',
        message: { label: 'quit' }
      }
    }
  ],
  initialState: "q0",
  terminalStates: ["qf"]
};
```

### Auth CFSM (role a)

```typescript
const cfsm_a: CFSM = {
  role: "a",
  protocolName: "OAuth",
  states: [
    { id: "q0" },  // Initial (can receive passwd OR quit)
    { id: "q1" },  // After receiving passwd
    { id: "qf" }   // Terminal
  ],
  transitions: [
    // Branch 1: passwd path
    {
      id: "t1",
      from: "q0",
      to: "q1",
      action: {
        type: 'receive',
        from: 'c',
        message: { label: 'passwd', payload: { payloadType: 'Str' } }
      }
    },
    {
      id: "t2",
      from: "q1",
      to: "qf",
      action: {
        type: 'send',
        to: 's',
        message: { label: 'auth', payload: { payloadType: 'Bool' } }
      }
    },
    // Branch 2: quit path
    {
      id: "t3",
      from: "q0",
      to: "qf",
      action: {
        type: 'receive',
        from: 'c',
        message: { label: 'quit' }
      }
    }
  ],
  initialState: "q0",
  terminalStates: ["qf"]
};
```

## Step 2: Create Initial Typing Context

```typescript
const Γ_0: TypingContext = {
  session: "oauth",
  cfsms: new Map([
    ["s", { machine: cfsm_s, currentState: "q0" }],
    ["c", { machine: cfsm_c, currentState: "q0" }],
    ["a", { machine: cfsm_a, currentState: "q0" }]
  ])
};
```

## Step 3: Run Safety Check on Γ₀

### Rule [S-⊕&]: Check Send/Receive Compatibility

```typescript
function checkSendReceiveCompatibility(Γ: TypingContext): CheckResult {
  const violations = [];

  // For each role's CFSM at current state
  for (const [roleP, {machine: cfsmP, currentState: stateP}] of Γ.cfsms) {
    // Get enabled send transitions from current state
    const enabledSends = cfsmP.transitions.filter(t =>
      t.from === stateP && t.action.type === 'send'
    );

    // Check each send has matching receive
    for (const sendTrans of enabledSends) {
      const roleQ = (sendTrans.action as SendAction).to;
      const msgLabel = sendTrans.action.message.label;

      // Get q's CFSM and current state
      const {machine: cfsmQ, currentState: stateQ} = Γ.cfsms.get(roleQ)!;

      // Find matching receive transition
      const matchingReceive = cfsmQ.transitions.find(t =>
        t.from === stateQ &&
        t.action.type === 'receive' &&
        (t.action as ReceiveAction).from === roleP &&
        t.action.message.label === msgLabel
      );

      if (!matchingReceive) {
        violations.push({
          sender: roleP,
          receiver: roleQ,
          message: msgLabel,
          reason: `No matching receive for ${roleP} -> ${roleQ}: ${msgLabel}`
        });
      }
    }
  }

  return {
    safe: violations.length === 0,
    violations
  };
}
```

### Check Γ₀ Step-by-Step

**Role s (at q0)**:

Enabled sends:
- `t1: q0 --send(c, login)--> q1`
- `t3: q0 --send(c, cancel)--> q2`

Check send `login` to `c`:
- c at q0
- c has transitions from q0:
  - `t1: q0 --receive(s, login)--> q1` ✓ MATCH!
  - `t3: q0 --receive(s, cancel)--> q2`
- **Result**: ✓ Compatible

Check send `cancel` to `c`:
- c at q0
- c has transitions from q0:
  - `t1: q0 --receive(s, login)--> q1`
  - `t3: q0 --receive(s, cancel)--> q2` ✓ MATCH!
- **Result**: ✓ Compatible

**Role c (at q0)**:

Enabled sends: *none* (only receives at q0)
- **Result**: ✓ Skip

**Role a (at q0)**:

Enabled sends: *none* (only receives at q0)
- **Result**: ✓ Skip

**Conclusion for Γ₀**: ✅ **SAFE**

## Step 4: Compute Reachable States

```typescript
function computeReachable(Γ_0: TypingContext): Set<TypingContext> {
  const visited = new Set<TypingContext>();
  const queue = [Γ_0];

  while (queue.length > 0) {
    const Γ = queue.shift()!;
    if (visited.has(Γ)) continue;
    visited.add(Γ);

    // Find all possible communications from Γ
    const successors = getSuccessors(Γ);
    queue.push(...successors);
  }

  return visited;
}
```

### Reachability Tree

```
                     Γ₀
                  (s:q0, c:q0, a:q0)
                       │
        ┌──────────────┴──────────────┐
        │                             │
    s sends 'login'              s sends 'cancel'
        │                             │
        ↓                             ↓
       Γ₁                            Γ₁'
  (s:q1, c:q1, a:q0)            (s:q2, c:q2, a:q0)
        │                             │
    c sends 'passwd'             c sends 'quit'
        │                             │
        ↓                             ↓
       Γ₂                            Γ₂'
  (s:q1, c:qf, a:q1)            (s:qf, c:qf, a:qf) ← Terminal
        │
    a sends 'auth'
        │
        ↓
       Γ₃
  (s:qf, c:qf, a:qf) ← Terminal
```

## Step 5: Check Each Reachable State

### Check Γ₁ (after s sends login)

**State**: s:q1, c:q1, a:q0

**Role s (at q1)**:

Enabled sends: *none*
Enabled receives:
- `t2: q1 --receive(a, auth)--> qf`

**Role c (at q1)**:

Enabled sends:
- `t2: q1 --send(a, passwd)--> qf`

Check send `passwd` to `a`:
- a at q0
- a has transitions from q0:
  - `t1: q0 --receive(c, passwd)--> q1` ✓ MATCH!
  - `t3: q0 --receive(c, quit)--> qf`
- **Result**: ✓ Compatible

**Role a (at q0)**:

Enabled sends: *none*

**Conclusion for Γ₁**: ✅ **SAFE**

### Check Γ₂ (after c sends passwd)

**State**: s:q1, c:qf, a:q1

**Role s (at q1)**:

Enabled receives:
- `t2: q1 --receive(a, auth)--> qf`

**Role c (at qf)**:

Terminal state, no transitions.

**Role a (at q1)**:

Enabled sends:
- `t2: q1 --send(s, auth)--> qf`

Check send `auth` to `s`:
- s at q1
- s has transitions from q1:
  - `t2: q1 --receive(a, auth)--> qf` ✓ MATCH!
- **Result**: ✓ Compatible

**Conclusion for Γ₂**: ✅ **SAFE**

### Check Γ₃ (terminal)

**State**: s:qf, c:qf, a:qf

All roles at terminal states. No enabled transitions.

**Conclusion for Γ₃**: ✅ **SAFE** (vacuously true)

### Check Γ₁' (after s sends cancel)

**State**: s:q2, c:q2, a:q0

**Role s (at q2)**:

Enabled transitions:
- `t4: q2 --tau--> qf` (internal action)

**Role c (at q2)**:

Enabled sends:
- `t4: q2 --send(a, quit)--> qf`

Check send `quit` to `a`:
- a at q0
- a has transitions from q0:
  - `t1: q0 --receive(c, passwd)--> q1`
  - `t3: q0 --receive(c, quit)--> qf` ✓ MATCH!
- **Result**: ✓ Compatible

**Role a (at q0)**:

Enabled sends: *none*

**Conclusion for Γ₁'**: ✅ **SAFE**

### Check Γ₂' (terminal)

**State**: s:qf, c:qf, a:qf

All terminal.

**Conclusion for Γ₂'**: ✅ **SAFE**

## Step 6: Final Safety Result

```typescript
const reachable = computeReachable(Γ_0);
// reachable = {Γ₀, Γ₁, Γ₂, Γ₃, Γ₁', Γ₂'}

const allSafe = Array.from(reachable).every(Γ =>
  checkSendReceiveCompatibility(Γ).safe
);

// Result:
console.log(allSafe); // true
```

**All reachable states are safe!**

✅ **OAuth protocol is SAFE**

## Why Classic MPST Failed (Recap)

Classic MPST tried to check:

```typescript
// This is what classic MPST does (and fails):
function classicCheck(protocol: GlobalProtocol): boolean {
  const types = project(protocol);  // Get session types

  // For OAuth:
  // Ss = c⊕{login.a&auth(Bool), cancel}
  // Sa = c&{passwd(Str).s⊕auth(Bool), quit}

  // Check partial projections:
  const Ss_to_a = partialProject(types.Ss, 'a');
  // = merge(a&auth(Bool), UNDEFINED) ← FAILS!

  return consistent(types);  // ✗ REJECTED
}
```

**The problem**: Tries to check ALL branches at once syntactically, ignoring that branches are mutually exclusive at runtime!

## What Safety Does Differently

```typescript
// This is what safety does (and succeeds):
function safetyCheck(protocol: GlobalProtocol): boolean {
  const cfsms = projectToCFSMs(protocol);  // Get CFSMs
  const Γ_0 = initialContext(cfsms);       // Initial state

  // Check reachable states:
  const reachable = computeReachable(Γ_0);
  // In branch 1: s,a interact (both mention each other)
  // In branch 2: s,a DON'T interact (neither mentions the other)
  // Both scenarios are safe!

  return reachable.every(Γ => checkSafety(Γ));  // ✓ ACCEPTED
}
```

**The insight**: Checks each execution path separately, respecting the semantics of choice!

## Summary: Key Differences

| Aspect | Classic MPST | Safety |
|--------|--------------|--------|
| **Operates on** | Session type syntax | CFSM execution states |
| **Checks** | All branches together | Each path separately |
| **OAuth branch 1** | s mentions a ✓ | s,a interact ✓ |
| **OAuth branch 2** | s doesn't mention a ✗ | s,a don't interact ✓ |
| **Merge branches** | UNDEFINED ⊓ a&auth = FAIL | Not needed! |
| **Result** | REJECT ✗ | ACCEPT ✓ |

---

**Conclusion**: Safety is the **semantic** version of consistency, and handles OAuth (and many other protocols) correctly!
