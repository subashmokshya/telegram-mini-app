// botCore.ts

import Decimal from 'decimal.js';
import {
  initBlockchain,
  getTotalPnL,
  getPositions,
  runSignalCheckAndOpen,
  closeAllPositions as _closeAllPositions,
  closePosition,
  client,
  aptos,
  account,
  priceFeeds
} from '../30m1hr/blockchain.js';

import { checkAndCloseForTP } from '../30m1hr/tpsl.js';
import { guessMarketRegime } from '../30m1hr/regime.js';
import { getCachedOHLCV } from '../30m1hr/binanceHistorical.js';
import { getBudgetAndLeverage } from '../30m1hr/BudgetAndLeverage.js';

export async function runSessionOnce(): Promise<void> {
  const maxBudget = new Decimal(500);
  const maxPerSession = 10;
  const tokens = Object.keys(priceFeeds);
  const openMap: Record<string, boolean> = {};
  tokens.forEach(t => openMap[t] = false);

  await initBlockchain();

  const pos = await getPositions().catch(() => []);
  const currentlyOpen = new Set<string>(
    pos.filter(p => BigInt(p.size) !== 0n)
       .map(p => tokens.find(t => p.pairType.includes(t))!)
  );
  tokens.forEach(t => openMap[t] = currentlyOpen.has(t));
  const slotsLeft = maxPerSession - currentlyOpen.size;

  await checkAndCloseForTP({ client, aptos, account, closePosition });

  if (slotsLeft > 0) {
    let entriesThis = 0;

    for (const symbol of tokens) {
      if (openMap[symbol] || entriesThis >= slotsLeft) continue;

      const ohlcv30 = await getCachedOHLCV(symbol, '30m', 300).catch(() => null);
      const ohlcv1h = await getCachedOHLCV(symbol, '1h', 300).catch(() => null);
      if (!ohlcv30 || !ohlcv1h) continue;

      const { regime } = await guessMarketRegime(symbol, ohlcv30, ohlcv1h);
      const { budget, leverage } = getBudgetAndLeverage(regime);

      const res = await runSignalCheckAndOpen({
        client, aptos, account,
        symbol,
        perPositionBudget: budget,
        leverage,
        regimeOverride: regime,
      });

      if (res.positionOpened) {
        openMap[symbol] = true;
        entriesThis++;
      }
    }
  }
}

export async function closeAllPositions() {
  await _closeAllPositions();
}
