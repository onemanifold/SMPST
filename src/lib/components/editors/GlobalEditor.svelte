<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { editorContent, setEditorContent, parseStatus } from '$lib/stores/editor';
  import * as monaco from 'monaco-editor';
  import { parseProtocol } from '$lib/stores/editor';

  let editorContainer: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor | null = null;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

  // Debounced auto-parse function (1 second delay)
  function debouncedParse(content: string) {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    debounceTimeout = setTimeout(() => {
      // Only parse if there's actual content
      if (content.trim().length > 0) {
        parseProtocol(content);
      }
    }, 1000); // 1 second delay
  }

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
      padding: { top: 24 }, // Add top padding to allow scrolling past header
    });

    // Allow scrolling to show content beneath the floating header
    // by scrolling up initially
    setTimeout(() => {
      if (editor) {
        const currentScroll = editor.getScrollTop();
        editor.setScrollTop(Math.max(0, currentScroll - 24));
      }
    }, 100);

    // Listen to content changes
    editor.onDidChangeModelContent(() => {
      if (editor) {
        const content = editor.getValue();
        setEditorContent(content);
        // Trigger debounced auto-parse
        debouncedParse(content);
      }
    });
  });

  onDestroy(() => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    editor?.dispose();
  });

  // Update editor when store changes externally
  $: if (editor && editor.getValue() !== $editorContent) {
    editor.setValue($editorContent);
  }
</script>

<div class="editor-wrapper">
  <div class="editor-container" bind:this={editorContainer} />
</div>

<style>
  .editor-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .editor-container {
    flex: 1;
  }
</style>
