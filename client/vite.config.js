import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the same build works at / (local `npm start`)
  // and behind a sub-path such as https://villacautela.com/roadmap/.
  base: './',
  server: {
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.API_PORT || 3001}` } },
  },
});
