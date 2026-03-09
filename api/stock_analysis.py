"""
JCN Stock Analysis - Full Analysis Data Endpoint
Returns all fundamental data for a single stock, structured for 10 UI modules.

Queries PROD_EOD_Fundamentals (quarterly data, up to 10 years),
aggregates into annual figures, computes per-share metrics,
quality ratios, growth rates, and valuation comparisons.

Single API call returns everything the frontend needs.
"""

import os
import json
import time
import logging
import math
from pathlib import Path as FilePath
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic Response Models
# ---------------------------------------------------------------------------

class StockAnalysisResponse(BaseModel):
    symbol: str
    company_name: str
    header: Dict[str, Any]              # Module 1: company info + key stats
    price_history: List[Dict[str, Any]]  # Module 2: daily prices for chart
    per_share_annual: List[Dict[str, Any]]  # Module 3: annual per-share data
    quality_metrics: List[Dict[str, Any]]   # Module 4: annual quality ratios
    income_statement: List[Dict[str, Any]]  # Module 5: annual IS with hierarchy
    balance_sheet: List[Dict[str, Any]]     # Module 6: annual BS with hierarchy
    cash_flows: List[Dict[str, Any]]        # Module 7: annual CF with hierarchy
    growth_rates: List[Dict[str, Any]]      # Module 8: YoY growth rates
    valuation: Dict[str, Any]               # Module 9: current valuation ratios
    quality_scores: Dict[str, Any]           # Module 10: composite quality scores


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

ANALYSIS_CACHE_DIR = FilePath("/tmp/jcn_stock_analysis")
ANALYSIS_CACHE_TTL = 30 * 60  # 30 minutes


def _safe_div(a, b, default=None):
    """Safe division that handles None, zero, NaN."""
    if a is None or b is None or b == 0:
        return default
    result = a / b
    if math.isnan(result) or math.isinf(result):
        return default
    return round(result, 4)


def _safe_round(val, decimals=2):
    """Round a value safely, returning None for None/NaN."""
    if val is None:
        return None
    try:
        r = round(float(val), decimals)
        if math.isnan(r) or math.isinf(r):
            return None
        return r
    except (ValueError, TypeError):
        return None


def _safe_sum(values):
    """Sum a list of values, treating None as 0."""
    return sum(v for v in values if v is not None)


def _pct_change(new, old):
    """Calculate percentage change, handling None/zero."""
    if new is None or old is None or old == 0:
        return None
    return round((new - old) / abs(old) * 100, 2)


def _get_connection():
    """Get a MotherDuck connection."""
    import duckdb
    token = os.getenv("MOTHERDUCK_TOKEN")
    if not token:
        raise RuntimeError("MOTHERDUCK_TOKEN not set")
    return duckdb.connect(f"md:?motherduck_token={token}")


def _fetch_fundamentals(conn, symbol_md: str) -> list:
    """Fetch up to 10 years of quarterly fundamental data."""
    rows = conn.execute("""
        SELECT *
        FROM PROD_EODHD.main.PROD_EOD_Fundamentals
        WHERE symbol = ?
        ORDER BY filing_date DESC
        LIMIT 44
    """, [symbol_md]).fetchall()
    cols = [d[0] for d in conn.description]
    return [dict(zip(cols, row)) for row in rows]


def _fetch_price_history(conn, symbol_md: str, years: int = 5) -> list:
    """Fetch daily adjusted_close prices for stock and SPY."""
    sql = f"""
        WITH stock_prices AS (
            SELECT date, adjusted_close AS price
            FROM PROD_EODHD.main.PROD_EOD_survivorship
            WHERE symbol = ?
              AND date >= CURRENT_DATE - INTERVAL '{years}' YEAR
            ORDER BY date
        ),
        spy_prices AS (
            SELECT date, adjusted_close AS spy_price
            FROM PROD_EODHD.main.PROD_EOD_ETFs
            WHERE symbol = 'SPY.US'
              AND date >= CURRENT_DATE - INTERVAL '{years}' YEAR
            ORDER BY date
        )
        SELECT s.date, s.price, p.spy_price
        FROM stock_prices s
        LEFT JOIN spy_prices p ON s.date = p.date
        ORDER BY s.date
    """
    rows = conn.execute(sql, [symbol_md]).fetchall()

    if not rows:
        return []

    # Normalize to 100 at start
    base_price = rows[0][1] if rows[0][1] else 1
    base_spy = rows[0][2] if rows[0][2] else 1

    return [
        {
            "date": str(r[0]),
            "price": _safe_round(r[1], 2),
            "spy_price": _safe_round(r[2], 2),
            "price_indexed": _safe_round(r[1] / base_price * 100, 2) if r[1] else None,
            "spy_indexed": _safe_round(r[2] / base_spy * 100, 2) if r[2] else None,
        }
        for r in rows
    ]


