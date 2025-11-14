# Contributing to Scribble MPST IDE

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## Getting Started

### Prerequisites

- Node.js 20+ (v22.21.1 confirmed working)
- npm or pnpm
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/onemanifold/SMPST.git
cd SMPST

# Install dependencies
npm install

# Run tests to verify setup
npm test

# Start development server
npm run dev
```

### Project Structure

```
SMPST/
├── src/
│   ├── core/         # Backend implementation
│   │   ├── parser/   # Scribble parser
│   │   ├── cfg/      # Control Flow Graph
│   │   ├── verification/  # Protocol verification
│   │   ├── projection/    # CFSM projection
│   │   └── simulation/    # Protocol simulator
│   └── lib/          # UI components (pending implementation)
├── docs/             # Design documentation
└── .github/          # CI/CD workflows
```

---

## Development Workflow

We follow **Test-Driven Development (TDD)**:

### 1. Create a Feature Branch

```bash
# Branch naming convention: feature/description or fix/description
git checkout -b feature/add-new-verification-check
```

### 2. Write Tests First

```typescript
// Example: src/core/verification/new-check.test.ts
describe('New Verification Check', () => {
  it('should detect the issue', () => {
    const protocol = '...'; // Test case
    const result = newCheck(protocol);
    expect(result.passed).toBe(false);
  });

  it('should pass for valid protocol', () => {
    const protocol = '...'; // Valid case
    const result = newCheck(protocol);
    expect(result.passed).toBe(true);
  });
});
```

### 3. Run Tests (They Should Fail)

```bash
npm test
# Tests fail (red) - expected!
```

### 4. Implement Feature

```typescript
// src/core/verification/new-check.ts
export function newCheck(protocol: string): CheckResult {
  // Implementation...
}
```

### 5. Run Tests Until They Pass

```bash
npm test
# Tests pass (green) ✅
```

### 6. Refactor & Document

- Clean up code
- Add JSDoc comments
- Update documentation

### 7. Commit Changes

```bash
git add .
git commit -m "feat: add new verification check"
```

**Commit Message Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `test`: Adding/updating tests
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `ci`: CI/CD changes

---

## Pull Request Process

### Before Submitting

1. ✅ **All tests pass**: `npm test`
2. ✅ **Code is formatted**: Follows project style
3. ✅ **TypeScript compiles**: `npx tsc --noEmit`
4. ✅ **Documentation updated**: README, JSDoc, etc.
5. ✅ **CHANGELOG updated**: Add entry under `[Unreleased]`

### Creating a Pull Request

1. **Push your branch**:
   ```bash
   git push origin feature/add-new-verification-check
   ```

2. **Open PR on GitHub**:
   - Use descriptive title: "feat: add new verification check"
   - Fill out PR template
   - Link related issues: "Closes #123"
   - Describe changes, motivation, and impact

3. **⚠️ IMPORTANT - PR Description Policy**:
   - ❌ **NEVER commit PR descriptions** to the repository (e.g., `PR_DESCRIPTION.md`, `PULL_REQUEST.md`)
   - ✅ Write PR descriptions **directly in GitHub's PR interface only**
   - **Rationale**: PR descriptions are GitHub metadata, not repository documentation
   - Committing PR descriptions is considered a bad practice that clutters the repository

4. **PR Checklist**:
   - [ ] Tests added/updated
   - [ ] Documentation updated
   - [ ] CHANGELOG.md updated
   - [ ] No breaking changes (or documented if necessary)
   - [ ] All CI checks passing

### Review Process

- Maintainers will review within 2-3 business days
- Address review comments
- Keep PR focused (one feature/fix per PR)
- Squash commits if requested

### After Approval

- PR will be squashed and merged to `main`
- Your contribution will be credited in release notes

---

## Coding Standards

### TypeScript

- **Strict mode**: Always enabled
- **Type annotations**: Required for function parameters and returns
- **No `any`**: Use proper types or `unknown`
- **Prefer interfaces**: Over `type` for object shapes

```typescript
// Good
function parse(source: string): ParseResult {
  // ...
}

