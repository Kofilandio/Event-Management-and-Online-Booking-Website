import { trainAndSave } from './index.js';

(async () => {
  console.log('Training BMF model on current interactions…');
  const model = await trainAndSave();
  console.log(`Done. Users: ${model.userIds.length}, items: ${model.itemIds.length}`);
  if (model.rmseHistory.length) {
    console.log('RMSE per epoch:', model.rmseHistory.map((v) => v.toFixed(4)).join(', '));
  }
  process.exit(0);
})();
