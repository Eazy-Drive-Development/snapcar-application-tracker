import express from 'express';
import cors from 'cors';
import analyticsRouter from './routes/analytics';
import authRouter from './routes/auth';

const app = express();

app.use(express.json());
app.use(cors({ origin: '*' }));

app.use('/api/auth', authRouter);
app.use('/api/analytics', analyticsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'snapcar-tracker-backend' });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