// Avoid
function parse(source) {  // Missing type
  // ...
}
```

### Naming Conventions

- **Variables/Functions**: `camelCase`
- **Classes/Types**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: `kebab-case.ts`

```typescript
const MAX_RETRIES = 3;                  // Constant
class ProtocolParser { }                // Class
interface ParseResult { }               // Interface
function parseProtocol(source: string) // Function
```

### Code Organization

- **One export per file** (exceptions for related utilities)
- **Barrel exports**: Use `index.ts` to re-export public API
- **Separation of concerns**: Business logic separate from UI

### Comments

- **JSDoc**: Required for all public APIs
- **Inline comments**: Explain "why", not "what"
- **TODO comments**: Include issue number: `// TODO(#123): Fix edge case`

```typescript
/**
 * Parses a Scribble protocol into an AST.
 *
 * @param source - The Scribble protocol source code
 * @returns The parsed AST or error
 * @throws {ParseError} If the syntax is invalid
 */
export function parse(source: string): ParseResult {
  // Implementation...
}
```

---

## Testing Requirements

### Coverage Requirements

- **Minimum**: 80% statement coverage
- **Target**: 100% for critical paths (parser, verification)
- **Run coverage**: `npm run test:coverage`

### Test Structure

```typescript
describe('Feature Name', () => {
  // Setup
  beforeEach(() => {
    // Common setup
  });

  describe('Subfeature', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = '...';

      // Act
      const result = doSomething(input);

      // Assert
      expect(result).toBe(expected);
    });

    it('should handle edge case', () => {
      // Test edge cases
    });

    it('should throw on invalid input', () => {
      expect(() => doSomething(invalid)).toThrow();
    });
  });
});
```

### What to Test

- **Happy path**: Normal, expected usage
- **Edge cases**: Boundary conditions, empty inputs
- **Error cases**: Invalid inputs, error handling
- **Integration**: Components working together

### Testing Tools

- **Vitest**: Test runner (Jest-compatible API)
- **@testing-library/svelte**: Component testing (when UI implemented)
- **Coverage**: V8 coverage reports

### Golden Tests (Regression Testing)

**Golden tests** ensure that language evolution doesn't break existing functionality by using snapshot-based testing.

#### What are Golden Tests?

Golden tests compare the output of the compiler pipeline against known-correct "golden" snapshots:
- **CFG structure**: Control flow graph nodes and edges
- **Verification results**: Deadlock, liveness, race condition detection
- **CFSM projections**: State machines for each role
- **Local protocols**: Serialized Scribble text

#### Running Golden Tests

```bash
# Run all golden tests
npm run test:golden

# Watch mode for development
npm run test:golden:watch

# View test results
npm run test:golden 2>&1 | grep -E "Test Files|Tests|Duration"
```

#### When Golden Tests Fail

Golden tests failing means **something changed in the compiler output**:

1. **Review the diff**:
   ```bash
   npm run test:golden
   # CI will show the diff in the output
   ```

2. **Determine if the change is intentional**:
   - ✅ **Intentional** (new feature, bug fix): Update snapshots
   - ❌ **Unintentional** (regression): Fix the code

3. **Update snapshots** (only if intentional):
   ```bash
   npm run test:golden:update
   # Review changes, then commit
   git add tests/golden/snapshots/
   git commit -m "Update golden snapshots for [feature/fix]"
   ```

#### Adding New Golden Protocols

To add a new protocol to the golden test suite:

1. **Edit the generator script**:
   ```typescript
   // scripts/generate-golden-protocols.ts
   const protocols: ProtocolSpec[] = [
     // ... existing protocols
     {
       name: 'my-new-protocol',
       category: 'complex',  // or simple, choice, multicast, recursion, parallel, types, edge-cases
       source: `
         protocol MyProtocol(role A, role B) {
           A -> B: Message(String);
         }
       `,
       description: 'Description of what this protocol tests',
       expectedValid: true,
       expectedProperties: {
         roles: ['A', 'B'],
         hasDeadlock: false,
         hasRaces: false,
         messageCount: 1,
       },
       performance: {
         maxParseTimeMs: 100,
         maxProjectionTimeMs: 200,
       },
     },
   ];
   ```

