<script lang="ts">
  import Editor from './Editor.svelte';
  import * as Tabs from "$lib/components/ui/tabs";
  import { editorView, viewMode, generatedCode, projectionData } from '../stores/editor';
  import { onMount } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { EditorState } from '@codemirror/state';
  import { javascript } from '@codemirror/lang-javascript';
  import { oneDark } from '@codemirror/theme-one-dark';

  let typescriptEditorContainer: HTMLDivElement;
  let typescriptView: EditorView | null = null;
  let currentRole = '';

  // When switching to Global view, reset to Scribble editor
  $: if ($viewMode === 'global' && $editorView === 'typescript') {
    editorView.set('scribble');
  }

  $: {
    // When viewMode changes, update the TypeScript editor
    if ($viewMode !== 'global' && typescriptView && $generatedCode[$viewMode]) {
      currentRole = $viewMode;
      const code = $generatedCode[$viewMode] || '// No code generated yet';
      typescriptView.dispatch({
        changes: {
          from: 0,
          to: typescriptView.state.doc.length,
          insert: code
        }
      });
    }
  }

  onMount(() => {
    if ($editorView === 'typescript') {
      initTypeScriptEditor();
    }
  });

  function initTypeScriptEditor() {
    if (typescriptView || !typescriptEditorContainer) return;

    const role = $viewMode !== 'global' ? $viewMode : ($projectionData[0]?.role || 'Client');
    currentRole = role;
    const code = $generatedCode[role] || '// No code generated yet';

    const startState = EditorState.create({
      doc: code,
      extensions: [
        basicSetup,
        javascript({ typescript: true }),
        oneDark,
        EditorState.readOnly.of(true), // Read-only for generated code
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '14px'
          },
          '.cm-scroller': {
            fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace'
          }
        })
      ]
    });

    typescriptView = new EditorView({
      state: startState,
      parent: typescriptEditorContainer
    });
  }

  $: if ($editorView === 'typescript' && !typescriptView && typescriptEditorContainer) {
    initTypeScriptEditor();
  }

  $: if ($editorView === 'scribble' && typescriptView) {
    typescriptView.destroy();
    typescriptView = null;
  }
</script>

<div class="code-editor">
  <div class="editor-tabs">
    <button
      class="tab"
      class:active={$editorView === 'scribble'}
      on:click={() => selectView('scribble')}
    >
      Scribble Protocol
    </button>
    {#if $viewMode !== 'global'}
      <button
        class="tab"
        class:active={$editorView === 'typescript'}
        on:click={() => selectView('typescript')}
      >
        TypeScript
        <span class="role-badge">{$viewMode}</span>
      </button>
    {/if}
  </div>

  <div class="editor-content">
    {#if $editorView === 'scribble'}
      <Editor />
    {:else}
      <div class="typescript-editor-wrapper">
        <div class="editor-header">
          <span class="editor-title">Generated TypeScript - {currentRole}</span>
          <span class="editor-hint">Read-only</span>
        </div>
        <div class="typescript-container" bind:this={typescriptEditorContainer}></div>
      </div>
    </Tabs.Content>
  </Tabs.Root>
</div>

<style>
  .code-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #282c34;
  }

  .editor-tabs {
    display: flex;
    flex-direction: row; /* explicitly horizontal */
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #1f2937;
    border-bottom: 2px solid #374151;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #111827;
    border: 1px solid #374151;
    border-radius: 6px 6px 0 0;
    color: #9ca3af;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab:hover:not(.active) {
    color: #d1d5db;
    background: #1f2937;
    border-color: #4b5563;
  }

  .tab.active {
    color: #ffffff;
    background: #667eea;
    border-color: #667eea;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  }

  .role-badge {
    font-size: 0.75rem;
    color: #667eea;
    background: rgba(102, 126, 234, 0.1);
    padding: 0.125rem 0.5rem;
    border-radius: 3px;
    font-weight: 600;
  }

  .editor-content {
    flex: 1;
    overflow: hidden;
  }

  .typescript-editor-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #282c34;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #1f2937;
    border-bottom: 1px solid #374151;
  }

  .editor-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f3f4f6;
  }

  .editor-hint {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .typescript-container {
    flex: 1;
    overflow: auto;
  }

  :global(.typescript-container .cm-editor) {
    height: 100%;
  }
</style>
