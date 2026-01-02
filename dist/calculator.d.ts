/**
 * Tax Calculator - FIFO Cost Basis Implementation
 * Calculates capital gains/losses for prediction market trades
 */
import type { PolymarketTrade, TaxReport } from './types.js';
/**
 * Generates complete tax report from trades
 */
export declare function generateTaxReport(trades: PolymarketTrade[], taxYear: number): Promise<TaxReport>;
