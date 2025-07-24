import dotenv from 'dotenv';
dotenv.config();
console.log('✅ Loaded .env');

import TelegramBot from 'node-telegram-bot-api';
import Decimal from 'decimal.js';

import {
  initBlockchain,
  getTotalPnL,
  getPositions,
  closeAllPositions,
  runSignalCheckAndOpen,
  closePosition,
  client,
  aptos,
  account,
  priceFeeds
} from './blockchain';

import { checkAndCloseForTP } from './tpsl';
import { guessMarketRegime } from './regime';
import { getCachedOHLCV } from './binanceHistorical';
import { getBudgetAndLeverage } from './BudgetAndLeverage';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });
console.log('🤖 Telegram bot started. Waiting for commands...');

const chatId = process.env.TELEGRAM_CHAT_ID!;

function logToTelegram(tag: string, message: string) {
  const formatted = `[${tag}] ${new Date().toISOString()} — ${message}`;
  console.log(formatted);
  bot.sendMessage(chatId, formatted);
}

function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

async function runSessionOnce(): Promise<void> {
  const maxBudget = new Decimal(500);
  const maxPerSession = 10;
  const tokens = Object.keys(priceFeeds);
  const openMap: Record<string, boolean> = {};
  tokens.forEach(t => openMap[t] = false);

  await initBlockchain();
  logToTelegram('START', 'Session initialized');

  const pos = await getPositions().catch(() => []);
  const currentlyOpen = new Set<string>(
    pos.filter(p => BigInt(p.size) !== 0n)
       .map(p => tokens.find(t => p.pairType.includes(t))!)
  );
  tokens.forEach(t => openMap[t] = currentlyOpen.has(t));
  const openCount = currentlyOpen.size;
  const slotsLeft = maxPerSession - openCount;

  const pnl = await getTotalPnL(client, account).catch(() => null);
  if (pnl != null) logToTelegram('PNL', `Total PnL: $${pnl.toFixed(2)}`);

  const { closedAny, closedCount } = await checkAndCloseForTP({ client, aptos, account, closePosition });

  if (slotsLeft > 0) {
    let entriesThis = 0;

    for (const symbol of tokens) {
      if (openMap[symbol] || entriesThis >= slotsLeft) continue;

      const ohlcv30 = await getCachedOHLCV(symbol, '30m', 300).catch(() => null);
      const ohlcv1h = await getCachedOHLCV(symbol, '1h', 300).catch(() => null);
      if (!ohlcv30 || !ohlcv1h) {
        logToTelegram('SKIP', `${symbol} missing required data`);
        continue;
      }

      const { regime } = await guessMarketRegime(symbol, ohlcv30, ohlcv1h);
      const { budget, leverage } = getBudgetAndLeverage(regime);
      logToTelegram('ENTRY', `${symbol} | Regime=${regime} | Budget=$${budget} | Lev=${leverage}x`);

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
        logToTelegram('WARN', `${symbol} low signalScore ${(signalScore * 100).toFixed(1)}%`);
      }

      if (positionOpened) {
        openMap[symbol] = true;
        entriesThis++;
        logToTelegram('TRADE', `✅ ${symbol} opened | Regime=${marketRegime}`);
      } else {
        logToTelegram('SKIP', `${symbol} => ${reason}`);
      }
    }
  }
}

// ✅ Listen to all messages for debug
bot.on('message', (msg) => {
  console.log(`[RECV] ${msg.text} from chatId=${msg.chat.id}`);
});

// ✅ /startbot handler
bot.onText(/\/startbot/, async (msg) => {
  if (msg.chat.id.toString() !== chatId) return;
  logToTelegram('INFO', 'Manual start triggered');
  try {
    await runSessionOnce();
    logToTelegram('DONE', 'Run complete');
  } catch (err) {
    if (err instanceof Error) {
      logToTelegram('ERROR', `Fatal error: ${err.message}`);
    } else {
      logToTelegram('ERROR', `Fatal error: ${JSON.stringify(err)}`);
    }
  }
});

// ✅ /closeall handler
bot.onText(/\/closeall/, async (msg) => {
  if (msg.chat.id.toString() !== chatId) return;
  logToTelegram('INFO', 'Closing all positions...');
  await closeAllPositions();
  logToTelegram('CLOSE', 'All positions closed');
});