2. **Regenerate protocols and metadata**:
   ```bash
   npm run generate:golden
   ```

3. **Run tests to create snapshots**:
   ```bash
   npm run test:golden
   ```

4. **Review and commit**:
   ```bash
   git add tests/golden/
   git commit -m "Add golden test for [protocol feature]"
   ```

#### Why Golden Tests Matter

Golden tests are **critical for safe language evolution**:

- **Breaking Change Detection**: Immediately catch unintended changes
- **Refactoring Confidence**: Verify outputs remain identical after refactoring
- **Performance Regression**: Track projection/verification time
- **Documentation**: Serve as living examples of all language features
- **Feature Development**: See exactly what changes when adding new features

**Example workflow when adding refinement types:**

1. Add test protocol with refinement: `Age(Int{x > 0})`
2. Run golden tests → many fail (expected)
3. Review diffs → CFSM now includes refinement AST
4. Verify other tests still pass (no unintended changes)
5. Update snapshots
6. Commit with clear message

#### Golden Test Categories

Current test suite covers:

- **simple**: Basic request-response, ping-pong (3 protocols)
- **choice**: Binary choice, nested choice (3 protocols)
- **multicast**: Broadcast, pub-sub (3 protocols)
- **recursion**: Loops, streaming, nested recursion (3 protocols)
- **parallel**: Independent actions, result collection (2 protocols)
- **complex**: TwoBuyer, ThreeBuyer, 2PC, OAuth (4 protocols)
- **types**: Simple, parametric, nested parametric (4 protocols)
- **edge-cases**: Unused roles, many roles, long sequences (3 protocols)

**Total: 25 golden protocols** covering all language features.

---

## Documentation

### Types of Documentation

1. **Code Comments**: Inline explanations (sparingly)
2. **JSDoc**: API documentation (required for public APIs)
3. **README**: Project overview and quick start
4. **Design Docs**: Architecture decisions (`docs/` folder)
5. **CHANGELOG**: User-facing changes

### Documentation Standards

- **Clear and concise**: Avoid jargon when possible
- **Examples**: Provide code examples for complex features
- **Keep updated**: Update docs with code changes
- **Link to references**: Academic papers, specs, etc.

### Design Documents

When proposing significant changes:

1. Create a design document in `docs/`
2. Describe the problem, proposed solution, alternatives
3. Include examples and diagrams
4. Get feedback before implementing

---

## Adding Future Features

This section documents insights and best practices for adding new features to the Scribble implementation, based on lessons learned from theorem-driven development and formal correctness work.

### Formal Correctness First

**Before implementing any new feature, establish its formal semantics:**

1. **Literature Review**: Find academic papers defining the feature
   - Session types extensions (Honda, Yoshida, Carbone)
   - Behavioral types (Deniélou & Yoshida)
   - Protocol specifications (Scribble papers)

2. **Formal Definition**: Document the mathematical model
   ```typescript
   /**
    * FORMAL DEFINITION (Author et al. Year):
    *
    * Feature F is defined as: [mathematical notation]
    *
    * Properties:
    * - Property 1: [formal statement]
    * - Property 2: [formal statement]
    *
    * @reference Author, A., & Author, B. (Year). Paper Title. Conference/Journal.
    */
   ```

3. **Theorem Identification**: List theorems that must hold
   - Soundness: Does feature preserve protocol correctness?
   - Completeness: Are all valid cases covered?
   - Composability: Does feature interact correctly with others?

**Example**: Exception handling
- See `docs/theory/exceptions.md` for formal semantics
- Reference: Carbone & Montesi's work on exception propagation
- Theorems: Exception safety, handler completeness

### Grammar Design: Avoiding Ambiguity

When adding new syntax, **prevent parser conflicts**:

#### Pattern 1: Lookahead-Based Disambiguation

