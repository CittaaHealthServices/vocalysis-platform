import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

/**
 * Plugin that removes `import "buffer/"` side-effect statements from the
 * final bundled chunks. The trailing-slash form (buffer/) is invalid in the
 * browser. Since vite-plugin-node-polyfills already exposes Buffer globally
 * via globals.Buffer, the redundant side-effect import can be safely dropped.
 *
 * Using renderChunk (not transform) because the import is lifted to the chunk
 * level by Rollup after all source transforms have run.
 */
function removeBufferSlashImport() {
  return {
    name: 'remove-buffer-slash-import',
    // renderChunk runs on the final assembled chunk code, after all transforms
    renderChunk(code) {
      if (!code.includes('buffer/')) return null
      const fixed = code
        // Remove bare side-effect imports: import "buffer/" or import 'buffer/'
        .replace(/import\s*["']buffer\/["'];?/g, '')
        // Fix named imports: from "buffer/" → from 'buffer'
        .replace(/from\s*["']buffer\/["']/g, "from 'buffer'")
      return fixed !== code ? { code: fixed, map: null } : null
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream', 'events'],
      globals: {
        Buffer: true,
        process: true,
      },
      protocolImports: true,
    }),
    // Must come AFTER nodePolyfills so renderChunk runs after polyfill injection
    removeBufferSlashImport(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
          utils: ['axios', '@tanstack/react-query', 'date-fns', 'react-hook-form', 'zod']
        }
      }
    }
  }
})
