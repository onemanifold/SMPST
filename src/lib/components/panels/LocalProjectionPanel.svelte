<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { projectionData, parseStatus } from '$lib/stores/editor';

  // Detect headless environment - DO NOT load Monaco in headless
  const isHeadless = typeof window !== 'undefined' && (
    navigator.webdriver === true ||
    /HeadlessChrome/.test(navigator.userAgent) ||
    /PhantomJS/.test(navigator.userAgent)
  );

  let selectedRole = '';
  let editorContainer: HTMLDivElement;
  let editor: any = null; // Monaco editor instance (loaded dynamically)
  let monaco: any = null; // Monaco module (loaded dynamically)
  let useTextareaFallback = isHeadless;
  let monacoLoaded = false;

  // Derived state
  let currentProjection: typeof $projectionData[0] | undefined;
  let localScribble = '';

  // Auto-select first role when projection data changes and no valid selection
  $: if ($projectionData.length > 0) {
    const roleExists = $projectionData.some(p => p.role === selectedRole);
    if (!selectedRole || !roleExists) {
      selectedRole = $projectionData[0].role;
    }
  } else if ($projectionData.length === 0) {
    selectedRole = '';
  }

  // Compute current projection based on selected role
  $: currentProjection = $projectionData.find(p => p.role === selectedRole);
  $: localScribble = currentProjection?.localProtocol || '';

  // Track pending update to avoid duplicate RAF calls
  let pendingEditorUpdate: number | null = null;

  // Update editor content when localScribble changes (only for Monaco)
  // Use requestAnimationFrame to defer the expensive setValue() call
  // This prevents UI stuttering when switching between role tabs
  $: if (editor && localScribble !== undefined && !useTextareaFallback) {
    const newValue = localScribble;

    // Cancel any pending update
    if (pendingEditorUpdate !== null) {
      cancelAnimationFrame(pendingEditorUpdate);
    }

    // Defer the expensive Monaco update to prevent blocking the UI
    pendingEditorUpdate = requestAnimationFrame(() => {
      pendingEditorUpdate = null;
      if (!editor) return;

      const currentValue = editor.getValue();
      if (newValue !== currentValue) {
        try {
          // Use pushEditOperations for smoother updates instead of setValue
          // This preserves undo stack and is more efficient for partial changes
          const model = editor.getModel();
          if (model) {
            const fullRange = model.getFullModelRange();
            model.pushEditOperations(
              [],
              [{ range: fullRange, text: newValue }],
              () => null
            );
          }
        } catch (e) {
          console.error('Failed to update editor:', e);
        }
      }
    });
  }

  // Function to set up Monaco environment and register language
  function setupMonaco() {
    if (!monaco) return;

    // Set up Monaco environment (needed for worker loading)
    (window as any).MonacoEnvironment = (window as any).MonacoEnvironment || {
      getWorkerUrl: function (_moduleId: string, label: string) {
        const base = import.meta.env.BASE_URL || '/';
        if (label === 'json') {
          return `${base}monacoeditorwork/json.worker.bundle.js`;
        }
        if (label === 'css' || label === 'scss' || label === 'less') {
          return `${base}monacoeditorwork/css.worker.bundle.js`;
        }
        if (label === 'html' || label === 'handlebars' || label === 'razor') {
          return `${base}monacoeditorwork/html.worker.bundle.js`;
        }
        if (label === 'typescript' || label === 'javascript') {
          return `${base}monacoeditorwork/ts.worker.bundle.js`;
        }
        return `${base}monacoeditorwork/editor.worker.bundle.js`;
      }
    };

    // Ensure Monaco language and theme are registered
    const languages = monaco.languages.getLanguages();
    const hasScribble = languages.some((lang: any) => lang.id === 'scribble');

    if (!hasScribble) {
      // Register Scribble language
      monaco.languages.register({ id: 'scribble' });

      // Define Scribble syntax highlighting
      monaco.languages.setMonarchTokensProvider('scribble', {
        keywords: [
          'protocol', 'role', 'choice', 'at', 'or', 'rec', 'continue', 'par', 'and', 'do', 'as', 'type', 'import'
        ],
        operators: ['(', ')', '{', '}', ';', ',', '<', '>', '->', ':'],
        tokenizer: {
          root: [
            [/\b(protocol|role|choice|at|or|rec|continue|par|and|do|as|type|import)\b/, 'keyword'],
            [/->/, 'keyword'],
            [/\b[A-Z][a-zA-Z0-9]*\b/, 'type'],
            [/\b[a-z][a-zA-Z0-9]*\b/, 'variable'],
            [/[(){}\[\];,<>:]/, 'delimiter'],
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
    }
  }

  // Dynamically load Monaco only when not headless
  async function loadMonaco() {
    if (useTextareaFallback || monacoLoaded) return;

    try {
      const monacoModule = await import('monaco-editor');
      monaco = monacoModule;
      monacoLoaded = true;
      setupMonaco();
    } catch (e) {
      console.error('[LocalProjectionPanel] Failed to load Monaco:', e);
      useTextareaFallback = true;
    }
  }

  // Create editor only when container is bound, Monaco loaded, AND we have data ready
  $: if (editorContainer && !editor && $projectionData.length > 0 && monacoLoaded && monaco && !useTextareaFallback) {
    tick().then(() => {
      if (!editor && localScribble && monaco) {
        try {
          editor = monaco.editor.create(editorContainer, {
            value: localScribble,
            language: 'scribble',
            theme: 'scribble-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            scrollBeyondLastLine: false,
            readOnly: true,
            domReadOnly: true,
            contextmenu: false,
            folding: false,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
          });
        } catch (e) {
          console.error('Failed to create Monaco editor:', e);
          useTextareaFallback = true;
        }
      }
    });
  }

  onMount(() => {
    if (isHeadless) {
      console.log('[LocalProjectionPanel] Headless detected, using textarea (Monaco not loaded)');
      useTextareaFallback = true;
    } else {
      loadMonaco();
    }
  });

  onDestroy(() => {
    // Cancel any pending editor update
    if (pendingEditorUpdate !== null) {
      cancelAnimationFrame(pendingEditorUpdate);
    }
    editor?.dispose();
  });
</script>

<div class="local-projection-panel">
  <!-- Role tabs - only shown when we have projection data -->
  {#if $projectionData.length > 0}
    <div class="role-tabs">
      {#each $projectionData as projection}
        <button
          class="role-tab"
          class:active={selectedRole === projection.role}
          on:click={() => { if (selectedRole !== projection.role) selectedRole = projection.role; }}
        >
          {projection.role}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Editor container - ALWAYS rendered to prevent recreation -->
  <div class="projection-content">
    <!-- Placeholder overlay - shown when no data -->
    {#if $parseStatus !== 'success' || $projectionData.length === 0}
      <div class="placeholder-overlay">
        <p>Parse a protocol to see local projections</p>
      </div>
    {:else if useTextareaFallback}
      <!-- Textarea fallback for headless environments -->
      <textarea
        class="fallback-textarea projection-textarea"
        readonly
        value={localScribble}
        spellcheck="false"
      ></textarea>
    {/if}

    <!-- Monaco editor container - only used when not headless -->
    {#if !useTextareaFallback}
      <div class="editor-container" bind:this={editorContainer}></div>
    {/if}
  </div>
</div>

<style>
  .local-projection-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .role-tabs {
    display: flex;
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-bg-primary);
    overflow-x: auto;
  }

  .role-tab {
    padding: var(--spacing-2) var(--spacing-4);
    background: transparent;
    color: var(--color-text-primary);
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    white-space: nowrap;
    transition: all var(--transition-normal);
  }

  .role-tab:hover {
    background: var(--color-bg-hover);
  }

  .role-tab.active {
    color: var(--color-text-inverse);
    border-bottom-color: var(--color-success);
  }

  .projection-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .placeholder-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-primary);
    color: var(--color-text-muted);
    font-style: italic;
    z-index: var(--z-dropdown);
  }

  .editor-container {
    flex: 1;
    overflow: hidden;
  }

  /* Fallback textarea for projection panel */
  .projection-textarea {
    flex: 1;
    width: 100%;
    padding: var(--spacing-3, 12px);
    background: var(--color-bg-secondary, #252526);
    color: var(--color-text-primary, #cccccc);
    border: none;
    outline: none;
    resize: none;
    font-family: var(--font-family-mono, 'Consolas', 'Monaco', monospace);
    font-size: var(--font-size-base, 14px);
    line-height: 1.5;
  }
</style>
