/**
 * FinViz-style preset filter definitions for the JCN Screener.
 * Each filter has a field name, display label, and preset options.
 * NO manual input — only dropdowns with preset min/max/range values.
 */

export interface FilterOption {
  label: string
  value: { op: string; value: number | number[] | string | string[] }
}

export interface FilterDef {
  field: string
  label: string
  options: FilterOption[]
}

export interface FilterTab {
  id: string
  label: string
  filters: FilterDef[]
}

// --- Reusable option sets ---

const SCORE_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: 0 } },
  { label: "Over 90", value: { op: "gte", value: 90 } },
  { label: "Over 80", value: { op: "gte", value: 80 } },
  { label: "Over 70", value: { op: "gte", value: 70 } },
  { label: "Over 60", value: { op: "gte", value: 60 } },
  { label: "Over 50", value: { op: "gte", value: 50 } },
  { label: "Under 50", value: { op: "lte", value: 50 } },
  { label: "Under 30", value: { op: "lte", value: 30 } },
]

const MARKET_CAP_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: 0 } },
  { label: "Mega (200B+)", value: { op: "gte", value: 200e9 } },
  { label: "Large (10B+)", value: { op: "gte", value: 10e9 } },
  { label: "Mid (2B-10B)", value: { op: "between", value: [2e9, 10e9] } },
  { label: "Small (300M-2B)", value: { op: "between", value: [300e6, 2e9] } },
  { label: "Micro (<300M)", value: { op: "lte", value: 300e6 } },
  { label: "Large+  (10B+)", value: { op: "gte", value: 10e9 } },
  { label: "Mid+  (2B+)", value: { op: "gte", value: 2e9 } },
]

const SECTOR_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "eq", value: "" } },
  {
    label: "Technology",
    value: { op: "in", value: ["Technology", "Information Technology"] },
  },
  {
    label: "Healthcare",
    value: { op: "in", value: ["Healthcare", "Health Care"] },
  },
  {
    label: "Financial Services",
    value: { op: "in", value: ["Financial Services", "Financials"] },
  },
  {
    label: "Consumer Cyclical",
    value: { op: "in", value: ["Consumer Cyclical", "Consumer Discretionary"] },
  },
  {
    label: "Consumer Defensive",
    value: { op: "in", value: ["Consumer Defensive", "Consumer Staples"] },
  },
  { label: "Industrials", value: { op: "eq", value: "Industrials" } },
  { label: "Energy", value: { op: "eq", value: "Energy" } },
  { label: "Utilities", value: { op: "eq", value: "Utilities" } },
  { label: "Real Estate", value: { op: "eq", value: "Real Estate" } },
  {
    label: "Basic Materials",
    value: { op: "in", value: ["Basic Materials", "Materials"] },
  },
  {
    label: "Communication Services",
    value: { op: "eq", value: "Communication Services" },
  },
]

const PE_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: -9999 } },
  { label: "Low (<15)", value: { op: "lte", value: 15 } },
  { label: "Under 20", value: { op: "lte", value: 20 } },
  { label: "Under 25", value: { op: "lte", value: 25 } },
  { label: "Under 30", value: { op: "lte", value: 30 } },
  { label: "Under 50", value: { op: "lte", value: 50 } },
  { label: "Over 50", value: { op: "gte", value: 50 } },
  { label: "Profitable (>0)", value: { op: "gte", value: 0.01 } },
]

const PEG_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: -9999 } },
  { label: "Low (<1)", value: { op: "lte", value: 1 } },
  { label: "Under 1.5", value: { op: "lte", value: 1.5 } },
  { label: "Under 2", value: { op: "lte", value: 2 } },
  { label: "Over 2", value: { op: "gte", value: 2 } },
]

const RATIO_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: -9999 } },
  { label: "Under 1", value: { op: "lte", value: 1 } },
  { label: "Under 2", value: { op: "lte", value: 2 } },
  { label: "Under 3", value: { op: "lte", value: 3 } },
  { label: "Under 5", value: { op: "lte", value: 5 } },
  { label: "Over 5", value: { op: "gte", value: 5 } },
  { label: "Over 10", value: { op: "gte", value: 10 } },
]

const MARGIN_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: -9999 } },
  { label: "Over 50%", value: { op: "gte", value: 0.5 } },
  { label: "Over 30%", value: { op: "gte", value: 0.3 } },
  { label: "Over 20%", value: { op: "gte", value: 0.2 } },
  { label: "Over 10%", value: { op: "gte", value: 0.1 } },
  { label: "Over 0% (Positive)", value: { op: "gte", value: 0 } },
  { label: "Negative", value: { op: "lte", value: 0 } },
]

