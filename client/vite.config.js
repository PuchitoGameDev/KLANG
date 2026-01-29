import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  // base: './' asegura que index.html busque los assets en la misma carpeta
  base: './', 
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // ESTO SOLUCIONA EL "React is not defined"
  esbuild: {
    // Inyecta automáticamente el import de React en todos los archivos .jsx y .js
    jsxInject: `import React from 'react'`
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    // Aumentamos el límite para que no se queje tanto de los chunks
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Asegura que los nombres de archivos sean consistentes
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  }
})