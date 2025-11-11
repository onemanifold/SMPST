# Scribble MPST IDE

Modern web-based IDE for Multiparty Session Types with CFG-based verification.

## Architecture

This project follows a layered architecture where the **Control Flow Graph (CFG)** is the central semantic artifact:

```
Scribble Source → AST → CFG → CFSM → State Machine → Code
```

See [docs/architecture-overview.md](./docs/architecture-overview.md) for a complete explanation.

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

- **[Formal Foundations](./docs/foundations.md)** - MPST theory, LTS, Scribble semantics
- **[Architecture Overview](./docs/architecture-overview.md)** - Complete explanation of CFG-based architecture
- **[CFG Design](./docs/cfg-design.md)** - CFG structure and verification algorithms
- **[Implementation Status](./docs/STATUS.md)** - Current status, test coverage, recent changes
- **[Scribble 2.0 Syntax](./docs/scribble-2.0-syntax.md)** - EBNF grammar and examples
- **[AST Design](./docs/ast-design.md)** - TypeScript AST type definitions

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

**Layer 3: Verification**
- ✅ Deadlock detection (SCC-based)
- ✅ Liveness checking
- ✅ Parallel deadlock detection
- ✅ Race condition detection
- ✅ Progress checking
- ✅ 24/24 tests passing

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
