import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Cerca i test direttamente nella cartella server (es. server.test.js, security-regressions.test.js)
    include: ['*.test.js', '**/*.test.js'],
    environment: 'node',
  },
});