def _aggregate_annual(quarters: list) -> dict:
    """
    Aggregate quarterly data into annual data.
    P&L and CF items are summed across quarters in each calendar year.
    BS items use the latest quarter in each year (point-in-time).
    Returns dict of {year: aggregated_data}.
    """
    by_year: dict = {}
    for q in quarters:
        qdate = q.get("date", "")
        if not qdate:
            continue
        year = int(str(qdate)[:4])
        if year not in by_year:
            by_year[year] = []
        by_year[year].append(q)

    annual = {}
    # Columns that should be SUMMED (P&L and Cash Flow)
    sum_prefixes = ("is_", "cf_")
    # Columns that should use LATEST value (Balance Sheet, valuation, company info)
    latest_prefixes = ("bs_", "market_cap", "pe_ratio", "forward_pe",
                       "peg_ratio", "price_book", "price_sales", "enterprise_value",
                       "dividend_yield", "trailing_pe", "profit_margin",
                       "operating_margin", "return_on", "revenue_per_share",
                       "revenue_ttm", "gross_profit_ttm", "ebitda",
                       "shares_outstanding", "beta", "book_value",
                       "diluted_eps", "dividend_share", "earnings_",
                       "analyst_", "eps_", "wall_street", "quarterly_",
                       "most_recent", "enterprise_value")

    for year, qs in sorted(by_year.items()):
        if not qs:
            continue
        # Sort quarters by date to get latest
        qs_sorted = sorted(qs, key=lambda x: str(x.get("date", "")))
        latest_q = qs_sorted[-1]

        agg = {
            "year": year,
            "num_quarters": len(qs),
            "company_name": latest_q.get("company_name"),
            "sector": latest_q.get("sector"),
            "industry": latest_q.get("industry"),
        }

        # Process each column
        for key in latest_q:
            if key in ("symbol", "date", "filing_date", "company_name",
                       "sector", "industry", "exchange", "country",
                       "gic_sector", "gic_group", "gic_industry",
                       "gic_sub_industry", "earnings_before_after_market",
                       "earnings_quarter_date", "earnings_report_date",
                       "most_recent_quarter"):
                continue

            if any(key.startswith(p) for p in sum_prefixes):
                # Sum across quarters
                vals = [q.get(key) for q in qs if q.get(key) is not None]
                agg[key] = sum(vals) if vals else None
            else:
                # Use latest quarter value
                agg[key] = latest_q.get(key)

        annual[year] = agg

    return annual


def _build_per_share_data(annual: dict) -> list:
    """Build per-share data table (Module 3) from annual aggregated data."""
    result = []
    for year in sorted(annual.keys(), reverse=True):
        a = annual[year]
        shares = a.get("bs_commonStockSharesOutstanding")
        if not shares or shares <= 0:
            shares = a.get("shares_outstanding")
        if not shares or shares <= 0:
            continue

        rev = a.get("is_totalRevenue")
        ni = a.get("is_netIncome")
        fcf = a.get("cf_freeCashFlow")
        ebitda = a.get("is_ebitda")
        equity = a.get("bs_totalStockholderEquity")
        opcf = a.get("cf_totalCashFromOperatingActivities")
        divs = a.get("cf_dividendsPaid")  # negative
        buyback = a.get("cf_salePurchaseOfStock")  # negative for buybacks
        mcap = a.get("market_cap")

        result.append({
            "year": year,
            "revenue_per_share": _safe_div(rev, shares),
            "eps": _safe_div(ni, shares),
            "fcf_per_share": _safe_div(fcf, shares),
            "ebitda_per_share": _safe_div(ebitda, shares),
            "book_value_per_share": _safe_div(equity, shares),
            "operating_cf_per_share": _safe_div(opcf, shares),
            "dividend_per_share": _safe_div(-divs if divs else None, shares),
            "buyback_yield": _safe_div(-buyback if buyback else None, mcap) if mcap else None,
            "dividend_yield": _safe_div(-divs if divs else None, mcap) if mcap else None,
            "total_return_yield": _safe_div(
                (-divs if divs else 0) + (-buyback if buyback else 0),
                mcap
            ) if mcap else None,
            "shares_outstanding": _safe_round(shares / 1e6, 1),  # In millions
            "revenue": _safe_round(rev / 1e6, 1) if rev else None,
            "net_income": _safe_round(ni / 1e6, 1) if ni else None,
            "free_cash_flow": _safe_round(fcf / 1e6, 1) if fcf else None,
        })

    return result


