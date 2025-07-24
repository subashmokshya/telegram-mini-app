"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportTrades = exports.getStats = exports.getRecentResults = exports.getWinRate = exports.recordTrade = void 0;
const tradeHistory = [];
function recordTrade(pair, direction, result, pnl, score, regime) {
    tradeHistory.push({ pair, direction, result, pnl, score, regime, timestamp: Date.now() });
    if (tradeHistory.length > 1000)
        tradeHistory.shift();
}
exports.recordTrade = recordTrade;
function getWinRate() {
    const total = tradeHistory.length;
    if (total === 0)
        return 0;
    const wins = tradeHistory.filter(t => t.result === 'win').length;
    return (wins / total) * 100;
}
exports.getWinRate = getWinRate;
function getRecentResults(limit = 20) {
    return tradeHistory.slice(-limit);
}
exports.getRecentResults = getRecentResults;
function getStats() {
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
exports.getStats = getStats;
function exportTrades() {
    return [...tradeHistory];
}
exports.exportTrades = exportTrades;
