import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  res.json({ data: [], total: 0, warnings: ['Benchmark data sources have been removed'] });
});

export default router;
