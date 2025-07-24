"use strict";
// cooldownManager.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInCooldown = exports.getCooldownUntil = exports.trackOutcome = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const FILE = path_1.default.join(__dirname, 'cooldowns.json');
let cache = {};
function load() {
    if (fs_1.default.existsSync(FILE)) {
        try {
            cache = JSON.parse(fs_1.default.readFileSync(FILE, 'utf8'));
        }
        catch (e) {
            console.error('⚠️ Failed to load cooldowns.json:', e);
            cache = {};
        }
    }
}
function save() {
    fs_1.default.writeFileSync(FILE, JSON.stringify(cache, null, 2));
}
function getWinRate(history) {
    const last = history.slice(-5);
    const wins = last.filter(r => r === 'win').length;
    return wins / last.length;
}
function trackOutcome(symbol, result) {
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
exports.trackOutcome = trackOutcome;
function getCooldownUntil(symbol) {
    load();
    return cache[symbol]?.cooldownUntil ?? 0;
}
exports.getCooldownUntil = getCooldownUntil;
function isInCooldown(symbol) {
    load();
    const now = Date.now();
    const cooldown = cache[symbol]?.cooldownUntil;
    const active = typeof cooldown === 'number' && now < cooldown;
    if (active) {
        console.log(`⏳ Skipping ${symbol}: cooldown active until ${new Date(cooldown).toISOString()}`);
    }
    return active;
}
exports.isInCooldown = isInCooldown;
