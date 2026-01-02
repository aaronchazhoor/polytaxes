/**
 * Type definitions for Polymarket Tax Form Generator
 */

export interface PolymarketTrade {
  timestamp: number;
  type: 'TRADE' | 'REDEEM';
  side: 'BUY' | 'SELL';
  conditionId: string;
  outcome: string;
  size: number;
  usdcSize: number;
  price: number;
  transactionHash: string;
  title: string;
}

export interface MarketData {
  question: string;
  closed: boolean;
  condition_id: string;
  tokens: Array<{
    outcome: string;
    winner: boolean;
    price: number;
  }>;
}

export interface Form8949Entry {
  description: string;
  dateAcquired: string;
  dateSold: string;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
  isLongTerm: boolean;
  holdingDays: number;
}

export interface TaxReport {
  shortTerm: Form8949Entry[];
  longTerm: Form8949Entry[];
  shortTermSummary: {
    count: number;
    totalProceeds: number;
    totalCostBasis: number;
    totalGainLoss: number;
  };
  longTermSummary: {
    count: number;
    totalProceeds: number;
    totalCostBasis: number;
    totalGainLoss: number;
  };
  totalTransactions: number;
  totalGainLoss: number;
  warnings: string[];
  openPositions: OpenPosition[];
}

export interface OpenPosition {
  positionKey: string;
  conditionId: string;
  outcome: string;
  quantity: number;
  costBasis: number;
  lots: InventoryLot[];
  title: string;
}

export interface InventoryLot {
  acquisitionDate: number;
  quantity: number;
  costBasisPerToken: number;
  totalCostBasis: number;
  marketTitle: string;
  transactionHash: string;
  outcome: string;
}

export interface PDFGenerationOptions {
  taxYear: number;
  mode: 'summary' | 'detailed';
}
