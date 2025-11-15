<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { projectionData, parseStatus } from '$lib/stores/editor';
  import * as monaco from 'monaco-editor';

  let selectedRole = '';
  let editorContainer: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor | null = null;

  // Auto-select first role when projection data updates
  // Also reset if current role doesn't exist in new projection data
  $: if ($projectionData.length > 0) {
    const roleExists = $projectionData.some(p => p.role === selectedRole);
    if (!selectedRole || !roleExists) {
      selectedRole = $projectionData[0].role;
    }
  }

  // Get serialized local protocol from projection data
  $: currentProjection = $projectionData.find(p => p.role === selectedRole);
  $: localScribble = currentProjection?.localProtocol || '';

  // Update editor content when selected role changes
  $: if (editor && localScribble !== editor.getValue()) {
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

  onMount(() => {
    if (!editorContainer) return;

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

    // Small delay to ensure container is fully rendered
    setTimeout(() => {
      if (!editorContainer) return;

      try {
        // Create read-only Monaco editor
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
    }, 100);
  });

  onDestroy(() => {
    editor?.dispose();
  });
</script>

<div class="local-projection-panel">
  {#if $parseStatus !== 'success' || $projectionData.length === 0}
    <div class="placeholder">
      <p>Parse a protocol to see local projections</p>
    </div>
  {:else}
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

    <div class="projection-content">
      <div class="editor-container" bind:this={editorContainer}></div>
    </div>
  {/if}
</div>

<style>
  .local-projection-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #1e1e1e;
    color: #ccc;
  }

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    font-style: italic;
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
  }

  .editor-container {
    flex: 1;
    overflow: hidden;
  }
</style>
