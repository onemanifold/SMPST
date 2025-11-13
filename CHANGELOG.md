# Changelog

All notable changes to the Scribble MPST IDE will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Technology stack decision documented in UI_SPECIFICATION.md
- Tauri desktop deployment pipeline (disabled, ready for activation)
- Multi-platform build workflow (Windows, macOS, Linux)
- Quality gates in CI/CD (tests must pass before builds)
- Comprehensive versioning scheme (VERSIONING.md)
- Automated GitHub Actions workflows

### Changed
- UI components removed (preparing for fresh implementation with Carbon)
- Simplified App.svelte to placeholder

## [0.1.0-alpha] - 2025-01-11

### Added
- **Parser**: Chevrotain-based Scribble 2.0 parser with 100% test coverage
- **CFG Builder**: AST → Control Flow Graph transformation (all constructs supported)
- **Verification**: 15 verification algorithms covering P0-P3 priorities
  - Deadlock detection (SCC-based)
  - Liveness checking
  - Parallel deadlock detection
  - Race condition detection
  - Progress checking
  - Choice determinism, mergeability, connectedness (P0)
  - Nested recursion, recursion in parallel, fork-join structure (P1)
  - Multicast, self-communication, empty choice branch (P2)
  - Merge reachability (P3)
- **Projection**: CFG → CFSM projection with formal correctness
- **CFG Simulator**: Orchestration-based protocol execution
- **Code Generation**: TypeScript code generation from projections
- Complete test suite (100+ tests, all passing)
- Comprehensive documentation (architecture, design, formal foundations)

### Fixed
- Recursion semantics in CFG builder (continue edge handling)
- Simulator infinite loop in recursive protocols
- Trace recording (protocol-level events only)

## Version Tags

- `v0.1.0-alpha` - Initial backend implementation (unreleased)

[Unreleased]: https://github.com/onemanifold/SMPST/compare/v0.1.0-alpha...HEAD
[0.1.0-alpha]: https://github.com/onemanifold/SMPST/releases/tag/v0.1.0-alpha