def _build_quality_metrics(annual: dict) -> list:
    """Build quality metrics table (Module 4) from annual data."""
    result = []
    for year in sorted(annual.keys(), reverse=True):
        a = annual[year]
        rev = a.get("is_totalRevenue")
        gp = a.get("is_grossProfit")
        oi = a.get("is_operatingIncome")
        ni = a.get("is_netIncome")
        ebitda = a.get("is_ebitda")
        ta = a.get("bs_totalAssets")
        tl = a.get("bs_totalLiab")
        eq = a.get("bs_totalStockholderEquity")
        ltd = a.get("bs_longTermDebt")
        ca = a.get("bs_totalCurrentAssets")
        cl = a.get("bs_totalCurrentLiabilities")
        ie = a.get("is_interestExpense")
        opcf = a.get("cf_totalCashFromOperatingActivities")
        capex = a.get("cf_capitalExpenditures")
        fcf = a.get("cf_freeCashFlow")
        invested_cap = None
        if eq is not None and ltd is not None:
            invested_cap = eq + ltd
        result.append({
            "year": year,
            "gross_margin": _safe_div(gp, rev),
            "operating_margin": _safe_div(oi, rev),
            "net_margin": _safe_div(ni, rev),
            "ebitda_margin": _safe_div(ebitda, rev),
            "fcf_margin": _safe_div(fcf, rev),
            "roic": _safe_div(ni, invested_cap),
            "roe": _safe_div(ni, eq),
            "roa": _safe_div(ni, ta),
            "roce": _safe_div(oi, invested_cap),
            "debt_to_equity": _safe_div(tl, eq),
            "long_term_debt_to_equity": _safe_div(ltd, eq),
            "current_ratio": _safe_div(ca, cl),
            "interest_coverage": _safe_div(oi, ie),
            "asset_turnover": _safe_div(rev, ta),
            "capex_to_revenue": _safe_div(abs(capex) if capex else None, rev),
            "fcf_conversion": _safe_div(fcf, ni),
            "cash_conversion": _safe_div(opcf, ni),
        })
    return result


