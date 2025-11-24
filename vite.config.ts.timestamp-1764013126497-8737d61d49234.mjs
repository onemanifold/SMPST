// vite.config.ts
import { defineConfig } from "file:///home/user/SMPST/node_modules/vite/dist/node/index.js";
import { svelte } from "file:///home/user/SMPST/node_modules/@sveltejs/vite-plugin-svelte/src/index.js";
import path from "path";
import monacoEditorPluginModule from "file:///home/user/SMPST/node_modules/vite-plugin-monaco-editor/dist/index.js";
var monacoEditorPlugin = monacoEditorPluginModule.default || monacoEditorPluginModule;
var vite_config_default = defineConfig({
  plugins: [
    svelte(),
    monacoEditorPlugin({})
  ],
  base: "/SMPST/",
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib")
    }
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("monaco-editor")) {
              return "monaco";
            }
            if (id.includes("d3")) {
              return "d3";
            }
            if (id.includes("dexie")) {
              return "dexie";
            }
            if (id.includes("chevrotain")) {
              return "chevrotain";
            }
            if (id.includes("svelte-spa-router")) {
              return "router";
            }
          }
          if (id.includes("/src/core/simulation/")) {
            return "core-simulation";
          }
          if (id.includes("/src/core/verification/")) {
            return "core-verification";
          }
          if (id.includes("/src/core/parser/")) {
            return "core-parser";
          }
          if (id.includes("/src/core/projection/")) {
            return "core-projection";
          }
        }
      }
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    // Use jsdom for Svelte component tests
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/dist/**"]
  },
  optimizeDeps: {
    include: ["monaco-editor", "chevrotain", "dexie", "d3"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS91c2VyL1NNUFNUXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS91c2VyL1NNUFNUL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3VzZXIvU01QU1Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IHN2ZWx0ZSB9IGZyb20gJ0BzdmVsdGVqcy92aXRlLXBsdWdpbi1zdmVsdGUnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgbW9uYWNvRWRpdG9yUGx1Z2luTW9kdWxlIGZyb20gJ3ZpdGUtcGx1Z2luLW1vbmFjby1lZGl0b3InO1xuXG5jb25zdCBtb25hY29FZGl0b3JQbHVnaW4gPSAobW9uYWNvRWRpdG9yUGx1Z2luTW9kdWxlIGFzIGFueSkuZGVmYXVsdCB8fCBtb25hY29FZGl0b3JQbHVnaW5Nb2R1bGU7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgc3ZlbHRlKCksXG4gICAgbW9uYWNvRWRpdG9yUGx1Z2luKHt9KVxuICBdLFxuICBiYXNlOiAnL1NNUFNULycsXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJGxpYjogcGF0aC5yZXNvbHZlKCcuL3NyYy9saWInKVxuICAgIH1cbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBhc3NldHNEaXI6ICdhc3NldHMnLFxuICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiAoaWQpID0+IHtcbiAgICAgICAgICAvLyBWZW5kb3IgY2h1bmtzXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkge1xuICAgICAgICAgICAgLy8gTW9uYWNvIGVkaXRvciAtIGxhcmdlLCBsYXp5IGxvYWRlZFxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdtb25hY28tZWRpdG9yJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICdtb25hY28nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gRDMgLSB2aXN1YWxpemF0aW9uIGxpYnJhcnlcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnZDMnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ2QzJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIERleGllIC0gSW5kZXhlZERCXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2RleGllJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICdkZXhpZSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBDaGV2cm90YWluIC0gcGFyc2VyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2NoZXZyb3RhaW4nKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ2NoZXZyb3RhaW4nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc3ZlbHRlLXNwYS1yb3V0ZXJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnc3ZlbHRlLXNwYS1yb3V0ZXInKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3JvdXRlcic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29yZSBtb2R1bGVzIC0gc2VwYXJhdGUgY2h1bmsgZm9yIHNpbXVsYXRpb24vdmVyaWZpY2F0aW9uXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvc3JjL2NvcmUvc2ltdWxhdGlvbi8nKSkge1xuICAgICAgICAgICAgcmV0dXJuICdjb3JlLXNpbXVsYXRpb24nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9zcmMvY29yZS92ZXJpZmljYXRpb24vJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnY29yZS12ZXJpZmljYXRpb24nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9zcmMvY29yZS9wYXJzZXIvJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnY29yZS1wYXJzZXInO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9zcmMvY29yZS9wcm9qZWN0aW9uLycpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2NvcmUtcHJvamVjdGlvbic7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICB0ZXN0OiB7XG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBlbnZpcm9ubWVudDogJ2pzZG9tJywgLy8gVXNlIGpzZG9tIGZvciBTdmVsdGUgY29tcG9uZW50IHRlc3RzXG4gICAgc2V0dXBGaWxlczogWycuL3NyYy90ZXN0L3NldHVwLnRzJ10sXG4gICAgZXhjbHVkZTogWycqKi9ub2RlX21vZHVsZXMvKionLCAnKiovZTJlLyoqJywgJyoqL2Rpc3QvKionXVxuICB9LFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbJ21vbmFjby1lZGl0b3InLCAnY2hldnJvdGFpbicsICdkZXhpZScsICdkMyddXG4gIH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFrTyxTQUFTLG9CQUFvQjtBQUMvUCxTQUFTLGNBQWM7QUFDdkIsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sOEJBQThCO0FBRXJDLElBQU0scUJBQXNCLHlCQUFpQyxXQUFXO0FBR3hFLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxJQUNQLG1CQUFtQixDQUFDLENBQUM7QUFBQSxFQUN2QjtBQUFBLEVBQ0EsTUFBTTtBQUFBLEVBQ04sU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsTUFBTSxLQUFLLFFBQVEsV0FBVztBQUFBLElBQ2hDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLElBQ1gsV0FBVztBQUFBLElBQ1gsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYyxDQUFDLE9BQU87QUFFcEIsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBRS9CLGdCQUFJLEdBQUcsU0FBUyxlQUFlLEdBQUc7QUFDaEMscUJBQU87QUFBQSxZQUNUO0FBRUEsZ0JBQUksR0FBRyxTQUFTLElBQUksR0FBRztBQUNyQixxQkFBTztBQUFBLFlBQ1Q7QUFFQSxnQkFBSSxHQUFHLFNBQVMsT0FBTyxHQUFHO0FBQ3hCLHFCQUFPO0FBQUEsWUFDVDtBQUVBLGdCQUFJLEdBQUcsU0FBUyxZQUFZLEdBQUc7QUFDN0IscUJBQU87QUFBQSxZQUNUO0FBRUEsZ0JBQUksR0FBRyxTQUFTLG1CQUFtQixHQUFHO0FBQ3BDLHFCQUFPO0FBQUEsWUFDVDtBQUFBLFVBQ0Y7QUFHQSxjQUFJLEdBQUcsU0FBUyx1QkFBdUIsR0FBRztBQUN4QyxtQkFBTztBQUFBLFVBQ1Q7QUFDQSxjQUFJLEdBQUcsU0FBUyx5QkFBeUIsR0FBRztBQUMxQyxtQkFBTztBQUFBLFVBQ1Q7QUFDQSxjQUFJLEdBQUcsU0FBUyxtQkFBbUIsR0FBRztBQUNwQyxtQkFBTztBQUFBLFVBQ1Q7QUFDQSxjQUFJLEdBQUcsU0FBUyx1QkFBdUIsR0FBRztBQUN4QyxtQkFBTztBQUFBLFVBQ1Q7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixTQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUE7QUFBQSxJQUNiLFlBQVksQ0FBQyxxQkFBcUI7QUFBQSxJQUNsQyxTQUFTLENBQUMsc0JBQXNCLGFBQWEsWUFBWTtBQUFBLEVBQzNEO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsaUJBQWlCLGNBQWMsU0FBUyxJQUFJO0FBQUEsRUFDeEQ7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
