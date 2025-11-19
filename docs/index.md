# SMPST Documentation Index

Welcome to the SMPST (Scribble Multiparty Session Types) documentation. This is an academic research tool and interactive tutorial for learning about Multiparty Session Types (MPST), their extensions, and variants.

## 📖 About This Documentation

This documentation is designed to enable **complete reimplementation** of the MPST system from theory to practice. It's abstract enough to not be implementation-specific, yet detailed enough to guide reimplementation in any language.

---

## 🎯 Getting Started

**New to SMPST? Start here:**

- **[CLI Quickstart](getting-started/cli-quickstart.md)** - Get up and running in 5 minutes
- **[Installation & Setup](../README.md#installation)** - Setup instructions
- **[First Protocol Example](../README.md#command-line-tools)** - Your first Scribble protocol

---

## 📚 Theory & Formal Foundations

**Complete formal foundations for understanding and reimplementing MPST:**

### Core Theory
- **[MPST Foundations](foundations.md)** - Formal foundations of Multiparty Session Types
- **[Projection Correctness](theory/projection-correctness.md)** - Proof of projection soundness
- **[LTS Operational Semantics](theory/lts-operational-semantics.md)** - Labeled Transition System semantics
- **[CFG-LTS Equivalence](theory/cfg-lts-equivalence.md)** - Control Flow Graph and LTS relationship

### Advanced Theory
- **[Safety vs Consistency](theory/safety-vs-consistency-visual.md)** - Visual explanations of safety properties
- **[Safety Invariant Deep Dive](theory/safety-invariant-deep-dive.md)** - Formal safety guarantees
- **[Bottom-Up MPST](theory/bottom-up-mpst.md)** - Alternative MPST approach
- **[Asynchronous Subtyping](theory/asynchronous-subtyping.md)** - Subtyping in async contexts

### Extensions & Variants
- **[Sub-Protocol Formal Analysis](theory/sub-protocol-formal-analysis.md)** - Protocol composition theory
- **[Parameterized Protocols](theory/parameterized-protocols.md)** - Parameterization support
- **[Exception Handling](theory/exception-handling.md)** - Error handling in session types
- **[Timed Session Types](theory/timed-session-types.md)** - Temporal constraints

### Verification & Testing
- **[Theorem-Driven Testing](theory/THEOREM_DRIVEN_TESTING.md)** - Formal verification approach
- **[Formal Methods Workflow](theory/FORMAL_METHODS_WORKFLOW.md)** - Testing methodology
- **[Completeness Analysis](theory/COMPLETENESS_ANALYSIS.md)** - Verification completeness
- **[FIFO Verification](theory/fifo-verification.md)** - Message ordering guarantees

**[→ See all theory docs](theory/)**

---

## 🏗️ Architecture

**Abstract design suitable for any implementation:**

- **[Architecture Overview](architecture/overview.md)** - Complete system design and CFG-based pipeline
- **[AST Design](architecture/ast.md)** - Abstract Syntax Tree structure
- **[CFG Design](architecture/cfg.md)** - Control Flow Graph construction
- **[CFSM Design](architecture/cfsm.md)** - Communicating Finite State Machines ⭐
- **[Enriched CFSM](architecture/enriched-cfsm.md)** - Extended CFSM with additional features
- **[Projection Algorithm](architecture/projection.md)** - Global to local protocol projection

**Key Insights:**
- The **CFSM document** includes critical tau transition semantics and the OAuth protocol fix
- Architecture is layered: `Scribble → AST → CFG → CFSM → Code`
- CFG is the central semantic artifact

**[→ Architecture index](architecture/)**

---

## 🔧 Implementation Guide

**TypeScript-specific implementation details:**

- **[Implementation Lessons](implementation-lessons.md)** - Critical insights from theory to code ⭐
- **[Parser Implementation](implementation/simulation-engine-design.md)** - Chevrotain-based parser details
- **[Verification Algorithms](../README.md#layer-3-verification)** - 15 verification algorithms
- **[Simulation Engine](implementation/simulation-formal-verification.md)** - CFG and CFSM simulators

**Key Topics in Implementation Lessons:**
- Epsilon transitions for projection
- Two-pass algorithm for recursion
- Tau transition eager application (critical!)
- Async/concurrent architecture patterns
- Theorem-driven testing methodology
- Sub-protocol implementation patterns

**Implementation Status:** See **[STATUS.md](STATUS.md)** for current progress

---

## 📖 Reference Documentation

**Language specifications and API references:**

### Language Reference
- **[Scribble Language Reference](reference/scribble-language.md)** - Complete language spec
- **[Scribble Syntax](reference/scribble-syntax.md)** - EBNF grammar and examples
- **[Projection Specification](reference/projection-spec.md)** - Formal projection rules
- **[Known Limitations](reference/limitations.md)** - Parser and language limitations

### CLI & API
- **[CLI Reference](reference/cli.md)** - Complete command-line interface documentation
- **[Safety API](reference/api/safety-api.md)** - Safety checking API reference

---

## 🎓 Tutorials

**Step-by-step learning guides:**

- **[Projection Tutorial](tutorials/projection-tutorial.md)** - Learn global-to-local projection
- **[Simulation Usage](tutorials/simulation-usage.md)** - Using the CFG and CFSM simulators

---

## 👥 Contributing

**Development workflow and guidelines:**

- **[Development Roadmap](contributing/roadmap.md)** - TDD workflow and layer-by-layer development
- **[Testing Strategy](contributing/testing-strategy.md)** - CFG testing methodology
- **[Implementation Status](STATUS.md)** - Current progress and test results
- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute

---

## 📊 Project Status

**Current Status:** Layer 5 complete (Projection & CFSM Simulation)

**Test Coverage:**
- ✅ Layer 1: Parser (100%)
- ✅ Layer 2: CFG Builder (100%)
- ✅ Layer 3: Verification (47/47 tests)
- ✅ Layer 4: CFG Simulator (23/23 tests)
- ✅ Layer 5: Projection & CFSM (69/69 tests)
- ⏸️ Layer 6: Code Generation (planned)

**See [STATUS.md](STATUS.md) for detailed layer-by-layer status**

---

## 🗂️ Documentation Organization

```
docs/
├── index.md (you are here)          # Master documentation index
├── foundations.md                    # MPST formal foundations
├── implementation-lessons.md         # Critical implementation insights
├── STATUS.md                         # Current implementation status
│
├── getting-started/                  # Quick start guides
│   └── cli-quickstart.md
│
├── theory/                           # Formal theory (20+ documents)
│   ├── projection-correctness.md
│   ├── safety-invariant-deep-dive.md
│   └── ...
│
├── architecture/                     # System design
│   ├── overview.md
│   ├── ast.md
│   ├── cfg.md
│   ├── cfsm.md                      # ⭐ Includes tau semantics
│   └── projection.md
│
├── reference/                        # Language & API specs
│   ├── scribble-syntax.md
│   ├── scribble-language.md
│   ├── cli.md
│   └── api/
│       └── safety-api.md
│
├── tutorials/                        # Step-by-step guides
│   ├── projection-tutorial.md
│   └── simulation-usage.md
│
├── contributing/                     # Development docs
│   ├── roadmap.md
│   └── testing-strategy.md
│
└── implementation/                   # Implementation notes
    └── ...
```

---

## 🔍 Quick Navigation

**Looking for something specific?**

- **How to write protocols?** → [Scribble Syntax](reference/scribble-syntax.md)
- **How projection works?** → [Projection Tutorial](tutorials/projection-tutorial.md)
- **What are CFSMs?** → [CFSM Architecture](architecture/cfsm.md)
- **How to verify protocols?** → [STATUS.md Layer 3](STATUS.md)
- **How to simulate protocols?** → [Simulation Usage](tutorials/simulation-usage.md)
- **Formal foundations?** → [MPST Foundations](foundations.md)
- **Implementation details?** → [Implementation Lessons](implementation-lessons.md)
- **Current progress?** → [STATUS.md](STATUS.md)

---

## 📚 Academic References

This implementation is based on research by:
- **Honda, Yoshida, Carbone** (2008): "Multiparty Asynchronous Session Types"
- **Scalas & Yoshida** (2019): "Less is More: Multiparty Session Types Revisited"
- **Deniélou & Yoshida** (2012): "Multiparty Session Types Meet Communicating Automata"

See individual documents for specific citations.

---

## 📝 License

MIT - See [LICENSE](../LICENSE)

---

**Last Updated:** 2025-11-19
