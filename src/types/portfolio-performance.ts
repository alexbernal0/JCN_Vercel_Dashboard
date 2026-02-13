export interface PortfolioPerformanceData {
  symbol: string;
  security_name: string;
  cost_basis: number;
  shares: number;
  current_price: number;
  daily_change_pct: number;
  ytd_pct: number;
  yoy_pct: number;
  portfolio_gain_pct: number;
  pct_below_52w_high: number;
  channel_range_52w: number;
  portfolio_pct: number;
  sector: string;
  industry: string;
}

export interface PortfolioPerformanceResponse {
  success: boolean;
  data: PortfolioPerformanceData[];
  total_positions: number;
  total_value: number;
  timestamp: string;
}
