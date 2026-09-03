import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const stub = fileURLToPath(new URL('./test/astro-env-stub.ts', import.meta.url));

export default defineConfig({
  test: {
    alias: {
      'astro:env/client': stub,
      'astro:env/server': stub,
    },
  },
});
