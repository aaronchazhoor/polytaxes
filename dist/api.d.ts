/**
 * Polymarket API integration
 * Fetches trading history and market data
 */
import type { PolymarketTrade, MarketData } from './types.js';
/**
 * Fetches trading history for a wallet within a tax year
 */
export declare function fetchTradingHistory(walletAddress: string, taxYear: number, onProgress?: (message: string) => void): Promise<PolymarketTrade[]>;
/**
 * Fetches market data by condition ID
 */
export declare function fetchMarket(conditionId: string): Promise<MarketData | null>;
/**
 * Fetches multiple markets in batches
 */
export declare function fetchMarketsBatch(conditionIds: string[]): Promise<Map<string, MarketData>>;
export declare function isValidWalletAddress(address: string): boolean;
export declare function extractWalletAddress(input: string): string | null;
