import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        // In Docker, BACKEND_URL points to the backend service name.
        // In local dev (no env var), falls back to localhost.
        target: process.env.BACKEND_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
