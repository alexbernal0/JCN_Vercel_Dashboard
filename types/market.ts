/**
 * Market Type Definitions
 *
 * Type definitions for market data structures.
 */

export interface MarketIndex {
  symbol: string;
  name: string;
  currentValue: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

export interface MarketData {
  indices: MarketIndex[];
  updatedAt: string;
}

export interface Metadata {
  lastRefresh: string;
  status: "success" | "error" | "pending";
  message?: string;
}
