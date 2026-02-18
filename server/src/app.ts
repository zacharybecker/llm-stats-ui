import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env';
import healthRouter from './routes/health';
import modelsRouter from './routes/models';
import pricingRouter from './routes/pricing';
import benchmarksRouter from './routes/benchmarks';
import { flushAll } from './services/cache';
import { parseConfig } from './services/configParser';

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/models', modelsRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/benchmarks', benchmarksRouter);

// Config refresh
app.post('/api/config/refresh', (_req, res) => {
  try {
    flushAll();
    const models = parseConfig();
    res.json({ status: 'ok', models_loaded: models.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to refresh config' });
  }
});

// Serve static SPA in production
if (env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));

  // Catch-all for client-side routing
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

export default app;
