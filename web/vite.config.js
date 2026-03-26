import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

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
  ],
  resolve: {
    alias: [
      // Some packages import 'buffer/' (trailing slash) which browsers can't resolve.
      // Map it to the plain 'buffer' so Vite/polyfill can bundle it correctly.
      { find: /^buffer\/$/, replacement: 'buffer' },
    ],
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
