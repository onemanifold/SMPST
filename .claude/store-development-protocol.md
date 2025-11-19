# Store Development Protocol

**⚠️ CRITICAL: READ THIS BEFORE CREATING OR MODIFYING ANY STORE ⚠️**

This document is in `.claude/` so AI assistants see it across sessions.

## The Problem This Solves

Frontend stores bridge backend logic to UI. They frequently fail to:
- Handle backend errors
- Expose all backend return values
- Update state correctly

**Result:** UI appears broken, users get no feedback, hours wasted debugging.

## Mandatory Pattern for ALL Stores

### 1. Backend Return Values MUST Be Fully Handled

**WRONG (incomplete implementation):**
```typescript
export function stepSimulation() {
  const result = simulator.step();  // Returns: { success, state, error, event }
  executionState.set(result.state);  // ❌ Only uses 1 of 4 properties!
}
```

**CORRECT (full implementation):**
```typescript
export function stepSimulation() {
  const result = simulator.step();

  handleStepResult(result, {
    onSuccess: (state, event) => {
      executionState.set(state);    // ✅ Uses state
      lastEvent.set(event ?? null); // ✅ Uses event
      lastError.set(null);          // ✅ Clears error
    },
    onError: (error, state) => {
      lastError.set(error);         // ✅ Exposes error
      executionState.set(state);    // ✅ Preserves state
      console.error('Failed:', error);
    }
  });
}
```

### 2. Every Backend Property MUST Have a Store

If backend returns `{ success, state, error, event, warnings }`, you MUST have:
```typescript
export const executionState = writable<State>(null);  // ✅
export const lastError = writable<Error | null>(null);  // ✅
export const lastEvent = writable<Event | null>(null);  // ✅
export const warnings = writable<Warning[]>([]);        // ✅ NEW property = new store
```

### 3. Tests MUST Verify All Properties

For EVERY store function, tests must check:
- ✅ Success case: all success properties exposed
- ✅ Error case: errors exposed to UI
- ✅ State preservation on error
- ✅ Cleanup (no dangling state)

Example test structure:
```typescript
describe('myStoreFunction', () => {
  it('exposes all success properties', () => {
    // Call function
    // Verify EVERY backend return value has corresponding store update
  });

  it('exposes errors from backend', () => {
    // Trigger error
    // Verify error store is populated
  });
});
```

## How to Create a New Store

**Use the generator (it creates tests automatically):**
```bash
npm run create:store <name> <backend-path>
```

Example:
```bash
npm run create:store verification core/verification/verifier
```

This creates:
- `src/lib/stores/verification.ts` with contract template
- `src/lib/stores/__tests__/verification.test.ts` with contract tests

Then:
1. Implement backend calls using `handleStepResult` or similar
2. Complete the TODO tests
3. Run `npm run test:ui` and keep it open while coding
4. Commit (pre-commit hook verifies tests pass)

## When Adding New Backend Features

If you add new backend functionality (e.g., channel delegation):

1. **Backend returns new properties?** → Add stores for them
2. **Existing methods return new data?** → Update handlers and tests
3. **New error types?** → Update error handling

### Example: Adding Channel Delegation

Backend adds:
```typescript
interface DelegationResult {
  success: boolean;
  delegatedChannel: Channel;  // NEW
  delegationError?: Error;    // NEW
}
```

You MUST:
1. Add stores:
   ```typescript
   export const delegatedChannel = writable<Channel | null>(null);
   export const delegationError = writable<Error | null>(null);
   ```

2. Add tests:
   ```typescript
   it('exposes delegatedChannel on successful delegation', () => {
     // Test that delegatedChannel store is updated
   });

   it('exposes delegationError on delegation failure', () => {
     // Test that delegationError store is updated
   });
   ```

3. Tests will FAIL until you implement it → immediate feedback!

## Enforcement Mechanisms

These ensure you can't ignore this protocol:

### 1. TypeScript (Compile-Time)
- Contract handlers force you to handle all cases
- Missing properties = compilation error

### 2. Tests (Development-Time)
- Run `npm run test:ui` - watch mode shows failures immediately
- Tests fail if backend properties aren't exposed

### 3. Pre-Commit Hook (Commit-Time)
- Runs store tests automatically
- Can't commit if tests fail
- Located: `.husky/pre-commit`

### 4. CI/CD (PR-Time)
- GitHub Actions runs full test suite
- PRs can't merge if tests fail
- Located: `.github/workflows/test.yml`

## Quick Reference

| Scenario | Action | Tool |
|----------|--------|------|
| Creating new store | `npm run create:store name path` | Code generator |
| While coding | `npm run test:ui` | Live test watcher |
| Before commit | Auto-runs | Pre-commit hook |
| Backend changed | Update tests first | TDD |
| See contract violations | Read test failures | Vitest output |

## Real Example from Codebase

See `src/lib/stores/simulation-v2.ts` for reference implementation.

Compare with `src/lib/stores/simulation.ts` (old version) to see what NOT to do.

## Why This Matters

Without this discipline:
- ✅ Backend: implements feature correctly
- ❌ Frontend: ignores error cases
- 😞 User: sees broken UI, no error message
- 🔥 Debugging: hours wasted finding the disconnect

With this discipline:
- ✅ Backend: implements feature
- ✅ Frontend: MUST handle all cases (tests enforce)
- 😊 User: sees proper feedback
- ⚡ Debugging: test failure points to exact issue

---

**Remember: Future you will thank current you for following this protocol!**
