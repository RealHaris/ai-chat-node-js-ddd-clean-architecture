import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  // Configure for Node.js library build
  output: {
    target: 'node',
    filename: {
      js: 'main.cjs',
    },
    cleanDistPath: false,
    minify: false,
  },
  // Source entry point
  source: {
    entry: {
      main: './src/main.ts',
    },
    // Configure TypeScript decorators
    decorators: {
      version: 'legacy', // Use legacy decorators (compatible with tsyringe)
    },
  },
  // Tools configuration
  tools: {
    rspack: config => {
      config.target = 'node18';
      config.externalsType = 'module';
      // Externalize all node_modules
      config.externals = [
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
        'bcrypt',
        // Node.js built-ins
        'fs',
        'path',
        'os',
        'crypto',
        'http',
        'https',
        'url',
        'querystring',
        'events',
        'stream',
        'util',
        'buffer',
        'child_process',
      ];
      return config;
    },
  },
});
