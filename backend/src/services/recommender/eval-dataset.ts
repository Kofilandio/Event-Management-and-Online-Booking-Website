/**
 * Offline training & evaluation of the from-scratch Biased Matrix Factorization
 * recommender on the dataset provided with the assignment (e-class).
 *
 * Run with:
 *   npm run eval:recommender                 # default dataset path
 *   npm run eval:recommender -- <path.csv>   # custom event_interest.csv
 *
 * What it does (the BMF algorithm in model.ts is NOT modified — it is only
 * fed real data here):
 *   1. Streams `event_interest.csv` and maps each (user, event) interaction to
 *      a 0–5 pseudo-rating, using the same semantics as the live app:
 *          interested = 1      → 5.0  (strong positive, like a booking)
 *          not_interested = 1  → 1.0  (negative signal)
 *          otherwise (shown)   → 2.0  (weak positive, like a view)
 *   2. Deterministically shuffles and splits the interactions 80/20.
 *   3. Trains the existing `train()` on the 80% partition.
 *   4. Reports the training-RMSE curve, the held-out test RMSE (on user/item
 *      pairs the model has actually seen), and ranking quality
 *      (HitRate@K / Precision@K) for users with held-out positives.
 */
import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { type Interaction, train, predict, topNForUser, isUserKnown } from './model.js';

// ---- Config -----------------------------------------------------------------

const DEFAULT_DATASET = path.resolve('..', 'rel_event_csvs', 'event_interest.csv');
const DATASET_PATH = process.argv[2] ?? DEFAULT_DATASET;

const TEST_FRACTION = 0.2;
const SPLIT_SEED = 1234;
const TOP_K = 10;
const MAX_RANKING_USERS = 2000; // cap ranking eval cost; sampled deterministically

// k-core filtering: keep only users/events with at least this many interactions.
// The raw dataset is extremely sparse (~1.8 interactions/event), which leaves
// most held-out pairs "cold" and makes every metric meaningless. Iteratively
// pruning to a denser core is standard practice for evaluating CF models.
// Override from the CLI: `npm run eval:recommender -- <csv> <minUser> <minItem>`.
const MIN_USER = Number(process.argv[3] ?? 5);
const MIN_ITEM = Number(process.argv[4] ?? 5);

// Pseudo-rating mapping — mirrors the live app (view=2.0, booking=5.0) and adds
// the explicit negative signal the dataset provides.
const RATING_INTERESTED = 5.0;
const RATING_SHOWN = 2.0;
const RATING_NOT_INTERESTED = 1.0;

// ---- Deterministic PRNG (same family as the model) --------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- CSV loading ------------------------------------------------------------

interface Row {
  userId: number;
  itemId: number;
  rating: number;
}

function ratingFor(invited: number, interested: number, notInterested: number): number {
  if (interested === 1) return RATING_INTERESTED;
  if (notInterested === 1) return RATING_NOT_INTERESTED;
  return RATING_SHOWN; // shown to the user (with or without invite) but no explicit response
}

