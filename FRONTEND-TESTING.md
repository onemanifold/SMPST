# Frontend Testing Strategy

**⚠️ IMPORTANT: This document describes the testing methodology for frontend code. ALL frontend changes must follow these patterns. ⚠️**

## Quick Start

### Creating a New Store
```bash
npm run create:store <name> <backend-module-path>
```

Example:
```bash
npm run create:store verification core/verification/verifier
```

This generates:
- Store file with contract enforcement template
- Test file with contract test structure
- Both files have TODOs guiding you to complete implementation

### Running Tests While Developing
```bash
npm run test:stores:ui
```

This opens Vitest UI showing real-time test results as you code.

### Running All Store Tests
```bash
npm run test:stores
```

---

## The Problem We're Solving

**Symptom:** Frontend appears broken, but backend works perfectly.

**Root Cause:** Stores (the integration layer) only partially implement backend APIs:
- Ignore error returns
- Don't expose all backend data
- Handle success but not failure cases

**Result:** Users see incomplete/broken UI with no error messages.

---

## The Solution: Contract-Enforced Testing

Every store MUST:

1. **Expose ALL backend return values** via stores
2. **Handle success AND error cases** explicitly
3. **Have tests that verify** all properties are exposed

### Example: Correct Implementation

```typescript
// Backend returns this:
interface StepResult {
  success: boolean;
  state: ExecutionState;
  error?: Error;
  event?: Event;
}

// Store MUST expose ALL of it:
export const executionState = writable<ExecutionState>(null);
export const lastError = writable<Error | null>(null);
export const lastEvent = writable<Event | null>(null);

export function stepSimulation() {
  const result = simulator.step();

  // Use contract handler to force handling all cases
  handleStepResult(result, {
    onSuccess: (state, event) => {
      executionState.set(state);    // ✅
      lastEvent.set(event ?? null); // ✅
      lastError.set(null);          // ✅
    },
    onError: (error, state) => {
      lastError.set(error);         // ✅
      executionState.set(state);    // ✅
    }
  });
}
```

### Tests Enforce This

```typescript
it('exposes backend error when step fails', () => {
  // Setup simulation that will error
  stepSimulation();

  // ✅ Test FAILS if lastError is not exposed
  expect(get(lastError)).toBeDefined();
  expect(get(lastError).type).toBe('no-transition');
});
```

If you forget to expose `lastError`, this test fails immediately.

---

## Enforcement Layers

### 1. Development Time: Live Testing
**Tool:** `npm run test:stores:ui`

- Watch mode shows failures in real-time
- Fails when backend properties aren't exposed
- Fast feedback loop (sub-second)

### 2. Commit Time: Pre-Commit Hook
**Location:** `.husky/pre-commit`

- Automatically runs store tests
- Blocks commit if tests fail
- Prevents incomplete implementations from entering codebase

### 3. CI/CD: GitHub Actions
**Location:** `.github/workflows/frontend-contracts.yml`

- Runs on all PRs and pushes
- Blocks merge if contracts violated
- Clear error messages guide fixes

### 4. Compile Time: TypeScript
**Tool:** Contract handlers (see `src/lib/stores/contracts/`)

- Forces handling both success and error cases
- TypeScript won't compile if properties ignored
- Catches issues before running code

---

## Detailed Guide

See `.claude/store-development-protocol.md` for:
- Complete patterns and anti-patterns
- Step-by-step examples
- How to handle backend changes
- Troubleshooting common issues

---

## Commands Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run create:store <name> <path>` | Generate store with tests | Starting new store |
| `npm run test:stores:ui` | Interactive test watcher | While developing |
| `npm run test:stores` | Run all store tests | Quick validation |
| `npm run test:coverage` | Coverage report | Check test completeness |

---

## File Locations

```
src/lib/stores/
├── contracts/
│   └── backend-contract.ts          # Contract enforcement utilities
├── __tests__/
│   ├── simulation-v2.test.ts        # Example: comprehensive tests
│   └── <your-store>.test.ts         # Your tests go here
├── simulation-v2.ts                 # Example: correct implementation
├── simulation.ts                    # OLD: incorrect (for comparison)
└── <your-store>.ts                  # Your stores go here
```

---

## Real Example

Compare these files to see correct vs incorrect:

- ✅ **Correct:** `src/lib/stores/simulation-v2.ts` + `__tests__/simulation-v2.test.ts`
- ❌ **Incorrect:** `src/lib/stores/simulation.ts` (no tests, incomplete implementation)

---

## FAQ

**Q: What if backend adds new properties later?**
A: Tests will fail, forcing you to handle them. This is by design.

**Q: Can I skip error handling for simple operations?**
A: No. Users need to know when things fail. Always handle errors.

**Q: Do I need tests for every function?**
A: Yes, if it calls backend. Tests document the contract.

**Q: What about UI components (Svelte files)?**
A: Component tests are optional. Store tests are mandatory. Stores contain the integration logic that breaks most often.

**Q: How do I test async operations?**
A: Use `async/await` in tests. Vitest handles this automatically.

---

## When Adding New Backend Features

Example: You're adding "channel delegation" support.

1. **Backend changes:** `DelegationSimulator` now returns `{ success, channel, error }`

2. **Store changes needed:**
   ```typescript
   // Add stores for new properties
   export const delegatedChannel = writable<Channel | null>(null);
   export const delegationError = writable<Error | null>(null);

   export function delegateChannel(channel: string) {
     const result = simulator.delegate(channel);
     handleResult(result, {
       onSuccess: (channel) => {
         delegatedChannel.set(channel);
         delegationError.set(null);
       },
       onError: (error) => {
         delegationError.set(error);
       }
     });
   }
   ```

3. **Tests you MUST add:**
   ```typescript
   it('exposes delegated channel on success', () => { ... });
   it('exposes delegation errors on failure', () => { ... });
   ```

4. **Run `npm run test:stores:ui`** - tests fail until implementation complete

---

## Why This Matters

Without this discipline:
- Backend works ✅
- Frontend broken ❌
- No error messages 😞
- Hours debugging 🔥

With this discipline:
- Backend works ✅
- Frontend works ✅
- Clear error messages 😊
- Minutes to fix issues ⚡

---

**Remember: Future sessions depend on current session following this protocol!**
