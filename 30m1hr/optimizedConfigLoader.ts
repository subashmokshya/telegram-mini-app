// optimizedConfigLoader.ts
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Regime } from './regime';
import { ScaledThresholds } from './scale';
import adaptiveConfig from './adaptiveConfig.json';

// ─── Full OptimizedEntry definition ─────────────────────────────────────────
export interface OptimizedEntry {
  divergenceMin: number | undefined;
  emaSlopeLong: number | undefined;
  emaSlopeShort: number | undefined;
  macdAccel: number | undefined;
  rsiLong: [number, number] | undefined;
  rsiShort: [number, number] | undefined;
  bodyMin: number | undefined;
  atrMin: number | undefined;
  adxSlopeMin: number | undefined;
  // core trading thresholds
  signalScoreMin:     number;
  divergenceScoreMin: number;
  volumePctMin:       number;
  atrPctMin:          number;
  adxMin:             number;
  adxBuffer?:         number;
  macdHistMin:        number;
  emaSlopeMin:        number;
  emaSlopeMax:        number;
  volatilityMin:      number;
  macdMomentumMin:    number;
  rsiSlopeMin:        number;
  rsiOverbought:      number;
  rsiOversold:        number;
  confidenceMin:      number;
  anticipationAllowed: any;
  tpMultiplier:       number;
  slMultiplier:       number;
  leverage:           number;
  enabled?:           boolean;
  timestamp?:         string;
}

// ─── Constants & cache ─────────────────────────────────────────────────────────
const CONFIG_PATH = path.resolve(__dirname, 'optimizedConfigs.json');
const RELOAD_INTERVAL_MS = 10 * 60 * 1000;
const CACHE: Record<string, OptimizedEntry> = {};
let lastLoaded = 0;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/USDT$/, '_USD');
}

// ─── Load & cache configs from disk ─────────────────────────────────────────────
function loadConfigs(forceReload = false): Record<string, OptimizedEntry> {
  const now = Date.now();
  if (!forceReload && Object.keys(CACHE).length && now - lastLoaded < RELOAD_INTERVAL_MS) {
    return CACHE;
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    console.warn(`⚠️ optimizedConfigLoader: missing ${CONFIG_PATH}`);
    return CACHE;
  }

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed: Record<string, OptimizedEntry> = JSON.parse(raw);
    Object.keys(CACHE).forEach(k => delete CACHE[k]);
    Object.assign(CACHE, parsed);
    lastLoaded = now;
    return CACHE;
  } catch (err) {
    console.error('❌ optimizedConfigLoader load error', err);
    return CACHE;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Get all configs (optionally force reload) */
export function getAllOptimizedConfigs(
  forceReload = false
): Record<string, OptimizedEntry> {
  return loadConfigs(forceReload);
}

/** Get one symbol+regime config */
export function getOptimizedConfig(
  symbol: string,
  regime: Regime
): OptimizedEntry | undefined {
  const configs = loadConfigs();
  const key = `${normalizeSymbol(symbol)}_${regime}`;
  return configs[key];
}

/** Map OptimizedEntry → ScaledThresholds */
export function getOptimizedThresholds(
  symbol: string,
  regime: Regime
): ScaledThresholds | null {
  const cfg = getOptimizedConfig(symbol, regime);
  if (!cfg) return null;
  return {
    signalScoreMin:     cfg.signalScoreMin,
    divergenceScoreMin: cfg.divergenceScoreMin,
    volumePctMin:       cfg.volumePctMin,
    atrPctMin:          cfg.atrPctMin,
    adxMin:             cfg.adxMin,
    macdHistMin:        cfg.macdHistMin,
    emaSlopeMin:        cfg.emaSlopeMin,
    rsiOverbought:      cfg.rsiOverbought,
    rsiOversold:        cfg.rsiOversold,
  };
}

/** Get or generate full config via gridSearch.ts */
export function getFullConfig(
  symbol: string,
  regime: Regime
): OptimizedEntry {
  const existing = getOptimizedConfig(symbol, regime);
  if (existing) return existing;

  const key = `${normalizeSymbol(symbol)}_${regime}`;
  console.warn(`⚠️ missing config ${key} — running gridSearch…`);
  const leverageDefault: number = adaptiveConfig.leverageStrategy[regime] ?? 1;
  execSync(
    `npx ts-node gridSearch.ts ${regime} ${normalizeSymbol(symbol)} ${leverageDefault}`,
    { cwd: __dirname, stdio: 'inherit' }
  );

  const reloaded = getOptimizedConfig(symbol, regime);
  if (!reloaded) {
    throw new Error(`Still no config for ${key} after gridSearch`);
  }
  return reloaded;
}

/** When was this regime last tuned? */
export function getLastTunedTimestamp(
  symbol: string,
  regime: Regime
): number | null {
  const cfg = getOptimizedConfig(symbol, regime);
  return cfg?.timestamp ? new Date(cfg.timestamp).getTime() : null;
}

/** Is config older than threshold (12h default)? */
export function isConfigOutdated(
  symbol: string,
  regime: Regime,
  thresholdMs = 12 * 60 * 60 * 1000
): boolean {
  const ts = getLastTunedTimestamp(symbol, regime);
  return ts === null || Date.now() - ts > thresholdMs;
}

/** Save or overwrite one regime config on disk */
export function saveOptimizedConfig(
  symbol: string,
  regime: Regime,
  config: OptimizedEntry
) {
  const all = loadConfigs(true);
  const key = `${normalizeSymbol(symbol)}_${regime}`;
  if (fs.existsSync(CONFIG_PATH)) {
    fs.copyFileSync(CONFIG_PATH, CONFIG_PATH + `.backup.${Date.now()}`);
  }
  config.enabled = config.enabled ?? true;
  config.timestamp = new Date().toISOString();
  all[key] = config;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(all, null, 2));
  Object.assign(CACHE, all);
}

export { Regime };
