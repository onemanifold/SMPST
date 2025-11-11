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
  <Tabs.Root value={$editorView} onValueChange={(v) => editorView.set(v)}>
    <Tabs.List class="bg-dark-800 border-b-2 border-dark-700 px-4 py-3">
      <Tabs.Trigger value="scribble">Scribble Protocol</Tabs.Trigger>
      {#if $viewMode !== 'global'}
        <Tabs.Trigger value="typescript">
          TypeScript
          <span class="role-badge ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
            {$viewMode}
          </span>
        </Tabs.Trigger>
      {/if}
    </Tabs.List>

    <Tabs.Content value={$editorView} class="flex-1">
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
        {/if}
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
