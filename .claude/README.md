# SMPST Development Guide for AI Assistants

**⚠️ START EVERY SESSION BY READING THIS FILE ⚠️**

This directory contains critical development protocols for the SMPST project.

---

## File Overview

| File | Purpose | When to Read |
|------|---------|--------------|
| `README.md` | **THIS FILE** - Start here | **Every session** |
| `development-philosophy.md` | Core principles | **Every session** |
| `store-development-protocol.md` | Frontend integration rules | When modifying stores |
| `simulation-development-protocol.md` | Simulation feature patterns | When working on simulation |
| `theorem-driven-testing.md` | Testing methodology | When writing tests |
| `formal-methods-workflow.md` | Feature development process | When adding features |
| `backend-contract-checklist.md` | Feature parity workflow | When exposing backend features |

---

## Critical Rules (NEVER VIOLATE)

### 1. Formal Correctness Over Everything
- Every feature MUST have formal basis (theorem from literature)
- Tests MUST verify theorems, not just "it works"
- Implementation MUST be grounded in formal semantics

**See:** `development-philosophy.md`

### 2. Complete Backend Integration
- Stores MUST expose ALL backend return values
- Errors MUST be handled, not ignored
- Use contract handlers to enforce completeness

**See:** `store-development-protocol.md`

### 3. Theorem-Driven Testing
- Tests are proof obligations for formal theorems
- Reference theorem numbers and papers
- Link to theory documentation

**See:** `theorem-driven-testing.md`

---

## Session Startup Checklist

At the start of EVERY session:

```bash
# 1. Read this directory
ls .claude/
cat .claude/README.md

# 2. Check project status
cat docs/STATUS.md

# 3. Run tests to see current state
npm test

# 4. Review recent commits
git log --oneline -10
```

---

## Common Tasks

### Adding a New Store

```bash
# 1. Generate with template
npm run create:store <name> <backend-path>

# 2. Implement using contract handlers
# Edit: src/lib/stores/<name>.ts

# 3. Complete tests
# Edit: src/lib/stores/__tests__/<name>.test.ts

# 4. Test in watch mode
npm run test:stores:ui

# 5. Pre-commit hook verifies completeness
git commit -m "..."
```

**See:** `store-development-protocol.md`

---

### Adding a New Backend Feature

```bash
# 1. Find theorem in literature
# Use Perplexity if blocked (see CONTRIBUTING.md)

# 2. Document formal semantics
# Create: docs/theory/<feature>.md

# 3. Write theorem tests
# Create: tests/__tests__/theorems/<category>/<feature>.test.ts

# 4. Implement with annotations
# Edit: src/core/<module>/<file>.ts

# 5. Verify all links
# Theory ↔ Tests ↔ Code

# 6. Run tests
npm test -- tests/__tests__/theorems/
```

**See:** `formal-methods-workflow.md`

---

### Writing a Test

```typescript
// ❌ WRONG
it('should work', () => {
  expect(doThing()).toBe(true);
});

// ✅ RIGHT
describe('Theorem 5.1: Recursion Scoping (Demangeon & Honda 2012)', () => {
  it('proves: recursion variables bound within protocol', () => {
    // Test that verifies formal theorem
  });
});
```

**See:** `theorem-driven-testing.md`

---

## Project Structure

```
SMPST/
├── .claude/                    ← YOU ARE HERE
│   ├── README.md               ← Start here every session
│   ├── development-philosophy.md
│   ├── store-development-protocol.md
│   ├── theorem-driven-testing.md
│   └── formal-methods-workflow.md
│
├── src/
│   ├── core/                   ← Backend (formally verified)
│   │   ├── parser/
│   │   ├── cfg/
│   │   ├── verification/
│   │   ├── projection/
│   │   └── simulation/
│   └── lib/
│       ├── stores/             ← Integration layer (contract-enforced)
│       └── components/         ← UI (Svelte)
│
├── tests/
│   └── __tests__/
│       └── theorems/           ← Theorem verification tests
│
├── docs/
│   ├── theory/                 ← Formal theory documentation
│   └── STATUS.md               ← Current project state
│
└── CONTRIBUTING.md             ← Full development guide
```

---

## Key Commands

| Command | Purpose |
|---------|---------|
| `npm run create:store <name> <path>` | Generate store with tests |
| `npm run test:stores:ui` | Watch store tests |
| `npm test` | Run all tests |
| `npm test -- tests/__tests__/theorems/` | Run theorem tests only |
| `npm run test:coverage` | Coverage report |

---

## When in Doubt

### "Can I implement this feature?"

**Check:**
1. Does a formal definition exist in literature?
2. Is there a theorem guaranteeing correctness?
3. Can I write tests as proof obligations?

**If NO to any:** Don't implement. Document as future work.

---

### "How do I know if my store is correct?"

**Check:**
1. Does it expose ALL backend return values?
2. Are errors handled, not ignored?
3. Do tests verify all backend properties?
4. Does `npm run test:stores` pass?

**If NO to any:** Store is incomplete.

---

### "Why did my test fail?"

**Ask:**
1. Which theorem does this test verify?
2. What formal property is violated?
3. Does the implementation match the formal definition?

**Don't just make test pass - understand the theorem violation.**

---

## Anti-Patterns to Avoid

### ❌ "It works, ship it"
- **Problem:** No formal verification
- **Solution:** Ground in theorems first

### ❌ Ignoring backend errors
- **Problem:** Frontend silently drops errors
- **Solution:** Use contract handlers

### ❌ Tests without formal grounding
- **Problem:** Don't know what they verify
- **Solution:** Reference theorems explicitly

### ❌ Implementation-first development
- **Problem:** No formal specification
- **Solution:** Theory → Tests → Code

---

## Session Handoff Protocol

### At END of Session

Document:
1. **Theorems verified** (which tests pass)
2. **Formal properties implemented** (with references)
3. **Theory gaps remaining** (for next session)
4. **Contracts enforced** (frontend-backend integration)

### At START of Session

Check:
1. **Read `.claude/` directory** (this directory)
2. **Check `docs/STATUS.md`** (project state)
3. **Run tests** (what's verified)
4. **Review recent commits** (what changed)

---

## Resources

### Within This Repository
- `CONTRIBUTING.md` - Complete contribution guide
- `FRONTEND-TESTING.md` - Frontend testing strategy
- `docs/theory/THEOREM_DRIVEN_TESTING.md` - Full methodology
- `docs/theory/FORMAL_METHODS_WORKFLOW.md` - Complete workflow

### External References
- Papers in `docs/theory/*.md`
- Perplexity for blocked papers (see CONTRIBUTING.md)

---

## Philosophy Summary

**This project implements formally verified session types.**

We don't just write code that "works" - we implement **mathematical models** with **proven correctness**.

Every feature:
- ✅ Grounded in published research
- ✅ Formally documented
- ✅ Theorem-verified through tests
- ✅ Completely implemented (no partial backend integration)

**If you can't point to the theorem, don't write the code.**

---

## Questions?

- Check `CONTRIBUTING.md` for detailed guides
- Read relevant `.claude/*.md` file for specific topics
- Review `docs/theory/*.md` for formal background

**Remember:** Start every session by reading this directory!
