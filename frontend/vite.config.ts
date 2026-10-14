/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Dev: `/api` proxies to the deployed CloudFront origin (set VITE_API_ORIGIN in frontend/.env.local).
const apiOrigin = process.env.VITE_API_ORIGIN;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: apiOrigin ? { '/api': { target: apiOrigin, changeOrigin: true } } : undefined,
  },
  build: { outDir: 'dist', target: 'es2022', sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
