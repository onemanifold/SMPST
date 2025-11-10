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

## Design Documents

- **[Architecture Overview](./docs/architecture-overview.md)** - Complete explanation of CFG-based architecture
- **[Scribble 2.0 Syntax](./docs/scribble-2.0-syntax.md)** - EBNF grammar and examples
- **[AST Design](./docs/ast-design.md)** - TypeScript AST type definitions
- **[CFG Design](./docs/cfg-design.md)** - CFG structure and verification algorithms

## Deployment

This project automatically deploys to GitHub Pages on push to `main` branch.

**Live URL**: https://onemanifold.github.io/SMPST/

## Key Features (Planned)

### Phase 1: Core Features
- ✅ Project setup with Vite + Svelte + TypeScript
- ✅ GitHub Pages deployment
- ✅ Vitest TDD infrastructure
- ⏳ Scribble 2.0 parser (Chevrotain)
- ⏳ CFG builder with parallel composition
- ⏳ Verification algorithms (deadlock, liveness, etc.)
- ⏳ CFSM projection
- ⏳ D3 visualization for CFG/CFSM

### Phase 2: Runtime
- ⏳ State machine execution
- ⏳ Interactive simulation
- ⏳ Message trace visualization

### Phase 3: Code Generation
- ⏳ TypeScript/JavaScript code generation
- ⏳ Type guards and assertions
- ⏳ Runtime library integration

### Phase 4: Advanced Features
- ⏳ Persistence (IndexedDB via Dexie)
- ⏳ Protocol library
- ⏳ Export/import protocols
- ⏳ WebRTC-based P2P testing

## Contributing

This is a research/educational project. Contributions welcome!

## License

MIT
