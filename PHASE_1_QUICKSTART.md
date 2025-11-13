# Phase 1 Quick Start Guide - CODE Tab Foundation

**Last Updated**: 2025-11-12
**Prerequisites**: UI Specification v2.0 complete, backend (Layers 1-5) complete
**Estimated Time**: 2-3 days for full Phase 1 completion

---

## 📋 Phase 1 Overview

**Goal**: Build the CODE tab foundation with global Scribble editor and basic UI layout

**Components to Build**:
1. Install Monaco Editor and dependencies
2. Create IDE layout structure (Header + Tabs)
3. Build CODE tab with split panes (Global | Local)
4. Integrate Monaco editor for global Scribble
5. Wire up real parser (replace mock)
6. Create verification results panel

**Expected Output**: Working CODE tab where users can:
- Write global Scribble protocols in Monaco editor
- Parse protocols (real parser, not mock)
- See verification results (deadlock, liveness, etc.)
- View basic UI layout with tabs

---

## 🚀 Step-by-Step Implementation

### Step 1: Install Monaco Editor

**Install dependencies**:
```bash
npm install monaco-editor
npm install @monaco-editor/react
npm install --save-dev monaco-editor-webpack-plugin
```

**Why these packages**:
- `monaco-editor`: Core Monaco editor (VS Code's editor)
- `@monaco-editor/react`: React wrapper (works with Svelte via adapter)
- `monaco-editor-webpack-plugin`: Vite plugin for Monaco assets

**Update vite.config.ts**:
```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig({
  plugins: [
    svelte(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService'],
      // Only include workers we need
      customWorkers: []
    })
  ],
  base: '/SMPST/',
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib')
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts']
  }
});
```

**Install Vite Monaco plugin**:
```bash
npm install --save-dev vite-plugin-monaco-editor
```

---

### Step 2: Create IDE Layout Structure

**Create**: `src/lib/components/IDE.svelte`

```svelte
<script lang="ts">
  import { activeTab } from '$lib/stores/editor';
  import CodeTab from './tabs/CodeTab.svelte';
  import SimulationTab from './tabs/SimulationTab.svelte';
  import Header from './Header.svelte';

  let currentTab: 'code' | 'simulation' = 'code';

  $: activeTab.set(currentTab);
</script>

<div class="ide-container">
  <Header />

  <nav class="tab-bar">
    <button
      class="tab"
      class:active={currentTab === 'code'}
      on:click={() => currentTab = 'code'}
    >
      CODE
    </button>
    <button
      class="tab"
      class:active={currentTab === 'simulation'}
      on:click={() => currentTab = 'simulation'}
    >
      SIMULATION
    </button>
  </nav>

  <main class="tab-content">
    {#if currentTab === 'code'}
      <CodeTab />
    {:else}
      <SimulationTab />
    {/if}
  </main>
</div>

<style>
  .ide-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .tab-bar {
    display: flex;
    background: #2d2d2d;
    border-bottom: 1px solid #1e1e1e;
  }

  .tab {
    padding: 12px 24px;
    background: transparent;
    color: #ccc;
    border: none;
    cursor: pointer;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .tab:hover {
    background: #3d3d3d;
  }

  .tab.active {
    color: #fff;
    border-bottom-color: #007acc;
  }

  .tab-content {
    flex: 1;
    overflow: hidden;
  }
</style>
```

**Create**: `src/lib/components/Header.svelte`

```svelte
<script lang="ts">
  import { parseStatus, verificationResult } from '$lib/stores/editor';

  $: statusColor = $parseStatus === 'success' ? 'green' :
                   $parseStatus === 'error' ? 'red' : 'gray';
</script>

<header class="header">
  <div class="logo">
    <span class="logo-icon">🔄</span>
    <span class="logo-text">Scribble MPST IDE</span>
  </div>

  <div class="status">
    <div class="status-indicator" class:success={$parseStatus === 'success'}
         class:error={$parseStatus === 'error'}>
      {#if $parseStatus === 'success'}
        ✓ Protocol Valid
      {:else if $parseStatus === 'error'}
        ✗ Parse Error
      {:else}
        ○ Ready
      {/if}
    </div>

    {#if $verificationResult}
      <div class="verification-status">
        <span class:success={$verificationResult.deadlockFree}>
          Deadlock: {$verificationResult.deadlockFree ? '✓' : '✗'}
        </span>
        <span class:success={$verificationResult.livenessSatisfied}>
          Liveness: {$verificationResult.livenessSatisfied ? '✓' : '✗'}
        </span>
      </div>
    {/if}
  </div>
</header>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
    background: #1e1e1e;
    border-bottom: 1px solid #333;
    color: #fff;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 600;
  }

  .logo-icon {
    font-size: 24px;
  }

  .status {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .status-indicator {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    background: #333;
  }

  .status-indicator.success {
    background: #2d5f2d;
    color: #90ee90;
  }

  .status-indicator.error {
    background: #5f2d2d;
    color: #ff6b6b;
  }

  .verification-status {
    display: flex;
    gap: 12px;
    font-size: 13px;
  }

  .verification-status span {
    color: #ff6b6b;
  }

  .verification-status span.success {
    color: #90ee90;
  }
</style>
```

---

### Step 3: Build CODE Tab with Split Panes

**Create**: `src/lib/components/tabs/CodeTab.svelte`

```svelte
<script lang="ts">
  import GlobalEditor from '../editors/GlobalEditor.svelte';
  import LocalProjectionPanel from '../panels/LocalProjectionPanel.svelte';
  import VerificationPanel from '../panels/VerificationPanel.svelte';
  import { outputPanelCollapsed } from '$lib/stores/editor';

  let splitPos = 50; // percentage
</script>

<div class="code-tab">
  <div class="split-container" style="--split-pos: {splitPos}%">
    <div class="left-pane">
      <div class="pane-header">Global Scribble</div>
      <GlobalEditor />
    </div>

    <div class="resize-handle"
         on:mousedown={(e) => {
           // TODO: Implement drag resize
         }}
    />

    <div class="right-pane">
      <div class="pane-header">Local Scribble</div>
      <LocalProjectionPanel />
    </div>
  </div>

  {#if !$outputPanelCollapsed}
    <div class="bottom-panel">
      <VerificationPanel />
    </div>
  {/if}
</div>

<style>
  .code-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .split-container {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .left-pane {
    width: var(--split-pos);
    display: flex;
    flex-direction: column;
    border-right: 1px solid #333;
  }

  .right-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .pane-header {
    padding: 8px 16px;
    background: #2d2d2d;
    border-bottom: 1px solid #1e1e1e;
    font-weight: 500;
    color: #ccc;
  }

  .resize-handle {
    width: 4px;
    background: #1e1e1e;
    cursor: col-resize;
    transition: background 0.2s;
  }

  .resize-handle:hover {
    background: #007acc;
  }

  .bottom-panel {
    height: 200px;
    border-top: 1px solid #333;
    background: #1e1e1e;
  }
</style>
```

---

### Step 4: Integrate Monaco Editor

**Create**: `src/lib/components/editors/GlobalEditor.svelte`

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { editorContent, setEditorContent, parseStatus } from '$lib/stores/editor';
  import * as monaco from 'monaco-editor';

  let editorContainer: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor | null = null;

  onMount(() => {
    // Register Scribble language
    monaco.languages.register({ id: 'scribble' });

    // Define Scribble syntax highlighting
    monaco.languages.setMonarchTokensProvider('scribble', {
      keywords: [
        'global', 'protocol', 'role', 'from', 'to', 'choice', 'at',
        'or', 'rec', 'continue', 'par', 'and', 'do', 'as'
      ],
      operators: ['(', ')', '{', '}', ';', ',', '<', '>'],
      tokenizer: {
        root: [
          [/\b(global|protocol|role|from|to|choice|at|or|rec|continue|par|and|do|as)\b/, 'keyword'],
          [/\b[A-Z][a-zA-Z0-9]*\b/, 'type'],
          [/\b[a-z][a-zA-Z0-9]*\b/, 'variable'],
          [/[(){}\[\];,<>]/, 'delimiter'],
          [/\/\/.*$/, 'comment'],
        ]
      }
    });

    // Define Scribble theme
    monaco.editor.defineTheme('scribble-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'C586C0' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'comment', foreground: '6A9955' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
      }
    });

    // Create editor
    editor = monaco.editor.create(editorContainer, {
      value: $editorContent,
      language: 'scribble',
      theme: 'scribble-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      scrollBeyondLastLine: false,
    });

    // Listen to content changes
    editor.onDidChangeModelContent(() => {
      if (editor) {
        setEditorContent(editor.getValue());
      }
    });
  });

  onDestroy(() => {
    editor?.dispose();
  });

  // Update editor when store changes externally
  $: if (editor && editor.getValue() !== $editorContent) {
    editor.setValue($editorContent);
  }
