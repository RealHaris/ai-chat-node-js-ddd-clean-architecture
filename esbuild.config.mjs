import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');

const sharedConfig = {
  bundle: true,
  minify: false,
  platform: 'node',
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
    '@node-ts/bus-core',
    '@node-ts/bus-messages',
    'uuid',
    'zod',
    'zod-validation-error',
    'bcrypt',
    'jsonwebtoken',
    'ioredis',
    'bullmq',
    'node-cron',
  ],
  entryPoints: [],
  outfile: '',
};

async function buildMain() {
  const config = {
    ...sharedConfig,
    entryPoints: ['src/main.ts'],
    outfile: 'dist/main.cjs',
  };

  if (watch) {
    const ctx = await context(config);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await build(config);
  }
}

async function buildWorker() {
  const config = {
    ...sharedConfig,
    entryPoints: ['src/worker.ts'],
    outfile: 'dist/worker.cjs',
  };

  if (watch) {
    const ctx = await context(config);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await build(config);
  }
}

async function buildAll() {
  await Promise.all([buildMain(), buildWorker()]);
}

buildAll().catch(() => process.exit(1));
