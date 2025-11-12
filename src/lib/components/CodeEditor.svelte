<script lang="ts">
  import { Tabs, Tab, TabContent } from 'carbon-components-svelte';
  import Editor from './Editor.svelte';
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

  $: selectedIndex = $editorView === 'scribble' ? 0 : 1;

  function handleTabChange(event: CustomEvent<{ selectedIndex: number }>) {
    editorView.set(event.detail.selectedIndex === 0 ? 'scribble' : 'typescript');
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
        EditorState.readOnly.of(true),
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
  <Tabs selected={selectedIndex} on:change={handleTabChange}>
    <Tab label="Scribble Protocol" />
    {#if $viewMode !== 'global'}
      <Tab label="TypeScript ({$viewMode})" />
    {/if}

    <svelte:fragment slot="content">
      <TabContent>
        <Editor />
      </TabContent>

      {#if $viewMode !== 'global'}
        <TabContent>
          <div class="typescript-editor-wrapper">
            <div class="typescript-container" bind:this={typescriptEditorContainer}></div>
          </div>
        </TabContent>
      {/if}
    </svelte:fragment>
  </Tabs>
</div>

<style>
  .code-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--cds-ui-01);
  }

  .typescript-editor-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .typescript-container {
    flex: 1;
    overflow: auto;
  }

  :global(.code-editor .bx--tab-content) {
    padding: 0 !important;
    height: calc(100% - 48px);
  }

  :global(.typescript-container .cm-editor) {
    height: 100%;
  }
</style>
