import cors from 'cors';

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    const whitelist: string[] = ['*'];

    if (!origin || whitelist.includes('*')) {
      callback(null, true);
    } else if (whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`${origin} is not a valid origin`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  exposedHeaders: ['App-X-Access-Token', 'App-X-Session-Token'],
};

const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
