# DMst Architecture - Simulator Extension Refactor

**Status**: RECOMMENDED FOR FOLLOW-UP
**Priority**: Medium (Code Quality Improvement)
**Blocking PR**: No - Current architecture is functional

---

## Current State

### ✅ Proper Inheritance (Working)

```typescript
// Runtime Executor
class Executor { ... }
class DMstExecutor extends Executor { ... }  // ✅ CORRECT
```

```typescript
// State Types
interface SimulationState { ... }
interface DMstSimulationState extends SimulationState { ... }  // ✅ CORRECT
```

### ❌ Missing Inheritance (Code Duplication)

```typescript
// Simulators
class Simulator { ... }                    // Base simulator
class DMstSimulator { ... }                 // ❌ Should extend Simulator
```

**Issue**: DMstSimulator duplicates ~300 lines of code from Simulator

---

## Why Refactor?

### Benefits
1. **Code Reuse**: Eliminate ~300 lines of duplicated logic
2. **Time-Travel Debugging**: Inherit trace/replay capabilities
3. **Maintainability**: Single source of truth for simulator logic
4. **Consistency**: Mirrors DMstExecutor → Executor pattern

### Current Duplication

**Duplicated Methods**:
- `step(role?)` - Fair scheduling logic
- `run(maxSteps?)` - Run loop
- `pause()` - Pause signal
- `reset()` - State reset
- `addObserver()` / `removeObserver()` - Observer pattern
- `getTrace()` - Trace access
- `injectMessage()` - Test helper

**Lines of Duplication**: ~300 / 751 (40%)

---

## Refactor Plan

### Phase 1: Make DMstSimulator extend Simulator

```typescript
export class DMstSimulator extends Simulator {
  // DMst-specific state
  private dynamicCFSMs: Map<string, CFSM>;
  private versionRegistry: CFSMVersionRegistry;
  private cfsmRegistry: Map<string, Map<string, CFSM>>;

  constructor(
    staticRoles: Map<string, CFSM>,
    dynamicRoles: Map<string, CFSM> = new Map(),
    transport?: MessageTransport,
    cfsmRegistry?: Map<string, Map<string, CFSM>>,
    options?: {
      recordTrace?: boolean;
      protocolName?: string;
    }
  ) {
    // Convert to base Simulator config
    const config: SimulatorConfig = {
      roles: staticRoles,
      transport,
      options: {
        recordTrace: options?.recordTrace,
        maxSteps: 1000,
        strictMode: false,
      },
    };

    super(config);  // ← Call base constructor

    // DMst-specific setup
    this.dynamicCFSMs = dynamicRoles;
    this.cfsmRegistry = cfsmRegistry || new Map();
    this.versionRegistry = createVersionRegistry();
    this.protocolName = options?.protocolName || 'UnnamedProtocol';

    // Replace base executors with DMstExecutors
    this.replaceExecutorsWithDMstExecutors(staticRoles);
  }

  private replaceExecutorsWithDMstExecutors(roles: Map<string, CFSM>): void {
    // Clear base executors
    this.executors.clear();

    // Create DMstExecutors
    for (const [role, cfsm] of roles.entries()) {
      registerInitialVersion(this.versionRegistry, this.protocolName, role, cfsm);

      const config: DMstExecutorConfig = {
        role,
        cfsm,
        transport: this.transport,
        cfsmRegistry: this.cfsmRegistry,
        dynamicRegistry: this.state.dynamicParticipants,
        dynamicCFSMs: this.dynamicCFSMs,
        cfsmVersion: 1,
        protocolName: this.protocolName,
      };

      this.executors.set(role, new DMstExecutor(config));
    }
  }
}
```

### Phase 2: Override DMst-Specific Methods

