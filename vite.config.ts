import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    optimizeDeps: {
      // Pre-bundle pdfjs-dist so Vite resolves it correctly in dynamic imports
      include: ['pdfjs-dist'],
    },
    build: {
      rollupOptions: {
        // Exclude the pdfjs worker from bundling — we load it from CDN at runtime
        external: (id) => id.includes('pdf.worker'),
      },
    },
  };
});