```typescript
// Problem: Two rules start with same tokens
private ruleA = this.RULE('ruleA', () => {
  this.CONSUME(tokens.Protocol);
  this.CONSUME(tokens.Identifier);
  // ... rest of rule
});

private ruleB = this.RULE('ruleB', () => {
  this.CONSUME(tokens.Protocol);
  this.CONSUME(tokens.Identifier);
  this.CONSUME(tokens.Extends);  // Distinguishing token
  // ... rest of rule
});

// Solution: Use GATE for lookahead
private moduleDeclaration = this.RULE('moduleDeclaration', () => {
  this.OR([
    {
      GATE: () => this.LA(3).tokenType === tokens.Extends,
      ALT: () => this.SUBRULE(this.ruleB)
    },
    { ALT: () => this.SUBRULE(this.ruleA) },
  ]);
});
```

#### Pattern 2: Unified Rule with Post-Processing

```typescript
// Instead of separate rules, parse generically then specialize
private unifiedRule = this.RULE('unifiedRule', () => {
  this.CONSUME(tokens.CommonPrefix);
  // ... parse common structure

  // Optional distinguishing suffix
  this.OPTION(() => {
    this.CONSUME(tokens.DistinguishingToken);
    // ... parse extension
  });
});
```

#### Pattern 3: Keyword-First Design

```typescript
// Require distinguishing keyword BEFORE common prefix
// BAD:  protocol P(...) extends Q  vs  protocol P(...)
// GOOD: protocol P(...)  vs  extends protocol P(...) from Q
```

### Temporary Disabling: The TODO Pattern

If a feature causes ambiguity, **disable it with comprehensive documentation**:

```typescript
private moduleDeclaration = this.RULE('moduleDeclaration', () => {
  this.OR([
    { ALT: () => this.SUBRULE(this.globalProtocolDeclaration) },

    // TODO: Re-enable Protocol Subtyping (Phase 5)
    // DISABLED: Grammar ambiguity with globalProtocolDeclaration
    //
    // ISSUE:
    //   Both rules start with: Protocol Identifier TypeParameters? LParen
    //   Parser cannot distinguish until it sees 'extends' keyword.
    //
    // RESOLUTION STRATEGIES:
    //   1. Lookahead: Use GATE to check for 'extends' after role parameters
    //   2. Unified Rule: Parse as globalProtocolDeclaration, check for extends
    //   3. Keyword First: Require 'extends protocol' vs 'protocol' syntax
    //
    // DEPENDENCIES:
    //   - Subtyping theory implementation (docs/theory/subtyping.md)
    //   - Projection rules for subtyping
    //   - Verification: subtype relation checking
    //
    // REFERENCES:
    //   - Gay & Hole (2005): Subtyping for session types
    //   - Honda et al. (2008): Asynchronous subtyping
    //
    // See: docs/FUTURE_FEATURES.md for full plan
    //
    // { ALT: () => this.SUBRULE(this.protocolExtension) },

    { ALT: () => this.SUBRULE(this.localProtocolDeclaration) },
  ]);
});
```

**Create tracking document**: `docs/FUTURE_FEATURES.md`

### Separation of Concerns: Implementation vs. Formal Model

**Keep implementation details separate from formal semantics:**

#### Example: CFG vs. LTS

**WRONG - Polluting formal model:**
```typescript
// CFSM is formally an LTS, not a CFG
interface CFSM {
  states: CFSMState[];     // LTS: Q
  transitions: Transition[]; // LTS: →
  nodes?: any[];           // ❌ CFG pollution!
  edges?: any[];           // ❌ CFG pollution!
}
```

**RIGHT - Separation:**
```typescript
// Formal model (LTS)
interface CFSM {
  states: CFSMState[];       // Q
  transitions: Transition[]; // →
  initialState: string;      // q₀
  terminalStates: string[];  // Q_term
}

// Implementation detail (separate file)
// src/core/cfg/types.ts
interface CFG {
  nodes: CFGNode[];
  edges: CFGEdge[];
}

// Optional conversion (when needed)
// src/core/projection/cfg-view.ts
function buildCFGView(cfsm: CFSM): CFG {
  // Convert LTS to CFG for visualization/simulation
}
```

### Theorem-Driven Testing

**Write tests that verify formal properties, not implementation details:**

#### Test Structure Template

