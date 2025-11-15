# CFSMSimulator Refactoring Plan

## Goal
Add full sub-protocol support with call stack semantics to CFSMSimulator,
making it a true CFSM runtime following formal MPST semantics.

## Changes Required

### 1. Imports
- [x] Import `CallStackFrame` from cfsm-simulator-types

### 2. Class Fields
- [ ] Rename `cfsm` → `rootCFSM` (never changes)
- [ ] Add `currentCFSM: CFSM` (changes during sub-protocol execution)
- [ ] Add `callStack: CallStackFrame[]`
- [ ] Add `cfsmRegistry: Map<string, Map<string, CFSM>>`
- [ ] Update config type to exclude cfsmRegistry

### 3. Constructor
- [ ] Store root CFSM as `rootCFSM`
- [ ] Initialize `currentCFSM = rootCFSM`
- [ ] Initialize `callStack = []`
- [ ] Initialize `cfsmRegistry` from config or empty Map

### 4. getState()
- [ ] Add `callStack: [...this.callStack]` to return value

### 5. getEnabledTransitions()
- [ ] Change `this.cfsm.transitions` → `this.currentCFSM.transitions`

### 6. step()
- [ ] Check if current state is terminal
- [ ] If terminal and callStack.length > 0: pop and return to parent
- [ ] Emit 'step-out' event when popping
- [ ] Otherwise proceed normally

### 7. fireTransition()
- [ ] Add case for 'subprotocol' action type
- [ ] Call `executeSubProtocol(transition)`

### 8. executeSubProtocol() [NEW METHOD]
- [ ] Look up sub-protocol CFSM from registry
- [ ] Find formal role for this participant using roleMapping
- [ ] Get sub-protocol CFSM for that role
- [ ] Push call stack frame (parentCFSM, returnState, roleMapping, protocol)
- [ ] Switch currentCFSM to sub-protocol CFSM
- [ ] Transition to sub-protocol initial state
- [ ] Emit 'step-into' event
- [ ] Return success result

### 9. Terminal State Handling
- [ ] Update `isComplete()` to check `currentCFSM.terminalStates`
- [ ] Update completion logic to handle call stack

### 10. All CFSM References
- [ ] Find all `this.cfsm` references
- [ ] Update to `this.currentCFSM` where appropriate
- [ ] Keep `this.rootCFSM` for role name, etc.

### 11. Reset
- [ ] Reset `currentCFSM = this.rootCFSM`
- [ ] Clear `callStack = []`

### 12. Async Support (Future - separate PR)
- Make step() async
- Update DistributedSimulator to await

## Testing Strategy
1. Existing tests should still pass (no sub-protocols)
2. Add sub-protocol execution test
3. Add nested sub-protocol test
4. Test step-into/step-out events
5. Test call stack preservation across steps

## Formal Correctness
Following docs/SUB_PROTOCOL_FORMAL_SEMANTICS.md:
- Rule [CALL]: Push frame, switch CFSM
- Rule [RETURN]: Pop frame on terminal, restore parent
- σ (sigma) substitution: formal params → actual roles
