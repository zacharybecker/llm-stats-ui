import { Router, Request, Response } from 'express';
import { getAllModels } from '../services/modelMatcher';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const models = await getAllModels();
    const configured = models.filter((m) => m.is_configured).length;
    res.json({
      status: 'ok',
      total_models: models.length,
      configured_models: configured,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

export default router;
