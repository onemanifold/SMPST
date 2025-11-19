# Architecture Documentation

This section contains architectural design documents describing the system's structure and key design decisions.

**Purpose:** Provide abstract, implementation-agnostic architecture suitable for reimplementation in any language.

---

## 🏗️ System Architecture

### Core Pipeline

```
Scribble Source → AST → CFG → CFSM → State Machine → Code
```

The architecture follows a **layered transformation pipeline** where each layer has clear responsibilities:

---

## 📚 Architecture Documents

### 1. [Architecture Overview](overview.md)
**Complete system design and layered architecture**

- CFG-based verification pipeline
- Layer-by-layer transformation
- Design rationale and trade-offs
- Integration between components

**Read this first** to understand the overall system design.

---

### 2. [AST Design](ast.md)
**Abstract Syntax Tree structure and type definitions**

- Complete AST node types for Scribble 2.0
- Protocol declarations, role definitions
- Message passing, choice, parallel, recursion
- Sub-protocol support
- TypeScript type definitions (transferable to other languages)

**Key Design Decisions:**
- Strongly typed AST nodes
- Immutable data structures
- Separate nodes for each Scribble construct

---

### 3. [CFG Design](cfg.md)
**Control Flow Graph construction and semantics**

- CFG node types (initial, action, fork, join, merge, terminal)
- Edge types (normal, continue, parallel branches)
- Transformation rules: AST → CFG
- Parallel composition handling
- Recursion and choice semantics

**Key Design Decisions:**
- Actions on edges (not nodes) - following LTS semantics
- Explicit fork/join nodes for parallel composition
- Continue edges for recursion back-edges
- Merge nodes for choice convergence

---

### 4. [CFSM Architecture](cfsm.md) ⭐
**Communicating Finite State Machines - formal definition and critical semantics**

- Formal CFSM definition (LTS-based)
- **Tau transition semantics** (critical for correctness!)
- CFSM action types: send, receive, tau, choice
- Message buffers and FIFO semantics
- Deadlock detection (local and distributed)
- Projection rules: CFG → CFSM
- **OAuth protocol case study** (tau transition bug fix)

**Key Insights:**
- Tau transitions must be applied **eagerly** after each communication
- Without eager tau application, protocols get stuck at intermediate states
- Actions live on transitions (LTS semantics), not on states
- FIFO message buffers enable asynchronous execution

**This document contains critical implementation wisdom** - the tau transition fix that improved test success by 58%.

---

### 5. [Enriched CFSM](enriched-cfsm.md)
**Extended CFSM design with additional features**

- Language extensions beyond basic MPST
- Additional semantic features
- Enhanced verification capabilities
- Implementation considerations

---

### 6. [Projection Algorithm](projection.md)
**Global to local protocol projection**

- Projection rules for each Scribble construct
- Epsilon transitions for irrelevant actions
- Role-specific CFSM generation
- State merging and minimization
- Two-pass algorithm for recursion
- Fork-join optimization

**Key Design Decisions:**
- Epsilon transitions when role not involved
- Recursion labels are transparent (don't create states)
- Only preserve fork/join if role in multiple branches
- Two-pass traversal: forward edges first, then back edges

---

## 🎯 Key Architectural Principles

### 1. Layered Architecture
- Each layer has single responsibility
- Clear transformation rules between layers
- Independent verification at each layer

### 2. CFG as Central Artifact
- Global choreography representation
- Enables comprehensive verification
- Foundation for projection
- Allows multiple execution semantics (sync/async)

### 3. LTS Semantics
- Actions on transitions (not states)
- Formal operational semantics
- Enables duality verification
- Matches process algebra theory

### 4. Verification Before Execution
- Static verification on CFG
- Type checking before runtime
- Early error detection
- Formal correctness guarantees

---

## 📊 Architecture Layers

### Layer 1: Parsing
**Input:** Scribble source code
**Output:** AST
**See:** Parser implementation details

### Layer 2: CFG Construction
**Input:** AST
**Output:** CFG
**See:** [CFG Design](cfg.md)

### Layer 3: Verification
**Input:** CFG
**Output:** Verification results
**Algorithms:** 15 verification checks (deadlock, liveness, safety, etc.)

### Layer 4: CFG Simulation
**Input:** CFG
**Output:** Execution trace
**Semantics:** Synchronous global choreography

### Layer 5: Projection & CFSM
**Input:** CFG
**Output:** Per-role CFSMs
**See:** [Projection](projection.md), [CFSM](cfsm.md)

### Layer 6: Code Generation (Planned)
**Input:** CFSMs
**Output:** Runtime code
**Target:** TypeScript/JavaScript

---

## 🔍 Critical Design Decisions

### Why CFG Over Direct Projection?

**Traditional Approach:**
```
Scribble → AST → Direct Projection → CFSM
```

**Problems:**
- Hard to verify before projection
- No global view for verification
- Difficult to implement complex checks

**Our Approach:**
```
Scribble → AST → CFG → Verification → CFSM
```

**Benefits:**
- ✅ Global verification before projection
- ✅ CFG enables graph algorithms (SCC, reachability)
- ✅ Multiple execution semantics (sync CFG, async CFSM)
- ✅ Educational: visualize global choreography

### Why Actions on Transitions?

**Alternative:** Actions as state properties
**Our Choice:** Actions on transitions (LTS semantics)

**Reasoning:**
- ✅ Clear causality (transition causes state change)
- ✅ Matches formal semantics from literature
- ✅ Easy duality verification (send/receive pairs)
- ✅ Standard in process algebras (CCS, π-calculus)

### Why Eager Tau Application?

**See:** [CFSM Architecture](cfsm.md) for detailed explanation

**Critical Bug:** Without eager tau, protocols get stuck
**Fix:** Apply tau transitions after every communication
**Impact:** 58% improvement in test success rate

---

## 🔗 Related Documentation

- **[Implementation Lessons](../implementation-lessons.md)** - How to implement this architecture
- **[Theory Foundations](../foundations.md)** - Formal theory behind the design
- **[STATUS.md](../STATUS.md)** - Current implementation status

---

## 📚 References

**Key Papers:**
1. **Honda, Yoshida, Carbone (2008)**: MPST foundations
2. **Deniélou & Yoshida (2012)**: CFG/CFSM approach
3. **Scalas & Yoshida (2019)**: "Less is More" (bottom-up MPST)
4. **Milner (1980)**: CCS and tau calculus

**Specifications:**
- Scribble Language Reference v0.3 (2013)

---

**Last Updated:** 2025-11-19
