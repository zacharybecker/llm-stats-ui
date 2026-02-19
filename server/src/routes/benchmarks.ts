import { Router, Request, Response } from 'express';
import { getAllModels } from '../services/modelMatcher';
import { ArenaScore } from '../types/benchmarks';

const router = Router();

function getArenaScore(benchmarks: Record<string, ArenaScore | null>, category: string): ArenaScore | null {
  const key = `arena_${category.replace('-', '_')}`;
  return (benchmarks as Record<string, ArenaScore | null>)[key] ?? null;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const includeUnconfigured = req.query.include_unconfigured === 'true';
    const { models: allModels, status } = await getAllModels(includeUnconfigured);
    let models = allModels;
    const category = (req.query.category as string) || 'all';

    if (category !== 'all') {
      // Filter to models that have data for this specific category
      models = models.filter((m) => {
        const score = getArenaScore(m.benchmarks, category);
        return score !== null;
      });

      // Sort by rating in this category (descending)
      models.sort((a, b) => {
        const aScore = getArenaScore(a.benchmarks, category);
        const bScore = getArenaScore(b.benchmarks, category);
        return (bScore?.rating || 0) - (aScore?.rating || 0);
      });
    } else {
      // Show all models that have any arena data
      models = models.filter(
        (m) =>
          m.benchmarks.arena_text !== null ||
          m.benchmarks.arena_code !== null ||
          m.benchmarks.arena_vision !== null
      );

      // Default sort by text rating
      models.sort((a, b) => (b.benchmarks.arena_text?.rating || 0) - (a.benchmarks.arena_text?.rating || 0));
    }

    res.json({ data: models, total: models.length, warnings: status.warnings });
  } catch (error) {
    console.error('Error fetching benchmarks:', error);
    res.status(500).json({ error: 'Failed to fetch benchmarks' });
  }
});

export default router;