```typescript
export class DMstSimulator extends Simulator {
  // ... constructor from Phase 1 ...

  /**
   * Override step() to add DMst-specific behavior
   */
  override async step(targetRole?: string): Promise<SimulationStepResult> {
    // DMst pre-processing
    await this.processPendingInvitations();

    // Call base implementation
    const result = await super.step(targetRole);

    // DMst post-processing
    if (result.success && result.updates) {
      for (const [role, update] of result.updates) {
        await this.handleDMstMessages(role, update);
      }
    }

    // Update DMst state
    this.syncStateFromExecutors();
    const completed = allParticipantsTerminated(this.state);
    const deadlocked = detectDMstDeadlock(this.state, this.transport);

    return {
      ...result,
      completed,
      deadlocked,
    };
  }

  /**
   * DMst-specific: Process pending invitations
   */
  private async processPendingInvitations(): Promise<void> {
    // ... existing implementation ...
  }

  /**
   * DMst-specific: Handle create/invite messages
   */
  private async handleDMstMessages(
    role: string,
    result: ExecutionResult
  ): Promise<void> {
    // ... existing implementation ...
  }

  /**
   * DMst-specific: Sync state from executors
   */
  private syncStateFromExecutors(): void {
    // ... existing implementation ...
  }
}
```

### Phase 3: Remove Duplicated Code

**Delete** (inherited from base):
- `run()` - Unless DMst-specific behavior needed
- `pause()` - Inherited
- `reset()` - Inherited (may need override for version registry)
- `getTrace()` - Inherited
- `addObserver()` / `removeObserver()` - Inherited
- `injectMessage()` - Inherited

**Keep** (DMst-specific):
- `processPendingInvitations()`
- `handleDMstMessages()`
- `syncStateFromExecutors()`
- `broadcastUpdate()` (Sprint 3)
- DMst state accessors

---

## Testing Strategy

### Regression Tests
1. Run full DMst test suite
2. Verify all 117 updatable recursion tests pass
3. Verify integration tests pass
4. Check observer/trace functionality

### New Tests
1. Verify inherited methods work correctly
2. Test DMst-specific overrides
3. Verify version registry integration

---

## Risks

### Medium Risk
- **State Management**: DMstSimulationState extends SimulationState ✅ (compatible)
- **Executor Types**: Need to ensure type safety with DMstExecutor
- **Method Overrides**: Must preserve DMst semantics

### Low Risk
- TypeScript compilation errors (easily fixable)
- Test failures (indicate issues to fix)

### Mitigation
- Small, incremental commits
- Run tests after each phase
- Keep both implementations until tests pass

---

## Estimated Effort

- **Phase 1**: 2 hours (constructor refactor, executor replacement)
- **Phase 2**: 1 hour (method overrides)
- **Phase 3**: 1 hour (cleanup, remove duplicates)
- **Testing**: 1 hour
- **Total**: ~5 hours

---

## Recommendation

**For This PR**: Document as tech debt, do NOT implement
**Reason**:
- Functional architecture already in place
- Risk vs. reward not favorable before PR
- DMstExecutor properly extends Executor ✅
- No functional gaps

**For Next Sprint**: Implement as code quality improvement
**Benefit**: Cleaner code, less duplication, better maintainability

---

## Current PR Status

### ✅ COMPLETE - Ready for PR
1. Projection layer: All DMst actions project to CFSM
2. Integration tests: Pipeline verified
3. Runtime: executeCreate, executeInvite working
4. Verification: Definition 14 & Theorem 20 complete
5. Documentation: DMST_FEATURES.md

### ✅ ARCHITECTURE - Working
1. DMstExecutor extends Executor ✅
2. DMstSimulationState extends SimulationState ✅
3. Full pipeline functional ✅

### 📋 TECH DEBT - Not Blocking
1. DMstSimulator should extend Simulator (code quality)
2. Comprehensive test suites for dynamic participants
3. Theorem 23/29 dedicated test suites

---

**Last Updated**: 2025-11-18
**Status**: Architecture is functional, refactor is optional cleanup
**PR Decision**: Ship without refactor, address in follow-up