const RETURN_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: -9999 } },
  { label: "Over 30%", value: { op: "gte", value: 0.3 } },
  { label: "Over 20%", value: { op: "gte", value: 0.2 } },
  { label: "Over 15%", value: { op: "gte", value: 0.15 } },
  { label: "Over 10%", value: { op: "gte", value: 0.1 } },
  { label: "Over 5%", value: { op: "gte", value: 0.05 } },
  { label: "Positive", value: { op: "gte", value: 0 } },
  { label: "Negative", value: { op: "lte", value: 0 } },
]

const GROWTH_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: -9999 } },
  { label: "Over 50%", value: { op: "gte", value: 0.5 } },
  { label: "Over 25%", value: { op: "gte", value: 0.25 } },
  { label: "Over 15%", value: { op: "gte", value: 0.15 } },
  { label: "Over 10%", value: { op: "gte", value: 0.1 } },
  { label: "Over 5%", value: { op: "gte", value: 0.05 } },
  { label: "Positive", value: { op: "gte", value: 0 } },
  { label: "Negative", value: { op: "lte", value: 0 } },
]

const PCT_CHANGE_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: -9999 } },
  { label: "Up >5%", value: { op: "gte", value: 5 } },
  { label: "Up >3%", value: { op: "gte", value: 3 } },
  { label: "Up >1%", value: { op: "gte", value: 1 } },
  { label: "Up", value: { op: "gte", value: 0 } },
  { label: "Down", value: { op: "lte", value: 0 } },
  { label: "Down >3%", value: { op: "lte", value: -3 } },
  { label: "Down >5%", value: { op: "lte", value: -5 } },
]

const YIELD_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: -9999 } },
  { label: "Over 5%", value: { op: "gte", value: 0.05 } },
  { label: "Over 3%", value: { op: "gte", value: 0.03 } },
  { label: "Over 2%", value: { op: "gte", value: 0.02 } },
  { label: "Over 1%", value: { op: "gte", value: 0.01 } },
  { label: "Positive", value: { op: "gte", value: 0 } },
  { label: "None (0%)", value: { op: "lte", value: 0 } },
]

const BETA_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: -9999 } },
  { label: "Under 0.5", value: { op: "lte", value: 0.5 } },
  { label: "Under 1", value: { op: "lte", value: 1 } },
  { label: "Under 1.5", value: { op: "lte", value: 1.5 } },
  { label: "Over 1", value: { op: "gte", value: 1 } },
  { label: "Over 1.5", value: { op: "gte", value: 1.5 } },
  { label: "Over 2", value: { op: "gte", value: 2 } },
]

const DEBT_EQUITY_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: -9999 } },
  { label: "Low (<0.5)", value: { op: "lte", value: 0.5 } },
  { label: "Under 1", value: { op: "lte", value: 1 } },
  { label: "Under 2", value: { op: "lte", value: 2 } },
  { label: "Over 1", value: { op: "gte", value: 1 } },
  { label: "Over 2", value: { op: "gte", value: 2 } },
]

const CURRENT_RATIO_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "gte", value: -9999 } },
  { label: "Over 3", value: { op: "gte", value: 3 } },
  { label: "Over 2", value: { op: "gte", value: 2 } },
  { label: "Over 1.5", value: { op: "gte", value: 1.5 } },
  { label: "Over 1", value: { op: "gte", value: 1 } },
  { label: "Under 1", value: { op: "lte", value: 1 } },
]

// --- Tab Definitions ---

