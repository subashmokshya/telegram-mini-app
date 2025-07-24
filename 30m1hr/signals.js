"use strict";
// ✅ Fully Optimized signals.ts — Aligned with Adaptive Strategy + Clean Types
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRSIDiverging = exports.isEMACompressed = exports.getMinutesSinceHour = exports.checkSignals = exports.detectMarketRegime = exports.calculateADX = exports.buildIndicatorInputs = exports.divergenceScore = exports.linearSlope = exports.calculateSignalScore = exports.calculateSignalScoreWeighted = exports.isUncertainRegime = exports.TradeMemory = void 0;
const technicalindicators_1 = require("technicalindicators");
class TradeMemory {
    constructor() {
        this.cooldownCounter = 0;
        this.lastResult = null;
    }
    recordTradeResult(outcome) {
        this.lastResult = outcome;
        this.cooldownCounter = outcome === 'loss' ? 5 : 0;
    }
    tick() {
        if (this.cooldownCounter > 0)
            this.cooldownCounter--;
    }
    canTrade(signalStrength, overrideThreshold = 0.8) {
        return this.cooldownCounter === 0 || signalStrength >= overrideThreshold;
    }
}
exports.TradeMemory = TradeMemory;
function isUncertainRegime(regime) {
    return ['flat_or_choppy', 'volatile_uncertain', 'neutral'].includes(regime);
}
exports.isUncertainRegime = isUncertainRegime;
function calculateSignalScoreWeighted({ rsi, macdHist, emaSlope, atrPct, adx, divergenceScore = 0 }, thresholds, p0) {
    const rsiComponent = rsi > 70 || rsi < 30 ? 1 : rsi > 55 || rsi < 45 ? 0.8 : 0.5;
    const macdComponent = Math.abs(macdHist) > 0.0002 ? 1 : 0.3; // Weaker influence
    const emaSlopeComponent = Math.abs(emaSlope) > 0.003 ? 1 : Math.abs(emaSlope) > 0.0015 ? 0.7 : 0.3;
    const atrComponent = atrPct > 0.005 ? 1 : atrPct > 0.003 ? 0.7 : 0.4;
    const adxComponent = adx > 30 ? 1 : adx > 20 ? 0.7 : 0.4;
    const divergenceComponent = divergenceScore > 0.3 ? 1 : divergenceScore > 0.1 ? 0.6 : 0.3;
    const weightedScore = (1.2 * rsiComponent +
        0.5 * macdComponent +
        1.5 * emaSlopeComponent +
        1.0 * atrComponent +
        1.0 * adxComponent +
        0.3 * divergenceComponent) / 5.5;
    return Math.min(1, weightedScore);
}
exports.calculateSignalScoreWeighted = calculateSignalScoreWeighted;
exports.calculateSignalScore = calculateSignalScoreWeighted;
function linearSlope(arr) {
    const n = arr.length;
    if (n === 0)
        return 0;
    const xMean = (n - 1) / 2;
    const yMean = arr.reduce((a, b) => a + b, 0) / n;
    const numerator = arr.reduce((sum, y, i) => sum + (i - xMean) * (y - yMean), 0);
    const denominator = arr.reduce((sum, _, i) => sum + Math.pow(i - xMean, 2), 0);
    return denominator === 0 ? 0 : numerator / denominator;
}
exports.linearSlope = linearSlope;
function divergenceScore(rsiTrend, priceTrend) {
    if (rsiTrend.length < 5 || priceTrend.length < 5)
        return 0;
    const rsiSlope = linearSlope(rsiTrend);
    const priceSlope = linearSlope(priceTrend);
    const slopeDiff = Math.abs(rsiSlope - priceSlope);
    const isStrongOpposition = Math.sign(rsiSlope) !== Math.sign(priceSlope);
    const isFlattening = Math.abs(priceSlope) < 0.002; // price almost flat
    const isRSILeading = Math.abs(rsiSlope) > Math.abs(priceSlope) * 3;
    const hasDivergence = (isStrongOpposition && slopeDiff > 0.2) ||
        (isFlattening && Math.abs(rsiSlope) > 0.1) ||
        (isRSILeading && slopeDiff > 0.25);
    if (hasDivergence) {
        console.log(`📉 Divergence Detected — RSI Slope: ${rsiSlope.toFixed(4)} vs Price Slope: ${priceSlope.toFixed(4)} (Δ=${slopeDiff.toFixed(4)})`);
        return parseFloat(Math.min(slopeDiff, 1).toFixed(4));
    }
    return 0;
}
exports.divergenceScore = divergenceScore;
function buildIndicatorInputs(signalResult, close, // ⬅️ full close array instead of single price
volumeArr) {
    const closePrice = close.at(-1) ?? 1;
    const slope = signalResult.emaFast && signalResult.emaSlow
        ? (signalResult.emaFast - signalResult.emaSlow) / signalResult.emaSlow
        : 0;
    const atrPct = signalResult.atrValue && closePrice ? signalResult.atrValue / closePrice : 0;
    const volumePercent = calculateVolumePercent(volumeArr);
    const thresholds = {
        RSI: 35,
        MACD_Histogram: 0.002,
        EMA_Slope: 0.0025,
        ATRPercent: 0.35,
        VolumePercent: 0.75,
        regime: signalResult.marketRegime,
        atrMin: 0.25,
        adxMin: 15,
        signalScoreMin: 0.75,
        emaBullThreshold: 0.002,
        emaBearThreshold: -0.002,
        rsiOversold: 30,
        rsiOverbought: 70,
        tpMultLong: 1.5,
        slMultLong: 1.0,
        tpMultShort: 1.5,
        slMultShort: 1.0,
        leverage: 100,
        winRate: 0.65,
        trades: 30,
        enabled: true
    };
    const rsiTrend = signalResult.rsiTrend ?? [];
    const priceTrend = close.slice(-rsiTrend.length); // ✅ aligned
    const divScore = divergenceScore(rsiTrend, priceTrend);
    return {
        rsi: signalResult.rsiValue ?? 50,
        macdHist: signalResult.macdHist ?? 0,
        macdHistPrev: signalResult.macdHistPrev ?? 0,
        emaSlope: slope,
        adx: signalResult.adxValue ?? 20,
        atrPct,
        atr: signalResult.atrValue ?? 0,
        thresholds,
        rsiTrend,
        divergenceScore: divScore,
        signalScore: 0,
        volumePct: volumePercent,
        volumePercent: volumePercent
    };
}
exports.buildIndicatorInputs = buildIndicatorInputs;
function calculateADX(high, low, close, period = 14) {
    if (high.length < period)
        return null;
    const adxArr = technicalindicators_1.ADX.calculate({ high, low, close, period });
    return adxArr.length > 0 ? adxArr[adxArr.length - 1].adx : null;
}
exports.calculateADX = calculateADX;
function detectMarketRegime({ emaShort, emaLong, rsi, macd, atrPct }) {
    const emaGap = (emaShort - emaLong) / emaLong;
    const macdAbs = Math.abs(macd);
    if (emaGap > 0.003 && rsi > 60 && macd > 0)
        return 'bullish';
    if (emaGap < -0.003 && rsi < 40 && macd < 0)
        return 'bearish';
    if (Math.abs(emaGap) < 0.001 && rsi >= 45 && rsi <= 55 && atrPct < 0.2)
        return 'flat_or_choppy';
    if (atrPct > 0.5 && (rsi < 45 || rsi > 55) && macdAbs < 0.001)
        return 'volatile_uncertain';
    return 'neutral';
}
exports.detectMarketRegime = detectMarketRegime;
function calculateVolumePercent(volume) {
    if (!volume.length)
        return 0;
    const latestVol = volume.at(-1) ?? 0;
    const maxVol = Math.max(...volume.slice(-50));
    return maxVol > 0 ? latestVol / maxVol : 0;
}
function checkSignals(symbol, ohlcv, configOverride, forcedRegime) {
    const { open, high, low, close, volume } = ohlcv;
    if (close.length < 26) {
        console.log(`⚠️ Not enough data for ${symbol} (need 26+ candles, got ${close.length})`);
        return {
            emaFast: 0,
            emaSlow: 0,
            atrValue: 0,
            adxValue: 0,
            adxPrev: 0,
            macdValue: 0,
            macdHist: 0,
            macdHistPrev: 0,
            rsiValue: 0,
            marketRegime: 'neutral',
            signalScore: 0,
            rsiTrend: [],
            volumePct: 0,
            priceTrend: () => null,
            priceSlope: 0,
            passed: false,
            reason: 'Rejected: insufficient candles (<26)'
        };
    }
    const emaFastArr = technicalindicators_1.EMA.calculate({ period: 5, values: close });
    const emaSlowArr = technicalindicators_1.EMA.calculate({ period: 20, values: close });
    const atrArr = technicalindicators_1.ATR.calculate({ period: 14, high, low, close });
    const macdArr = technicalindicators_1.MACD.calculate({
        values: close,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
    });
    const rsiArr = technicalindicators_1.RSI.calculate({ period: 14, values: close });
    const adxArr = technicalindicators_1.ADX.calculate({ high, low, close, period: 14 });
    const emaFast = emaFastArr.at(-1) ?? 0;
    const emaSlow = emaSlowArr.at(-1) ?? 0;
    const atrValue = atrArr.at(-1) ?? 0;
    const macdResult = macdArr.at(-1);
    const macdPrev = macdArr.at(-2);
    const macdValue = macdResult?.MACD ?? 0;
    const macdHist = macdResult?.histogram ?? 0;
    const macdHistPrev = macdPrev?.histogram ?? macdHist;
    const rsiValue = rsiArr.at(-1) ?? 0;
    const adxValue = adxArr.at(-1)?.adx ?? 0;
    const adxPrev = adxArr.at(-2)?.adx ?? adxValue;
    const adxSlope = adxValue - adxPrev;
    const lastClose = close.at(-1) ?? 1;
    const atrPct = atrValue / lastClose;
    const volumePercent = calculateVolumePercent(volume);
    const marketRegime = forcedRegime ?? detectMarketRegime({
        emaShort: emaFast,
        emaLong: emaSlow,
        rsi: rsiValue,
        macd: macdValue,
        atrPct
    });
    const signalResult = {
        emaFast,
        emaSlow,
        atrValue,
        adxValue,
        adxPrev,
        macdValue,
        macdHist,
        macdHistPrev,
        rsiValue,
        rsiTrend: rsiArr.slice(-20),
        marketRegime,
        priceTrend: () => null,
        signalScore: 0,
        passed: false,
        reason: '',
        volumePct: 0,
        priceSlope: 0
    };
    const indicatorInputs = buildIndicatorInputs(signalResult, close, volume);
    const thresholds = configOverride
        ? { ...indicatorInputs.thresholds, ...configOverride }
        : indicatorInputs.thresholds;
    const signalScore = (0, exports.calculateSignalScore)(indicatorInputs, thresholds, {
        rsi: indicatorInputs.rsi,
        macdHist: indicatorInputs.macdHist,
        macdHistPrev: indicatorInputs.macdHistPrev,
        emaSlope: indicatorInputs.emaSlope,
        atrPct: indicatorInputs.atrPct,
        adx: indicatorInputs.adx,
        regime: thresholds.regime ?? marketRegime,
        divergence: indicatorInputs.divergenceScore ?? 0,
        cfg: thresholds,
        volumePct: indicatorInputs.volumePct ?? 0
    });
    const rsiSlope = linearSlope(indicatorInputs.rsiTrend);
    const priceSlope = linearSlope(close.slice(-indicatorInputs.rsiTrend.length));
    const divType = indicatorInputs.divergenceScore > 0
        ? rsiSlope > 0 ? 'Bullish' : 'Bearish'
        : 'None';
    if (!ohlcv || ohlcv.close.length < 30) {
        console.warn(`[Signal ERROR] OHLCV data too short or missing`);
    }
    console.log(`📈 ${symbol} indicators:`);
    console.log(`  EMA(5): ${emaFast.toFixed(6)}, EMA(20): ${emaSlow.toFixed(6)}`);
    console.log(`  EMA Slope: ${indicatorInputs.emaSlope.toFixed(6)}`);
    console.log(`  ATR(14): ${atrValue.toFixed(6)}, ATR%: ${(atrPct * 100).toFixed(2)}%`);
    console.log(`  MACD(12,26): ${macdValue.toFixed(6)}, MACD Hist: ${macdHist.toFixed(6)}, Prev Hist: ${macdHistPrev.toFixed(6)}`);
    console.log(`  RSI(14): ${rsiValue.toFixed(2)}`);
    console.log(`  ADX(14): ${adxValue.toFixed(2)}`);
    console.log(`  Volume%: ${(volumePercent * 100).toFixed(2)}%`);
    console.log(`[Signal] ${symbol} | ADX: ${adxValue.toFixed(2)} | ADX Slope: ${adxSlope.toFixed(4)}`);
    console.log(`🧪 RSI Slope: ${rsiSlope}, Price Slope: ${priceSlope}`);
    console.log(`  Divergence Score: ${indicatorInputs.divergenceScore.toFixed(4)} (${divType})`);
    console.log(`  📊 Market Regime: ${marketRegime}, Signal Score: ${signalScore.toFixed(2)}`);
    return {
        ...signalResult,
        signalScore,
        passed: true,
        reason: 'Signal calculated',
        volumePct: indicatorInputs.volumePct,
        atrPct: indicatorInputs.atrPct,
        emaSlope: indicatorInputs.emaSlope,
        adxSlope: indicatorInputs.adx - adxPrev,
        adx: indicatorInputs.adx,
        atr: indicatorInputs.atr,
        rsi: indicatorInputs.rsi,
        divergenceScore: indicatorInputs.divergenceScore,
        priceSlope
    };
}
exports.checkSignals = checkSignals;
function getMinutesSinceHour() {
    return new Date().getUTCMinutes();
}
exports.getMinutesSinceHour = getMinutesSinceHour;
function isEMACompressed(emaFast, emaSlow, price) {
    return Math.abs(emaFast - emaSlow) / price < 0.0015; // 0.15%
}
exports.isEMACompressed = isEMACompressed;
function isRSIDiverging(rsiTrend, priceTrend) {
    const rsiSlope = rsiTrend[rsiTrend.length - 1] - rsiTrend[0];
    const priceSlope = priceTrend[priceTrend.length - 1] - priceTrend[0];
    return Math.abs(rsiSlope - priceSlope) / Math.abs(priceSlope || 1e-6) > 0.1;
}
exports.isRSIDiverging = isRSIDiverging;
