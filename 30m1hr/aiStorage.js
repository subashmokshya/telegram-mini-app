"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAIPOS = exports.removeAIPOS = exports.getAIPOS = exports.saveAIPOS = exports.loadAIPOS = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const STORAGE_PATH = path_1.default.resolve(__dirname, 'ai_positions.json');
const LOG_DIR = path_1.default.resolve(__dirname, 'logs');
const LOG_FILE = path_1.default.join(LOG_DIR, 'positions_log.csv');
function loadAIPOS() {
    try {
        const raw = fs_1.default.readFileSync(STORAGE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
exports.loadAIPOS = loadAIPOS;
function saveAIPOS(data) {
    try {
        fs_1.default.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2));
    }
    catch (e) {
        console.error(`❌ Failed to save AI positions:`, e);
    }
}
exports.saveAIPOS = saveAIPOS;
function getAIPOS(symbol) {
    return loadAIPOS().find(p => p.symbol === symbol);
}
exports.getAIPOS = getAIPOS;
async function removeAIPOS(symbol, entryPrice, tolerance = 0.01) {
    try {
        const existing = loadAIPOS();
        const filtered = existing.filter(pos => pos.symbol !== symbol || (entryPrice !== undefined && Math.abs(pos.entryPrice - entryPrice) >= tolerance));
        if (filtered.length !== existing.length) {
            saveAIPOS(filtered);
            console.log(`🧹 Removed AI position for ${symbol}`);
        }
    }
    catch (e) {
        console.error(`❌ Failed to remove AI position for ${symbol}:`, e);
    }
}
exports.removeAIPOS = removeAIPOS;
function recordAIPOS(symbol, entry, txHash, signalScore, marketRegime, tp, sl, rsi, macdHist, emaSlope, atrPct, leverage, atr, adx, adxSlope, volumePct, perPositionBudget, breakevenActivated = false, trailingTPPct = 0, divergenceScore = 0, tradeType = 'standard', note = '', phase, highestFav, lowestFav, slPrice, triggeredByOverride, entryReasonOverride, extraTP, extraSL, extraRRR) {
    const triggeredBy = triggeredByOverride ||
        (tradeType === 'anticipation' ? 'early' :
            tradeType === 'override' ? 'fallback' :
                (divergenceScore ?? 0) >= 0.3 ? 'divergence' : 'standard');
    const entryReason = entryReasonOverride ||
        (triggeredBy === 'early' ? 'Anticipation Entry: Early Signal or Divergence' :
            triggeredBy === 'fallback' ? 'Fallback Entry: Signal Score Override' :
                triggeredBy === 'divergence' ? 'Divergence Entry' :
                    signalScore >= 0.9 ? 'High Confidence Signal' : 'Standard Signal Passed');
    const data = loadAIPOS();
    const updated = {
        symbol,
        entryPrice: entry,
        txHash,
        timestamp: Date.now(),
        signalScore,
        marketRegime,
        tp: extraTP ?? tp,
        sl: extraSL ?? sl,
        rsi,
        macdHist,
        emaSlope,
        atrPct,
        leverage,
        atr,
        adx,
        adxSlope,
        volumePct,
        breakevenActivated,
        trailingTPPct,
        perPositionBudget,
        divergenceScore,
        tradeType,
        note,
        phase,
        highestFav,
        lowestFav,
        slPrice,
        triggeredBy,
        entryReason,
        rrr: extraRRR,
        fallbackTP: undefined,
        fallbackSL: undefined,
        fallbackRRR: undefined,
        regime: undefined,
        breakevenLogged: undefined
    };
    logPositionToCSV(updated);
    const withoutOld = data.filter(p => !(p.symbol === symbol && Math.abs(p.entryPrice - entry) < 0.005));
    withoutOld.push(updated);
    saveAIPOS(withoutOld);
}
exports.recordAIPOS = recordAIPOS;
function logPositionToCSV(pos) {
    try {
        if (!fs_1.default.existsSync(LOG_DIR))
            fs_1.default.mkdirSync(LOG_DIR, { recursive: true });
        const keys = Object.keys(pos);
        const row = keys.map(k => JSON.stringify(pos[k])).join(',') + '\n';
        // Write header if file doesn't exist
        if (!fs_1.default.existsSync(LOG_FILE)) {
            const header = keys.join(',') + '\n';
            fs_1.default.appendFileSync(LOG_FILE, header);
        }
        fs_1.default.appendFileSync(LOG_FILE, row);
    }
    catch (e) {
        console.error(`❌ Failed to log position to CSV:`, e);
    }
}