export const FILTER_TABS: FilterTab[] = [
  {
    id: "descriptive",
    label: "Descriptive",
    filters: [
      { field: "market_cap", label: "Market Cap", options: MARKET_CAP_OPTIONS },
      { field: "gics_sector", label: "Sector", options: SECTOR_OPTIONS },
    ],
  },
  {
    id: "jcn_scores",
    label: "JCN Scores",
    filters: [
      // 5 Factor Composites
      {
        field: "value_score_composite",
        label: "Value Score",
        options: SCORE_OPTIONS,
      },
      {
        field: "quality_score_composite",
        label: "Quality Score",
        options: SCORE_OPTIONS,
      },
      {
        field: "finstr_score_composite",
        label: "Fin. Strength Score",
        options: SCORE_OPTIONS,
      },
      {
        field: "growth_score_composite",
        label: "Growth Score",
        options: SCORE_OPTIONS,
      },
      {
        field: "momentum_score_composite",
        label: "Momentum Score",
        options: SCORE_OPTIONS,
      },
      // 8 JCN Blend Composites
      {
        field: "jcn_full_composite",
        label: "JCN Full Composite",
        options: SCORE_OPTIONS,
      },
      { field: "jcn_qarp", label: "JCN QARP", options: SCORE_OPTIONS },
      { field: "jcn_garp", label: "JCN GARP", options: SCORE_OPTIONS },
      {
        field: "jcn_quality_momentum",
        label: "JCN Quality Momentum",
        options: SCORE_OPTIONS,
      },
      {
        field: "jcn_value_momentum",
        label: "JCN Value Momentum",
        options: SCORE_OPTIONS,
      },
      {
        field: "jcn_growth_quality_momentum",
        label: "JCN Growth Quality Mom.",
        options: SCORE_OPTIONS,
      },
      { field: "jcn_fortress", label: "JCN Fortress", options: SCORE_OPTIONS },
      {
        field: "jcn_alpha_trifecta",
        label: "JCN Alpha Trifecta",
        options: SCORE_OPTIONS,
      },
    ],
  },
  {
    id: "valuation",
    label: "Valuation",
    filters: [
      { field: "pe_ratio", label: "P/E Ratio", options: PE_OPTIONS },
      { field: "forward_pe", label: "Forward P/E", options: PE_OPTIONS },
      { field: "peg_ratio", label: "PEG Ratio", options: PEG_OPTIONS },
      { field: "price_book", label: "Price/Book", options: RATIO_OPTIONS },
      { field: "price_sales", label: "Price/Sales", options: RATIO_OPTIONS },
      { field: "ev_ebitda", label: "EV/EBITDA", options: RATIO_OPTIONS },
      {
        field: "dividend_yield",
        label: "Dividend Yield",
        options: YIELD_OPTIONS,
      },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    filters: [
      {
        field: "revenue_growth",
        label: "Revenue Growth (QoQ YoY)",
        options: GROWTH_OPTIONS,
      },
      {
        field: "earnings_growth",
        label: "Earnings Growth (QoQ YoY)",
        options: GROWTH_OPTIONS,
      },
    ],
  },
  {
    id: "profitability",
    label: "Profitability",
    filters: [
      { field: "gross_margin", label: "Gross Margin", options: MARGIN_OPTIONS },
      { field: "profit_margin", label: "Net Margin", options: MARGIN_OPTIONS },
      {
        field: "operating_margin",
        label: "Operating Margin",
        options: MARGIN_OPTIONS,
      },
      {
        field: "return_on_equity",
        label: "Return on Equity",
        options: RETURN_OPTIONS,
      },
      {
        field: "return_on_assets",
        label: "Return on Assets",
        options: RETURN_OPTIONS,
      },
    ],
  },
  {
    id: "momentum",
    label: "Momentum",
    filters: [
      {
        field: "daily_change_pct",
        label: "Daily % Change",
        options: PCT_CHANGE_OPTIONS,
      },
      { field: "ytd_pct", label: "YTD %", options: PCT_CHANGE_OPTIONS },
      { field: "yoy_pct", label: "YoY %", options: PCT_CHANGE_OPTIONS },
      { field: "beta", label: "Beta", options: BETA_OPTIONS },
      // Momentum sub-components
      { field: "af_momentum", label: "AF Momentum", options: SCORE_OPTIONS },
      { field: "fip_score", label: "FIP Score", options: SCORE_OPTIONS },
      { field: "systemscore", label: "System Score", options: SCORE_OPTIONS },
      { field: "af_composite", label: "AF Composite", options: SCORE_OPTIONS },
      {
        field: "fip_composite",
        label: "FIP Composite",
        options: SCORE_OPTIONS,
      },
      {
        field: "sys_composite",
        label: "SYS Composite",
        options: SCORE_OPTIONS,
      },
    ],
  },
  {
    id: "fundamentals",
    label: "Fundamentals",
    filters: [
      {
        field: "debt_to_equity",
        label: "Debt/Equity",
        options: DEBT_EQUITY_OPTIONS,
      },
      {
        field: "current_ratio",
        label: "Current Ratio",
        options: CURRENT_RATIO_OPTIONS,
      },
      {
        field: "interest_coverage",
        label: "Interest Coverage",
        options: RATIO_OPTIONS,
      },
    ],
  },
]
