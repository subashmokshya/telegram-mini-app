import dotenv from 'dotenv';
dotenv.config();

import Decimal from 'decimal.js';

import {
  initBlockchain,
  getTotalPnL,
  closeAllPositions,
  getPositions,
  runSignalCheckAndOpen,
  closePosition,
  client,
  aptos,
  account,
  priceFeeds
} from './blockchain';

import { checkAndCloseForTP } from './tpsl';
import { guessMarketRegime, Regime } from './regime';
import { getCachedOHLCV } from './binanceHistorical';
import { getBudgetAndLeverage } from './BudgetAndLeverage';

const MAX_CYCLES = 10000;

function normalizeSymbol(sym: string) {
  return sym.replace(/USDT$/, '_USD').toUpperCase();
}

function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

function log(tag: string, message: string) {
  console.log(`[${tag}] ${new Date().toISOString()} — ${message}`);
}

async function runSession() {
  const maxBudget = new Decimal(500);
  const maxPerSession = 10;
  let sessionCount = 0;
  const tokens = Object.keys(priceFeeds);
  const openMap: Record<string, boolean> = {};
  tokens.forEach(t => openMap[t] = false);

  await initBlockchain();
  log('START', 'Session initialized');

  for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
    log('CYCLE', `--- Cycle ${cycle + 1} ---`);

    const pos = await getPositions().catch(() => []);
    const currentlyOpen = new Set<string>(
      pos.filter(p => BigInt(p.size) !== 0n)
         .map(p => tokens.find(t => p.pairType.includes(t))!)
    );
    tokens.forEach(t => openMap[t] = currentlyOpen.has(t));
    const openCount = currentlyOpen.size;
    const slotsLeft = maxPerSession - openCount;

    const pnl = await getTotalPnL(client, account).catch(() => null);
    if (pnl != null) log('PNL', `Total PnL: $${pnl.toFixed(2)}`);

    const { closedAny, closedCount } = await checkAndCloseForTP({ client, aptos, account, closePosition });
    if (closedAny) sessionCount = Math.max(0, sessionCount - closedCount);

    if (slotsLeft > 0) {
      let entriesThis = 0;

      for (const symbol of tokens) {
        if (openMap[symbol] || entriesThis >= slotsLeft) continue;

        const raw = await getCachedOHLCV(symbol, '30m', 300).catch(() => null);
        if (!raw || raw.close.length < 100) {
          log('SKIP', `${symbol} insufficient data`);
          continue;
        }

        const ohlcv30 = raw;
        const ohlcv1h = await getCachedOHLCV(symbol, '1h', 300).catch(() => null);
        if (!ohlcv30) {
          log('SKIP', `${symbol} missing 30m data`);
          continue;
        }

        if (!ohlcv1h) {
          log('SKIP', `${symbol} missing 1h data`);
          continue;
        }
        const { regime } = await guessMarketRegime(symbol, ohlcv30, ohlcv1h);
        const { budget, leverage } = getBudgetAndLeverage(regime);

        log('ENTRY', `${symbol} | Regime=${regime} | Budget=$${budget} | Lev=${leverage}x`);

        const res = await runSignalCheckAndOpen({
          client,
          aptos,
          account,
          symbol,
          perPositionBudget: budget,
          leverage,
          regimeOverride: regime,
        });

        const { positionOpened, reason, marketRegime, signalScore } = res;
        if (signalScore < 0.7) {
          log('WARN', `${symbol} low signalScore ${(signalScore * 100).toFixed(1)}%`);
        }

        if (positionOpened) {
          openMap[symbol] = true;
          sessionCount++;
          entriesThis++;
          log('TRADE', `✅ ${symbol} opened | Regime=${marketRegime} | Count=${sessionCount}`);
        } else {
          log('SKIP', `${symbol} => ${reason}`);
        }
      }
    }

    await delay(10000);
  }
}

runSession().catch(err => {
  log('FATAL', `Fatal error: ${err.message}`);
  process.exit(1);
});
