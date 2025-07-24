"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateSignalOnly = void 0;
const signals_1 = require("./signals");
const binanceHistorical_1 = require("./binanceHistorical");
function candlePosition({ open, close, high, low }) {
    const range = high - low || 1;
    const closePos = (close - low) / range;
    if (closePos >= 0.8)
        return 'top';
    if (closePos >= 0.67)
        return 'anticipation_top';
    if (closePos <= 0.2)
        return 'bottom';
    if (closePos <= 0.33)
        return 'anticipation_bottom';
    return 'middle';
}
async function evaluateSignalOnly(symbol, _ohlcv, p0) {
    try {
        // 1) Fetch 30m for confirmation + 1h for entry candle
        const mtf = await (0, binanceHistorical_1.getMultiTimeframeOHLCV)(symbol, ['30m', '1h'], 300);
        const ohlcv30m = mtf['30m'];
        const ohlcv1h = mtf['1h'];
        // 2) Compute confirmation metrics on 30m
        const res30 = (0, signals_1.checkSignals)(symbol, ohlcv30m, p0.configOverride, p0.regimeOverride);
        const { signalScore = 0, rsiValue: rsi = 50, rsiTrend = [], emaSlope: emaSlope30m = 0, macdHist = 0, macdHistPrev = 0, adxValue: adx = 0, adxSlope = 0, atrValue = 0, divergenceScore = 0, priceSlope: rawPriceSlope30m, marketRegime } = res30;
        const rsiSlope30m = (0, signals_1.linearSlope)(rsiTrend);
        const macdAccel30m = macdHist - macdHistPrev;
        const priceSlope30m = typeof rawPriceSlope30m === 'number' && !isNaN(rawPriceSlope30m) ? rawPriceSlope30m : 0;
        const atrPct30m = (atrValue / ohlcv30m.close.at(-1)) * 100;
        // 3) Grab latest 1h candle for entry trigger
        const i1h = ohlcv1h.close.length - 1;
        const open1h = ohlcv1h.open[i1h], high1h = ohlcv1h.high[i1h], low1h = ohlcv1h.low[i1h], close1h = ohlcv1h.close[i1h];
        const candlePos1h = candlePosition({ open: open1h, high: high1h, low: low1h, close: close1h });
        // 4) Get 30m candle position (for bullishLong/bearishShort)
        const i30m = ohlcv30m.close.length - 1;
        const candlePos30m = candlePosition({
            open: ohlcv30m.open[i30m],
            high: ohlcv30m.high[i30m],
            low: ohlcv30m.low[i30m],
            close: ohlcv30m.close[i30m],
        });
        // 5) Define sniper + reversal + directional (bearishShort/bullishLong) conditions
        const sniperConditions = {
            long: {
                signalScore: { value: signalScore, pass: signalScore > 0.5, expected: '> 0.5' },
                rsi: { value: rsi, pass: rsi >= 35 && rsi <= 55, expected: '35–50' },
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m > 0, expected: '> 0' },
                atr: { value: atrPct30m, pass: atrPct30m > 0.25, expected: '> 0.25%' },
                adx: { value: adx, pass: adx > 10, expected: '> 10' },
                adxSlope: { value: adxSlope, pass: adxSlope < 0, expected: '< 0' },
                divergence: { value: divergenceScore, pass: divergenceScore >= 0, expected: '>= 0' },
                priceSlope: { value: priceSlope30m, pass: priceSlope30m > 0, expected: '> 0' },
                emaSlope30m: { value: emaSlope30m, pass: emaSlope30m > 0, expected: '> 0' },
                macdAccel30m: { value: macdAccel30m, pass: macdAccel30m > 0, expected: '> 0' },
                candlePos1h: { value: candlePos1h, pass: candlePos1h === 'bottom' || candlePos1h === 'anticipation_bottom', expected: 'bottom/anticipation_bottom' },
            },
            short: {
                signalScore: { value: signalScore, pass: signalScore > 0.5, expected: '> 0.5' },
                rsi: { value: rsi, pass: rsi >= 35 && rsi <= 55, expected: '35–55' },
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m < 0, expected: '< 0' },
                atr: { value: atrPct30m, pass: atrPct30m > 0.25, expected: '> 0.25%' },
                adx: { value: adx, pass: adx > 10, expected: '> 10' },
                adxSlope: { value: adxSlope, pass: adxSlope < 0, expected: '< 0' },
                divergence: { value: divergenceScore, pass: divergenceScore >= 0, expected: '>= 0' },
                priceSlope: { value: priceSlope30m, pass: priceSlope30m < 0, expected: '< 0' },
                emaSlope30m: { value: emaSlope30m, pass: emaSlope30m < 0, expected: '< 0' },
                macdAccel30m: { value: macdAccel30m, pass: macdAccel30m < 0, expected: '< 0' },
                candlePos1h: { value: candlePos1h, pass: candlePos1h === 'top' || candlePos1h === 'anticipation_top', expected: 'top/anticipation_top' },
            },
            longReversal: {
                signalScore: { value: signalScore, pass: signalScore > 0.5, expected: '> 0.5' },
                rsi: { value: rsi, pass: rsi > 80, expected: '> 80' },
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m > 0, expected: '> 0' },
                atr: { value: atrPct30m, pass: atrPct30m > 0.25, expected: '> 0.25%' },
                adx: { value: adx, pass: adx > 10, expected: '> 10' },
                adxSlope: { value: adxSlope, pass: adxSlope > 0, expected: '> 0' },
                divergence: { value: divergenceScore, pass: divergenceScore >= 0, expected: '>= 0' },
                priceSlope: { value: priceSlope30m, pass: priceSlope30m > 0, expected: '> 0' },
                emaSlope30m: { value: emaSlope30m, pass: emaSlope30m > 0, expected: '> 0' },
                macdAccel30m: { value: macdAccel30m, pass: macdAccel30m > 0, expected: '> 0' },
                candlePos1h: { value: candlePos1h, pass: candlePos1h === 'top' || candlePos1h === 'anticipation_top', expected: 'top/anticipation_top' },
            },
            shortReversal: {
                signalScore: { value: signalScore, pass: signalScore > 0.5, expected: '> 0.5' },
                rsi: { value: rsi, pass: rsi < 20, expected: '< 20' },
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m < 0, expected: '< 0' },
                atr: { value: atrPct30m, pass: atrPct30m > 0.25, expected: '> 0.25%' },
                adx: { value: adx, pass: adx > 10, expected: '> 10' },
                adxSlope: { value: adxSlope, pass: adxSlope > 0, expected: '> 0' },
                divergence: { value: divergenceScore, pass: divergenceScore >= 0, expected: '>= 0' },
                priceSlope: { value: priceSlope30m, pass: priceSlope30m < 0, expected: '< 0' },
                emaSlope30m: { value: emaSlope30m, pass: emaSlope30m < 0, expected: '< 0' },
                macdAccel30m: { value: macdAccel30m, pass: macdAccel30m < 0, expected: '< 0' },
                candlePos1h: { value: candlePos1h, pass: candlePos1h === 'bottom' || candlePos1h === 'anticipation_bottom', expected: 'bottom/anticipation_bottom' },
            },
            bearishShort: {
                signalScore: { value: signalScore, pass: signalScore > 0.5, expected: '> 0.5' },
                rsi: { value: rsi, pass: rsi >= 65 && rsi <= 80, expected: '65–80' },
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m < 0, expected: '< 0' },
                atr: { value: atrPct30m, pass: atrPct30m > 0.25, expected: '> 0.25%' },
                adx: { value: adx, pass: adx > 10, expected: '> 10' },
                adxSlope: { value: adxSlope, pass: adxSlope < 0, expected: '< 0' },
                divergence: { value: divergenceScore, pass: divergenceScore >= 0, expected: '>= 0' },
                priceSlope: { value: priceSlope30m, pass: priceSlope30m > 0, expected: '> 0' },
                emaSlope30m: { value: emaSlope30m, pass: emaSlope30m > 0, expected: '> 0' },
                macdAccel30m: { value: macdAccel30m, pass: macdAccel30m > 0, expected: '> 0' },
                candlePos1h: { value: candlePos1h, pass: candlePos1h === 'top' || candlePos1h === 'anticipation_top', expected: 'top/anticipation_top' },
            },
            bullishLong: {
                signalScore: { value: signalScore, pass: signalScore > 0.5, expected: '> 0.5' },
                rsi: { value: rsi, pass: rsi >= 20 && rsi <= 35, expected: '20–35' },
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m > 0, expected: '> 0' },
                atr: { value: atrPct30m, pass: atrPct30m > 0.25, expected: '> 0.25%' },
                adx: { value: adx, pass: adx > 10, expected: '> 10' },
                adxSlope: { value: adxSlope, pass: adxSlope < 0, expected: '< 0' },
                divergence: { value: divergenceScore, pass: divergenceScore >= 0, expected: '>= 0' },
                priceSlope: { value: priceSlope30m, pass: priceSlope30m < 0, expected: '< 0' },
                emaSlope30m: { value: emaSlope30m, pass: emaSlope30m < 0, expected: '< 0' },
                macdAccel30m: { value: macdAccel30m, pass: macdAccel30m < 0, expected: '< 0' },
                candlePos1h: { value: candlePos1h, pass: candlePos1h === 'bottom' || candlePos1h === 'anticipation_bottom', expected: 'bottom/anticipation_bottom' },
            },
        };
        // 6) Evaluate failures
        const failed = {
            long: [], short: [], longReversal: [], shortReversal: [], bearishShort: [], bullishLong: []
        };
        for (const side of Object.keys(sniperConditions)) {
            for (const [k, { value, pass, expected }] of Object.entries(sniperConditions[side])) {
                if (!pass)
                    failed[side].push(`${k}=${value} ❌ [expected ${expected}]`);
            }
        }
        // 7) Direction logic
        let direction;
        let reason = '';
        if (failed.long.length === 0) {
            direction = 'long';
            reason = '✅ sniper criteria met';
        }
        else if (failed.short.length === 0) {
            direction = 'short';
            reason = '✅ sniper criteria met';
        }
        else if (failed.longReversal.length === 0) {
            direction = 'short';
            reason = '✅ reversal criteria met';
        }
        else if (failed.shortReversal.length === 0) {
            direction = 'long';
            reason = '✅ reversal criteria met';
        }
        else if (failed.bearishShort.length === 0) {
            direction = 'short';
            reason = '✅ bearishShort override';
        }
        else if (failed.bullishLong.length === 0) {
            direction = 'long';
            reason = '✅ bullishLong override';
        }
        if (!direction) {
            return {
                ...res30,
                shouldOpen: false,
                passed: false,
                reason: `✖️ Signal rejected:\n(long): ${failed.long.join('; ')}\n(short): ${failed.short.join('; ')}\n(longReversal): ${failed.longReversal.join('; ')}\n(shortReversal): ${failed.shortReversal.join('; ')}\n(bearishShort): ${failed.bearishShort.join('; ')}\n(bullishLong): ${failed.bullishLong.join('; ')}`,
                confidence: 'low',
                logged: false,
            };
        }
        // 8) Final result
        return {
            ...res30,
            shouldOpen: true,
            passed: true,
            reason,
            direction,
            entryType: direction,
            confidence: 'high',
            triggeredBy: 'evaluateSignalOnly',
            logged: false,
        };
    }
    catch (err) {
        console.error(`❌ Error evaluating sniper signal for ${symbol}`, err);
        return {
            shouldOpen: false,
            reason: 'error',
            confidence: 'low',
            logged: false,
            signalScore: 0, emaFast: 0, emaSlow: 0,
            atrValue: 0, adxValue: 0, adxPrev: 0,
            macdValue: 0, macdHist: 0, macdHistPrev: 0,
            rsiValue: 0, rsiTrend: [], marketRegime: 'neutral',
            volumePct: 0, priceTrend: () => null, priceSlope: 0,
        };
    }
}
exports.evaluateSignalOnly = evaluateSignalOnly;
