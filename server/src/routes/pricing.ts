import { Router, Request, Response } from 'express';
import { getAllModels } from '../services/modelMatcher';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    let models = await getAllModels();

    // Only include models with pricing data
    models = models.filter(
      (m) => m.pricing.input_per_million !== null || m.pricing.output_per_million !== null
    );

    // Sort
    const sort = req.query.sort as string | undefined;
    if (sort) {
      const [field, dir] = sort.split(':');
      const direction = dir === 'desc' ? -1 : 1;

      models.sort((a, b) => {
        let aVal: number | null = null;
        let bVal: number | null = null;

        switch (field) {
          case 'input': aVal = a.pricing.input_per_million; bVal = b.pricing.input_per_million; break;
          case 'output': aVal = a.pricing.output_per_million; bVal = b.pricing.output_per_million; break;
          default: aVal = a.pricing.input_per_million; bVal = b.pricing.input_per_million; break;
        }

        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        return (aVal - bVal) * direction;
      });
    }

    // Cost calculator
    const inputTokens = parseInt(req.query.input_tokens as string) || 0;
    const outputTokens = parseInt(req.query.output_tokens as string) || 0;
    const requests = parseInt(req.query.requests as string) || 1;

    if (inputTokens > 0 || outputTokens > 0) {
      const withCosts = models.map((m) => {
        const inputCost = m.pricing.input_per_million
          ? (inputTokens / 1_000_000) * m.pricing.input_per_million * requests
          : null;
        const outputCost = m.pricing.output_per_million
          ? (outputTokens / 1_000_000) * m.pricing.output_per_million * requests
          : null;
        const totalCost = inputCost !== null && outputCost !== null ? inputCost + outputCost : null;

        return { ...m, calculated_cost: { input_cost: inputCost, output_cost: outputCost, total_cost: totalCost } };
      });

      res.json({ data: withCosts, total: withCosts.length });
      return;
    }

    res.json({ data: models, total: models.length });
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

export default router;
