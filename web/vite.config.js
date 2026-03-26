import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

/**
 * Vite plugin that rewrites `import "buffer/"` (trailing slash) in source code
 * to `import "buffer"` so vite-plugin-node-polyfills can handle it.
 * Some packages (wavesurfer.js, etc.) use the trailing-slash form which browsers
 * cannot resolve as a bare module specifier.
 */
function fixBufferTrailingSlash() {
  return {
    name: 'fix-buffer-trailing-slash',
    enforce: 'pre',
    // Transform hook rewrites source code BEFORE Rollup processes it
    transform(code) {
      if (!code.includes('buffer/')) return null
      return code
        .replace(/from\s*['"]buffer\/['"]/g, "from 'buffer'")
        .replace(/import\s*['"]buffer\/['"]/g, "import 'buffer'")
        .replace(/require\s*\(\s*['"]buffer\/['"]\s*\)/g, "require('buffer')")
    },
    // Also handle resolveId for any cases the transform misses
    resolveId(id) {
      if (id === 'buffer/' || (id.startsWith('buffer/') && !id.startsWith('buffer//'))) {
        return { id: 'buffer', moduleSideEffects: false }
      }
    }
  }
}

export default defineConfig({
  plugins: [
    fixBufferTrailingSlash(),
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream', 'events'],
      globals: {
        Buffer: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  optimizeDeps: {
    // Force esbuild to pre-bundle buffer so the polyfill is available
    include: ['buffer'],
    esbuildOptions: {
      plugins: [
        {
          name: 'fix-buffer-slash-esbuild',
          setup(build) {
            // Redirect 'buffer/' imports to 'buffer' during esbuild pre-bundling
            build.onResolve({ filter: /^buffer\/$/ }, () => ({
              path: 'buffer',
              external: false,
            }))
          }
        }
      ]
    }
  },
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
