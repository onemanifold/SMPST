# Golden Protocol Test Suite

This directory contains golden test protocols for regression testing and safe language evolution.

## Purpose

These protocols serve as:
1. **Regression Tests** - Catch breaking changes immediately
2. **Golden Outputs** - Known-correct verified protocols
3. **Documentation** - Examples of all language features
4. **Performance Baselines** - Track projection/verification time

## Structure

```
tests/golden/
├── protocols/           # Source .scr files
├── snapshots/           # Golden outputs (CFG, CFSM, local protocols, verification)
├── metadata/            # Test metadata and expected properties
└── README.md            # This file
```

## Protocol Categories

### Simple

- **request-response** - Basic request-response pattern
- **ping-pong** - Simple ping-pong protocol
- **three-party** - Three-party circular communication

### Choice

- **simple-choice** - Basic binary choice
- **choice-with-continuation** - Choice with different continuations
- **nested-choice** - Nested choice structures

### Multicast

- **simple-multicast** - Basic multicast/broadcast
- **pub-sub** - Pub-sub with acknowledgments
- **multicast-choice** - Multicast combined with choice

### Recursion

- **simple-recursion** - Basic recursion with termination
- **streaming** - Infinite streaming protocol
- **nested-recursion** - Nested recursion structures

### Parallel

- **independent-parallel** - Independent parallel actions
- **parallel-collection** - Parallel result collection

### Complex

- **two-buyer** - Classic two-buyer protocol
- **three-buyer** - Three-buyer with circular sharing
- **two-phase-commit** - Two-phase commit protocol
- **oauth-flow** - OAuth-like authentication flow

### Types

- **simple-types** - Simple type examples
- **parametric-types** - Parametric type examples
- **nested-parametric** - Nested parametric types
- **complex-nesting** - Complex deeply nested types

### Edge-cases

- **unused-role** - Protocol with unused role C
- **many-roles** - Protocol with many roles
- **long-sequence** - Long message sequence

## Running Tests

```bash
# Run all golden tests
npm run test:golden

# Update snapshots (use with caution!)
npm run test:golden:update
```

## Adding New Protocols

1. Add protocol to `scripts/generate-golden-protocols.ts`
2. Run `npm run generate:golden`
3. Run `npm run test:golden` to generate initial snapshots
4. Review and commit snapshots

## Generated: 2025-11-14T14:17:41.023Z

Total protocols: 25
