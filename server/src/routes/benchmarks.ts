import { Router, Request, Response } from 'express';
import { getAllModels } from '../services/modelMatcher';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    let models = await getAllModels();
    const source = req.query.source as string || 'all';

    if (source === 'arena') {
      models = models.filter((m) => m.benchmarks.arena_elo !== null);

      // Sort by Elo descending by default
      models.sort((a, b) => (b.benchmarks.arena_elo || 0) - (a.benchmarks.arena_elo || 0));

      // Category filter
      const category = req.query.category as string | undefined;
      if (category && category !== 'overall') {
        models = models
          .filter((m) => m.benchmarks.arena_categories?.[category] != null)
          .sort((a, b) =>
            (b.benchmarks.arena_categories?.[category] || 0) -
            (a.benchmarks.arena_categories?.[category] || 0)
          );
      }
    } else if (source === 'openllm') {
      models = models.filter((m) => m.benchmarks.ollm_average !== null);
      models.sort((a, b) => (b.benchmarks.ollm_average || 0) - (a.benchmarks.ollm_average || 0));
    } else {
      // All - return models with any benchmark data
      models = models.filter(
        (m) => m.benchmarks.arena_elo !== null || m.benchmarks.ollm_average !== null
      );
    }

    res.json({ data: models, total: models.length });
  } catch (error) {
    console.error('Error fetching benchmarks:', error);
    res.status(500).json({ error: 'Failed to fetch benchmarks' });
  }
});

export default router;
