# Versioning Scheme

**Current Version:** 0.1.0-alpha
**Status:** Pre-release (Backend complete, UI pending)

---

## Semantic Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

### Version Numbers

- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality (backwards-compatible)
- **PATCH**: Bug fixes (backwards-compatible)

### Pre-Release Tags

Used to indicate stability level:

| Tag | Meaning | Example | Stability |
|-----|---------|---------|-----------|
| `alpha` | Early development | `0.1.0-alpha` | ⚠️ Unstable |
| `beta` | Feature complete, testing | `0.2.0-beta` | ⚠️ Use with caution |
| `rc` | Release candidate | `1.0.0-rc.1` | ✅ Mostly stable |
| (none) | Stable release | `1.0.0` | ✅ Production ready |

---

## Version History

### Current: 0.1.0-alpha

**Status:** Backend Complete, UI Pending
**Date:** 2025-11-12
**Git Tag:** Not yet tagged

**Backend (Complete):**
- ✅ Parser (Chevrotain-based Scribble 2.0)
- ✅ CFG Builder (AST → Control Flow Graph)
- ✅ Verification (15 algorithms, 100% test coverage)
- ✅ Projection (CFG → CFSM per role)
- ✅ CFG Simulator (orchestration-based execution)
- ✅ Code Generation (TypeScript from projections)

**UI (Pending):**
- ⏸️ Web UI (design complete, implementation pending)
- ⏸️ Desktop app (Tauri wrapper planned)

---

## Roadmap

### 0.2.0-beta (Web UI Complete)

**Target:** Month 2
**Trigger:** First working web deployment

**Deliverables:**
- Web UI implementation (Svelte 5 + Carbon Components)
- All core IDE features functional
- Deployed to GitHub Pages
- Ready for user testing

**Git Tag:** `v0.2.0-beta`

### 0.3.0-beta (Polished & Tested)

**Target:** Month 3
**Trigger:** User feedback incorporated

**Deliverables:**
- Bug fixes from user testing
- Performance optimizations
- Accessibility improvements
- Comprehensive documentation

**Git Tag:** `v0.3.0-beta`

### 1.0.0-rc.1 (Release Candidate)

**Target:** Month 4
**Trigger:** Feature complete, stable

**Deliverables:**
- All planned features implemented
- No known critical bugs
- Full test coverage maintained
- Production-ready quality

**Git Tag:** `v1.0.0-rc.1`

### 1.0.0 (Stable Release)

**Target:** Month 5
**Trigger:** RC validated in production

**Deliverables:**
- First stable release
- Desktop builds (Windows, macOS, Linux)
- Complete documentation
- Migration guides

**Git Tag:** `v1.0.0`

---

## Tagging Convention

### Git Tags

All releases are tagged in git:

```bash
# Alpha/Beta releases
git tag v0.1.0-alpha
git tag v0.2.0-beta

# Release candidates
git tag v1.0.0-rc.1
git tag v1.0.0-rc.2

# Stable releases
git tag v1.0.0
git tag v1.1.0
```

### GitHub Releases

Each tag creates a GitHub Release:

- **Pre-release**: Marked as "Pre-release" on GitHub
- **Stable**: Marked as "Latest" on GitHub
- **Desktop builds**: Only created for `rc` and stable releases

---

## Stability Guarantees

### Alpha (0.x.x-alpha)

- ⚠️ **Breaking changes** may occur between versions
- ⚠️ **APIs unstable**, subject to change
- ⚠️ **Not recommended** for production use
- ✅ **Testing encouraged** for early feedback

### Beta (0.x.x-beta)

- ✅ **Feature complete** for that milestone
- ⚠️ **Minor breaking changes** possible
- ✅ **APIs mostly stable**, major changes unlikely
- ✅ **Testing recommended** for production evaluation

### Release Candidate (x.x.x-rc.x)

- ✅ **Feature complete**, no new features planned
- ✅ **APIs stable**, no breaking changes
- ✅ **Bug fixes only**, focused on stability
- ✅ **Production use** for risk-tolerant users

### Stable (x.x.x)

- ✅ **Production ready**, fully tested
- ✅ **APIs guaranteed stable** within major version
- ✅ **Long-term support** (bug fixes, security patches)
- ✅ **Recommended** for all users

---

## Upgrading Between Versions

### Within Same Major Version (1.x.x → 1.y.y)

✅ **Safe upgrade** - No breaking changes
✅ **Drop-in replacement** - No code changes needed
✅ **Backwards compatible** - Old code continues to work

### Across Major Versions (1.x.x → 2.0.0)

⚠️ **Breaking changes** - Review changelog
⚠️ **Migration guide** - Follow upgrade instructions
⚠️ **Test thoroughly** - Verify your use case

---

## Package.json Version

The `package.json` version always reflects current development state:

```json
{
  "version": "0.1.0-alpha",
  "private": true
}
```

This version is bumped:
- **Before** creating a release tag
- **In the PR** that completes a milestone

---

## Changelog

All notable changes are documented in [CHANGELOG.md](./CHANGELOG.md):

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security fixes

Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## CI/CD Integration

### Web Deployment (GitHub Pages)

- ✅ Deploys on every push to `main`
- ✅ Always reflects latest stable code
- ✅ No version tagging required

### Desktop Builds (Tauri)

- ✅ Triggered by version tags (`v*`)
- ✅ Only builds for `rc` and stable releases
- ✅ Creates GitHub Release with binaries
- ✅ Quality gates ensure tests pass first

### Automatic Tagging

When ready to release:

```bash
# Update package.json version
npm version 0.2.0-beta --no-git-tag-version

# Commit version bump
git add package.json
git commit -m "chore: bump version to 0.2.0-beta"

# Create and push tag
git tag v0.2.0-beta
git push origin main --tags

# GitHub Actions automatically:
# 1. Runs tests
# 2. Builds desktop apps (if enabled)
# 3. Creates GitHub Release
```

---

## Version Queries

Users can check version in multiple ways:

### Web App

```javascript
// Display in UI footer
console.log(APP_VERSION); // From build-time constant
```

### Desktop App

```bash
# Command line
scribble-mpst-ide --version
> Scribble MPST IDE v1.0.0
```

### Package

```bash
# npm package
npm list smpst-ide
```

---

## Support Policy

| Version Type | Support Duration | Updates |
|-------------|------------------|---------|
| **Alpha** | Until next release | None |
| **Beta** | Until RC | Bug fixes only |
| **RC** | Until stable | Critical fixes only |
| **Stable** | 12 months | Bug fixes, security |
| **LTS** (future) | 24 months | Security only |

---

## Questions?

- **Current version?** Check `package.json` or GitHub releases
- **When's next release?** See roadmap above
- **Is X stable?** Check stability table above
- **Breaking changes?** See [CHANGELOG.md](./CHANGELOG.md)

**Last Updated:** 2025-11-12
**Document Version:** 1.0