```typescript
/**
 * THEOREM X.Y: [Name] (Author et al. Year)
 *
 * STATEMENT:
 *   [Formal statement in mathematical notation]
 *
 * FORMAL PROPERTY:
 *   [Property being tested]
 *
 * LTS/FORMAL REPRESENTATION:
 *   [Visual diagram or formal notation]
 *
 * WHY THIS TEST IS VALID:
 *   [Explanation of testing methodology]
 *
 * @reference Author, A., et al. (Year). Paper. Conference, Section X.Y
 */
describe('Theorem X.Y: [Name]', () => {
  describe('Proof Obligation 1: [Property]', () => {
    it('proves: [specific claim]', () => {
      const protocol = `...`;

      // Parse and project
      const ast = parse(protocol);
      const projections = projectAll(buildCFG(ast.declarations[0]));

      // Test using LTS primitives (not implementation details)
      const cfsm = projections.cfsms.get('RoleName')!;

      // FORMAL CHECK: [What we're verifying]
      const property = checkProperty(cfsm);
      expect(property).toBe(expectedValue);
      // ✅ PROOF: [What this proves]
    });
  });
});
```

#### Use LTS Primitives, Not Implementation Details

```typescript
// ❌ BAD - Testing implementation details (CFG structure)
const branches = cfsm.nodes.filter(n => n.type === 'branch');
const actions = cfsm.nodes.filter(isActionNode);

// ✅ GOOD - Testing formal properties (LTS semantics)
import { findBranchingStates, countActions } from '../lts-analysis';

const branches = findBranchingStates(cfsm);
const actionCount = countActions(cfsm, 'send') + countActions(cfsm, 'receive');
```

### Documentation Requirements for New Features

Every new feature must include:

1. **Theory Document**: `docs/theory/[feature].md`
   - Formal definition from literature
   - Theorems that must hold
   - Examples demonstrating the feature
   - References to academic papers

2. **Implementation Guide**: Inline comments
   ```typescript
   /**
    * Implements [feature] according to [Author et al. Year]
    *
    * FORMAL SEMANTICS:
    *   [Brief formal description]
    *
    * ALGORITHM:
    *   1. [Step 1]
    *   2. [Step 2]
    *   ...
    *
    * For teaching: [Intuitive explanation]
    *
    * @reference [Paper citation]
    */
   ```

3. **Test Documentation**: As shown above

4. **Integration Plan**: Update `docs/THEORY_INTEGRATION_PLAN.md`
   - Add feature to appropriate phase
   - List dependencies
   - Identify research gaps (use Perplexity if needed)

### Feature Implementation Checklist

Before merging a new feature:

- [ ] **Formal semantics documented** (`docs/theory/[feature].md`)
- [ ] **Parser grammar** (no ambiguities)
- [ ] **AST types** (with formal documentation)
- [ ] **CFG construction** (if needed)
- [ ] **Projection rules** (with theorem references)
- [ ] **Verification checks** (formal properties)
- [ ] **Theorem-based tests** (all passing)
- [ ] **LTS analysis functions** (if new primitives needed)
- [ ] **Integration tests** (feature interacts correctly)
- [ ] **Documentation** (theory + inline + examples)
- [ ] **Literature references** (proper citations)

### Examples in This Codebase

**Completed Features:**
- **Basic projection**: See `src/core/projection/`
  - Theory: `docs/theory/projection-correctness.md`
  - Tests: `src/__tests__/theorems/projection/`
  - LTS analysis: `src/core/projection/lts-analysis.ts`

**Disabled Features (with TODOs):**
- **Protocol subtyping**: See `src/core/parser/parser.ts:39-46`
- **Exception handling**: See `src/core/parser/parser.ts:266-272`
- **Timed session types**: See `src/core/parser/parser.ts:250-257`

**Theory Documents:**
- `docs/theory/asynchronous-subtyping.md`
- `docs/theory/exception-handling-semantics.md`
- `docs/theory/timed-session-types.md`

### Getting Help

If you're implementing a complex feature:

1. **Create design doc** in `docs/implementation/[feature]-design.md`
2. **Use Perplexity proxy** for literature review (see next section)
3. **Open discussion** on GitHub to get feedback
4. **Ask for theory review** from maintainers before implementation

---

## Perplexity Proxy Workflow (AI Contributions)

