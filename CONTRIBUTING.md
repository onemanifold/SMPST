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