async function loadInteractions(file: string): Promise<Row[]> {
  if (!fs.existsSync(file)) {
    console.error(`Dataset not found: ${file}`);
    console.error('Pass the path to event_interest.csv as an argument:');
    console.error('  npm run eval:recommender -- ../rel_event_csvs/event_interest.csv');
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const rows: Row[] = [];
  let header = true;
  let skipped = 0;

  // header: user,event,invited,timestamp,interested,not_interested
  for await (const line of rl) {
    if (header) { header = false; continue; }
    if (!line) continue;
    const c = line.split(',');
    if (c.length < 6) { skipped++; continue; }
    const userId = Number(c[0]);
    const itemId = Number(c[1]);
    const invited = Number(c[2]);
    const interested = Number(c[4]);
    const notInterested = Number(c[5]);
    if (!Number.isFinite(userId) || !Number.isFinite(itemId)) { skipped++; continue; }
    rows.push({ userId, itemId, rating: ratingFor(invited, interested, notInterested) });
  }

  if (skipped) console.log(`(skipped ${skipped} malformed rows)`);
  return rows;
}

/** Iteratively drop users/events below the interaction thresholds until stable. */
function kCore(rows: Row[], minUser: number, minItem: number): Row[] {
  let current = rows;
  for (;;) {
    const userCount = new Map<number, number>();
    const itemCount = new Map<number, number>();
    for (const r of current) {
      userCount.set(r.userId, (userCount.get(r.userId) ?? 0) + 1);
      itemCount.set(r.itemId, (itemCount.get(r.itemId) ?? 0) + 1);
    }
    const next = current.filter(
      (r) => (userCount.get(r.userId) ?? 0) >= minUser && (itemCount.get(r.itemId) ?? 0) >= minItem,
    );
    if (next.length === current.length) return next;
    current = next;
    if (current.length === 0) return current;
  }
}

// ---- Metrics ----------------------------------------------------------------

function rmse(model: ReturnType<typeof train>, rows: Row[]): { rmse: number; evaluated: number; cold: number } {
  let sumSq = 0;
  let evaluated = 0;
  let cold = 0;
  for (const r of rows) {
    // Only score pairs the model can actually personalise (seen user + item),
    // otherwise predict() returns the global mean and the number is meaningless.
    if (!predictIsPersonalised(model, r.userId, r.itemId)) { cold++; continue; }
    const pred = predict(model, r.userId, r.itemId);
    const err = r.rating - pred;
    sumSq += err * err;
    evaluated++;
  }
  return { rmse: Math.sqrt(sumSq / Math.max(1, evaluated)), evaluated, cold };
}

// Fast membership for "was this (user,item) seen in training?"
let knownItems: Set<number> = new Set();
function predictIsPersonalised(model: ReturnType<typeof train>, userId: number, itemId: number): boolean {
  return isUserKnown(model, userId) && knownItems.has(itemId);
}

// ---- Main -------------------------------------------------------------------

(async () => {
  console.log(`Dataset: ${DATASET_PATH}`);
  const all = await loadInteractions(DATASET_PATH);

  // Deduplicate (user,item) keeping the strongest signal, mirroring index.ts.
  const dedup = new Map<string, number>();
  for (const r of all) {
    const k = `${r.userId}:${r.itemId}`;
    dedup.set(k, Math.max(dedup.get(k) ?? 0, r.rating));
  }
  const rows: Row[] = [];
  for (const [k, rating] of dedup) {
    const [u, i] = k.split(':').map(Number);
    rows.push({ userId: u, itemId: i, rating });
  }

  console.log(`Loaded ${all.length} rows → ${rows.length} unique (user,event) interactions`);

  // Prune to a dense k-core so held-out evaluation is meaningful.
  const before = rows.length;
  const cored = MIN_USER > 1 || MIN_ITEM > 1 ? kCore(rows, MIN_USER, MIN_ITEM) : rows;
  if (cored.length !== before) {
    console.log(`k-core (≥${MIN_USER} per user, ≥${MIN_ITEM} per event): ${before} → ${cored.length} interactions`);
  }
  rows.length = 0;
  rows.push(...cored);
  if (rows.length === 0) {
    console.error('No interactions left after k-core filtering — lower the thresholds.');
    process.exit(1);
  }

  const uUsers = new Set(rows.map((r) => r.userId)).size;
  const uItems = new Set(rows.map((r) => r.itemId)).size;
  console.log(`Users: ${uUsers}  Events: ${uItems}  (density ${(rows.length / (uUsers * uItems) * 100).toFixed(3)}%)`);
  const dist = rows.reduce<Record<string, number>>((m, r) => { m[r.rating] = (m[r.rating] ?? 0) + 1; return m; }, {});
  console.log('Rating distribution:', dist);

  // Deterministic shuffle + 80/20 split.
  const rng = mulberry32(SPLIT_SEED);
  for (let k = rows.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [rows[k], rows[j]] = [rows[j], rows[k]];
  }
  const cut = Math.floor(rows.length * (1 - TEST_FRACTION));
  const trainRows = rows.slice(0, cut);
  const testRows = rows.slice(cut);
  console.log(`\nSplit: ${trainRows.length} train / ${testRows.length} test`);

  // Train the EXISTING from-scratch BMF.
  console.log('\nTraining BMF (from scratch)…');
  const t0 = Date.now();
  const model = train(trainRows as Interaction[]);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  knownItems = new Set(model.itemIds);

  const h = model.rmseHistory;
  console.log(`Done in ${secs}s — ${model.userIds.length} users × ${model.itemIds.length} items, K=${model.config.factors}`);
  console.log(`Train RMSE: ${h[0].toFixed(4)} (epoch 1) → ${h[h.length - 1].toFixed(4)} (epoch ${h.length})`);
  console.log('Per-epoch:', h.map((v) => v.toFixed(3)).join(' '));

  // Held-out RMSE.
  const test = rmse(model, testRows);
  console.log(`\nTest RMSE: ${test.rmse.toFixed(4)} over ${test.evaluated} known pairs ` +
    `(${test.cold} cold pairs skipped)`);

  // Ranking quality: for users with held-out positives, does top-K surface them?
  const positivesByUser = new Map<number, Set<number>>();
  for (const r of testRows) {
    if (r.rating >= RATING_INTERESTED && isUserKnown(model, r.userId)) {
      (positivesByUser.get(r.userId) ?? positivesByUser.set(r.userId, new Set()).get(r.userId)!).add(r.itemId);
    }
  }
  // Items the user already had in the training set are excluded from candidates.
  const trainByUser = new Map<number, Set<number>>();
  for (const r of trainRows) {
    (trainByUser.get(r.userId) ?? trainByUser.set(r.userId, new Set()).get(r.userId)!).add(r.itemId);
  }

  const candidateItems = model.itemIds;
  const evalUsers = [...positivesByUser.keys()].slice(0, MAX_RANKING_USERS);
  let hits = 0;
  let precSum = 0;
  let recSum = 0;
  for (const u of evalUsers) {
    const positives = positivesByUser.get(u)!;
    const exclude = trainByUser.get(u) ?? new Set<number>();
    const top = topNForUser(model, u, candidateItems, TOP_K, exclude);
    const topIds = new Set(top.map((t) => t.itemId));
    let inter = 0;
    for (const p of positives) if (topIds.has(p)) inter++;
    if (inter > 0) hits++;
    precSum += inter / TOP_K;
    recSum += inter / positives.size;
  }
  const n = evalUsers.length;
  console.log(`\nRanking (over ${n} test users with held-out positives, K=${TOP_K}):`);
  console.log(`  HitRate@${TOP_K}:   ${(hits / n).toFixed(4)}  (${hits}/${n} users got ≥1 positive in top-${TOP_K})`);
  console.log(`  Precision@${TOP_K}: ${(precSum / n).toFixed(4)}`);
  console.log(`  Recall@${TOP_K}:    ${(recSum / n).toFixed(4)}`);

  console.log('\nDone.');
  process.exit(0);
})();
