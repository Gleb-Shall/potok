import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: [
      { find: /^react$/, replacement: fileURLToPath(new URL('./src/lib/react-compat.js', import.meta.url)) },
      { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
      { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/jsx-dev-runtime' },
    ],
    dedupe: ['preact'],
  },
  test: { setupFiles: ['./tests/setup.js'], server: { deps: { inline: ['@animate-ui/react', 'motion', 'framer-motion'] } } },
  build: { target: 'es2022' },
});
