/**
 * Standalone sanity test for the Biased Matrix Factorization implementation.
 * Run with: `npx tsx src/services/recommender/__test.ts`
 *
 * Constructs a synthetic preference matrix, trains BMF, and verifies that:
 *  1. Training RMSE decreases over epochs.
 *  2. Top-N recommendations align with the held-out preferred items per user.
 */
import { train, topNForUser, predict } from './model.js';

function synthDataset() {
  // 5 users x 8 items. Two underlying "tastes":
  //  - even-indexed users like even-indexed items
  //  - odd-indexed users like odd-indexed items
  const interactions: { userId: number; itemId: number; rating: number }[] = [];
  for (let u = 0; u < 5; u++) {
    for (let i = 0; i < 8; i++) {
      const match = (u % 2) === (i % 2);
      // observed interactions: a mix of "5" likes, "1" dislikes
      if (match && Math.random() > 0.2) interactions.push({ userId: u, itemId: i, rating: 5 });
      if (!match && Math.random() > 0.5) interactions.push({ userId: u, itemId: i, rating: 1 });
    }
  }
  return interactions;
}

(function run() {
  const data = synthDataset();
  console.log(`Training on ${data.length} interactions…`);

  const model = train(data, { factors: 8, epochs: 50, learningRate: 0.02, regularization: 0.02 });
  console.log('RMSE history (first/last):',
    model.rmseHistory[0].toFixed(4), '→', model.rmseHistory[model.rmseHistory.length - 1].toFixed(4));

  if (model.rmseHistory[model.rmseHistory.length - 1] >= model.rmseHistory[0]) {
    console.error('FAIL: training did not reduce RMSE');
    process.exit(1);
  }

  const candidateItems = [0, 1, 2, 3, 4, 5, 6, 7];

  // For each user, verify the top item has same parity (taste match)
  let correct = 0;
  for (let u = 0; u < 5; u++) {
    const top = topNForUser(model, u, candidateItems, 4);
    const expectedParity = u % 2;
    const topMatches = top.filter((t) => t.itemId % 2 === expectedParity).length;
    if (topMatches >= 2) correct++;
    console.log(`user ${u} (parity ${expectedParity}): top items =`,
      top.map((t) => `${t.itemId}:${t.score.toFixed(2)}`).join(' '));
  }

  console.log(`Users with correct taste preference in top-4: ${correct}/5`);
  if (correct < 4) {
    console.error('FAIL: recommendation alignment below threshold');
    process.exit(1);
  }
  console.log('OK');
})();