def _build_financial_statement(annual: dict, statement_type: str) -> list:
    """Build hierarchical financial statement (Modules 5-7)."""
    if statement_type == "income":
        structure = [
            ("Revenue", "is_totalRevenue", [
                ("Cost of Revenue", "is_costOfRevenue", []),
            ]),
            ("Gross Profit", "is_grossProfit", []),
            ("Operating Expenses", "is_operatingExpense", [
                ("R&D", "is_researchDevelopment", []),
                ("SG&A", "is_sellingGeneralAdministrative", []),
                ("D&A", "is_depreciationAndAmortization", []),
            ]),
            ("Operating Income", "is_operatingIncome", []),
            ("Interest Expense", "is_interestExpense", []),
            ("Income Before Tax", "is_incomeBeforeTax", []),
            ("Income Tax", "is_incomeTaxExpense", []),
            ("EBITDA", "is_ebitda", []),
            ("Net Income", "is_netIncome", []),
        ]
    elif statement_type == "balance":
        structure = [
            ("Total Assets", "bs_totalAssets", [
                ("Current Assets", "bs_totalCurrentAssets", [
                    ("Cash & Equivalents", "bs_cash", []),
                    ("Short-Term Investments", "bs_shortTermInvestments", []),
                    ("Net Receivables", "bs_netReceivables", []),
                    ("Inventory", "bs_inventory", []),
                ]),
                ("Non-Current Assets", "bs_nonCurrentAssetsTotal", [
                    ("PP&E", "bs_propertyPlantEquipment", []),
                    ("Goodwill", "bs_goodWill", []),
                    ("Intangibles", "bs_intangibleAssets", []),
                    ("Long-Term Investments", "bs_longTermInvestments", []),
                ]),
            ]),
            ("Total Liabilities", "bs_totalLiab", [
                ("Current Liabilities", "bs_totalCurrentLiabilities", [
                    ("Accounts Payable", "bs_accountsPayable", []),
                    ("Short-Term Debt", "bs_shortTermDebt", []),
                ]),
                ("Non-Current Liabilities", "bs_nonCurrentLiabilitiesTotal", [
                    ("Long-Term Debt", "bs_longTermDebt", []),
                ]),
            ]),
            ("Stockholder Equity", "bs_totalStockholderEquity", [
                ("Common Stock", "bs_commonStock", []),
                ("Retained Earnings", "bs_retainedEarnings", []),
                ("Treasury Stock", "bs_treasuryStock", []),
            ]),
            ("Net Debt", "bs_netDebt", []),
            ("Shares Outstanding (M)", "bs_commonStockSharesOutstanding", []),
        ]
    else:  # cashflow
        structure = [
            ("Operating Cash Flow", "cf_totalCashFromOperatingActivities", [
                ("Net Income", "cf_netIncome", []),
                ("D&A", "cf_depreciation", []),
                ("Stock-Based Comp", "cf_stockBasedCompensation", []),
                ("Working Capital Changes", "cf_changeToOperatingActivities", []),
            ]),
            ("Investing Cash Flow", "cf_totalCashflowsFromInvestingActivities", [
                ("Capital Expenditures", "cf_capitalExpenditures", []),
                ("Investments", "cf_investments", []),
            ]),
            ("Financing Cash Flow", "cf_totalCashFromFinancingActivities", [
                ("Dividends Paid", "cf_dividendsPaid", []),
                ("Share Buybacks/Issuance", "cf_salePurchaseOfStock", []),
                ("Net Borrowings", "cf_netBorrowings", []),
            ]),
            ("Free Cash Flow", "cf_freeCashFlow", []),
            ("Net Change in Cash", "cf_changeInCashAndCashEquivalents", []),
        ]

    years_sorted = sorted(annual.keys(), reverse=True)

    def _build_items(struct, year_data):
        items = []
        for label, col, children in struct:
            val = year_data.get(col)
            if col == "bs_commonStockSharesOutstanding" and val:
                val = val / 1e6
            elif val is not None:
                val = val / 1e6  # Display in millions
            child_items = _build_items(children, year_data) if children else []
            items.append({
                "label": label,
                "value": _safe_round(val, 1),
                "is_parent": len(children) > 0,
                "children": child_items,
            })
        return items

    result = []
    for year in years_sorted:
        result.append({"year": year, "items": _build_items(structure, annual[year])})
    return result


def _build_growth_rates(annual: dict) -> list:
    """Build YoY growth rates (Module 8)."""
    metrics = [
        ("Revenue", "is_totalRevenue"),
        ("Gross Profit", "is_grossProfit"),
        ("Operating Income", "is_operatingIncome"),
        ("EBITDA", "is_ebitda"),
        ("Net Income", "is_netIncome"),
        ("EPS", None),  # computed
        ("Free Cash Flow", "cf_freeCashFlow"),
        ("Operating Cash Flow", "cf_totalCashFromOperatingActivities"),
        ("Total Assets", "bs_totalAssets"),
        ("Stockholder Equity", "bs_totalStockholderEquity"),
        ("Long-Term Debt", "bs_longTermDebt"),
        ("Dividends Paid", "cf_dividendsPaid"),
    ]
    years = sorted(annual.keys(), reverse=True)
    result = []
    for label, col in metrics:
        row = {"metric": label, "values": {}}
        for i, year in enumerate(years):
            if i + 1 >= len(years):
                break
            curr_year = years[i]
            prev_year = years[i + 1]
            if col:
                curr = annual[curr_year].get(col)
                prev = annual[prev_year].get(col)
            else:  # EPS
                curr_ni = annual[curr_year].get("is_netIncome")
                curr_sh = annual[curr_year].get("bs_commonStockSharesOutstanding")
                prev_ni = annual[prev_year].get("is_netIncome")
                prev_sh = annual[prev_year].get("bs_commonStockSharesOutstanding")
                curr = _safe_div(curr_ni, curr_sh) if curr_sh else None
                prev = _safe_div(prev_ni, prev_sh) if prev_sh else None
            row["values"][str(curr_year)] = _pct_change(curr, prev)
        result.append(row)
    return result


