// global.d.ts

declare module '@merkletrade/ts-sdk' {
    /** Minimal state for on‐chain price */
    export interface PairState {
      indexPrice: number;
    }
  
    /** Metadata about a market (type tags) */
    export interface PairInfo {
      pairType:       string;
      baseAssetType:  string;
      quoteAssetType: string;
    }
  
    /** On‐chain config for collateral & leverage */
    export interface MarketConfig {
      minCollateral: number;  // in USD units
      maxCollateral: number;
      minLeverage:   number;
      maxLeverage:   number;
    }
  
    export class MerkleClientConfig {
      static testnet(): Promise<any>;
      static mainnet():  Promise<any>;
    }
  
    export class MerkleClient {
      config: any;
      getUsdcBalance: (arg0: {
        accountAddress: import("@aptos-labs/ts-sdk").AccountAddress;
      }) => any;      
  
      /** Quick index‐price lookup */
      api: {
        getPairState(symbol: string): Promise<PairState>;
        getMarketConfig(market: string): Promise<MarketConfig>;
      };
  
      /** All symbols metadata */
      getAllPairInfos(): Promise<PairInfo[]>;
  
      /** Build on‐chain payloads */
      payloads: {
        testnetFaucetUSDC(arg0: { amount: bigint; }): unknown;
        placeMarketOrder(params: {
          pair: string;
          userAddress: string;
          sizeDelta: bigint;
          collateralDelta: bigint;
          isLong: boolean;
          isIncrease: boolean;
          typeArguments: [string, string];
        }): any;
      };
  
      /** Fetch your open positions */
      getPositions(opts: { address: string }): Promise<any[]>;
    }
    
    interface StoredPosition {
      symbol: string;
      entryPrice: number;
      txHash: string;
      timestamp: number;
      signalScore: number;
      marketRegime: string;
    }
    
  }