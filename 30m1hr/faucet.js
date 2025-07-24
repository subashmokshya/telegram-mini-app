"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// faucet.ts
const ts_sdk_1 = require("@merkletrade/ts-sdk");
const ts_sdk_2 = require("@aptos-labs/ts-sdk");
async function main() {
    // initialize clients
    const merkle = new ts_sdk_1.MerkleClient(await ts_sdk_1.MerkleClientConfig.testnet());
    const aptos = new ts_sdk_2.Aptos(merkle.config.aptosConfig);
    // initialize account from env var or hard‑code your private key here
    const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x351aa7effb36543a56c9951dff8c284881898390ca1b4bb1352554ce2fb60091";
    const account = ts_sdk_2.Account.fromPrivateKey({
        privateKey: new ts_sdk_2.Ed25519PrivateKey(ts_sdk_2.PrivateKey.formatPrivateKey(PRIVATE_KEY, ts_sdk_2.PrivateKeyVariants.Ed25519)),
    });
    console.log(`Using account: ${account.accountAddress.toString()}`);
    // 1) Top up USDC via testnet faucet
    console.log("Claiming testnet USDC...");
    const faucetPayload = merkle.payloads.testnetFaucetUSDC({
        amount: 10000000000n, // 10 USDC (USDC has 6 decimals)
    });
    const faucetTx = await sendTransaction(aptos, account, faucetPayload);
    console.log(`✅ USDC faucet tx hash: ${faucetTx.hash}`);
    // wait for balance to update
    await (0, ts_sdk_2.sleep)(2000);
    // fetch USDC balance
    const usdcBalance = await merkle.getUsdcBalance({
        accountAddress: account.accountAddress,
    });
    console.log(`USDC Balance: ${Number(usdcBalance) / 1e6} USDC`);
    // 2) (Optional) place a small market order to test
    console.log("Placing a small BTC_USD market order...");
    const openPayload = merkle.payloads.placeMarketOrder({
        pair: "BTC_USD",
        userAddress: account.accountAddress.toString(),
        sizeDelta: 10000000000n,
        collateralDelta: 100000000n,
        isLong: true,
        isIncrease: true,
        typeArguments: ["BTC", "USD"]
    });
    const openTx = await sendTransaction(aptos, account, openPayload);
    console.log(`✅ Open order tx hash: ${openTx.hash}`);
    // wait a bit and then close
    await (0, ts_sdk_2.sleep)(2000);
    // fetch open positions
    const positions = await merkle.getPositions({
        address: account.accountAddress.toString(),
    });
    console.log("Open positions:", positions);
    const position = positions.find((p) => p.pairType === "BTC_USD");
    if (!position) {
        console.warn("No BTC_USD position found to close.");
        return;
    }
    console.log("Closing BTC_USD position...");
    const closePayload = merkle.payloads.placeMarketOrder({
        pair: "BTC_USD",
        userAddress: account.accountAddress.toString(),
        sizeDelta: position.size,
        collateralDelta: position.collateral,
        isLong: position.isLong,
        isIncrease: false,
        typeArguments: ["BTC", "USD"]
    });
    const closeTx = await sendTransaction(aptos, account, closePayload);
    console.log(`✅ Close order tx hash: ${closeTx.hash}`);
}
async function sendTransaction(aptos, account, payload) {
    const tx = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: payload,
    });
    const signed = await aptos.signAndSubmitTransaction({
        signer: account,
        transaction: tx,
    });
    return await aptos.waitForTransaction({ transactionHash: signed.hash });
}
main().catch((err) => {
    console.error("Error in faucet script:", err);
    process.exit(1);
});
