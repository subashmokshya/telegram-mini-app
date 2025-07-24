"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logTrade = void 0;
// tradeLogger.ts — Enhanced CSV logger with TP/SL/Budget/ADX metadata
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const LOG_DIR = path_1.default.resolve(__dirname, 'logs');
const LOG_PATH = path_1.default.join(LOG_DIR, 'trade_logs.csv');
const JSON_LOG_PATH = path_1.default.join(LOG_DIR, 'trade_logs.jsonl');
const HEADER = [
    'timestamp',
    'symbol',
    'direction',
    'entryPrice',
    'exitPrice',
    'pnlPct',
    'result',
    'marketRegime',
    'signalScore',
    'rsi',
    'macdHist',
    'emaSlope',
    'atrPct',
    'atr',
    'adx',
    'adxSlope',
    'volumePct',
    'divergenceScore',
    'leverage',
    'tradeType',
    'closedBy',
    'triggeredBy',
    'note',
    'entryReason',
    'tp',
    'sl',
    'rrr',
    'breakevenActivated',
    'trailingTPPct',
    'phase',
    'highestFav',
    'lowestFav',
    'perPositionBudget'
].join(',');
if (!fs_1.default.existsSync(LOG_DIR))
    fs_1.default.mkdirSync(LOG_DIR, { recursive: true });
if (!fs_1.default.existsSync(LOG_PATH))
    fs_1.default.writeFileSync(LOG_PATH, HEADER + '\n', 'utf-8');
function logTrade(trade) {
    const { symbol, direction, entryPrice, exitPrice, pnlPct, result, marketRegime, signalScore, rsi, macdHist, emaSlope, atrPct, atr, adx, adxSlope = 0, volumePct = 0, divergenceScore, leverage, tradeType = 'standard', closedBy = '', note = '', tp = NaN, sl = NaN, rrr = NaN, breakevenActivated = false, trailingTPPct = 0, phase = '', highestFav = NaN, lowestFav = NaN, perPositionBudget = NaN } = trade;
    const autoTriggeredBy = trade.triggeredBy || (() => {
        if (tradeType === 'anticipation')
            return 'early';
        if (tradeType === 'override')
            return 'fallback';
        if ((divergenceScore ?? 0) >= 0.3)
            return 'divergence';
        return 'standard';
    })();
    const autoEntryReason = trade.entryReason || (() => {
        if (autoTriggeredBy === 'early')
            return 'Anticipation Entry: Early Signal or Divergence';
        if (autoTriggeredBy === 'fallback')
            return 'Fallback Entry: Signal Score Override';
        if (autoTriggeredBy === 'divergence')
            return 'Divergence Entry';
        if (signalScore >= 0.9)
            return 'High Confidence Signal';
        return 'Standard Signal Passed';
    })();
    const row = [
        new Date().toISOString(),
        symbol,
        direction,
        entryPrice.toFixed(6),
        exitPrice.toFixed(6),
        pnlPct.toFixed(2),
        result,
        marketRegime,
        signalScore.toFixed(2),
        rsi.toFixed(2),
        macdHist.toFixed(5),
        emaSlope.toFixed(5),
        atrPct.toFixed(4),
        atr.toFixed(6),
        adx.toFixed(2),
        adxSlope.toFixed(5),
        volumePct.toFixed(2),
        divergenceScore.toFixed(2),
        leverage.toFixed(0),
        tradeType,
        closedBy,
        autoTriggeredBy,
        `"${note.replace(/"/g, '""')}"`,
        `"${autoEntryReason.replace(/"/g, '""')}"`,
        isNaN(tp) ? '' : tp.toFixed(5),
        isNaN(sl) ? '' : sl.toFixed(5),
        isNaN(rrr) ? '' : rrr.toFixed(2),
        breakevenActivated ? 'true' : 'false',
        trailingTPPct.toFixed(2),
        phase,
        isNaN(highestFav) ? '' : highestFav.toFixed(2),
        isNaN(lowestFav) ? '' : lowestFav.toFixed(2),
        isNaN(perPositionBudget) ? '' : perPositionBudget.toFixed(2)
    ].join(',');
    try {
        fs_1.default.appendFileSync(LOG_PATH, row + '\n', 'utf-8');
        fs_1.default.appendFileSync(JSON_LOG_PATH, JSON.stringify({ ...trade, triggeredBy: autoTriggeredBy, entryReason: autoEntryReason }) + '\n');
    }
    catch (err) {
        console.error(`❌ Failed to write trade log:`, err);
    }
}
exports.logTrade = logTrade;
