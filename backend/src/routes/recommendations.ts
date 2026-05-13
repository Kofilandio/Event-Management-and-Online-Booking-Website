import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { recommendForUser, trainAndSave } from '../services/recommender/index.js';

export const recommendationsRouter = Router();

recommendationsRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const n = Math.min(20, Math.max(1, Number(req.query.n ?? 6)));
    const ids = await recommendForUser(req.user!.userId, n);
    if (ids.length === 0) return res.json([]);
    const events = await prisma.event.findMany({
      where: { id: { in: ids } },
      include: { categories: true, ticketTypes: true, photos: true },
    });
    // preserve order from recommender
    const byId = new Map(events.map((e) => [e.id, e]));
    res.json(ids.map((id) => byId.get(id)).filter(Boolean));
  } catch (e) { next(e); }
});

// admin-only retraining trigger
recommendationsRouter.post('/retrain', authenticate, requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const model = await trainAndSave();
    res.json({
      users: model.userIds.length,
      items: model.itemIds.length,
      rmseHistory: model.rmseHistory,
    });
  } catch (e) { next(e); }
});