def _build_valuation(latest_q: dict) -> dict:
    """Build valuation ratios (Module 9) from latest quarterly data."""
    return {
        "pe_ratio": _safe_round(latest_q.get("pe_ratio")),
        "forward_pe": _safe_round(latest_q.get("forward_pe")),
        "peg_ratio": _safe_round(latest_q.get("peg_ratio")),
        "price_to_book": _safe_round(latest_q.get("price_book_mrq")),
        "price_to_sales": _safe_round(latest_q.get("price_sales_ttm")),
        "ev_to_ebitda": _safe_round(latest_q.get("enterprise_value_ebitda")),
        "ev_to_revenue": _safe_round(latest_q.get("enterprise_value_revenue")),
        "dividend_yield": _safe_round(latest_q.get("dividend_yield"), 4),
        "trailing_pe": _safe_round(latest_q.get("trailing_pe")),
        "market_cap": latest_q.get("market_cap"),
        "enterprise_value": latest_q.get("enterprise_value"),
        "analyst_target_price": _safe_round(latest_q.get("analyst_target_price")),
        "analyst_rating": _safe_round(latest_q.get("analyst_rating")),
        "analyst_buy": latest_q.get("analyst_buy"),
        "analyst_hold": latest_q.get("analyst_hold"),
        "analyst_sell": latest_q.get("analyst_sell"),
        "analyst_strong_buy": latest_q.get("analyst_strong_buy"),
        "analyst_strong_sell": latest_q.get("analyst_strong_sell"),
    }


def _build_quality_scores(annual: dict) -> dict:
    """Build composite quality scores (Module 10) from recent 4 years."""
    years = sorted(annual.keys(), reverse=True)[:4]
    if not years:
        return {}

    # Average metrics over last 4 years
    def avg_metric(key):
        vals = [annual[y].get(key) for y in years if annual[y].get(key) is not None]
        return sum(vals) / len(vals) if vals else None

    # Score each dimension 0-100
    def _score(val, low, high):
        if val is None:
            return 50
        clamped = max(low, min(high, val))
        return round((clamped - low) / (high - low) * 100)

    # Compute averages
    gm = avg_metric("is_grossProfit")
    rev = avg_metric("is_totalRevenue")
    ni = avg_metric("is_netIncome")
    eq = avg_metric("bs_totalStockholderEquity")
    ta = avg_metric("bs_totalAssets")
    fcf = avg_metric("cf_freeCashFlow")
    ltd = avg_metric("bs_longTermDebt")
    ca = avg_metric("bs_totalCurrentAssets")
    cl = avg_metric("bs_totalCurrentLiabilities")

    gross_margin = _safe_div(gm, rev)
    roe = _safe_div(ni, eq)
    roa = _safe_div(ni, ta)
    fcf_margin = _safe_div(fcf, rev)
    debt_ratio = _safe_div(ltd, eq)
    current_ratio = _safe_div(ca, cl)

    # Revenue growth (latest vs 4 years ago)
    rev_growth = None
    if len(years) >= 2:
        newest = annual[years[0]].get("is_totalRevenue")
        oldest = annual[years[-1]].get("is_totalRevenue")
        rev_growth = _safe_div(newest, oldest)
        if rev_growth:
            rev_growth = rev_growth - 1  # Convert ratio to growth rate

    scores = {
        "profitability": _score(gross_margin, 0, 0.7),
        "returns": _score(roe, -0.1, 0.5),
        "efficiency": _score(roa, -0.05, 0.2),
        "cash_generation": _score(fcf_margin, -0.1, 0.3),
        "financial_health": _score(current_ratio, 0.5, 3.0),
        "growth": _score(rev_growth, -0.1, 0.3),
    }
    scores["overall"] = round(sum(scores.values()) / len(scores))
    return scores


