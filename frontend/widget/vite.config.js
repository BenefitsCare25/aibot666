import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/embed.js',
      name: 'InsuranceChatWidget',
      fileName: (format) => `widget.${format}.js`,
      formats: ['iife']
    },
    rollupOptions: {
      output: {
        assetFileNames: 'widget.[ext]',
        inlineDynamicImports: true
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
});
