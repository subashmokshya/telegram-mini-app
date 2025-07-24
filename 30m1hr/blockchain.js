"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTotalPnL = exports.runSignalCheckAndOpen = exports.closeAllPositions = exports.closePosition = exports.initBlockchain = exports.resolveSymbolFromPairType = exports.getPositions = exports.fetchPrice = exports.priceFeeds = exports.account = exports.aptos = exports.client = void 0;
/// <reference path="./global.d.ts" />
const ts_sdk_1 = require("@merkletrade/ts-sdk");
const ts_sdk_2 = require("@aptos-labs/ts-sdk");
const dotenv_1 = __importDefault(require("dotenv"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const strategyEngine_1 = require("./strategyEngine");
const aiStorage_1 = require("./aiStorage");
const decimal_js_1 = __importDefault(require("decimal.js"));
const cooldownManager_1 = require("./cooldownManager");
const binanceHistorical_1 = require("./binanceHistorical");
const regime_1 = require("./regime");
dotenv_1.default.config();
exports.priceFeeds = {
    BTC_USD: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    ETH_USD: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    ADA_USD: "0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d",
    XRP_USD: "0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8",
    LTC_USD: "0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54",
    DOGE_USD: "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
    EIGEN_USD: "0xc65db025687356496e8653d0d6608eec64ce2d96e2e28c530e574f0e4f712380",
    TAO_USD: "0x410f41de235f2db824e562ea7ab2d3d3d4ff048316c61d629c0b93f58584e1af",
    ZRO_USD: "0x3bd860bea28bf982fa06bcf358118064bb114086cc03993bd76197eaab0b8018",
    OP_USD: "0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf",
    HBAR_USD: "0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd",
    ENA_USD: "0xb7910ba7322db020416fcac28b48c01212fd9cc8fbcbaf7d30477ed8605f6bd4",
    LINK_USD: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
    WLD_USD: "0xd6835ad1f773de4a378115eb6824bd0c0e42d84d1c84d9750e853fb6b6c7794a",
    STRK_USD: "0x6a182399ff70ccf3e06024898942028204125a819e519a335ffa4579e66cd870",
    INJ_USD: "0x7a5bc1d2b56ad029048cd63964b3ad2776eadf812edc1a43a31406cb54bff592",
    SEI_USD: "0x53614f1cb0c031d4af66c04cb9c756234adad0e1cee85303795091499a4084eb",
    AVAX_USD: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
    BLUR_USD: "0x856aac602516addee497edf6f50d39e8c95ae5fb0da1ed434a8c2ab9c3e877e9",
    TIA_USD: "0x09f7c1d7dfbb7df2b8fe3d3d87ee94a2259d212da4f30c1f0540d066dfa44723",
    BNB_USD: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
    ARB_USD: "0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5",
    VIRTUAL_USD: "0x8132e3eb1dac3e56939a16ff83848d194345f6688bff97eb1c8bd462d558802b",
    JUP_USD: "0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
    PYTH_USD: "0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff",
    W_USD: "0xeff7446475e218517566ea99e72a4abec2e1bd8498b43b7d8331e29dcb059389",
    SUI_USD: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
    TRUMP_USD: "0x879551021853eec7a7dc827578e8e69da7e4fa8148339aa0d3d5296405be4b1a",
    SOL_USD: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    APT_USD: "0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5",
    KAITO_USD: "0x7302dee641a08507c297a7b0c8b3efa74a48a3baa6c040acab1e5209692b7e59",
    XLM_USD: "0xb7a8eba68a997cd0210c2e1e4ee811ad2d174b3611c22d9ebf16f4cb7e9ba850",
};
// Fetch latest price for PnL calc only (PYTH)
async function fetchPrice(pair) {
    const url = `${process.env.PYTH_API_URL}?ids[]=${exports.priceFeeds[pair]}`;
    const [data] = await (0, node_fetch_1.default)(url).then(r => r.json());
    return Number(data.price.price) * 10 ** data.price.expo;
}
exports.fetchPrice = fetchPrice;
async function getPositions() {
    return exports.client.getPositions({ address: exports.account.accountAddress.toString() });
}
exports.getPositions = getPositions;
function resolveSymbolFromPairType(pairType) {
    return Object.keys(exports.priceFeeds).find(sym => pairType.toUpperCase().includes(sym));
}
exports.resolveSymbolFromPairType = resolveSymbolFromPairType;
async function initBlockchain() {
    const config = await ts_sdk_1.MerkleClientConfig.testnet();
    exports.client = new ts_sdk_1.MerkleClient(config);
    exports.aptos = new ts_sdk_2.Aptos(config.aptosConfig);
    const rawKey = process.env.APTOS_PRIVATE_KEY;
    if (!rawKey)
        throw new Error("❌ APTOS_PRIVATE_KEY is missing");
    const formattedKey = ts_sdk_2.PrivateKey.formatPrivateKey(rawKey, ts_sdk_2.PrivateKeyVariants.Ed25519);
    exports.account = ts_sdk_2.Account.fromPrivateKey({
        privateKey: new ts_sdk_2.Ed25519PrivateKey(formattedKey)
    });
    console.log("✅ Blockchain initialized.");
}
exports.initBlockchain = initBlockchain;
// TRADE EXECUTION
async function closePosition(pair, pos, client, aptos, account, reason, price) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            // ✅ Re-fetch fresh position state
            const freshPositions = await client.getPositions({ address: account.accountAddress.toString() });
            const matched = freshPositions.find(p => p.pairType === pos.pairType);
            if (!matched || BigInt(matched.size) === 0n) {
                console.warn(`⚠️ No open position found for ${pair}. Skipping close.`);
                return;
            }
            const sizeDelta = BigInt(matched.size);
            const isLong = matched.isLong ?? matched.side === "long";
            const payload = client.payloads.placeMarketOrder({
                pair,
                userAddress: account.accountAddress.toString(),
                sizeDelta,
                collateralDelta: 0n,
                isLong,
                isIncrease: false,
                typeArguments: ["0x1::usdc::USDC", "0x1::aptos_coin::AptosCoin"],
            });
            const txn = await aptos.transaction.build.simple({
                sender: account.accountAddress,
                data: payload,
            });
            const { hash } = await aptos.signAndSubmitTransaction({ signer: account, transaction: txn });
            await aptos.waitForTransaction({ transactionHash: hash });
            console.log(`✅ Closed ${pair} @ ${price.toFixed(6)} | Reason: ${reason} | TX: ${hash}`);
            return; // exit on success
        }
        catch (err) {
            console.error(`❌ Attempt ${attempt} to close ${pair} failed:`, err.message ?? err);
            if (attempt === 2) {
                console.error(`🚨 Giving up on closing ${pair} after 2 failed attempts.`);
            }
            else {
                await new Promise(res => setTimeout(res, 2000));
            }
        }
    }
}
exports.closePosition = closePosition;
async function closeAllPositions() {
    const positions = await getPositions();
    for (const pos of positions) {
        if (BigInt(pos.size) > 0n) {
            try {
                console.log(`🚪 Closing ${pos.symbol}...`);
                const symbol = resolveSymbolFromPairType(pos.pairType);
                if (!symbol)
                    continue;
                const mark = await fetchPrice(symbol);
                await closePosition(symbol, pos, exports.client, exports.aptos, exports.account, 'market_dry', mark);
            }
            catch (err) {
                console.warn(`⚠️ Failed to close ${pos.symbol}:`, err);
            }
        }
    }
}
exports.closeAllPositions = closeAllPositions;
async function runSignalCheckAndOpen({ client, aptos, account, symbol, perPositionBudget, regimeOverride, leverage, }) {
    if ((0, cooldownManager_1.isInCooldown)(symbol)) {
        const cooldownUntil = (0, cooldownManager_1.getCooldownUntil)(symbol);
        console.log(`⏳ Skipping ${symbol}: in cooldown until ${new Date(cooldownUntil).toLocaleString()}`);
        return { positionOpened: false, marketRegime: "cooldown", reason: "in_cooldown", signalScore: 0 };
    }
    const ohlcv30m = await (0, binanceHistorical_1.getCachedOHLCV)(symbol, "30m", 300);
    const ohlcv1h = await (0, binanceHistorical_1.getCachedOHLCV)(symbol, "1h", 300);
    const entryPrice = ohlcv30m.close.at(-1);
    if (!ohlcv30m || ohlcv30m.close.length < 100 || !entryPrice || entryPrice <= 0) {
        return { positionOpened: false, marketRegime: "unknown", reason: "invalid_ohlcv_or_price", signalScore: 0 };
    }
    const { regime: guessedRegime, confidence: regimeConfidence } = regimeOverride ? { regime: regimeOverride, confidence: 1.0 } : await (0, regime_1.guessMarketRegime)(symbol, ohlcv30m, ohlcv1h);
    console.log(`🧠 Regime detected for ${symbol}: ${guessedRegime} (${(regimeConfidence * 100).toFixed(1)}%)`);
    // ✅ Run signal strategy directly
    const result = await (0, strategyEngine_1.evaluateSignalOnly)(symbol, ohlcv30m, {
        regimeOverride: guessedRegime,
        leverage,
        bypassBacktestCheck: true
    });
    const { direction, tp = 0, sl = 0, signalScore = 0, rsiValue: rsi = 0, macdHist = 0, macdHistPrev = 0, emaFast, emaSlow, atrValue: atr = 0, adxValue: adx = 0, adxPrev = 0, volumePct = 1, divergenceScore = 0, rrr, triggeredBy, reason: entryReason, passed } = result;
    if (!direction || !passed) {
        if (!result.logged) {
            result.logged = true; // prevent future duplicate logs
        }
        return {
            positionOpened: false,
            marketRegime: guessedRegime,
            reason: result.reason ?? "invalid_direction_or_not_passed",
            signalScore
        };
    }
    const emaSlope = (emaFast - emaSlow) / (emaSlow || 1);
    const atrPct = atr / (entryPrice || 1);
    const adxSlope = adx - adxPrev;
    console.log(`📊 [Signal] ${symbol} | ${direction.toUpperCase()} | Score=${signalScore.toFixed(2)} | RSI=${rsi.toFixed(2)} | MACD=${macdHist.toFixed(4)} | EMA Slope=${emaSlope.toFixed(4)} | ATR=${(atrPct * 100).toFixed(2)}% | ADX=${adx.toFixed(2)} | Vol=${volumePct.toFixed(2)} | ADX Slope=${adxSlope.toFixed(2)} | Lev=${leverage}x | RRR=${rrr?.toFixed(2)}`);
    const stored = (0, aiStorage_1.getAIPOS)(symbol);
    const tolerance = atrPct >= 0.6 ? entryPrice * 0.002 : entryPrice * 0.0005;
    const entryDiff = Math.abs(Number(stored?.entryPrice ?? 0) - entryPrice);
    if (stored && entryDiff > tolerance) {
        const positions = await client.getPositions({ address: account.accountAddress.toString() });
        const stillOpen = positions.some((p) => p.pairType.includes(symbol) && BigInt(p.size) !== 0n);
        if (!stillOpen) {
            await (0, aiStorage_1.removeAIPOS)(symbol);
            return { positionOpened: false, marketRegime: guessedRegime, reason: "stale_cache_removed", signalScore };
        }
        return { positionOpened: false, marketRegime: guessedRegime, reason: "entry_mismatch_existing", signalScore };
    }
    const isLong = direction === "long";
    const budget = new decimal_js_1.default(perPositionBudget);
    const collateral = budget.times(1000000).toDecimalPlaces(0);
    const notional = budget.times(leverage).times(1000000).toDecimalPlaces(0);
    if (collateral.lte(0) || notional.lte(0)) {
        return { positionOpened: false, marketRegime: guessedRegime, reason: "invalid_budget", signalScore };
    }
    if (process.env.DRY_RUN === "true") {
        console.log(`[DRY RUN] Skipping execution for ${symbol} at ${entryPrice}`);
        return { positionOpened: false, marketRegime: guessedRegime, reason: "dry_run", signalScore };
    }
    console.log(`🚀 Executing ${symbol} | ${direction.toUpperCase()} @ ${entryPrice} | Lev ${leverage}x`);
    const payload = client.payloads.placeMarketOrder({
        pair: symbol,
        userAddress: account.accountAddress.toString(),
        sizeDelta: BigInt(notional.toString()),
        collateralDelta: BigInt(collateral.toString()),
        isLong,
        isIncrease: true,
        typeArguments: ["0x1::usdc::USDC", "0x1::aptos_coin::AptosCoin"]
    });
    const txRequest = await aptos.transaction.build.simple({ sender: account.accountAddress, data: payload });
    const { hash } = await aptos.signAndSubmitTransaction({ signer: account, transaction: txRequest });
    await aptos.waitForTransaction({ transactionHash: hash });
    console.log(`✅ Trade executed for ${symbol} — TX: ${hash}`);
    (0, aiStorage_1.recordAIPOS)(symbol, entryPrice, hash, signalScore, guessedRegime, tp, sl, rsi, macdHist, emaSlope, atrPct, leverage, atr, adx, adxSlope, volumePct, perPositionBudget, false, 0, divergenceScore, "anticipation", result.reason, "init", undefined, undefined, undefined, triggeredBy, entryReason, rrr);
    return {
        positionOpened: true,
        marketRegime: guessedRegime,
        reason: "executed",
        signalScore
    };
}
exports.runSignalCheckAndOpen = runSignalCheckAndOpen;
/*
 * Returns the total unrealized PnL (USD) across all active positions.
 */
