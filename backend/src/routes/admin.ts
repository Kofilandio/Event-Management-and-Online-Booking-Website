import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { buildEventsXml, buildEventsJson } from '../services/export.js';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('ADMIN'));

// list users
adminRouter.get('/users', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const users = await prisma.user.findMany({
      where: {
        ...(status && status !== 'ALL' ? { status: status as any } : {}),
        ...(q ? { OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, firstName: true, lastName: true, email: true,
        phone: true, city: true, country: true, role: true, status: true, createdAt: true,
      },
    });
    res.json(users);
  } catch (e) { next(e); }
});

// user detail
adminRouter.get('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new HttpError(404, 'User not found');
    const { passwordHash, ...rest } = user;
    res.json(rest);
  } catch (e) { next(e); }
});

const decisionSchema = z.object({ decision: z.enum(['APPROVE', 'REJECT']) });

adminRouter.post('/users/:id/decision', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { decision } = decisionSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id },
      data: { status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED' },
    });
    res.json({ id: user.id, status: user.status });
  } catch (e) { next(e); }
});

// XML export
adminRouter.get('/export/xml', async (_req, res, next) => {
  try {
    const xml = await buildEventsXml();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="events.xml"');
    res.send(xml);
  } catch (e) { next(e); }
});

// JSON export
adminRouter.get('/export/json', async (_req, res, next) => {
  try {
    const json = await buildEventsJson();
    res.setHeader('Content-Disposition', 'attachment; filename="events.json"');
    res.json(json);
  } catch (e) { next(e); }
});
