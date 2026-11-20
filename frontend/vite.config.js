import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port 8081 is already allowed by the backend's CORS_ORIGINS and used for share links (PUBLIC_APP_URL).
export default defineConfig({
  plugins: [react()],
  server: { port: 8081, strictPort: true },
  preview: { port: 8081, strictPort: true },
});
