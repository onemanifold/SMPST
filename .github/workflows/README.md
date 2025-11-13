# GitHub Actions Workflows

This directory contains CI/CD pipelines for the Scribble MPST IDE project.

## Active Workflows

### `deploy.yml` - GitHub Pages Deployment
**Status:** ✅ Active
**Triggers:** Push to `main` branch
**Purpose:** Builds and deploys web version to GitHub Pages
**Output:** https://onemanifold.github.io/SMPST/

## Disabled Workflows

### `tauri-build.yml.disabled` - Desktop App Builds
**Status:** 🔒 Disabled (ready for activation)
**Triggers:** Version tags (`v*`) or manual dispatch
**Purpose:** Build desktop applications for Windows, macOS, and Linux

**Why disabled:**
- Web version must be completed first
- Requires Tauri setup in `src-tauri/` directory
- Will be enabled in future phase (Month 4 of roadmap)

## Activating Tauri Builds

When ready to enable desktop builds:

### Prerequisites
1. ✅ Web version complete and tested
2. ✅ Tauri initialized: `npm run tauri init`
3. ✅ Local testing successful: `npm run tauri dev`

### Activation Steps

```bash
# 1. Rename workflow file to activate
mv .github/workflows/tauri-build.yml.disabled \
   .github/workflows/tauri-build.yml

# 2. Commit the change
git add .github/workflows/tauri-build.yml
git commit -m "ci: Enable Tauri desktop builds"
git push

# 3. Create a version tag to trigger first build
git tag v0.1.0
git push --tags
```

### What Happens Next

GitHub Actions will automatically run a multi-stage pipeline:

**Stage 1: Quality Checks** (~2-3 minutes)
1. ✅ TypeScript type checking (`tsc --noEmit`)
2. ✅ Run all unit tests (`npm test`)
3. ✅ Generate test coverage report
4. ✅ Upload coverage to Codecov (optional)

**Stage 2: Multi-Platform Builds** (only if tests pass, ~10-15 minutes)
1. ✅ Build Windows x64 binary (`.exe`, `.msi`)
2. ✅ Build macOS Universal binary (`.dmg`, Intel + Apple Silicon)
3. ✅ Build Linux binaries (`.deb`, `.AppImage`, `.rpm`)

**Stage 3: Release Creation**
1. ✅ Create GitHub Release (draft mode)
2. ✅ Upload all binaries to the release
3. ✅ Generate release notes

**⚠️ Important:** If any test fails, the build stage is skipped entirely. This ensures only tested code is distributed.

**Total pipeline time:** ~15-20 minutes (tests + builds in parallel)

### Build Matrix

The workflow uses GitHub's matrix strategy to build all platforms simultaneously:

| Platform | Runner | Target | Outputs |
|----------|--------|--------|---------|
| Windows | `windows-latest` | `x86_64-pc-windows-msvc` | `.exe`, `.msi` |
| macOS | `macos-latest` | `universal-apple-darwin` | `.dmg`, `.app` |
| Linux | `ubuntu-22.04` | `x86_64-unknown-linux-gnu` | `.deb`, `.AppImage`, `.rpm` |

### Manual Testing

You can test the workflow without creating a release:

```bash
# Trigger workflow manually (requires push permission)
gh workflow run tauri-build.yml
```

Or via GitHub UI: Actions → Tauri Desktop Build → Run workflow

### Binary Sizes

Expected output sizes:
- **Windows**: 8-12 MB per installer
- **macOS**: 8-12 MB (Universal binary)
- **Linux**: 8-12 MB per package format

Compare to typical Electron apps: 80-120 MB

## Troubleshooting

### Build fails on macOS
**Issue:** Code signing requirements
**Solution:** Add `APPLE_SIGNING_IDENTITY` to GitHub secrets (optional for open-source)

### Build fails on Linux
**Issue:** Missing system dependencies
**Solution:** Check `apt-get install` step includes all webkit dependencies

### Release not created
**Issue:** `GITHUB_TOKEN` permissions
**Solution:** Ensure repo has Actions write permissions (Settings → Actions → General)

## Cost

**GitHub Actions Usage:**
- ✅ Free for public repositories
- ✅ 2000 minutes/month on free plan (enough for ~30 multi-platform builds)
- ✅ All three OS runners included

## Security

The workflow:
- ✅ Uses official GitHub Actions (`actions/*`, `tauri-apps/tauri-action`)
- ✅ Pins versions for reproducibility
- ✅ Uses GitHub token (scoped automatically)
- ✅ Creates draft releases (manual review before publishing)

## Further Reading

- [Tauri GitHub Actions Guide](https://v2.tauri.app/guides/distribute/github-releases/)
- [GitHub Actions: Matrix Strategy](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs)
- [Tauri Configuration](https://v2.tauri.app/reference/config/)
