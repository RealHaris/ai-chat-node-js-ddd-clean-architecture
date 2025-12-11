import portfinder from 'portfinder';
import { createApp } from './app';

const port = parseInt(process.env.APP_PORT || '3000', 10) || 3000;

portfinder.getPort({ port }, async (err, availablePort) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  if (port !== availablePort) {
    console.log(`Port ${port} is in use, using ${availablePort} instead.`);
  }

  const app = await createApp();
  app.listen(availablePort, () => {
    console.log(`Server listening on port ${availablePort}`);
  });
});
