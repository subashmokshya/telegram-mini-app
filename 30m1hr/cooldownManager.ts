// cooldownManager.ts

import fs from 'fs';
import path from 'path';

const FILE = path.join(__dirname, 'cooldowns.json');
let cache: Record<string, { history: string[]; cooldownUntil: number }> = {};

function load() {
  if (fs.existsSync(FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch (e) {
      console.error('⚠️ Failed to load cooldowns.json:', e);
      cache = {};
    }
  }
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
}

function getWinRate(history: string[]) {
  const last = history.slice(-5);
  const wins = last.filter(r => r === 'win').length;
  return wins / last.length;
}

export function trackOutcome(symbol: string, result: 'win' | 'loss') {
  load();
  const now = Date.now();

  if (!cache[symbol]) {
    cache[symbol] = { history: [], cooldownUntil: 0 };
  }

  cache[symbol].history.push(result);
  if (cache[symbol].history.length > 10) {
    cache[symbol].history.shift();
  }

  const last3 = cache[symbol].history.slice(-3);
  const last5 = cache[symbol].history.slice(-5);
  const winRate = getWinRate(cache[symbol].history);

  // 1. Loss → 1h
  if (result === 'loss') {
    cache[symbol].cooldownUntil = now + 60 * 60 * 1000;
    console.log(`⏳ Cooldown set for ${symbol} after LOSS`);
  }

  // 2. 3 wins in a row → 1h
  else if (last3.every(r => r === 'win')) {
    cache[symbol].cooldownUntil = now + 60 * 60 * 1000;
    console.log(`⏳ Cooldown set for ${symbol} after 3 WIN STREAK`);
  }

  // 3. 2 losses in last 3 → 90 min
  if (last3.filter(r => r === 'loss').length >= 2) {
    cache[symbol].cooldownUntil = now + 90 * 60 * 1000;
    console.log(`⏳ Cooldown set for ${symbol}: 2 losses in last 3`);
  }

  // 4. Win rate < 50% in last 5 → 2h
  if (last5.length === 5 && getWinRate(last5) < 0.5) {
    cache[symbol].cooldownUntil = now + 2 * 60 * 60 * 1000;
    console.log(`⏳ Cooldown set for ${symbol}: win rate < 50% in last 5`);
  }

  save();
}

export function getCooldownUntil(symbol: string): number {
  load();
  return cache[symbol]?.cooldownUntil ?? 0;
}

export function isInCooldown(symbol: string): boolean {
  load();
  const now = Date.now();
  const cooldown = cache[symbol]?.cooldownUntil;
  const active = typeof cooldown === 'number' && now < cooldown;
  if (active) {
    console.log(`⏳ Skipping ${symbol}: cooldown active until ${new Date(cooldown).toISOString()}`);
  }
  return active;
}