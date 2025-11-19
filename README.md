# Scribble MPST IDE

Modern web-based IDE for Multiparty Session Types with CFG-based verification.

## 📚 Documentation

**→ [Complete Documentation Index](./docs/index.md)** - Start here for comprehensive guides, theory, and architecture docs

**Quick Links:**
- **[Getting Started](./docs/getting-started/cli-quickstart.md)** - 5-minute quickstart
- **[Architecture Overview](./docs/architecture/overview.md)** - System design
- **[Implementation Lessons](./docs/implementation-lessons.md)** - Theory to code insights
- **[Theory & Foundations](./docs/theory/)** - Formal MPST theory
- **[Current Status](./docs/STATUS.md)** - Implementation progress

## Architecture

This project follows a layered architecture where the **Control Flow Graph (CFG)** is the central semantic artifact:

```
Scribble Source → AST → CFG → CFSM → State Machine → Code
```

See [docs/architecture/overview.md](./docs/architecture/overview.md) for a complete explanation.

## Tech Stack

- **Framework**: Svelte 4 + TypeScript
- **Build Tool**: Vite 6
- **Testing**: Vitest
- **Parser**: Chevrotain
- **Codegen**: ts-morph
- **Visualization**: D3.js
- **Storage**: Dexie.js (IndexedDB)

## Getting Started

### Prerequisites

- Node.js 20+ (v22.21.1 confirmed working)
- npm or pnpm

### Installation

```bash
npm install
```

### Development

```bash
# Start dev server with hot reload
npm run dev

# Run tests in watch mode
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Command Line Tools

The SMPST IDE includes powerful CLI tools for working with Scribble protocols.

### Parse Protocols

Validate and inspect protocol syntax:

```bash
npm run parse examples/request-response.scr
```

### Project to Local Protocols

Convert global protocols to local protocols following formal MPST rules:

```bash
# Project all roles
npm run project examples/request-response.scr

# Project specific role
npm run project examples/buyer-seller-agency.scr -- --role Buyer

# Save to files
npm run project examples/login-or-register.scr -- --output-dir ./local

# Show help
npm run project:help
```

**Quick Example:**
```bash
echo "protocol Test(role A, role B) { A -> B: Hello(); }" | npm run project -- --stdin
```

**Documentation:**
- 📖 [CLI Quick Start](./docs/getting-started/cli-quickstart.md) - Get started in 5 minutes
- 📚 [Full CLI Documentation](./docs/reference/cli.md) - Complete reference and examples
- 🔬 [Projection Theory](./docs/reference/projection-spec.md) - Formal specification

**Example Protocols:**
- `examples/request-response.scr` - Simple message passing
- `examples/login-or-register.scr` - Choice constructs
- `examples/stream-data.scr` - Recursion loops
- `examples/buyer-seller-agency.scr` - Three roles with tau-elimination
- `examples/travel-agency.scr` - Complex nested protocol (from spec)

## Project Structure

```
SMPST/
├── src/
│   ├── lib/           # Reusable library code
│   ├── components/    # Svelte components
│   ├── core/          # Core logic (parser, CFG, verification)
│   └── test/          # Test files
├── docs/              # Design documentation
│   ├── architecture-overview.md
│   ├── scribble-2.0-syntax.md
│   ├── ast-design.md
│   └── cfg-design.md
├── .github/
│   └── workflows/
│       └── deploy.yml # GitHub Pages deployment
└── dist/              # Build output (generated)
```

## Development Workflow (TDD)

1. **Write test first**:
   ```typescript
   it('should parse parallel composition', () => {
     const source = 'par { A->B: Msg(); } and { C->D: Msg(); }';
     const ast = parse(source);
     expect(ast.type).toBe('Parallel');
   });
   ```

2. **Run test (it fails)**:
   ```bash
   npm test
   ```

3. **Implement feature**:
   ```typescript
   function parse(source: string): AST {
     // Implementation...
   }
   ```

4. **Run test (it passes)**:
   ```bash
   npm test
   ```

5. **Refactor if needed**

## Documentation

**For complete documentation, see [docs/index.md](./docs/index.md)**

### Core Documentation
- **[Formal Foundations](./docs/foundations.md)** - MPST theory, LTS, Scribble semantics
- **[Architecture Overview](./docs/architecture/overview.md)** - Complete explanation of CFG-based architecture
- **[CFG Design](./docs/architecture/cfg.md)** - CFG structure and verification algorithms
- **[CFSM Architecture](./docs/architecture/cfsm.md)** - CFSM semantics and tau transitions
- **[Implementation Status](./docs/STATUS.md)** - Current status, test coverage, recent changes
- **[Implementation Lessons](./docs/implementation-lessons.md)** - Critical insights from theory to code

### Reference & Tutorials
- **[Scribble Syntax](./docs/reference/scribble-syntax.md)** - EBNF grammar and examples
- **[CLI Reference](./docs/reference/cli.md)** - Complete CLI documentation
- **[Projection Tutorial](./docs/tutorials/projection-tutorial.md)** - Learn global-to-local projection
- **[Theory Documentation](./docs/theory/)** - Formal theory and verification

## Deployment

This project automatically deploys to GitHub Pages on push to `main` branch.

**Live URL**: https://onemanifold.github.io/SMPST/

## Implementation Status

### ✅ Complete & Tested (Layers 1-4)

**Layer 1: Parser**
- ✅ Chevrotain-based Scribble 2.0 parser
- ✅ Full syntax support (message, choice, parallel, recursion, do)
- ✅ 100% test coverage

**Layer 2: CFG Builder**
- ✅ AST → CFG transformation
- ✅ All Scribble constructs implemented
- ✅ Correct recursion semantics (verified against Scribble spec)
- ✅ 100% rule coverage

**Layer 3: Verification** (COMPREHENSIVE - All Gaps Covered)
- ✅ Deadlock detection (SCC-based)
- ✅ Liveness checking
- ✅ Parallel deadlock detection
- ✅ Race condition detection
- ✅ Progress checking
- ✅ Choice determinism (P0 - projection-critical)
- ✅ Choice mergeability (P0 - projection-critical)
- ✅ Connectedness (P0 - projection-critical)
- ✅ Nested recursion (P1 - correctness)
- ✅ Recursion in parallel (P1 - well-formedness)
- ✅ Fork-join structure (P1 - well-formedness)
- ✅ Multicast (P2 - semantic correctness)
- ✅ Self-communication (P2 - semantic validation)
- ✅ Empty choice branch (P2 - structural)
- ✅ Merge reachability (P3 - structural)
- ✅ 47/47 tests passing (15 algorithms total)

**Layer 4: CFG Simulator**
- ✅ Orchestration-based execution
- ✅ Sequential protocols
- ✅ Choice execution (internal/external)
- ✅ Parallel interleaving
- ✅ Recursion (simple, conditional, nested)
- ✅ Trace recording
- ✅ 23/23 tests passing

**Test Results**: All implemented layers have 100% test pass rate

### 🚧 In Progress

**Layer 5: Projection & CFSM**
- Design phase
- CFG → per-role CFSM projection

### ⏸️ Planned

**Layer 6: Code Generation**
- TypeScript/JavaScript code generation
- Type guards and assertions
- Runtime library integration

**UI & Visualization**
- D3 visualization for CFG/CFSM
- Interactive simulation UI
- Message trace visualization

**Advanced Features**
- Persistence (IndexedDB via Dexie)
- Protocol library
- Export/import protocols
- WebRTC-based P2P testing

## Contributing

This is a research/educational project. Contributions welcome!

## License

MIT
