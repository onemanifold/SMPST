# CFSM Projection Tests

This directory contains organized test files for the CFSM projection module, split from a monolithic 1,329-line file into 9 focused test files for better maintainability and parallel execution.

## Test Structure

```
__tests__/
├── basic-messaging.test.ts       # 4 tests  - Simple send/receive projection
├── choice-projection.test.ts     # 6 tests  - Internal/external choice (⊕/&)
├── parallel-projection.test.ts   # 6 tests  - Parallel composition
├── recursion-projection.test.ts  # 5 tests  - Recursion and loops
├── known-protocols.test.ts       # 5 tests  - Literature protocols (2PC, Three-Buyer, etc.)
├── edge-cases.test.ts            # 7 tests  - Edge cases and error handling
├── formal-correctness.test.ts    # 6 tests  - Formal properties (Honda-Yoshida-Carbone 2008)
├── complex-integration.test.ts   # 4 tests  - Multi-construct combinations
└── completeness.test.ts          # 2 tests  - Completeness properties
```

**Total**: 45 tests across 9 files

## Supporting Directories

### `__fixtures__/`
Reusable protocol definitions that can be shared across tests:
- Basic patterns (REQUEST_RESPONSE, THREE_ROLE_CHAIN, etc.)
- Choice patterns (INTERNAL_CHOICE, NESTED_CHOICE, etc.)
- Parallel patterns (PARALLEL_WITH_SEQUENCES, etc.)
- Recursion patterns (INFINITE_LOOP, NESTED_RECURSION, etc.)
- Literature protocols (TWO_PHASE_COMMIT, THREE_BUYER, PING_PONG, etc.)

### `__test-utils__/`
Shared test utilities:
- **helpers.ts**: Assertion helpers, graph analysis functions
  - `hasSendAction()`, `hasReceiveAction()`
  - `hasCycle()`, `getReachableStates()`
  - `assertValidCFSMStructure()`, `assertMessageDuality()`
- **builders.ts**: Test data builders
  - `buildCFSMFromSource()`, `buildAllCFSMsFromSource()`
  - Protocol template builders

## Running Tests

```bash
# Run all projection tests
npm test src/core/projection

# Run specific test file
npm test basic-messaging

# Run in watch mode
npm test -- --watch choice-projection

# Run with coverage
npm test src/core/projection --coverage
```

## Benefits of This Structure

1. **Parallel Execution**: Vitest can run test files in parallel (2-4x faster)
2. **Focused Testing**: Each file tests one concern (easier to debug)
3. **Better Navigation**: Jump directly to relevant test category
4. **Code Reuse**: Shared fixtures reduce duplication (45 protocols → ~30)
5. **Maintainability**: Files are 80-200 lines instead of 1,329 lines

## Adding New Tests

1. **Use existing fixtures** when possible:
   ```typescript
   import { REQUEST_RESPONSE } from '../__fixtures__/protocols';
   ```

2. **Use test helpers** for assertions:
   ```typescript
   import { hasSendAction, hasCycle } from '../__test-utils__/helpers';
   ```

3. **Add to appropriate category file** or create new file if needed

4. **Follow naming convention**: `[category]-projection.test.ts`

## Test Categories

### Basic Messaging
Simple send/receive projection patterns. Foundation for all other tests.

### Choice Projection
Tests for internal choice (⊕) where role makes decision, and external choice (&) where role reacts to decision.

### Parallel Projection
Tests for parallel composition with fork/join semantics.

### Recursion Projection
Tests for recursion with `rec` and `continue` statements, including nested recursion.

### Known Protocols
Well-known protocols from session types literature for validation against academic standards.

### Edge Cases
Error handling, empty protocols, unused roles, stress tests.

### Formal Correctness
Tests verify formal properties from Honda-Yoshida-Carbone (2008):
- **Completeness**: Every message projected exactly once
- **Correctness**: Each CFSM contains only relevant actions
- **Composability**: Send/receive duality
- **Well-Formedness**: No orphaned states, deterministic choices

### Complex Integration
Tests combining multiple constructs (choice + parallel + recursion).

### Completeness
Tests for protocol interaction preservation and terminal state reachability.

## References

- Honda, K., Yoshida, N., & Carbone, M. (2008). "Multiparty Asynchronous Session Types". POPL '08.
- Deniélou, P.-M., & Yoshida, N. (2012). "Multiparty Session Types Meet Communicating Automata". ESOP '12.
