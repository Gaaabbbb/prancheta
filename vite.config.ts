import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // caminhos relativos: o build funciona em qualquer pasta de um site (ou aberto pelo celular na rede)
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // o código do jogo passou um pouco de 500 kB com as copas; os bancos e o SheetJS já vão em pedaços à parte
  build: { chunkSizeWarningLimit: 650 },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
