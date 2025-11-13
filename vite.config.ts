import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import monacoEditorPluginModule from 'vite-plugin-monaco-editor';

const monacoEditorPlugin = (monacoEditorPluginModule as any).default || monacoEditorPluginModule;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    monacoEditorPlugin({
      publicPath: 'monacoeditorwork'
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
  },
  optimizeDeps: {
    include: ['monaco-editor']
  }
});
