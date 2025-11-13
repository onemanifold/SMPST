# Fix: Monaco Editor 404 on GitHub Pages + Add Dexie Protocol Storage

## Summary

Fixes Monaco Editor worker file 404 errors on GitHub Pages deployment and adds persistent IndexedDB storage for saved protocols using Dexie.

## Problem

When deployed to GitHub Pages at `https://onemanifold.github.io/SMPST/`, the Monaco Editor was failing with:
```
[Error] Failed to load resource: the server responded with a status of 404 ()
https://onemanifold.github.io/SMPST/monacoeditorwork/editor.worker.bundle.js
```

Additionally, the protocol save/load functionality was using localStorage, which has limitations for larger protocols.

## Solution

### 1. Monaco Editor GitHub Pages Fix

**Root Cause:** Monaco worker files weren't respecting the `/SMPST/` base path configured in Vite.

**Changes:**
- Added `MonacoEnvironment.getWorkerUrl` configuration in `GlobalEditor.svelte` to dynamically construct worker URLs using `import.meta.env.BASE_URL`
- Configured `vite-plugin-monaco-editor` with `publicPath: 'monacoeditorwork'` in `vite.config.ts`
- Worker files now correctly load from `/SMPST/monacoeditorwork/` on GitHub Pages

**Verified:** Build produces workers at `dist/SMPST/monacoeditorwork/*.worker.bundle.js`

### 2. Dexie IndexedDB Protocol Storage

**Why:** Replace localStorage with IndexedDB for better reliability and capacity.

**Changes:**
- Created `src/lib/stores/protocol-db.ts` - Dexie database wrapper with CRUD operations
- `ProtocolDatabase` with auto-increment IDs and timestamp indexing
- Updated `Sidebar.svelte` to use async Dexie operations instead of localStorage
- Changed `SavedProtocol.id` from `string` to `number` for auto-increment support

**Benefits:**
- No storage quota limitations (localStorage ~5-10MB)
- Better performance for large datasets
- Transactional consistency
- Async operations (non-blocking)

## Verification

### Monaco Editor Verification
According to `docs/UI_SPECIFICATION.md` (line 200):
> **Monaco Editor** (VS Code editor component) preferred

Current implementation correctly uses Monaco Editor as specified (not CodeMirror).

### Dependency Cleanup
- Removed unused dependencies during investigation
- Re-added: `dexie` (^4.2.1) for protocol persistence
- Kept: `ts-morph` (^27.0.2) - backend code generation dependency
- Kept: `monaco-editor`, `vite-plugin-monaco-editor` - per specification

## Files Changed

```
 package-lock.json                              | 61 ++++++++++++++++++++-----
 package.json                                   |  4 +-
 src/lib/components/editors/GlobalEditor.svelte | 20 +++++++++
 src/lib/components/sidebar/Sidebar.svelte      | 62 +++++++++++++-------------
 src/lib/stores/protocol-db.ts                  | 54 ++++++++++++++++++++++
 vite.config.ts                                 |  4 +-
 6 files changed, 161 insertions(+), 44 deletions(-)
```

## Testing

- [x] Build completes successfully
- [x] No TypeScript errors
- [x] Worker files generated in correct location (`dist/SMPST/monacoeditorwork/*.worker.bundle.js`)
- [x] Dexie database wrapper created with proper types
- [x] Sidebar updated to use async storage operations

## Commits

1. **fix: Configure Monaco Editor for GitHub Pages deployment** (`d14760e`)
   - Add MonacoEnvironment configuration in GlobalEditor.svelte
   - Set publicPath in vite-plugin-monaco-editor
   - Fix 404 error for editor.worker.bundle.js
   - Update ts-morph to latest version (27.0.2)

2. **feat: Add Dexie IndexedDB for persistent protocol storage** (`c177dbf`)
   - Create protocol-db.ts Dexie wrapper with CRUD operations
   - Replace localStorage with IndexedDB in Sidebar.svelte
   - Add dexie dependency (^4.2.1)
   - Update SavedProtocol type with auto-increment IDs
   - Make save/load/delete operations async

## References

- Monaco Editor: https://microsoft.github.io/monaco-editor/
- Dexie.js: https://dexie.org/
- UI Specification: `docs/UI_SPECIFICATION.md`

## Branch

- Source: `claude/initial-setup-011CV6GfeHLet2uGyDnGFoBg`
- Target: `main` (or default branch)
