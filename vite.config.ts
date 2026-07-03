import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves from /<repo-name>/, not root
export default defineConfig({
  base: '/3d_phnompenh/',
  plugins: [react()],
});
