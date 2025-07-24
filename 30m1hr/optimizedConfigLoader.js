"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveOptimizedConfig = exports.isConfigOutdated = exports.getLastTunedTimestamp = exports.getFullConfig = exports.getOptimizedThresholds = exports.getOptimizedConfig = exports.getAllOptimizedConfigs = void 0;
// optimizedConfigLoader.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const adaptiveConfig_json_1 = __importDefault(require("./adaptiveConfig.json"));
// ─── Constants & cache ─────────────────────────────────────────────────────────
const CONFIG_PATH = path_1.default.resolve(__dirname, 'optimizedConfigs.json');
const RELOAD_INTERVAL_MS = 10 * 60 * 1000;
const CACHE = {};
let lastLoaded = 0;
// ─── Helpers ───────────────────────────────────────────────────────────────────
function normalizeSymbol(symbol) {
    return symbol.toUpperCase().replace(/USDT$/, '_USD');
}
// ─── Load & cache configs from disk ─────────────────────────────────────────────
function loadConfigs(forceReload = false) {
    const now = Date.now();
    if (!forceReload && Object.keys(CACHE).length && now - lastLoaded < RELOAD_INTERVAL_MS) {
        return CACHE;
    }
    if (!fs_1.default.existsSync(CONFIG_PATH)) {
        console.warn(`⚠️ optimizedConfigLoader: missing ${CONFIG_PATH}`);
        return CACHE;
    }
    try {
        const raw = fs_1.default.readFileSync(CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        Object.keys(CACHE).forEach(k => delete CACHE[k]);
        Object.assign(CACHE, parsed);
        lastLoaded = now;
        return CACHE;
    }
    catch (err) {
        console.error('❌ optimizedConfigLoader load error', err);
        return CACHE;
    }
}
// ─── Public API ────────────────────────────────────────────────────────────────
/** Get all configs (optionally force reload) */
function getAllOptimizedConfigs(forceReload = false) {
    return loadConfigs(forceReload);
}
exports.getAllOptimizedConfigs = getAllOptimizedConfigs;
/** Get one symbol+regime config */
function getOptimizedConfig(symbol, regime) {
    const configs = loadConfigs();
    const key = `${normalizeSymbol(symbol)}_${regime}`;
    return configs[key];
}
exports.getOptimizedConfig = getOptimizedConfig;
/** Map OptimizedEntry → ScaledThresholds */
function getOptimizedThresholds(symbol, regime) {
    const cfg = getOptimizedConfig(symbol, regime);
    if (!cfg)
        return null;
    return {
        signalScoreMin: cfg.signalScoreMin,
        divergenceScoreMin: cfg.divergenceScoreMin,
        volumePctMin: cfg.volumePctMin,
        atrPctMin: cfg.atrPctMin,
        adxMin: cfg.adxMin,
        macdHistMin: cfg.macdHistMin,
        emaSlopeMin: cfg.emaSlopeMin,
        rsiOverbought: cfg.rsiOverbought,
        rsiOversold: cfg.rsiOversold,
    };
}
exports.getOptimizedThresholds = getOptimizedThresholds;
/** Get or generate full config via gridSearch.ts */
function getFullConfig(symbol, regime) {
    const existing = getOptimizedConfig(symbol, regime);
    if (existing)
        return existing;
    const key = `${normalizeSymbol(symbol)}_${regime}`;
    console.warn(`⚠️ missing config ${key} — running gridSearch…`);
    const leverageDefault = adaptiveConfig_json_1.default.leverageStrategy[regime] ?? 1;
    (0, child_process_1.execSync)(`npx ts-node gridSearch.ts ${regime} ${normalizeSymbol(symbol)} ${leverageDefault}`, { cwd: __dirname, stdio: 'inherit' });
    const reloaded = getOptimizedConfig(symbol, regime);
    if (!reloaded) {
        throw new Error(`Still no config for ${key} after gridSearch`);
    }
    return reloaded;
}
exports.getFullConfig = getFullConfig;
/** When was this regime last tuned? */
function getLastTunedTimestamp(symbol, regime) {
    const cfg = getOptimizedConfig(symbol, regime);
    return cfg?.timestamp ? new Date(cfg.timestamp).getTime() : null;
}
exports.getLastTunedTimestamp = getLastTunedTimestamp;
/** Is config older than threshold (12h default)? */
function isConfigOutdated(symbol, regime, thresholdMs = 12 * 60 * 60 * 1000) {
    const ts = getLastTunedTimestamp(symbol, regime);
    return ts === null || Date.now() - ts > thresholdMs;
}
exports.isConfigOutdated = isConfigOutdated;
/** Save or overwrite one regime config on disk */
function saveOptimizedConfig(symbol, regime, config) {
    const all = loadConfigs(true);
    const key = `${normalizeSymbol(symbol)}_${regime}`;
    if (fs_1.default.existsSync(CONFIG_PATH)) {
        fs_1.default.copyFileSync(CONFIG_PATH, CONFIG_PATH + `.backup.${Date.now()}`);
    }
    config.enabled = config.enabled ?? true;
    config.timestamp = new Date().toISOString();
    all[key] = config;
    fs_1.default.writeFileSync(CONFIG_PATH, JSON.stringify(all, null, 2));
    Object.assign(CACHE, all);
}
exports.saveOptimizedConfig = saveOptimizedConfig;
