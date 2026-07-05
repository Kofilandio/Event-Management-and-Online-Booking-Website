import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

export const authRouter = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(40),
  password: z.string().min(6).max(100),
  confirmPassword: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(5),
  address: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  afm: z.string().regex(/^\d{9}$/, 'AFM must be exactly 9 digits'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 10);
    try {
      const user = await prisma.user.create({
        data: {
          username: data.username,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          country: data.country,
          latitude: data.latitude,
          longitude: data.longitude,
          afm: data.afm,
        },
      });
      res.status(201).json({
        id: user.id,
        username: user.username,
        status: user.status,
        message: 'Registration submitted. Awaiting administrator approval.',
      });
    } catch (e) {
      // Rely on the unique constraint to win any registration race; surface a
      // clean 409 instead of leaking a generic 500.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = (e.meta?.target as string[] | undefined)?.[0] ?? 'field';
        throw new HttpError(409, `${target === 'username' ? 'Username' : target === 'email' ? 'Email' : target} already in use`);
      }
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username } });

    // Always run bcrypt — even if no user — to keep timing constant and avoid
    // a username-enumeration oracle.
    const dummyHash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8h6r9oNn9MWQfBd5O6vYQyiPiW0jHK';
    const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
    if (!user || !ok) throw new HttpError(401, 'Invalid credentials');

    if (user.status !== 'APPROVED') {
      // Generic message — don't reveal whether the account is PENDING vs REJECTED.
      throw new HttpError(403, 'Account is not active');
    }

    const token = signToken({ userId: user.id, username: user.username, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    next(e);
  }
});

authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Server-side re-check: a token issued before the account was suspended
    // must not continue to grant access.
    if (user.status !== 'APPROVED') return res.status(403).json({ error: 'Account is not active' });
    res.json({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
    });
  } catch (e) {
    next(e);
  }
});
