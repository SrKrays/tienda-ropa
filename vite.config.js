import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      // dos páginas: la tienda (index.html) y el panel del local (admin.html → /admin)
      input: { main: resolve(import.meta.dirname, 'index.html'), admin: resolve(import.meta.dirname, 'admin.html') },
      output: {
        // librerías en archivos propios: se cachean y no se vuelven a bajar en cada deploy
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // PixiJS NO va acá: así conserva sus propios chunks diferidos (WebGPU, Canvas, workers)
          // y solo se baja el renderer que el navegador realmente usa.
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion'
          if (id.includes('react') || id.includes('scheduler')) return 'react'
        },
      },
    },
  },
})
