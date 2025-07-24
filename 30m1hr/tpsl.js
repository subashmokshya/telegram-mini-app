"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAndCloseForTP = exports.getDynamicTP_SL = void 0;
const aiStorage_1 = require("./aiStorage");
const blockchain_1 = require("./blockchain");
const tradeLogger_1 = require("./tradeLogger");
function getDynamicTP_SL({ symbol, regime, atr, entryPrice, leverage }) {
    // Fixed SL: -60% PnL, so priceMove = 0.6% at 100x, 1.2% at 50x, etc.
    const slPct = 60 / leverage / 100; // e.g., 0.006 for 100x = 0.6%
    const sl = entryPrice * slPct;
    // Regime-specific TP multipliers (RRR)
    let rrr = 2.0;
    switch (regime) {
        case "bullish":
            rrr = 1.6;
            break;
        case "bearish":
            rrr = 1.6;
            break;
        case "neutral":
            rrr = 1.6;
            break;
        case "flat_or_choppy":
            rrr = 1.6;
            break;
        case "volatile_uncertain":
            rrr = 1.6;
            break;
    }
    const tp = sl * rrr;
    // Sanity check
    if (sl <= 0 || tp <= 0 || !isFinite(sl) || !isFinite(tp)) {
        console.warn(`⚠️ Invalid TP/SL computed for ${symbol} @ ${regime}: TP=${tp}, SL=${sl}`);
        return {
            tp: 0, sl: 0, rrr: 0, halfATRThreshold: 0, trailOffset: 0, finalTP: 0
        };
    }
    return {
        tp,
        sl,
        rrr,
        halfATRThreshold: atr * 0.5,
        trailOffset: atr * 0.4,
        finalTP: atr * 6.0
    };
}
exports.getDynamicTP_SL = getDynamicTP_SL;
async function checkAndCloseForTP({ client, aptos, account, closePosition }) {
    const address = account.accountAddress.toString();
    const positions = await client.getPositions({ address });
    let closedAny = false;
    let closedCount = 0;
    for (const pos of positions) {
        if (BigInt(pos.size) === 0n)
            continue;
        const symbol = Object.keys(blockchain_1.priceFeeds).find((s) => pos.pairType.includes(s));
        if (!symbol)
            continue;
        const entryPrice = Number(pos.avgPrice ?? pos.entry ?? 0) / 1e10;
        if (!entryPrice)
            continue;
        const stored = (0, aiStorage_1.getAIPOS)(symbol);
        if (!stored)
            continue;
        const mark = await (0, blockchain_1.fetchPrice)(symbol);
        if (!mark)
            continue;
        const isLong = pos.isLong ?? pos.side === "long";
        const dir = isLong ? 1 : -1;
        const tpSl = getDynamicTP_SL({
            symbol,
            regime: stored.marketRegime,
            atr: stored.atr,
            entryPrice,
            leverage: stored.leverage
        });
        if (tpSl.rrr === 0)
            continue;
        const tpLevel = isLong ? entryPrice + tpSl.tp : entryPrice - tpSl.tp;
        const slLevel = isLong ? entryPrice - tpSl.sl : entryPrice + tpSl.sl;
        const movePct = ((mark - entryPrice) / entryPrice) * dir;
        const pnlPct = movePct * 100;
        const isLiquidated = pnlPct <= -99.5;
        // ── Trailing TP Logic ────────────────────────────────
        const prevHighest = stored.highestFav ?? entryPrice;
        const newHighest = isLong ? Math.max(prevHighest, mark) : Math.min(prevHighest, mark);
        const trailStart = isLong ? entryPrice + tpSl.tp * 0.5 : entryPrice - tpSl.tp * 0.5;
        const isTrailing = isLong ? mark >= trailStart : mark <= trailStart;
        let dynamicTP = isLong
            ? newHighest - tpSl.trailOffset
            : newHighest + tpSl.trailOffset;
        const capTP = isLong
            ? entryPrice + tpSl.finalTP
            : entryPrice - tpSl.finalTP;
        if (isLong)
            dynamicTP = Math.min(dynamicTP, capTP);
        else
            dynamicTP = Math.max(dynamicTP, capTP);
        const hitTP = isLong ? mark >= tpLevel : mark <= tpLevel;
        const hitSL = isLong ? mark <= slLevel : mark >= slLevel;
        const hitTrailing = isTrailing && (isLong ? mark <= dynamicTP : mark >= dynamicTP);
        const shouldClose = hitTP || hitSL || hitTrailing || isLiquidated;
        if (shouldClose) {
            const result = isLiquidated ? "liquidated" : hitTP || hitTrailing ? "win" : "loss";
            const reason = result === "win"
                ? hitTP
                    ? "tp_hit"
                    : "trailing_tp_hit"
                : result === "loss"
                    ? "sl_hit"
                    : "liquidated_exit";
            try {
                await closePosition(symbol, pos, client, aptos, account, reason, mark);
            }
            catch (e) {
                console.warn(`❌ Failed to close ${symbol}:`, e);
            }
            (0, tradeLogger_1.logTrade)({
                symbol,
                direction: isLong ? "long" : "short",
                entryPrice: stored.entryPrice,
                exitPrice: mark,
                pnlPct,
                result,
                marketRegime: stored.marketRegime,
                signalScore: stored.signalScore,
                rsi: stored.rsi,
                macdHist: stored.macdHist,
                emaSlope: stored.emaSlope,
                atrPct: stored.atrPct,
                atr: stored.atr,
                adx: stored.adx,
                adxSlope: stored.adxSlope ?? 0,
                volumePct: stored.volumePct ?? 0,
                divergenceScore: stored.divergenceScore ?? 0,
                leverage: stored.leverage,
                tradeType: stored.tradeType ?? "standard",
                closedBy: reason,
                triggeredBy: stored.triggeredBy ?? "",
                note: stored.note ?? "",
                entryReason: stored.entryReason ?? "",
                tp: tpSl.tp,
                sl: tpSl.sl,
                rrr: tpSl.rrr,
                breakevenActivated: stored.breakevenActivated ?? false,
                trailingTPPct: stored.trailingTPPct ?? 0,
                phase: stored.phase ?? "init",
                highestFav: stored.highestFav,
                lowestFav: stored.lowestFav,
                perPositionBudget: stored.perPositionBudget ?? 0
            });
            await (0, aiStorage_1.removeAIPOS)(symbol);
            closedAny = true;
            closedCount++;
        }
        else {
            (0, aiStorage_1.recordAIPOS)(symbol, stored.entryPrice, stored.txHash, stored.signalScore, stored.marketRegime, tpSl.tp, tpSl.sl, stored.rsi, stored.macdHist, stored.emaSlope, stored.atrPct, stored.leverage, stored.atr, stored.adx, stored.adxSlope ?? 0, stored.volumePct ?? 0, stored.perPositionBudget, stored.breakevenActivated ?? false, stored.trailingTPPct ?? 0, stored.divergenceScore ?? 0, stored.tradeType ?? "standard", stored.note ?? "", stored.phase ?? "init", isLong ? newHighest : stored.highestFav, !isLong ? newHighest : stored.lowestFav, stored.slPrice, stored.triggeredBy ?? "", stored.entryReason ?? "", tpSl.tp, tpSl.sl, tpSl.rrr);
        }
    }
    return { closedAny, closedCount };
}
exports.checkAndCloseForTP = checkAndCloseForTP;
