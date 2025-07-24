"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
console.log('✅ Loaded .env');
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const decimal_js_1 = __importDefault(require("decimal.js"));
const blockchain_1 = require("./blockchain");
const tpsl_1 = require("./tpsl");
const regime_1 = require("./regime");
const binanceHistorical_1 = require("./binanceHistorical");
const BudgetAndLeverage_1 = require("./BudgetAndLeverage");
const bot = new node_telegram_bot_api_1.default(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
console.log('🤖 Telegram bot started. Waiting for commands...');
const chatId = process.env.TELEGRAM_CHAT_ID;
function logToTelegram(tag, message) {
    const formatted = `[${tag}] ${new Date().toISOString()} — ${message}`;
    console.log(formatted);
    bot.sendMessage(chatId, formatted);
}
function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}
async function runSessionOnce() {
    const maxBudget = new decimal_js_1.default(500);
    const maxPerSession = 10;
    const tokens = Object.keys(blockchain_1.priceFeeds);
    const openMap = {};
    tokens.forEach(t => openMap[t] = false);
    await (0, blockchain_1.initBlockchain)();
    logToTelegram('START', 'Session initialized');
    const pos = await (0, blockchain_1.getPositions)().catch(() => []);
    const currentlyOpen = new Set(pos.filter(p => BigInt(p.size) !== 0n)
        .map(p => tokens.find(t => p.pairType.includes(t))));
    tokens.forEach(t => openMap[t] = currentlyOpen.has(t));
    const openCount = currentlyOpen.size;
    const slotsLeft = maxPerSession - openCount;
    const pnl = await (0, blockchain_1.getTotalPnL)(blockchain_1.client, blockchain_1.account).catch(() => null);
    if (pnl != null)
        logToTelegram('PNL', `Total PnL: $${pnl.toFixed(2)}`);
    const { closedAny, closedCount } = await (0, tpsl_1.checkAndCloseForTP)({ client: blockchain_1.client, aptos: blockchain_1.aptos, account: blockchain_1.account, closePosition: blockchain_1.closePosition });
    if (slotsLeft > 0) {
        let entriesThis = 0;
        for (const symbol of tokens) {
            if (openMap[symbol] || entriesThis >= slotsLeft)
                continue;
            const ohlcv30 = await (0, binanceHistorical_1.getCachedOHLCV)(symbol, '30m', 300).catch(() => null);
            const ohlcv1h = await (0, binanceHistorical_1.getCachedOHLCV)(symbol, '1h', 300).catch(() => null);
            if (!ohlcv30 || !ohlcv1h) {
                logToTelegram('SKIP', `${symbol} missing required data`);
                continue;
            }
            const { regime } = await (0, regime_1.guessMarketRegime)(symbol, ohlcv30, ohlcv1h);
            const { budget, leverage } = (0, BudgetAndLeverage_1.getBudgetAndLeverage)(regime);
            logToTelegram('ENTRY', `${symbol} | Regime=${regime} | Budget=$${budget} | Lev=${leverage}x`);
            const res = await (0, blockchain_1.runSignalCheckAndOpen)({
                client: blockchain_1.client,
                aptos: blockchain_1.aptos,
                account: blockchain_1.account,
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
            }
            else {
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
    if (msg.chat.id.toString() !== chatId)
        return;
    logToTelegram('INFO', 'Manual start triggered');
    try {
        await runSessionOnce();
        logToTelegram('DONE', 'Run complete');
    }
    catch (err) {
        if (err instanceof Error) {
            logToTelegram('ERROR', `Fatal error: ${err.message}`);
        }
        else {
            logToTelegram('ERROR', `Fatal error: ${JSON.stringify(err)}`);
        }
    }
});
// ✅ /closeall handler
bot.onText(/\/closeall/, async (msg) => {
    if (msg.chat.id.toString() !== chatId)
        return;
    logToTelegram('INFO', 'Closing all positions...');
    await (0, blockchain_1.closeAllPositions)();
    logToTelegram('CLOSE', 'All positions closed');
});