</script>

<div class="editor-container" bind:this={editorContainer} />

<style>
  .editor-container {
    width: 100%;
    height: 100%;
  }
</style>
```

---

### Step 5: Wire Up Real Parser

**Update**: `src/lib/stores/editor.ts`

Replace `mockParse` with real parser integration:

```typescript
import { writable, derived } from 'svelte/store';
import type { ProtocolExample } from '../data/examples';
import { ScribbleParser } from '../../core/parser/parser';
import { CFGBuilder } from '../../core/cfg/builder';
import { Verifier } from '../../core/verification/verifier';
import type { GlobalProtocol } from '../../core/ast/types';

// ... existing stores ...

// Real parse action
export async function parseProtocol(content: string) {
  parseStatus.set('parsing');
  parseError.set(null);

  try {
    // 1. Parse Scribble
    const parser = new ScribbleParser();
    const ast = parser.parse(content);

    if (!ast || ast.type !== 'GlobalProtocol') {
      throw new Error('Expected global protocol');
    }

    // 2. Build CFG
    const builder = new CFGBuilder();
    const cfg = builder.build(ast as GlobalProtocol);

    // 3. Verify protocol
    const verifier = new Verifier();
    const result = verifier.verify(cfg);

    // 4. Update stores
    parseStatus.set('success');
    verificationResult.set({
      deadlockFree: !result.errors.some(e => e.includes('deadlock')),
      livenessSatisfied: !result.errors.some(e => e.includes('liveness')),
      safetySatisfied: result.errors.length === 0,
      warnings: result.warnings,
      errors: result.errors
    });

    // TODO: 5. Project to CFSMs
    // TODO: 6. Generate TypeScript

    return { success: true, cfg, ast };
  } catch (error) {
    parseStatus.set('error');
    parseError.set(error instanceof Error ? error.message : String(error));
    return { success: false, error };
  }
}
```

**Add parse button to GlobalEditor**:

```svelte
<!-- In src/lib/components/editors/GlobalEditor.svelte -->
<script lang="ts">
  // ... existing imports ...
  import { parseProtocol } from '$lib/stores/editor';

  async function handleParse() {
    await parseProtocol($editorContent);
  }