def get_stock_analysis(symbol: str) -> StockAnalysisResponse:
    """
    Get complete analysis data for a single stock.
    Returns all 10 modules of data in one response.
    Cached in /tmp for 30 minutes per symbol.
    """
    clean = symbol.strip().upper().replace(".US", "")
    symbol_md = clean + ".US"

    # Check /tmp cache
    ANALYSIS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = ANALYSIS_CACHE_DIR / f"{clean}.json"
    if cache_file.exists():
        try:
            data = json.loads(cache_file.read_text())
            if time.time() - data.get("_ts", 0) < ANALYSIS_CACHE_TTL:
                logger.info(f"Analysis cache hit: {clean}")
                return StockAnalysisResponse(**data["payload"])
        except Exception:
            pass

    logger.info(f"Building analysis for {clean}...")
    conn = _get_connection()
    try:
        # 1. Fetch quarterly fundamentals (up to 44 quarters = 11 years)
        quarters = _fetch_fundamentals(conn, symbol_md)
        if not quarters:
            raise ValueError(f"No fundamental data found for {clean}")

        # 2. Fetch price history (5 years)
        price_history = _fetch_price_history(conn, symbol_md, years=5)

        # 3. Aggregate quarterly to annual
        annual = _aggregate_annual(quarters)

        # Latest quarter for snapshot values
        latest_q = quarters[0]

        # 4. Build header (Module 1)
        header = {
            "company_name": latest_q.get("company_name", clean),
            "sector": latest_q.get("sector", "Unknown"),
            "industry": latest_q.get("industry", "Unknown"),
            "gic_sector": latest_q.get("gic_sector"),
            "gic_industry": latest_q.get("gic_industry"),
            "exchange": latest_q.get("exchange"),
            "market_cap": latest_q.get("market_cap"),
            "pe_ratio": _safe_round(latest_q.get("pe_ratio")),
            "forward_pe": _safe_round(latest_q.get("forward_pe")),
            "dividend_yield": _safe_round(latest_q.get("dividend_yield"), 4),
            "beta": _safe_round(latest_q.get("beta")),
            "revenue_ttm": _safe_round(latest_q.get("revenue_ttm")),
            "profit_margin": _safe_round(latest_q.get("profit_margin"), 4),
            "operating_margin": _safe_round(latest_q.get("operating_margin_ttm"), 4),
            "roe": _safe_round(latest_q.get("return_on_equity_ttm"), 4),
            "roa": _safe_round(latest_q.get("return_on_assets_ttm"), 4),
            "analyst_target": _safe_round(latest_q.get("analyst_target_price")),
            "analyst_rating": _safe_round(latest_q.get("analyst_rating")),
            "quarters_available": len(quarters),
            "years_available": len(annual),
        }

        # 5. Build all modules
        per_share = _build_per_share_data(annual)
        quality = _build_quality_metrics(annual)
        income_stmt = _build_financial_statement(annual, "income")
        balance_sht = _build_financial_statement(annual, "balance")
        cash_flows = _build_financial_statement(annual, "cashflow")
        growth = _build_growth_rates(annual)
        valuation = _build_valuation(latest_q)
        quality_scores = _build_quality_scores(annual)

        # 6. Build response
        response = StockAnalysisResponse(
            symbol=clean,
            company_name=latest_q.get("company_name", clean),
            header=header,
            price_history=price_history,
            per_share_annual=per_share,
            quality_metrics=quality,
            income_statement=income_stmt,
            balance_sheet=balance_sht,
            cash_flows=cash_flows,
            growth_rates=growth,
            valuation=valuation,
            quality_scores=quality_scores,
        )

        # 7. Cache to /tmp
        try:
            cache_file.write_text(json.dumps({
                "payload": response.dict(),
                "_ts": time.time(),
            }))
        except Exception:
            pass

        logger.info(f"Analysis built for {clean}: {len(annual)} years, {len(quarters)} quarters")
        return response

    finally:
        conn.close()
