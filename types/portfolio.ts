/**
 * Portfolio Type Definitions
 *
 * Type definitions for portfolio data structures used throughout the application.
 */

export interface Holding {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  weight: number;
  gainLoss: number;
  gainLossPercent: number;
  sector: string;
}

export interface PerformanceMetrics {
  ytd: number;
  oneMonth: number;
  threeMonth: number;
  sixMonth: number;
  oneYear: number;
  threeYear: number;
  fiveYear: number;
  inception: number;
}

export interface PerformanceDataPoint {
  date: string;
  value: number;
  benchmark?: number;
}

export interface SectorAllocation {
  sector: string;
  weight: number;
  value: number;
}

export interface RiskMetrics {
  beta: number;
  alpha: number;
  sharpeRatio: number;
  volatility: number;
  maxDrawdown: number;
  var95: number; // Value at Risk (95%)
}

export interface Portfolio {
  id: string;
  name: string;
  description: string;
  totalValue: number;
  cashBalance: number;
  investedValue: number;
  performance: PerformanceMetrics;
  performanceHistory: PerformanceDataPoint[];
  holdings: Holding[];
  sectorAllocation: SectorAllocation[];
  riskMetrics: RiskMetrics;
  updatedAt: string;
}

export interface PortfolioSummary {
  id: string;
  name: string;
  description: string;
  totalValue: number;
  ytdReturn: number;
  oneYearReturn: number;
  updatedAt: string;
}
