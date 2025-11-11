<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { EditorState } from '@codemirror/state';
  import { javascript } from '@codemirror/lang-javascript';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { editorContent, setEditorContent } from '../stores/editor';

  let editorContainer: HTMLDivElement;
  let editorView: EditorView | null = null;

  onMount(() => {
    // Create CodeMirror instance
    const startState = EditorState.create({
      doc: $editorContent,
      extensions: [
        basicSetup,
        javascript(), // Using JavaScript as placeholder for Scribble syntax
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            setEditorContent(newContent);
          }
        }),
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

    editorView = new EditorView({
      state: startState,
      parent: editorContainer
    });

    // Subscribe to store changes (for example loading)
    const unsubscribe = editorContent.subscribe((content) => {
      if (editorView && editorView.state.doc.toString() !== content) {
        editorView.dispatch({
          changes: {
            from: 0,
            to: editorView.state.doc.length,
            insert: content
          }
        });
      }
    });

    return () => {
      unsubscribe();
    };
  });

  onDestroy(() => {
    if (editorView) {
      editorView.destroy();
    }
  });
</script>

<div class="editor-wrapper">
  <div class="editor-header">
    <span class="editor-title">Protocol Editor</span>
    <span class="editor-hint">Press Ctrl+Enter to parse</span>
  </div>
  <div class="editor-container" bind:this={editorContainer}></div>
</div>

<style>
  .editor-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #282c34;
    border-right: 1px solid #374151;
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

  .editor-container {
    flex: 1;
    overflow: auto;
  }

  :global(.cm-editor) {
    height: 100%;
  }

  :global(.cm-scroller) {
    overflow: auto;
  }
</style>
