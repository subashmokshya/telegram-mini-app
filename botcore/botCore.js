"use strict";
// botCore.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeAllPositions = exports.runSessionOnce = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
const blockchain_ts_1 = require("../30m1hr/blockchain.ts");
const tpsl_ts_1 = require("../30m1hr/tpsl.ts");
const regime_ts_1 = require("../30m1hr/regime.ts");
const binanceHistorical_ts_1 = require("../30m1hr/binanceHistorical.ts");
const BudgetAndLeverage_ts_1 = require("../30m1hr/BudgetAndLeverage.ts");
async function runSessionOnce() {
    const maxBudget = new decimal_js_1.default(500);
    const maxPerSession = 10;
    const tokens = Object.keys(blockchain_ts_1.priceFeeds);
    const openMap = {};
    tokens.forEach(t => openMap[t] = false);
    await (0, blockchain_ts_1.initBlockchain)();
    const pos = await (0, blockchain_ts_1.getPositions)().catch(() => []);
    const currentlyOpen = new Set(pos.filter(p => BigInt(p.size) !== 0n)
        .map(p => tokens.find(t => p.pairType.includes(t))));
    tokens.forEach(t => openMap[t] = currentlyOpen.has(t));
    const slotsLeft = maxPerSession - currentlyOpen.size;
    await (0, tpsl_ts_1.checkAndCloseForTP)({ client: blockchain_ts_1.client, aptos: blockchain_ts_1.aptos, account: blockchain_ts_1.account, closePosition: blockchain_ts_1.closePosition });
    if (slotsLeft > 0) {
        let entriesThis = 0;
        for (const symbol of tokens) {
            if (openMap[symbol] || entriesThis >= slotsLeft)
                continue;
            const ohlcv30 = await (0, binanceHistorical_ts_1.getCachedOHLCV)(symbol, '30m', 300).catch(() => null);
            const ohlcv1h = await (0, binanceHistorical_ts_1.getCachedOHLCV)(symbol, '1h', 300).catch(() => null);
            if (!ohlcv30 || !ohlcv1h)
                continue;
            const { regime } = await (0, regime_ts_1.guessMarketRegime)(symbol, ohlcv30, ohlcv1h);
            const { budget, leverage } = (0, BudgetAndLeverage_ts_1.getBudgetAndLeverage)(regime);
            const res = await (0, blockchain_ts_1.runSignalCheckAndOpen)({
                client: blockchain_ts_1.client, aptos: blockchain_ts_1.aptos, account: blockchain_ts_1.account,
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
exports.runSessionOnce = runSessionOnce;
async function closeAllPositions() {
    await (0, blockchain_ts_1.closeAllPositions)();
}
exports.closeAllPositions = closeAllPositions;