When AI assistants (like Claude) contribute to the project, they may encounter access restrictions when trying to retrieve academic papers, theorems, or formal proofs from certain websites (e.g., 403 errors due to AI site interaction policies).

### The Problem

AI assistants need access to:
- Academic papers for formal theory
- Theorem proofs for verification correctness
- Formal specifications for implementation
- Citations for documentation

However, many academic sites block automated access, causing 403 errors.

### The Solution: Perplexity Proxy

Use **Perplexity AI** as a proxy to access papers and synthesize knowledge:

#### Step 1: AI Generates Perplexity Prompt

When blocked, the AI assistant will generate a detailed Perplexity prompt like:

```markdown
## Perplexity Prompt: [Topic Name]

I'm implementing [feature] in the SMPST project. I need to understand:

1. [Specific question 1]
2. [Specific question 2]
3. [Formal definition/theorem statement]
4. [Implementation guidance]

Please provide:
- Formal definitions with citations
- Theorem statements and proof sketches
- Examples demonstrating the concept
- References to specific papers (with URLs if available)

Cite: [List of papers to reference]
```

**Examples in this project**:
- See `docs/THEORY_INTEGRATION_PLAN.md` Section 4 for Perplexity prompts
- Topics include: asynchronous semantics, parameterized protocols, exception handling, etc.

#### Step 2: Human Proxies the Request

1. Copy the Perplexity prompt
2. Paste into [Perplexity AI](https://www.perplexity.ai/)
3. Copy the response
4. Paste back to the AI assistant

#### Step 3: AI Integrates Knowledge

The AI assistant:
- Synthesizes the Perplexity response
- Creates formal documentation
- Adds proper citations
- Updates theory documents

### When to Use This Workflow

Use Perplexity proxy when:
- ✅ Accessing academic papers (arXiv, ACM, IEEE, SpringerLink)
- ✅ Finding formal theorem statements and proofs
- ✅ Synthesizing knowledge from multiple papers
- ✅ Getting implementation guidance from research
- ✅ Verifying correctness properties

Do NOT use for:
- ❌ Simple Google searches (use WebSearch tool instead)
- ❌ General programming questions (AI can answer directly)
- ❌ Reading GitHub documentation (AI can access directly)

### Best Practices

1. **Be Specific**: Prompts should request specific theorems, definitions, or proofs
2. **Include Citations**: List papers the prompt should reference
3. **Request Examples**: Ask for concrete examples demonstrating concepts
4. **Verify**: Human should sanity-check Perplexity responses before providing to AI
5. **Document**: Add Perplexity prompts to theory integration plan for future reference

### Example Session

**AI (Claude)**:
```
I'm getting 403 errors trying to access the Scalas & Yoshida 2019 paper on bottom-up MPST.
I need the formal definition of the compatibility invariant and the safety invariant
parametrization rules. Here's a Perplexity prompt:

[Generates detailed prompt]

Could you please run this through Perplexity and paste the response back?
```

**Human**:
```
[Runs prompt through Perplexity]
[Pastes response]

Here's the response from Perplexity...
```

**AI (Claude)**:
```
Thank you! Based on this, I can now document the compatibility checking algorithm...
[Continues implementation]
```

### Files Affected

When using this workflow, document the knowledge sources:
- `docs/theory/*.md` - Theory documents cite Perplexity-assisted research
- `docs/THEORY_INTEGRATION_PLAN.md` - Contains Perplexity prompts (Section 4)
- Local `CLAUDE.md` - AI session notes (gitignored, not committed)

**Note**: `CLAUDE.md` and `CLAUDE_*.md` files are automatically gitignored for AI session notes.

---

## Questions?

- **General questions**: Open a [Discussion](https://github.com/onemanifold/SMPST/discussions)
- **Bug reports**: Open an [Issue](https://github.com/onemanifold/SMPST/issues)
- **Feature requests**: Open an [Issue](https://github.com/onemanifold/SMPST/issues) with "enhancement" label

---

## Recognition

Contributors are recognized in:
- Git commit history
- GitHub Contributors page
- Release notes
- `CONTRIBUTORS.md` (for significant contributions)

Thank you for contributing to Scribble MPST IDE! 🎉
