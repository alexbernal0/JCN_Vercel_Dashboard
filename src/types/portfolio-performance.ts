export interface PortfolioPerformanceData {
  ticker: string;
  security: string;
  costBasis: number;
  currentPrice: number;
  shares: number;
  portValue: number;
  portPct: number;
  dailyChangePct: number;
  ytdPct: number;
  yoyPct: number;
  portGainPct: number;
  pctBelow52wkHigh: number;
  chanRangePct: number;
  week52High: number;
  week52Low: number;
  sector: string;
  industry: string;
}

export interface PortfolioPerformanceResponse {
  data: PortfolioPerformanceData[];
  lastUpdated: string;
  source: string;
}
