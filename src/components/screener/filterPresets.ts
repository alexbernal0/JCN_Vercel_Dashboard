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

  // --- Greater-Than Cutoffs (minimum floor) ---
  { label: "$200B+ \u2014 Mega", value: { op: "gte", value: 200e9 } },
  { label: "$100B+ \u2014 Mega / Large", value: { op: "gte", value: 100e9 } },
  { label: "$50B+ \u2014 Large", value: { op: "gte", value: 50e9 } },
  { label: "$20B+ \u2014 Large", value: { op: "gte", value: 20e9 } },
  { label: "$10B+ \u2014 Large / Mid", value: { op: "gte", value: 10e9 } },
  { label: "$5B+ \u2014 Mid", value: { op: "gte", value: 5e9 } },
  { label: "$2B+ \u2014 Mid", value: { op: "gte", value: 2e9 } },
  { label: "$1B+ \u2014 Mid / Small", value: { op: "gte", value: 1e9 } },
  { label: "$500M+ \u2014 Small", value: { op: "gte", value: 500e6 } },
  { label: "$200M+ \u2014 Small", value: { op: "gte", value: 200e6 } },
  { label: "$100M+ \u2014 Small / Micro", value: { op: "gte", value: 100e6 } },
  { label: "$50M+ \u2014 Micro", value: { op: "gte", value: 50e6 } },
  { label: "$20M+ \u2014 Micro", value: { op: "gte", value: 20e6 } },

  // --- Exclusive Segments (bounded ranges) ---
  {
    label: "Mega Only ($200B+)",
    value: { op: "between", value: [200e9, 999e12] },
  },
  {
    label: "Large Only ($10B\u2013$200B)",
    value: { op: "between", value: [10e9, 200e9] },
  },
  {
    label: "Mid Only ($2B\u2013$10B)",
    value: { op: "between", value: [2e9, 10e9] },
  },
  {
    label: "Small Only ($300M\u2013$2B)",
    value: { op: "between", value: [300e6, 2e9] },
  },
  {
    label: "Micro Only ($20M\u2013$300M)",
    value: { op: "between", value: [20e6, 300e6] },
  },

  // --- Combo Segments (adjacent cap groups) ---
  {
    label: "Large + Mid ($2B\u2013$200B)",
    value: { op: "between", value: [2e9, 200e9] },
  },
  {
    label: "Mid + Small ($300M\u2013$10B)",
    value: { op: "between", value: [300e6, 10e9] },
  },

  // --- TOP N by Market Cap ---
  { label: "TOP 50", value: { op: "top_n", value: 50 } },
  { label: "TOP 100", value: { op: "top_n", value: 100 } },
  { label: "TOP 200", value: { op: "top_n", value: 200 } },
  { label: "TOP 500", value: { op: "top_n", value: 500 } },
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

