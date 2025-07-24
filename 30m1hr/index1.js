"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const decimal_js_1 = __importDefault(require("decimal.js"));
const blockchain_1 = require("./blockchain");
const tpsl_1 = require("./tpsl");
const regime_1 = require("./regime");
const binanceHistorical_1 = require("./binanceHistorical");
const BudgetAndLeverage_1 = require("./BudgetAndLeverage");
const MAX_CYCLES = 10000;
function normalizeSymbol(sym) {
    return sym.replace(/USDT$/, '_USD').toUpperCase();
}
function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}
function log(tag, message) {
    console.log(`[${tag}] ${new Date().toISOString()} — ${message}`);
}
async function runSession() {
    const maxBudget = new decimal_js_1.default(500);
    const maxPerSession = 10;
    let sessionCount = 0;
    const tokens = Object.keys(blockchain_1.priceFeeds);
    const openMap = {};
    tokens.forEach(t => openMap[t] = false);
    await (0, blockchain_1.initBlockchain)();
    log('START', 'Session initialized');
    for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
        log('CYCLE', `--- Cycle ${cycle + 1} ---`);
        const pos = await (0, blockchain_1.getPositions)().catch(() => []);
        const currentlyOpen = new Set(pos.filter(p => BigInt(p.size) !== 0n)
            .map(p => tokens.find(t => p.pairType.includes(t))));
        tokens.forEach(t => openMap[t] = currentlyOpen.has(t));
        const openCount = currentlyOpen.size;
        const slotsLeft = maxPerSession - openCount;
        const pnl = await (0, blockchain_1.getTotalPnL)(blockchain_1.client, blockchain_1.account).catch(() => null);
        if (pnl != null)
            log('PNL', `Total PnL: $${pnl.toFixed(2)}`);
        const { closedAny, closedCount } = await (0, tpsl_1.checkAndCloseForTP)({ client: blockchain_1.client, aptos: blockchain_1.aptos, account: blockchain_1.account, closePosition: blockchain_1.closePosition });
        if (closedAny)
            sessionCount = Math.max(0, sessionCount - closedCount);
        if (slotsLeft > 0) {
            let entriesThis = 0;
            for (const symbol of tokens) {
                if (openMap[symbol] || entriesThis >= slotsLeft)
                    continue;
                const raw = await (0, binanceHistorical_1.getCachedOHLCV)(symbol, '30m', 300).catch(() => null);
                if (!raw || raw.close.length < 100) {
                    log('SKIP', `${symbol} insufficient data`);
                    continue;
                }
                const ohlcv30 = raw;
                const ohlcv1h = await (0, binanceHistorical_1.getCachedOHLCV)(symbol, '1h', 300).catch(() => null);
                if (!ohlcv30) {
                    log('SKIP', `${symbol} missing 30m data`);
                    continue;
                }
                if (!ohlcv1h) {
                    log('SKIP', `${symbol} missing 1h data`);
                    continue;
                }
                const { regime } = await (0, regime_1.guessMarketRegime)(symbol, ohlcv30, ohlcv1h);
                const { budget, leverage } = (0, BudgetAndLeverage_1.getBudgetAndLeverage)(regime);
                log('ENTRY', `${symbol} | Regime=${regime} | Budget=$${budget} | Lev=${leverage}x`);
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
                    log('WARN', `${symbol} low signalScore ${(signalScore * 100).toFixed(1)}%`);
                }
                if (positionOpened) {
                    openMap[symbol] = true;
                    sessionCount++;
                    entriesThis++;
                    log('TRADE', `✅ ${symbol} opened | Regime=${marketRegime} | Count=${sessionCount}`);
                }
                else {
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
