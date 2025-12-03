# SMPST - Session Multiparty Protocol Specification Tool

This is a formally verified implementation of Multiparty Session Types (MPST).

## CARDINAL RULE: FORMAL SPECIFICATION IS ALWAYS AUTHORITATIVE

**READ THIS BEFORE DOING ANYTHING.**

### Authority Hierarchy

```
1. FORMAL SPECIFICATION (papers, theory docs, type definitions)  <- AUTHORITATIVE
         |
2. TESTS (encode specification as proof obligations)
         |
3. IMPLEMENTATION (must pass the tests)
```

### When Tests Fail

1. **FIRST**: Determine if the test matches the formal specification
2. If TEST is wrong (doesn't match spec) -> Fix the TEST
3. If TEST is correct (matches spec) -> Fix the IMPLEMENTATION

### NEVER DO THIS

```
Implementation behaves X way
  -> Tests fail because they expect Y (per spec)
  -> Change tests to expect X
  -> Change documentation to say X is correct
  -> RESULT: Specification corrupted to match buggy implementation
```

### ALWAYS DO THIS

```
Formal specification says Y
  -> Write tests that verify Y
  -> Tests fail because implementation does X
  -> Fix implementation to do Y
  -> RESULT: Implementation matches specification
```

**The specification is sacred. Tests encode it. Implementation realizes it. Never invert this hierarchy.**

---

## Required Reading

At the start of EVERY session, read these files:

1. `.claude/README.md` - Session startup checklist
2. `.claude/development-philosophy.md` - Core principles (CARDINAL RULE details)
3. `docs/STATUS.md` - Current project state

For specific tasks:
- `.claude/store-development-protocol.md` - When modifying stores
- `.claude/simulation-development-protocol.md` - When working on simulation
- `.claude/theorem-driven-testing.md` - When writing tests
- `.claude/formal-methods-workflow.md` - When adding features

---

## Project Structure

```
src/
  core/           # Backend - formally verified logic
    parser/       # Chevrotain-based Scribble parser
    cfg/          # AST -> Control Flow Graph transformation
    projection/   # CFG -> CFSM projection (per-role state machines)
    simulation/   # CFG and CFSM simulators
    verification/ # Safety verification algorithms
    
  lib/            # Frontend - Svelte UI
    stores/       # Svelte stores (must faithfully implement backend)
    components/   # UI components

docs/
  theory/         # Formal theory documentation
  architecture/   # System design documents
```

---

## Key Principles

1. **Theorem-Driven Testing**: Tests verify formal theorems, not just "it works"
2. **Store Contract Enforcement**: Frontend must expose ALL backend return values
3. **Theory-First Development**: Theory -> Documentation -> Tests -> Implementation

---

## Commands

```bash
npm run dev          # Start development server
npm test             # Run all tests
npm run test:golden  # Run golden snapshot tests
```

---

## Current Status

- Base MPST + "Less is More" verification: Working
- DMst (Dynamic MPST): Partially implemented, in progress on active branches
- Bisimulation: Being fixed on active branches

See `docs/STATUS.md` for details.

---

## Task Estimation

**Do NOT provide time estimates.** Instead, rate task difficulty from 1 to 5:

| Difficulty | Description |
|------------|-------------|
| 1 | Trivial - Single file change, straightforward |
| 2 | Easy - Few files, well-understood scope |
| 3 | Medium - Multiple files, some complexity |
| 4 | Hard - Significant changes, requires careful design |
| 5 | Very Hard - Architectural changes, high risk |