async function getTotalPnL(client, account) {
    const positions = await client.getPositions({
        address: account.accountAddress.toString(),
    });
    let totalPnl = 0;
    for (const pos of positions) {
        if (BigInt(pos.size) === 0n)
            continue;
        const symbol = resolveSymbolFromPairType(pos.pairType);
        if (!symbol) {
            console.warn(`⚠️ No matching symbol for pairType: ${pos.pairType}`);
            continue;
        }
        // fallback through all possible entry fields
        const rawEntry = pos.avgPrice ??
            pos.entry ??
            pos.entryPrice ??
            0;
        const entry = Number(rawEntry) / 1e10;
        if (!entry || isNaN(entry)) {
            console.warn(`⚠️ ${symbol} missing entry price, rawEntry=${rawEntry}`);
            continue;
        }
        // ALWAYS fetch the live mark price
        const mark = await fetchPrice(symbol);
        const sizeUsd = Number(pos.size) / 1e6;
        const isLong = pos.isLong ?? pos.side === "long";
        const dir = isLong ? 1 : -1;
        // USD PnL
        const pnl = ((mark - entry) / entry) * dir * sizeUsd;
        console.log(`📈 ${symbol} | ${isLong ? "LONG" : "SHORT"} | Entry=${entry.toFixed(6)} Mark=${mark.toFixed(6)} → PnL=$${pnl.toFixed(4)}`);
        totalPnl += pnl;
    }
    return totalPnl;
}
exports.getTotalPnL = getTotalPnL;
// ───── AUTO-START (if standalone) ─────
if (require.main === module) {
    (async () => {
        await initBlockchain();
        console.log("🚀 Bot is ready.");
        // Add your main loop here if needed
    })();
}
