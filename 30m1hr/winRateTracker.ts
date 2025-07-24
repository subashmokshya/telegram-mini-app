// winRateTracker.ts — tracks win/loss with PnL, score, and regime
export type TradeOutcome = 'win' | 'loss';

interface TradeRecord {
  pair: string;
  direction: 'long' | 'short';
  result: TradeOutcome;
  pnl: number;
  score: number;
  regime: string;
  timestamp: number;
}

const tradeHistory: TradeRecord[] = [];

export function recordTrade(
  pair: string,
  direction: 'long' | 'short',
  result: TradeOutcome,
  pnl: number,
  score: number,
  regime: string
): void {
  tradeHistory.push({ pair, direction, result, pnl, score, regime, timestamp: Date.now() });
  if (tradeHistory.length > 1000) tradeHistory.shift();
}

export function getWinRate(): number {
  const total = tradeHistory.length;
  if (total === 0) return 0;
  const wins = tradeHistory.filter(t => t.result === 'win').length;
  return (wins / total) * 100;
}

export function getRecentResults(limit = 20): TradeRecord[] {
  return tradeHistory.slice(-limit);
}

export function getStats() {
  const wins = tradeHistory.filter(t => t.result === 'win');
  const losses = tradeHistory.filter(t => t.result === 'loss');
  const total = tradeHistory.length;
  return {
    total,
    wins: wins.length,
    losses: losses.length,
    winRate: total ? (wins.length / total * 100).toFixed(2) + '%' : '0%',
    avgWinPnl: wins.length ? (wins.reduce((a, b) => a + b.pnl, 0) / wins.length).toFixed(2) : '0.00',
    avgLossPnl: losses.length ? (losses.reduce((a, b) => a + b.pnl, 0) / losses.length).toFixed(2) : '0.00'
  };
}

export function exportTrades(): TradeRecord[] {
  return [...tradeHistory];
}