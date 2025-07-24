import fetch from 'node-fetch';

export interface OHLCV {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  timestamp: number[];
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number[];
}

export const tokenSymbolToBinancePair: Record<string, string> = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', ADA: 'ADAUSDT', XRP: 'XRPUSDT',
  LTC: 'LTCUSDT', DOGE: 'DOGEUSDT', EIGEN: 'EIGENUSDT', TAO: 'TAOUSDT', ZRO: 'ZROUSDT',
  OP: 'OPUSDT', HBAR: 'HBARUSDT', ENA: 'ENAUSDT', LINK: 'LINKUSDT',
  WLD: 'WLDUSDT', STRK: 'STRKUSDT', INJ: 'INJUSDT', MANTA: 'MANTAUSDT', SEI: 'SEIUSDT',
  AVAX: 'AVAXUSDT', BLUR: 'BLURUSDT', MEME: 'MEMEUSDT', TIA: 'TIAUSDT', BNB: 'BNBUSDT',
  ARB: 'ARBUSDT', VIRTUAL: 'VIRTUALUSDT', JUP: 'JUPUSDT', PYTH: 'PYTHUSDT', W: 'WUSDT',
  SUI: 'SUIUSDT', TRUMP: 'TRUMPUSDT', SOL: 'SOLUSDT', APT: 'APTUSDT', KAITO: 'KAITOUSDT', XLM: 'XLMUSDT',
};

const EMPTY_OHLCV: OHLCV = { open: [], high: [], low: [], close: [], volume: [], timestamp: [] };

/**
 * Fetch historical OHLCV data from Binance API for a given interval.
 */
export async function fetchOHLCVFromBinance(
  symbol: string,
  interval: string,
  limit = 300
): Promise<OHLCV> {
  const cleanSymbol = symbol.replace('_USD', '');
  const binancePair = tokenSymbolToBinancePair[cleanSymbol];
  if (!binancePair) {
    console.warn(`⚠️ Skipping unsupported token: ${symbol}`);
    return EMPTY_OHLCV;
  }
  const url = `https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=${interval}&limit=${limit}`;
  console.log(`🔗 Fetching ${interval} OHLCV from Binance: ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`❌ Failed to fetch OHLCV: ${response.status}`);
  const raw = await response.json();
  if (!Array.isArray(raw) || raw.length === 0) return EMPTY_OHLCV;

  const ohlcv: OHLCV = { open: [], high: [], low: [], close: [], volume: [], timestamp: [] };
  for (const candle of raw) {
    const [t, o, h, l, c, v] = candle;
    const [ts, op, hi, lo, cl, vol] = [Number(t), Number(o), Number(h), Number(l), Number(c), Number(v)];
    if ([ts, op, hi, lo, cl, vol].some(val => isNaN(val) || val <= 0)) continue;
    ohlcv.timestamp.push(ts);
    ohlcv.open.push(op);
    ohlcv.high.push(hi);
    ohlcv.low.push(lo);
    ohlcv.close.push(cl);
    ohlcv.volume.push(vol);
  }
  if (ohlcv.close.length < 30) return EMPTY_OHLCV;
  console.log(`✅ Fetched ${ohlcv.close.length} ${interval} candles for ${symbol}`);
  return ohlcv;
}

/**
 * Fetch multiple timeframes of OHLCV (e.g., 15m and 30m) with caching.
 */
interface CachedOHLCV { data: OHLCV; timestamp: number; }
const ohlcvCache: Map<string, CachedOHLCV> = new Map();
const CACHE_TTL_MS = 60_000;

export async function getCachedOHLCV(
  symbol: string,
  interval: string,
  limit = 300
): Promise<OHLCV> {
  const key = `${symbol}_${interval}_${limit}`;
  const now = Date.now();
  const cached = ohlcvCache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await fetchOHLCVFromBinance(symbol, interval, limit);
  ohlcvCache.set(key, { data, timestamp: now });
  return data;
}

/**
 * Fetch both 15m and 30m OHLCV data for a symbol.
 */
export async function getMultiTimeframeOHLCV(
  symbol: string,
  intervals: string[] = ['5m', '15m', '30m', '1h', '4h', '1d'],
  limit = 300
): Promise<Record<string, OHLCV>> {
  const result: Record<string, OHLCV> = {};
  await Promise.all(
    intervals.map(async interval => {
      try {
        result[interval] = await getCachedOHLCV(symbol, interval, limit);
      } catch (err) {
        console.warn(`⚠️ Error fetching ${interval} for ${symbol}:`, err);
        result[interval] = EMPTY_OHLCV;
      }
    })
  );
  return result;
}

/**
 * Fetch latest single candle using Binance API.
 */
export async function fetchSingleCandle(
  symbol: string,
  interval = '1m'
): Promise<Candle | null> {
  const cleanSymbol = symbol.replace('_USD', '');
  const binancePair = tokenSymbolToBinancePair[cleanSymbol];
  if (!binancePair) return null;
  const url = `https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=${interval}&limit=1`;
  console.log(`🔗 Fetching single candle: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const [candle] = await res.json();
    const [t, o, h, l, c, v] = candle.map(Number);
    return { open: o, high: h, low: l, close: c, volume: v, timestamp: [t] };
  } catch {
    return null;
  }
}

/**
 * Clear cached OHLCV data.
 */
export function clearOHLCVCache(): void {
  ohlcvCache.clear();
}