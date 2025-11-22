import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import monacoEditorPluginModule from 'vite-plugin-monaco-editor';

const monacoEditorPlugin = (monacoEditorPluginModule as any).default || monacoEditorPluginModule;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    monacoEditorPlugin({})
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
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            // Monaco editor - large, lazy loaded
            if (id.includes('monaco-editor')) {
              return 'monaco';
            }
            // D3 - visualization library
            if (id.includes('d3')) {
              return 'd3';
            }
            // Dexie - IndexedDB
            if (id.includes('dexie')) {
              return 'dexie';
            }
            // Chevrotain - parser
            if (id.includes('chevrotain')) {
              return 'chevrotain';
            }
            // svelte-spa-router
            if (id.includes('svelte-spa-router')) {
              return 'router';
            }
          }

          // Core modules - separate chunk for simulation/verification
          if (id.includes('/src/core/simulation/')) {
            return 'core-simulation';
          }
          if (id.includes('/src/core/verification/')) {
            return 'core-verification';
          }
          if (id.includes('/src/core/parser/')) {
            return 'core-parser';
          }
          if (id.includes('/src/core/projection/')) {
            return 'core-projection';
          }
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom', // Use jsdom for Svelte component tests
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**']
  },
  optimizeDeps: {
    include: ['monaco-editor', 'chevrotain', 'dexie', 'd3']
  }
});
