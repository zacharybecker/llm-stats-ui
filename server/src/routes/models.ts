import { Router, Request, Response } from 'express';
import { getAllModels, getModelById } from '../services/modelMatcher';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const includeUnconfigured = req.query.include_unconfigured === 'true';
    const { models: allModels, status } = await getAllModels(includeUnconfigured);
    let models = allModels;

    // Filter by provider
    const provider = req.query.provider as string | undefined;
    if (provider) {
      models = models.filter((m) => m.provider.toLowerCase() === provider.toLowerCase());
    }

    // Search
    const search = req.query.search as string | undefined;
    if (search) {
      const lower = search.toLowerCase();
      models = models.filter(
        (m) =>
          m.id.toLowerCase().includes(lower) ||
          m.name.toLowerCase().includes(lower) ||
          m.provider.toLowerCase().includes(lower)
      );
    }

    // Sort
    const sort = req.query.sort as string | undefined;
    if (sort) {
      const [field, dir] = sort.split(':');
      const direction = dir === 'desc' ? -1 : 1;

      models.sort((a, b) => {
        let aVal: number | string | null = null;
        let bVal: number | string | null = null;

        switch (field) {
          case 'name': aVal = a.name; bVal = b.name; break;
          case 'provider': aVal = a.provider; bVal = b.provider; break;
          case 'context_length': aVal = a.context_length; bVal = b.context_length; break;
          case 'input_price': aVal = a.pricing.input_per_million; bVal = b.pricing.input_per_million; break;
          case 'output_price': aVal = a.pricing.output_per_million; bVal = b.pricing.output_per_million; break;
          case 'arena_elo': aVal = a.benchmarks.arena_elo; bVal = b.benchmarks.arena_elo; break;
          case 'benchmark_avg': aVal = a.benchmarks.ollm_average; bVal = b.benchmarks.ollm_average; break;
          default: return 0;
        }

        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * direction;
        }
        return ((aVal as number) - (bVal as number)) * direction;
      });
    }

    res.json({ data: models, total: models.length, warnings: status.warnings });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

router.get('/:id(*)', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id.join('/') : req.params.id;
    const model = await getModelById(id);
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }
    res.json(model);
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

export default router;
