import fs from 'fs';
import path from 'path';

const STORAGE_PATH = path.resolve(__dirname, 'ai_positions.json');
const LOG_DIR = path.resolve(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'positions_log.csv');

export interface StoredPosition {
  breakevenLogged: any;
  symbol: string;
  entryPrice: number;
  txHash: string;
  timestamp: number;
  signalScore: number;
  marketRegime: string;
  tp: number;
  sl: number;
  rsi: number;
  macdHist: number;
  emaSlope: number;
  atrPct: number;
  leverage: number;
  atr: number;
  adx: number;
  adxSlope?: number;
  volumePct?: number;
  breakevenActivated?: boolean;
  trailingTPPct?: number;
  perPositionBudget?: number;
  entryTimestamp?: number;
  divergenceScore?: number;
  tradeType?: 'standard' | 'override' | 'anticipation';
  note?: string;
  phase?: 'init' | 'trail';
  highestFav?: number;
  lowestFav?: number;
  slPrice?: number;
  triggeredBy?: string;
  entryReason?: string;

  // Legacy
  rrr?: number;
  fallbackTP?: number;
  fallbackSL?: number;
  fallbackRRR?: number;
  regime?: any;
}

export function loadAIPOS(): StoredPosition[] {
  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAIPOS(data: StoredPosition[]) {
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`❌ Failed to save AI positions:`, e);
  }
}

export function getAIPOS(symbol: string): StoredPosition | undefined {
  return loadAIPOS().find(p => p.symbol === symbol);
}

export async function removeAIPOS(symbol: string, entryPrice?: number, tolerance = 0.01): Promise<void> {
  try {
    const existing = loadAIPOS();
    const filtered = existing.filter(pos =>
      pos.symbol !== symbol || (entryPrice !== undefined && Math.abs(pos.entryPrice - entryPrice) >= tolerance)
    );

    if (filtered.length !== existing.length) {
      saveAIPOS(filtered);
      console.log(`🧹 Removed AI position for ${symbol}`);
    }
  } catch (e) {
    console.error(`❌ Failed to remove AI position for ${symbol}:`, e);
  }
}

export function recordAIPOS(
  symbol: string,
  entry: number,
  txHash: string,
  signalScore: number,
  marketRegime: string,
  tp: number,
  sl: number,
  rsi: number,
  macdHist: number,
  emaSlope: number,
  atrPct: number,
  leverage: number,
  atr: number,
  adx: number,
  adxSlope?: number,
  volumePct?: number,
  perPositionBudget?: number,
  breakevenActivated = false,
  trailingTPPct = 0,
  divergenceScore = 0,
  tradeType: 'standard' | 'override' | 'anticipation' = 'standard',
  note = '',
  phase?: 'init' | 'trail',
  highestFav?: number,
  lowestFav?: number,
  slPrice?: number,
  triggeredByOverride?: string,
  entryReasonOverride?: string,
  extraTP?: number,
  extraSL?: number,
  extraRRR?: number
) {
  const triggeredBy =
    triggeredByOverride ||
    (tradeType === 'anticipation' ? 'early' :
     tradeType === 'override' ? 'fallback' :
     (divergenceScore ?? 0) >= 0.3 ? 'divergence' : 'standard');

  const entryReason =
    entryReasonOverride ||
    (triggeredBy === 'early' ? 'Anticipation Entry: Early Signal or Divergence' :
     triggeredBy === 'fallback' ? 'Fallback Entry: Signal Score Override' :
     triggeredBy === 'divergence' ? 'Divergence Entry' :
     signalScore >= 0.9 ? 'High Confidence Signal' : 'Standard Signal Passed');

  const data = loadAIPOS();

  const updated: StoredPosition = {
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

function logPositionToCSV(pos: StoredPosition) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

    const keys = Object.keys(pos);
    const row = keys.map(k => JSON.stringify((pos as any)[k])).join(',') + '\n';

    // Write header if file doesn't exist
    if (!fs.existsSync(LOG_FILE)) {
      const header = keys.join(',') + '\n';
      fs.appendFileSync(LOG_FILE, header);
    }

    fs.appendFileSync(LOG_FILE, row);
  } catch (e) {
    console.error(`❌ Failed to log position to CSV:`, e);
  }
}
