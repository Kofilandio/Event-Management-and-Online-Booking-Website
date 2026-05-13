import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from './env.js';
import type { Role } from '@prisma/client';

export interface JwtPayload {
  userId: number;
  username: string;
  role: Role;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
