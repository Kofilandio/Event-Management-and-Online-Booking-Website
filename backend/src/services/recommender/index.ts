import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../lib/prisma.js';
import { type Interaction, type TrainedModel, train, topNForUser, isUserKnown } from './model.js';

const MODEL_PATH = path.resolve('./recommender-model.json');

let cachedModel: TrainedModel | null = null;

const RATING_BOOKING = 5.0;
const RATING_VIEW = 2.0;

/** Build training set from current DB state. */
export async function buildInteractions(): Promise<Interaction[]> {
  const bookings = await prisma.booking.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: { attendeeId: true, eventId: true },
  });
  const views = await prisma.eventView.findMany({
    select: { userId: true, eventId: true },
  });

  // collapse multiple views per (user,event) → single max-rating; bookings dominate
  const map = new Map<string, number>();
  for (const v of views) {
    const k = `${v.userId}:${v.eventId}`;
    map.set(k, Math.max(map.get(k) ?? 0, RATING_VIEW));
  }
  for (const b of bookings) {
    const k = `${b.attendeeId}:${b.eventId}`;
    map.set(k, RATING_BOOKING);
  }

  const out: Interaction[] = [];
  for (const [key, rating] of map.entries()) {
    const [u, i] = key.split(':').map(Number);
    out.push({ userId: u, itemId: i, rating });
  }
  return out;
}

// Write the model atomically (tmp + rename) so a crash mid-write can never
// leave a half-written model.json on disk for the next process to read.
async function persistModel(model: TrainedModel): Promise<void> {
  const tmp = `${MODEL_PATH}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tmp, JSON.stringify(model));
  await fsp.rename(tmp, MODEL_PATH);
}

export async function trainAndSave(): Promise<TrainedModel> {
  const interactions = await buildInteractions();
  if (interactions.length < 5) {
    // Not enough data — fall back to a degenerate "popularity-only" model.
    // We still ship it through the TrainedModel interface so the rest of the
    // pipeline doesn't need to special-case the cold start.
    const bookingCounts = await prisma.event.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, _count: { select: { bookings: true } } },
    });
    const itemIds = bookingCounts.map((e) => e.id);
    const itemBias = bookingCounts.map((e) => e._count.bookings * 0.5);
    const fake: TrainedModel = {
      config: { factors: 1, epochs: 0, learningRate: 0, regularization: 0, seed: 0, minRating: 0, maxRating: 5 },
      globalMean: 0,
      userIds: [],
      itemIds,
      userBias: [],
      itemBias,
      userFactors: [],
      itemFactors: itemIds.map(() => [0]),
      rmseHistory: [],
    };
    cachedModel = fake;
    await persistModel(fake);
    return fake;
  }
  const model = train(interactions);
  cachedModel = model;
  await persistModel(model);
  return model;
}

export async function getModel(): Promise<TrainedModel> {
  if (cachedModel) return cachedModel;
  if (fs.existsSync(MODEL_PATH)) {
    try {
      cachedModel = JSON.parse(await fsp.readFile(MODEL_PATH, 'utf8')) as TrainedModel;
      return cachedModel;
    } catch {
      // Corrupted / outdated artifact — retrain rather than crash.
    }
  }
  return trainAndSave();
}

/**
 * Recommend events for a user.
 *
 * - If the user has booking history known to the trained model, BMF is used.
 * - If they have only views, or have interacted only after the last retrain,
 *   we fall back to popularity (the BMF user vector is uninitialised so its
 *   personalisation contribution would be zero anyway).
 * - If they have no history at all, return most popular published events.
 */
export async function recommendForUser(userId: number, n = 6): Promise<number[]> {
  const [bookings, views, publishedEvents] = await Promise.all([
    prisma.booking.findMany({
      where: { attendeeId: userId, status: { not: 'CANCELLED' } },
      select: { eventId: true },
    }),
    prisma.eventView.findMany({ where: { userId }, select: { eventId: true } }),
    prisma.event.findMany({
      where: { status: 'PUBLISHED', startDateTime: { gte: new Date() } },
      select: { id: true, _count: { select: { bookings: true } } },
    }),
  ]);

  const exclude = new Set<number>();
  for (const b of bookings) exclude.add(b.eventId);
  // we don't exclude viewed — we still want to surface things the user clicked but didn't book

  if (publishedEvents.length === 0) return [];

  const popularityRanked = () =>
    publishedEvents
      .filter((e) => !exclude.has(e.id))
      .sort((a, b) => b._count.bookings - a._count.bookings)
      .map((e) => e.id);

  // Cold-start: no interactions at all → popularity.
  if (bookings.length === 0 && views.length === 0) {
    return popularityRanked().slice(0, n);
  }

  const model = await getModel();

  // Cold-start: user has views/bookings only after the last retrain → the
  // trained model has no vector for them. Personalised BMF can't help yet, so
  // serve popularity until the next retrain.
  if (!isUserKnown(model, userId)) {
    return popularityRanked().slice(0, n);
  }

  const candidateIds = publishedEvents.map((e) => e.id);
  const top = topNForUser(model, userId, candidateIds, n, exclude);

  if (top.length < n) {
    const have = new Set(top.map((t) => t.itemId));
    const filler = publishedEvents
      .filter((e) => !have.has(e.id) && !exclude.has(e.id))
      .sort((a, b) => b._count.bookings - a._count.bookings)
      .slice(0, n - top.length)
      .map((e) => ({ itemId: e.id, score: 0 }));
    return [...top, ...filler].map((t) => t.itemId);
  }

  return top.map((t) => t.itemId);
}