</script>

<div class="editor-wrapper">
  <div class="editor-toolbar">
    <button class="btn-parse" on:click={handleParse}>
      Parse & Verify
    </button>
  </div>
  <div class="editor-container" bind:this={editorContainer} />
</div>

<style>
  .editor-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .editor-toolbar {
    padding: 8px;
    background: #2d2d2d;
    border-bottom: 1px solid #1e1e1e;
  }

  .btn-parse {
    padding: 6px 16px;
    background: #007acc;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-parse:hover {
    background: #005a9e;
  }
</style>
```

---

### Step 6: Create Verification Results Panel

**Create**: `src/lib/components/panels/VerificationPanel.svelte`

```svelte
<script lang="ts">
  import { verificationResult, parseError, outputPanelCollapsed } from '$lib/stores/editor';

  function togglePanel() {
    outputPanelCollapsed.update(v => !v);
  }
</script>

<div class="verification-panel">
  <div class="panel-header">
    <h3>Verification Results</h3>
    <button class="btn-collapse" on:click={togglePanel}>
      {$outputPanelCollapsed ? '▲' : '▼'}
    </button>
  </div>

  <div class="panel-content">
    {#if $parseError}
      <div class="error-section">
        <h4>Parse Error</h4>
        <pre class="error-message">{$parseError}</pre>
      </div>
    {:else if $verificationResult}
      <div class="result-section">
        <div class="result-item" class:success={$verificationResult.deadlockFree}>
          <span class="icon">{$verificationResult.deadlockFree ? '✓' : '✗'}</span>
          <span>Deadlock Free: {$verificationResult.deadlockFree ? 'Yes' : 'No'}</span>
        </div>
        <div class="result-item" class:success={$verificationResult.livenessSatisfied}>
          <span class="icon">{$verificationResult.livenessSatisfied ? '✓' : '✗'}</span>
          <span>Liveness: {$verificationResult.livenessSatisfied ? 'Satisfied' : 'Violated'}</span>
        </div>
        <div class="result-item" class:success={$verificationResult.safetySatisfied}>
          <span class="icon">{$verificationResult.safetySatisfied ? '✓' : '✗'}</span>
          <span>Safety: {$verificationResult.safetySatisfied ? 'Satisfied' : 'Violated'}</span>
        </div>
      </div>

      {#if $verificationResult.errors.length > 0}
        <div class="error-list">
          <h4>Errors</h4>
          {#each $verificationResult.errors as error}
            <div class="error-item">✗ {error}</div>
          {/each}
        </div>
      {/if}

      {#if $verificationResult.warnings.length > 0}
        <div class="warning-list">
          <h4>Warnings</h4>
          {#each $verificationResult.warnings as warning}
            <div class="warning-item">⚠ {warning}</div>
          {/each}
        </div>
      {/if}
    {:else}
      <p class="placeholder">Parse a protocol to see verification results</p>
    {/if}
  </div>
</div>

<style>
  .verification-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e1e;
    color: #ccc;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: #2d2d2d;
    border-bottom: 1px solid #333;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
  }

  .btn-collapse {
    background: transparent;
    border: none;
    color: #ccc;
    cursor: pointer;
    padding: 4px;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .result-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #ff6b6b;
  }

  .result-item.success {
    color: #90ee90;
  }

  .icon {
    font-weight: bold;
  }

  .error-list, .warning-list {
    margin-top: 16px;
  }

  .error-list h4, .warning-list h4 {
    margin: 0 0 8px 0;
    font-size: 13px;
    font-weight: 500;
  }

  .error-item {
    padding: 6px 12px;
    margin-bottom: 4px;
    background: #5f2d2d;
    color: #ff6b6b;
    border-radius: 4px;
    font-size: 13px;
  }

  .warning-item {
    padding: 6px 12px;
    margin-bottom: 4px;
    background: #5f5f2d;
    color: #ffeb3b;
    border-radius: 4px;
    font-size: 13px;
  }

  .placeholder {
    color: #666;
    font-style: italic;
  }

  .error-message {
    color: #ff6b6b;
    background: #2d1e1e;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
  }
</style>
```

---

### Step 7: Update App.svelte

**Update**: `src/App.svelte`

```svelte
<script lang="ts">
  import IDE from './lib/components/IDE.svelte';
  import { loadExample } from './lib/stores/editor';
  import { protocolExamples } from './lib/data/examples';

  // Load example on mount
  import { onMount } from 'svelte';
  onMount(() => {
    loadExample(protocolExamples[0]); // Load Request-Response example
  });
</script>

<IDE />

<style global>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    overflow: hidden;
  }
</style>
```

---

## ✅ Testing Phase 1

### Manual Testing Checklist

- [ ] Monaco editor loads and displays
- [ ] Can type Scribble code in editor
- [ ] Syntax highlighting works (keywords, types, etc.)
- [ ] Parse button triggers parsing
- [ ] Parser errors shown in verification panel
- [ ] Verification results display correctly
- [ ] Split panes resizable (if implemented)
- [ ] Header shows parse status
- [ ] Bottom panel collapsible
- [ ] Tab switching works (CODE ↔ SIMULATION)

### Automated Testing

**Create**: `src/lib/components/__tests__/IDE.test.ts`

```typescript
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import IDE from '../IDE.svelte';

describe('IDE Component', () => {
  it('should render CODE and SIMULATION tabs', () => {
    render(IDE);
    expect(screen.getByText('CODE')).toBeInTheDocument();
    expect(screen.getByText('SIMULATION')).toBeInTheDocument();
  });

  it('should show CODE tab by default', () => {
    render(IDE);
    const codeTab = screen.getByText('CODE').closest('button');
    expect(codeTab).toHaveClass('active');
  });
});
```

**Run tests**:
```bash
npm test
```

---

## 🐛 Common Issues and Fixes

### Issue 1: Monaco editor not loading
**Solution**: Check that `vite-plugin-monaco-editor` is installed and configured correctly in `vite.config.ts`

### Issue 2: Syntax highlighting not working
**Solution**: Verify that `monaco.languages.setMonarchTokensProvider` is called before editor creation

### Issue 3: Parser import errors
**Solution**: Check path alias `$lib` is configured in `vite.config.ts` and `tsconfig.json`

### Issue 4: Store updates not reflecting in UI
**Solution**: Ensure you're using `$` prefix for reactive store subscriptions in Svelte

### Issue 5: Editor too small or not visible
**Solution**: Check CSS `height: 100%` is set on all parent containers up to `.ide-container`

---

## 📊 Success Criteria

Phase 1 is complete when:
- ✅ Monaco editor integrated and working
- ✅ Basic IDE layout with CODE/SIMULATION tabs
- ✅ CODE tab with Global Scribble editor + Local panel
- ✅ Parse button triggers real parser (not mock)
- ✅ Verification results displayed in bottom panel
- ✅ Header shows parse status and verification summary
- ✅ At least 3 component tests passing
- ✅ No console errors on page load
- ✅ Can parse and verify example protocols

---

## 🔜 After Phase 1

Once Phase 1 is complete:
1. **Phase 2**: Implement Local Scribble projection display
2. **Phase 3**: Build CFSM Network visualization (D3.js)
3. **Phase 4**: Build CFG Sequence diagram
4. **Phase 5**: Build CFG Structure with breadcrumbs
5. **Phase 6**: Add simulation controls with call stack

---

## 📚 Helpful Resources

### Monaco Editor
- Official Docs: https://microsoft.github.io/monaco-editor/
- Language Extension Guide: https://microsoft.github.io/monaco-editor/monarch.html
- React Wrapper (adapt for Svelte): https://github.com/suren-atoyan/monaco-react

### Svelte
- Official Docs: https://svelte.dev/docs
- Svelte Testing: https://testing-library.com/docs/svelte-testing-library/intro

### Existing Codebase
- Parser: `src/core/parser/parser.ts`
- CFG Builder: `src/core/cfg/builder.ts`
- Verifier: `src/core/verification/verifier.ts`
- Stores: `src/lib/stores/editor.ts`
- Examples: `src/lib/data/examples.ts`

---

## 💡 Tips

1. **Start small**: Get Monaco editor rendering first, then add features incrementally
2. **Use examples**: Test with `protocolExamples[0]` (Request-Response) initially
3. **Console.log liberally**: Debug store updates and parser results
4. **Test frequently**: Run manual tests after each component
5. **Commit often**: Commit after each working feature
6. **Read UI_SPECIFICATION.md**: Reference Section 3 for CODE tab details

---

**Ready to start Phase 1? Let's build the foundation! 🚀**