const INDUSTRY_OPTIONS: FilterOption[] = [
  { label: "Any", value: { op: "eq", value: "" } },
  {
    label: "Advertising Agencies",
    value: { op: "eq", value: "Advertising Agencies" },
  },
  {
    label: "Aerospace & Defense",
    value: { op: "eq", value: "Aerospace & Defense" },
  },
  {
    label: "Agricultural Inputs",
    value: { op: "eq", value: "Agricultural Inputs" },
  },
  {
    label: "Air Freight & Logistics",
    value: { op: "eq", value: "Air Freight & Logistics" },
  },
  {
    label: "Airlines",
    value: { op: "in", value: ["Airlines", "Passenger Airlines"] },
  },
  {
    label: "Apparel Manufacturing",
    value: { op: "eq", value: "Apparel Manufacturing" },
  },
  { label: "Apparel Retail", value: { op: "eq", value: "Apparel Retail" } },
  { label: "Asset Management", value: { op: "eq", value: "Asset Management" } },
  {
    label: "Auto & Truck Dealerships",
    value: { op: "eq", value: "Auto & Truck Dealerships" },
  },
  {
    label: "Auto Manufacturers",
    value: { op: "in", value: ["Auto Manufacturers", "Automobiles"] },
  },
  {
    label: "Auto Parts",
    value: { op: "in", value: ["Auto Parts", "Automobile Components"] },
  },
  { label: "Banks", value: { op: "in", value: ["Banks", "Banks - Regional"] } },
  {
    label: "Beverages",
    value: {
      op: "in",
      value: [
        "Beverages",
        "Beverages - Non-Alcoholic",
        "Beverages - Wineries & Distilleries",
      ],
    },
  },
  { label: "Biotechnology", value: { op: "eq", value: "Biotechnology" } },
  {
    label: "Broadline Retail",
    value: {
      op: "in",
      value: [
        "Broadline Retail",
        "Internet Retail",
        "Internet & Direct Marketing Retail",
      ],
    },
  },
  {
    label: "Building Materials",
    value: {
      op: "in",
      value: [
        "Building Materials",
        "Building Products",
        "Building Products & Equipment",
      ],
    },
  },
  {
    label: "Business Services",
    value: {
      op: "in",
      value: ["Business Equipment & Supplies", "Specialty Business Services"],
    },
  },
  { label: "Capital Markets", value: { op: "eq", value: "Capital Markets" } },
  {
    label: "Chemicals",
    value: { op: "in", value: ["Chemicals", "Specialty Chemicals"] },
  },
  {
    label: "Commercial Services",
    value: {
      op: "in",
      value: ["Commercial Services & Supplies", "Professional Services"],
    },
  },
  {
    label: "Communications Equipment",
    value: { op: "eq", value: "Communications Equipment" },
  },
  {
    label: "Computer Hardware",
    value: { op: "eq", value: "Computer Hardware" },
  },
  {
    label: "Conglomerates",
    value: { op: "in", value: ["Conglomerates", "Industrial Conglomerates"] },
  },
  {
    label: "Construction & Engineering",
    value: {
      op: "in",
      value: ["Construction & Engineering", "Engineering & Construction"],
    },
  },
  {
    label: "Construction Materials",
    value: { op: "eq", value: "Construction Materials" },
  },
  {
    label: "Consulting Services",
    value: { op: "eq", value: "Consulting Services" },
  },
  {
    label: "Consumer Electronics",
    value: { op: "eq", value: "Consumer Electronics" },
  },
  {
    label: "Consumer Finance",
    value: { op: "in", value: ["Consumer Finance", "Credit Services"] },
  },
  {
    label: "Containers & Packaging",
    value: {
      op: "in",
      value: ["Containers & Packaging", "Packaging & Containers"],
    },
  },
  { label: "Copper", value: { op: "eq", value: "Copper" } },
  {
    label: "Diagnostics & Research",
    value: { op: "eq", value: "Diagnostics & Research" },
  },
  { label: "Discount Stores", value: { op: "eq", value: "Discount Stores" } },
  {
    label: "Distributors",
    value: {
      op: "in",
      value: [
        "Distributors",
        "Industrial Distribution",
        "Electronics & Computer Distribution",
      ],
    },
  },
  {
    label: "Drug Manufacturers",
    value: {
      op: "in",
      value: [
        "Drug Manufacturers - General",
        "Drug Manufacturers - Specialty & Generic",
        "Pharmaceuticals",
      ],
    },
  },
  {
    label: "Education & Training",
    value: { op: "eq", value: "Education & Training Services" },
  },
  {
    label: "Electric Utilities",
    value: {
      op: "in",
      value: ["Electric Utilities", "Utilities - Regulated Electric"],
    },
  },
  {
    label: "Electrical Equipment",
    value: {
      op: "in",
      value: ["Electrical Equipment", "Electrical Equipment & Parts"],
    },
  },
  {
    label: "Electronic Components",
    value: {
      op: "in",
      value: [
        "Electronic Components",
        "Electronic Equipment, Instruments & Components",
      ],
    },
  },
  {
    label: "Entertainment",
    value: {
      op: "in",
      value: ["Entertainment", "Electronic Gaming & Multimedia"],
    },
  },
  {
    label: "Energy Equipment & Services",
    value: { op: "eq", value: "Energy Equipment & Services" },
  },
  {
    label: "Farm & Heavy Machinery",
    value: { op: "eq", value: "Farm & Heavy Construction Machinery" },
  },
  { label: "Farm Products", value: { op: "eq", value: "Farm Products" } },
  {
    label: "Financial Services",
    value: {
      op: "in",
      value: ["Financial Services", "Financial Conglomerates"],
    },
  },
  {
    label: "Food Distribution",
    value: { op: "eq", value: "Food Distribution" },
  },
  { label: "Food Products", value: { op: "eq", value: "Food Products" } },
  {
    label: "Furnishings & Appliances",
    value: {
      op: "in",
      value: ["Furnishings, Fixtures & Appliances", "Household Durables"],
    },
  },
  {
    label: "Gambling & Casinos",
    value: { op: "in", value: ["Gambling", "Resorts & Casinos"] },
  },
  { label: "Gas Utilities", value: { op: "eq", value: "Gas Utilities" } },
  { label: "Gold", value: { op: "eq", value: "Gold" } },
  {
    label: "Grocery Stores",
    value: {
      op: "in",
      value: ["Grocery Stores", "Consumer Staples Distribution & Retail"],
    },
  },
  {
    label: "Ground Transportation",
    value: { op: "eq", value: "Ground Transportation" },
  },
  {
    label: "Health Care Equipment",
    value: {
      op: "in",
      value: [
        "Health Care Equipment & Supplies",
        "Medical Devices",
        "Medical Instruments & Supplies",
      ],
    },
  },
  {
    label: "Health Care Providers",
    value: {
      op: "in",
      value: ["Health Care Providers & Services", "Medical Distribution"],
    },
  },
  {
    label: "Health Care REITs",
    value: {
      op: "in",
      value: ["Health Care REITs", "REIT - Healthcare Facilities"],
    },
  },
  {
    label: "Health Care Technology",
    value: {
      op: "in",
      value: ["Health Care Technology", "Health Information Services"],
    },
  },
  {
    label: "Home Improvement Retail",
    value: { op: "eq", value: "Home Improvement Retail" },
  },
  {
    label: "Hotels & Restaurants",
    value: {
      op: "in",
      value: ["Hotels, Restaurants & Leisure", "Restaurants"],
    },
  },
  {
    label: "Household Products",
    value: {
      op: "in",
      value: [
        "Household Products",
        "Household & Personal Products",
        "Personal Care Products",
      ],
    },
  },
  {
    label: "IT Services",
    value: {
      op: "in",
      value: ["IT Services", "Information Technology Services"],
    },
  },
  {
    label: "Independent Power Producers",
    value: {
      op: "eq",
      value: "Independent Power and Renewable Electricity Producers",
    },
  },
  {
    label: "Insurance",
    value: {
      op: "in",
      value: [
        "Insurance",
        "Insurance - Diversified",
        "Insurance - Life",
        "Insurance - Property & Casualty",
        "Insurance - Reinsurance",
        "Insurance Brokers",
      ],
    },
  },
  {
    label: "Interactive Media",
    value: {
      op: "in",
      value: ["Interactive Media & Services", "Internet Content & Information"],
    },
  },
  {
    label: "Leisure Products",
    value: { op: "in", value: ["Leisure Products", "Leisure"] },
  },
  {
    label: "Life Sciences Tools",
    value: { op: "eq", value: "Life Sciences Tools & Services" },
  },
  {
    label: "Lumber & Wood",
    value: { op: "eq", value: "Lumber & Wood Production" },
  },
  {
    label: "Luxury Goods",
    value: {
      op: "in",
      value: ["Luxury Goods", "Textiles, Apparel & Luxury Goods"],
    },
  },
  {
    label: "Machinery",
    value: { op: "in", value: ["Machinery", "Specialty Industrial Machinery"] },
  },
  {
    label: "Marine Transportation",
    value: { op: "in", value: ["Marine Shipping", "Marine Transportation"] },
  },
  {
    label: "Media",
    value: { op: "in", value: ["Media", "Diversified Consumer Services"] },
  },
  {
    label: "Metals & Mining",
    value: {
      op: "in",
      value: [
        "Metals & Mining",
        "Other Industrial Metals & Mining",
        "Other Precious Metals & Mining",
        "Silver",
      ],
    },
  },
  { label: "Multi-Utilities", value: { op: "eq", value: "Multi-Utilities" } },
  { label: "Oil & Gas E&P", value: { op: "eq", value: "Oil & Gas E&P" } },
  {
    label: "Oil & Gas Equipment",
    value: {
      op: "in",
      value: ["Oil & Gas Equipment & Services", "Oil & Gas Drilling"],
    },
  },
  {
    label: "Oil & Gas Midstream",
    value: { op: "eq", value: "Oil & Gas Midstream" },
  },
  {
    label: "Oil & Gas Refining",
    value: {
      op: "in",
      value: ["Oil & Gas Refining & Marketing", "Oil, Gas & Consumable Fuels"],
    },
  },
  { label: "Packaged Foods", value: { op: "eq", value: "Packaged Foods" } },
  {
    label: "Paper & Forest Products",
    value: {
      op: "in",
      value: ["Paper & Forest Products", "Paper & Paper Products"],
    },
  },
  {
    label: "Personal Services",
    value: { op: "eq", value: "Personal Services" },
  },
  {
    label: "Pollution & Treatment",
    value: { op: "eq", value: "Pollution & Treatment Controls" },
  },
  { label: "Railroads", value: { op: "eq", value: "Railroads" } },
  {
    label: "REITs - Diversified",
    value: { op: "in", value: ["Diversified REITs", "REIT - Diversified"] },
  },
  {
    label: "REITs - Industrial",
    value: { op: "eq", value: "REIT - Industrial" },
  },
  {
    label: "REITs - Mortgage",
    value: {
      op: "in",
      value: [
        "REIT - Mortgage",
        "Mortgage Real Estate Investment Trusts (REITs)",
        "Thrifts & Mortgage Finance",
      ],
    },
  },
  {
    label: "REITs - Office",
    value: { op: "in", value: ["Office REITs", "REIT - Office"] },
  },
  {
    label: "REITs - Residential",
    value: {
      op: "in",
      value: ["Residential REITs", "Residential Construction"],
    },
  },
  {
    label: "REITs - Retail",
    value: { op: "in", value: ["Retail REITs", "REIT - Retail"] },
  },
  {
    label: "REITs - Specialty",
    value: { op: "in", value: ["Specialized REITs", "REIT - Specialty"] },
  },
  {
    label: "Real Estate Services",
    value: {
      op: "in",
      value: [
        "Real Estate Services",
        "Real Estate Management & Development",
        "Real Estate - Development",
      ],
    },
  },
  {
    label: "Rental & Leasing",
    value: { op: "eq", value: "Rental & Leasing Services" },
  },
  {
    label: "Scientific Instruments",
    value: { op: "eq", value: "Scientific & Technical Instruments" },
  },
  {
    label: "Security & Protection",
    value: { op: "eq", value: "Security & Protection Services" },
  },
  {
    label: "Semiconductors",
    value: {
      op: "in",
      value: [
        "Semiconductors",
        "Semiconductors & Semiconductor Equipment",
        "Semiconductor Equipment & Materials",
      ],
    },
  },
  {
    label: "Software - Application",
    value: { op: "eq", value: "Software - Application" },
  },
  {
    label: "Software - Infrastructure",
    value: { op: "eq", value: "Software - Infrastructure" },
  },
  {
    label: "Software (All)",
    value: {
      op: "in",
      value: [
        "Software",
        "Software - Application",
        "Software - Infrastructure",
      ],
    },
  },
  { label: "Solar", value: { op: "eq", value: "Solar" } },
  { label: "Specialty Retail", value: { op: "eq", value: "Specialty Retail" } },
  {
    label: "Staffing & Employment",
    value: { op: "eq", value: "Staffing & Employment Services" },
  },
  { label: "Steel", value: { op: "in", value: ["Steel", "Coking Coal"] } },
  {
    label: "Telecom Services",
    value: {
      op: "in",
      value: [
        "Telecom Services",
        "Diversified Telecommunication Services",
        "Wireless Telecommunication Services",
      ],
    },
  },
  {
    label: "Textile Manufacturing",
    value: { op: "eq", value: "Textile Manufacturing" },
  },
  { label: "Tobacco", value: { op: "eq", value: "Tobacco" } },
  {
    label: "Trading Companies",
    value: { op: "eq", value: "Trading Companies & Distributors" },
  },
  {
    label: "Transportation Infrastructure",
    value: {
      op: "in",
      value: [
        "Transportation Infrastructure",
        "Airports & Air Services",
        "Integrated Freight & Logistics",
      ],
    },
  },
  { label: "Travel Services", value: { op: "eq", value: "Travel Services" } },
  { label: "Uranium", value: { op: "eq", value: "Uranium" } },
  {
    label: "Utilities - Renewable",
    value: { op: "eq", value: "Utilities - Renewable" },
  },
  { label: "Waste Management", value: { op: "eq", value: "Waste Management" } },
  { label: "Water Utilities", value: { op: "eq", value: "Water Utilities" } },
  {
    label: "Tech Hardware & Storage",
    value: { op: "eq", value: "Technology Hardware, Storage & Peripherals" },
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
      { field: "industry", label: "Industry", options: INDUSTRY_OPTIONS },
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
