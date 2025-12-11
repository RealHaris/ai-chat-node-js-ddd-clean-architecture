import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'dist/main.js'),
      formats: ['es'],
      fileName: 'main',
    },
    rollupOptions: {
      external: [
        'express',
        'cors',
        'helmet',
        'multer',
        'dotenv',
        'drizzle-orm',
        'pg',
        'postgres',
        'reflect-metadata',
        'tsyringe',
        'types-ddd',
        'uuid',
        'zod',
        'zod-validation-error',
        '@node-ts/bus-core',
        '@node-ts/bus-messages',
      ],
    },
    outDir: 'dist',
    emptyOutDir: false,
    minify: false,
  },
});
