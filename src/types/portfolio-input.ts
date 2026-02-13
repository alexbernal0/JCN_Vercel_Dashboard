/**
 * Portfolio Input Types
 *
 * Type definitions for the Portfolio Input component
 */

export interface PortfolioHolding {
  id: string;
  symbol: string;
  costBasis: number;
  shares: number;
}

export interface PortfolioInputData {
  holdings: PortfolioHolding[];
  lastUpdated: string;
}

// Type alias for API compatibility
export type PortfolioPosition = Omit<PortfolioHolding, "id">;

export const DEFAULT_HOLDINGS: Omit<PortfolioHolding, "id">[] = [
  { symbol: "SPMO", costBasis: 97.4, shares: 14301 },
  { symbol: "ASML", costBasis: 660.32, shares: 1042 },
  { symbol: "MNST", costBasis: 50.01, shares: 8234 },
  { symbol: "MSCI", costBasis: 342.94, shares: 2016 },
  { symbol: "COST", costBasis: 655.21, shares: 798 },
  { symbol: "AVGO", costBasis: 138.0, shares: 6088 },
  { symbol: "MA", costBasis: 418.76, shares: 1389 },
  { symbol: "FICO", costBasis: 1850.0, shares: 778 },
  { symbol: "SPGI", costBasis: 427.93, shares: 1554 },
  { symbol: "IDXX", costBasis: 378.01, shares: 1570 },
  { symbol: "ISRG", costBasis: 322.5, shares: 2769 },
  { symbol: "V", costBasis: 276.65, shares: 2338 },
  { symbol: "CAT", costBasis: 287.7, shares: 1356 },
  { symbol: "ORLY", costBasis: 103.0, shares: 3566 },
  { symbol: "HEI", costBasis: 172.0, shares: 1804 },
  { symbol: "CPRT", costBasis: 52.0, shares: 21136 },
  { symbol: "WM", costBasis: 177.77, shares: 3082 },
  { symbol: "TSLA", costBasis: 270.0, shares: 5022 },
  { symbol: "AAPL", costBasis: 181.4, shares: 2865 },
  { symbol: "LRCX", costBasis: 73.24, shares: 18667 },
  { symbol: "TSM", costBasis: 99.61, shares: 5850 },
];

export const MAX_POSITIONS = 30;
