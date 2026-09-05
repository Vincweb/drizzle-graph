import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** Where `pnpm dev` reaches the API server. Match it if you start the CLI on another port. */
const API = process.env.DRIZZLE_GRAPH_API ?? 'http://127.0.0.1:4600'

export default defineConfig({
  root: 'src/client',
  plugins: [react(), tailwindcss()],
  // Absolute, so a deep link like /graph?dir=… still finds the assets.
  base: '/',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 4601,
    // A leading ^ makes this a RegExp, and the trailing slash matters: a plain '/api' key
    // matches by prefix, so the client's own /api.ts module would be proxied away too.
    proxy: { '^/api/': API },
  },
})
