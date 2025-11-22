<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { projectionData, parseStatus } from '$lib/stores/editor';
  import * as monaco from 'monaco-editor';

  let selectedRole = '';
  let editorContainer: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor | null = null;

  // Derived state - computed in single reactive block to ensure deterministic order
  let currentProjection: typeof $projectionData[0] | undefined;
  let localScribble = '';

  // CORE FIX: Single atomic reactive block that handles ALL data derivation and updates
  // This ensures operations happen in guaranteed sequential order, eliminating race conditions
  $: {
    if ($projectionData.length > 0) {
      // Step 1: Ensure selectedRole is valid (auto-select first role if needed)
      const roleExists = $projectionData.some(p => p.role === selectedRole);
      if (!selectedRole || !roleExists) {
        selectedRole = $projectionData[0].role;
      }

      // Step 2: Compute current projection (selectedRole is now guaranteed to be valid)
      currentProjection = $projectionData.find(p => p.role === selectedRole);
      localScribble = currentProjection?.localProtocol || '';

      // Step 3: Update editor content (only if editor exists and content is different)
      if (editor && localScribble) {
        const currentValue = editor.getValue();
        if (localScribble !== currentValue) {
          try {
            const currentPosition = editor.getPosition();
            editor.setValue(localScribble);
            if (currentPosition) {
              editor.setPosition(currentPosition);
            }
          } catch (e) {
            console.error('Failed to update editor:', e);
          }
        }
      }
    } else {
      // No projection data - reset state
      currentProjection = undefined;
      localScribble = '';
      selectedRole = '';
      if (editor) {
        editor.setValue('');
      }
    }
  }

  // Function to set up Monaco environment and register language
  function setupMonaco() {
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
    const hasScribble = languages.some(lang => lang.id === 'scribble');

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

  // CORE FIX: Create editor only when container is bound AND we have data ready
  // Using tick() ensures all reactive computations (including localScribble) are complete
  $: if (editorContainer && !editor && $projectionData.length > 0) {
    // Wait for next tick to ensure localScribble is fully computed in reactive block above
    tick().then(() => {
      // Double-check editor wasn't created during tick
      if (!editor && localScribble) {
        setupMonaco();

        try {
          // Create read-only Monaco editor with computed localScribble value
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
        }
      }
    });
  }

  onMount(() => {
    setupMonaco();
  });

  onDestroy(() => {
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
          on:click={() => selectedRole = projection.role}
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
    {/if}

    <!-- Monaco editor container - NEVER destroyed -->
    <div class="editor-container" bind:this={editorContainer}></div>
  </div>
</div>

<style>
  .local-projection-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #1e1e1e;
    color: #ccc;
  }

  .role-tabs {
    display: flex;
    background: #2d2d2d;
    border-bottom: 1px solid #1e1e1e;
    overflow-x: auto;
  }

  .role-tab {
    padding: 8px 16px;
    background: transparent;
    color: #ccc;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .role-tab:hover {
    background: #3d3d3d;
  }

  .role-tab.active {
    color: #fff;
    border-bottom-color: #4EC9B0;
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
    background: #1e1e1e;
    color: #666;
    font-style: italic;
    z-index: 10;
  }

  .editor-container {
    flex: 1;
    overflow: hidden;
  }
</style>
