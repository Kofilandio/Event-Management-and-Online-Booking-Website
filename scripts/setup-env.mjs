#!/usr/bin/env node
/* Copies backend/.env.example → backend/.env if missing. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, '..', 'backend', '.env');
const source = path.join(__dirname, '..', 'backend', '.env.example');

if (fs.existsSync(target)) {
  console.log('✓ backend/.env already exists — leaving it untouched.');
} else {
  fs.copyFileSync(source, target);
  console.log('✓ Created backend/.env from .env.example');
  console.log('  → Edit JWT_SECRET to a long random string before going to production.');
}
