import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const SRC_ROOT = resolve(import.meta.dirname, 'src');
const DIST = resolve(import.meta.dirname, 'dist-electron');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // El root es src/renderer: de este modo Vite emite index.html en la raiz
  // de outDir, y no anidado en src/renderer/ (que es donde WindowManager
  // lo busca via join(__dirname, '../renderer/index.html')).
  root: resolve(SRC_ROOT, 'renderer'),
  resolve: {
    alias: {
      '@shared': resolve(SRC_ROOT, 'shared'),
      '@renderer': SRC_ROOT,
    },
  },
  // El renderer se construye dentro de dist-electron para que Electron
  // lo sirva desde el filesystem en produccion (loadFile).
  build: {
    outDir: resolve(DIST, 'renderer'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: resolve(SRC_ROOT, 'renderer/index.html'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  // El preload se compila aparte con tsc (CommonJS) -> dist-electron/preload
  // No lo incluimos en el bundle de Vite.
});