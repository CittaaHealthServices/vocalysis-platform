import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = parseInt(process.env.PORT || '3000', 10)

  return {
    plugins: [react()],

    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react:  ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            ui:     ['lucide-react', 'framer-motion'],
            query:  ['@tanstack/react-query'],
          },
        },
      },
    },

    preview: {
      port,
      host: '0.0.0.0',
      // SPA fallback — serve index.html for all routes
      proxy: {},
    },
  }
})
