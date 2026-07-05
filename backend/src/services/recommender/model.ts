/**
 * Biased Matrix Factorization, implemented from scratch.
 *
 * Predicted rating for (user u, item i):
 *     r̂(u,i) = μ + b_u + b_i + p_u · q_i
 *
 * Trained with stochastic gradient descent on the regularized squared error:
 *     L = Σ (r_{ui} - r̂(u,i))² + λ (‖p_u‖² + ‖q_i‖² + b_u² + b_i²)
 *
 * Implicit feedback is converted to pseudo-ratings before training:
 *     booking → 5.0   (strong positive signal: the user committed)
 *     view    → 2.0   (weak positive signal: the user expressed interest)
 *
 * No negative sampling is performed — only observed interactions train the
 * model. The cold-start path in `index.ts` falls back to popularity when no
 * signal exists.
 */

export interface Interaction {
  userId: number;
  itemId: number;
  rating: number;
}

export interface BMFConfig {
  factors: number;        // K — latent dimension
  epochs: number;         // training passes over the data
  learningRate: number;   // α
  regularization: number; // λ
  seed: number;
  minRating: number;      // clamp predictions during scoring
  maxRating: number;
}

export const DEFAULT_CONFIG: BMFConfig = {
  factors: 16,
  epochs: 30,
  learningRate: 0.01,
  regularization: 0.05,
  seed: 42,
  minRating: 0,
  maxRating: 5,
};

// Simple deterministic PRNG (mulberry32) so models are reproducible.
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

export interface TrainedModel {
  config: BMFConfig;
  globalMean: number;
  userIds: number[];
  itemIds: number[];
  userBias: number[];      // index parallel to userIds
  itemBias: number[];      // index parallel to itemIds
  userFactors: number[][]; // [users][K]
  itemFactors: number[][]; // [items][K]
  rmseHistory: number[];   // training RMSE per epoch
}

// Lazily-built id→index maps. Stored off-model (as a WeakMap key) so the model
// object itself stays a clean serializable POJO that round-trips through JSON.
const indexCache = new WeakMap<TrainedModel, { uMap: Map<number, number>; iMap: Map<number, number> }>();
function getIndexMaps(model: TrainedModel) {
  let cached = indexCache.get(model);
  if (!cached) {
    cached = {
      uMap: new Map(model.userIds.map((id, idx) => [id, idx])),
      iMap: new Map(model.itemIds.map((id, idx) => [id, idx])),
    };
    indexCache.set(model, cached);
  }
  return cached;
}

export function train(interactions: Interaction[], cfg: Partial<BMFConfig> = {}): TrainedModel {
  const config = { ...DEFAULT_CONFIG, ...cfg };
  const rng = mulberry32(config.seed);

  // Build index maps user/item ids → 0..N-1
  const userIdx = new Map<number, number>();
  const itemIdx = new Map<number, number>();
  const userIds: number[] = [];
  const itemIds: number[] = [];

  for (const it of interactions) {
    if (!userIdx.has(it.userId)) { userIdx.set(it.userId, userIds.length); userIds.push(it.userId); }
    if (!itemIdx.has(it.itemId)) { itemIdx.set(it.itemId, itemIds.length); itemIds.push(it.itemId); }
  }
  const nU = userIds.length;
  const nI = itemIds.length;
  const K = config.factors;

  const globalMean = interactions.reduce((s, x) => s + x.rating, 0) / Math.max(1, interactions.length);

  // Initialise factors with small random values
  const initFactor = () => Array.from({ length: K }, () => (rng() - 0.5) * 0.1);
  const userFactors = Array.from({ length: nU }, () => initFactor());
  const itemFactors = Array.from({ length: nI }, () => initFactor());
  const userBias = new Array(nU).fill(0);
  const itemBias = new Array(nI).fill(0);

  // Indexed interaction tuples
  const trainData = interactions.map((it) => ({
    u: userIdx.get(it.userId)!,
    i: itemIdx.get(it.itemId)!,
    r: it.rating,
  }));

  const rmseHistory: number[] = [];

  for (let epoch = 0; epoch < config.epochs; epoch++) {
    // Shuffle
    for (let k = trainData.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [trainData[k], trainData[j]] = [trainData[j], trainData[k]];
    }

    let sumSqErr = 0;
    for (const { u, i, r } of trainData) {
      // prediction
      const pu = userFactors[u];
      const qi = itemFactors[i];
      let dot = 0;
      for (let k = 0; k < K; k++) dot += pu[k] * qi[k];
      const pred = globalMean + userBias[u] + itemBias[i] + dot;
      const err = r - pred;
      sumSqErr += err * err;

      // updates — read old values before mutating so the q_i update sees the
      // pre-update p_u (and vice versa), as the SGD derivation requires.
      userBias[u] += config.learningRate * (err - config.regularization * userBias[u]);
      itemBias[i] += config.learningRate * (err - config.regularization * itemBias[i]);
      for (let k = 0; k < K; k++) {
        const puk = pu[k];
        const qik = qi[k];
        pu[k] += config.learningRate * (err * qik - config.regularization * puk);
        qi[k] += config.learningRate * (err * puk - config.regularization * qik);
      }
    }

    rmseHistory.push(Math.sqrt(sumSqErr / trainData.length));
  }

  return {
    config,
    globalMean,
    userIds,
    itemIds,
    userBias,
    itemBias,
    userFactors,
    itemFactors,
    rmseHistory,
  };
}

function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

export function predict(model: TrainedModel, userId: number, itemId: number): number {
  const { uMap, iMap } = getIndexMaps(model);
  const u = uMap.get(userId);
  const i = iMap.get(itemId);
  if (u == null || i == null) return model.globalMean;
  let dot = 0;
  const pu = model.userFactors[u];
  const qi = model.itemFactors[i];
  for (let k = 0; k < model.config.factors; k++) dot += pu[k] * qi[k];
  const raw = model.globalMean + model.userBias[u] + model.itemBias[i] + dot;
  return clamp(raw, model.config.minRating, model.config.maxRating);
}

export function isUserKnown(model: TrainedModel, userId: number): boolean {
  return getIndexMaps(model).uMap.has(userId);
}

export function topNForUser(
  model: TrainedModel,
  userId: number,
  candidateItemIds: number[],
  n: number,
  exclude: Set<number> = new Set(),
): { itemId: number; score: number }[] {
  const { uMap, iMap } = getIndexMaps(model);
  const u = uMap.get(userId);

  const scores: { itemId: number; score: number }[] = [];
  for (const itemId of candidateItemIds) {
    if (exclude.has(itemId)) continue;
    const i = iMap.get(itemId);
    if (i == null) {
      // unknown item — fall back to global mean
      scores.push({ itemId, score: model.globalMean });
      continue;
    }
    if (u == null) {
      // unknown user → use item bias + global mean only
      scores.push({ itemId, score: clamp(model.globalMean + model.itemBias[i], model.config.minRating, model.config.maxRating) });
      continue;
    }
    let dot = 0;
    const pu = model.userFactors[u];
    const qi = model.itemFactors[i];
    for (let k = 0; k < model.config.factors; k++) dot += pu[k] * qi[k];
    const raw = model.globalMean + model.userBias[u] + model.itemBias[i] + dot;
    scores.push({ itemId, score: clamp(raw, model.config.minRating, model.config.maxRating) });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, n);
}
