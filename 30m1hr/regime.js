"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guessMarketRegime = exports.detectRegime = void 0;
// regime.ts
const technicalindicators_1 = require("technicalindicators");
// === Helpers ===
function getEMAValue(close, period) {
    const arr = technicalindicators_1.EMA.calculate({ period, values: close });
    return arr.at(-1) ?? close.at(-1);
}
function getMACDHist(close) {
    const arr = technicalindicators_1.MACD.calculate({
        values: close,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
    });
    return arr.at(-1)?.histogram ?? 0;
}
function getADXValue(ohlcv, period) {
    const arr = technicalindicators_1.ADX.calculate({
        high: ohlcv.high,
        low: ohlcv.low,
        close: ohlcv.close,
        period,
    });
    return arr.at(-1)?.adx ?? 0;
}
function getRSIValue(close, period = 14) {
    const arr = technicalindicators_1.RSI.calculate({ values: close, period });
    return arr.at(-1) ?? 50;
}
function getATRValue(ohlcv, period) {
    const ranges = [];
    for (let i = 1; i < ohlcv.close.length; i++) {
        const high = ohlcv.high[i], low = ohlcv.low[i], prev = ohlcv.close[i - 1];
        ranges.push(Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev)));
    }
    const slice = ranges.slice(-period);
    return slice.reduce((sum, v) => sum + v, 0) / period;
}
function normalize(value, min, max) {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
}
/**
 * Detect regime purely using thresholds from dynamically generated configs
 */
async function detectRegime(symbol, ohlcv, timeframe) {
    if (!ohlcv.close?.length || ohlcv.close.length < 30) {
        throw new Error(`Insufficient data for regime detection (${timeframe})`);
    }
    const closeArr = ohlcv.close;
    const emaFast = getEMAValue(closeArr, 5);
    const emaSlow = getEMAValue(closeArr, 20);
    const emaSlope = (emaFast - emaSlow) / emaSlow;
    const atrPct = getATRValue(ohlcv, 14) / closeArr.at(-1);
    const volatilitySlope = atrPct - getATRValue(ohlcv, 28) / closeArr.at(-1);
    const adx = getADXValue(ohlcv, 14);
    const macdSlope = getMACDHist(closeArr) - getMACDHist(closeArr.slice(0, -1));
    const rsiArr = getRSIValue(closeArr);
    const rsiSlope = rsiArr - getRSIValue(closeArr.slice(0, -1));
    // Base confidence from combined metrics
    const trendScore = Math.abs(emaSlope) + Math.abs(macdSlope) + adx + Math.abs(rsiSlope);
    const baseConf = normalize(trendScore, 0, 10);
    // Regime priority order
    const regimes = [
        'flat_or_choppy',
        'volatile_uncertain',
        'bullish',
        'bearish',
        'neutral',
    ];
    // Map underscore-style regimes to config keys
    const regimeMap = {
        flat_or_choppy: 'flatOrChoppy',
        volatile_uncertain: 'volatileUncertain',
        bullish: 'bullish',
        bearish: 'bearish',
        neutral: 'neutral',
    };
    // Normalize symbol to match adaptiveConfig.json keys (e.g. BTC_USD -> BTCUSDT)
    const normalizedSymbol = symbol
        .toUpperCase()
        .replace('_', '')
        .replace(/USD$/, 'USDT');
    if (emaSlope > 0.002 && macdSlope > 0 && adx > 15 && rsiSlope > 0) {
        return { regime: 'bullish', confidence: baseConf, timeframe };
    }
    if (emaSlope < -0.002 && macdSlope < 0 && adx > 15 && rsiSlope < 0) {
        return { regime: 'bearish', confidence: baseConf, timeframe };
    }
    if (atrPct > 0.015 && Math.abs(volatilitySlope) > 0.01) {
        return { regime: 'volatile_uncertain', confidence: baseConf, timeframe };
    }
    if (adx < 10 && Math.abs(emaSlope) < 0.001) {
        return { regime: 'flat_or_choppy', confidence: baseConf, timeframe };
    }
    return { regime: 'neutral', confidence: baseConf * 0.5, timeframe };
    throw new Error(`No matching dynamic config for any regime on ${symbol}`);
}
exports.detectRegime = detectRegime;
/**
 * Compare 15m & 30m regimes, require alignment or fallback to 30m if mismatch.
 */
async function guessMarketRegime(symbol, ohlcv30m, ohlcv1h) {
    const r15 = await detectRegime(symbol, ohlcv30m, '30m');
    const r30 = await detectRegime(symbol, ohlcv1h, '1h');
    if (r15.regime === r30.regime) {
        return {
            regime: r15.regime,
            confidence: (r15.confidence + r30.confidence) / 2,
            timeframe: '30m+1h',
        };
    }
    return {
        regime: r30.regime,
        confidence: r30.confidence * 0.8,
        timeframe: '30m',
    };
}
exports.guessMarketRegime = guessMarketRegime;
