"""
Portfolio Allocation API Module
Transforms portfolio performance data into pie chart datasets for allocation visualization.
Uses PROD_DASHBOARD_SNAPSHOT data with proper market_cap-based category classification.
"""

import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime
from .cache_manager import get_cache_manager

logger = logging.getLogger(__name__)


class AllocationItem(BaseModel):
    """Single allocation item for pie chart"""
    name: str
    value: float
    ticker: Optional[str] = None


class PortfolioAllocationRequest(BaseModel):
    """Request model for portfolio allocation"""
    portfolio: List[Dict[str, Any]]


class PortfolioAllocationResponse(BaseModel):
    """Response model for portfolio allocation"""
    company: List[AllocationItem]
    category: List[AllocationItem]
    sector: List[AllocationItem]
    industry: List[AllocationItem]
    last_updated: str


def get_category_style(market_cap: Optional[float]) -> str:
    """
    Determine investment category style based on market cap.

    Size: Large (>0B), Mid (B-0B), Small (<B)
    Note: Growth/Value/Blend classification requires PE/PB ratios which are not
    currently in the snapshot table. For now, we classify by size only with
    'Blend' as the default style. This can be enhanced when PE/PB data is added.
    """
    if market_cap is None or market_cap == 0:
        return "Unknown"

    if market_cap >= 200_000_000_000:  # 00B+
        size = "Mega Cap"
    elif market_cap >= 10_000_000_000:  # 0B+
        size = "Large Cap"
    elif market_cap >= 2_000_000_000:  # B - 0B
        size = "Mid Cap"
    elif market_cap >= 300_000_000:  # 00M - B
        size = "Small Cap"
    else:
        size = "Micro Cap"

    return size


def calculate_portfolio_allocation(request: PortfolioAllocationRequest) -> PortfolioAllocationResponse:
    """
    Calculate portfolio allocation for 4 pie charts.

    Args:
        request: Portfolio holdings with symbol, cost_basis, shares

    Returns:
        PortfolioAllocationResponse with data for 4 pie charts
    """
    try:
        portfolio = request.portfolio

        if not portfolio:
            raise ValueError("Portfolio data required")

        # Extract symbols
        symbols = [item["symbol"] for item in portfolio]

        # Get cache manager and fetch MotherDuck data
        cache_mgr = get_cache_manager()

        # Try to get data from cache first, if not available, fetch from MotherDuck
        stock_data = cache_mgr.get_all_motherduck_data()

        # If cache is empty or doesn't have all symbols, fetch from MotherDuck
        if not stock_data or not all(f"{s}.US" in stock_data for s in symbols):
            logger.info("Cache miss or incomplete, fetching from MotherDuck")
            stock_data = cache_mgr.fetch_motherduck_data(symbols)

        # Filter to only requested symbols
        stock_data = {k: v for k, v in stock_data.items() if k.replace(".US", "") in symbols}

        # Create lookup for shares and cost basis
        portfolio_lookup = {item["symbol"]: item for item in portfolio}

        # Initialize data structures
        company_data = []
        category_data: Dict[str, float] = {}
        sector_data: Dict[str, float] = {}
        industry_data: Dict[str, float] = {}

        total_value = 0.0

        # First pass: calculate total portfolio value
        for symbol_key, info in stock_data.items():
            symbol = symbol_key.replace(".US", "")
            if symbol not in portfolio_lookup:
                continue
            shares = portfolio_lookup[symbol]["shares"]
            current_price = info.get("latest_eod_close", 0)
            current_value = current_price * shares
            total_value += current_value

        # Second pass: calculate percentages and group data
        for symbol_key, info in stock_data.items():
            symbol = symbol_key.replace(".US", "")
            if symbol not in portfolio_lookup:
                continue
            shares = portfolio_lookup[symbol]["shares"]
            current_price = info.get("latest_eod_close", 0)
            current_value = current_price * shares

            # Calculate portfolio percentage
            port_pct = (current_value / total_value * 100) if total_value > 0 else 0

            # Get sector and industry from snapshot
            sector = info.get("sector", "N/A")
            industry = info.get("industry", "N/A")
            market_cap = info.get("market_cap")
            is_etf = info.get("is_etf", False)

            # Company allocation
            company_data.append(AllocationItem(
                name=symbol,
                ticker=symbol,
                value=round(port_pct, 2)
            ))

            # Category style allocation (from market_cap)
            if is_etf:
                category = "ETF"
            else:
                category = get_category_style(market_cap)
            if category not in category_data:
                category_data[category] = 0
            category_data[category] += port_pct

            # Sector allocation (skip N/A; ETFs get "ETF" sector)
            if is_etf:
                sector_label = "ETF"
            elif sector and sector != "N/A" and sector != "Unknown":
                sector_label = sector
            else:
                sector_label = None

            if sector_label:
                if sector_label not in sector_data:
                    sector_data[sector_label] = 0
                sector_data[sector_label] += port_pct

            # Industry allocation (skip N/A; ETFs get their symbol as industry)
            if is_etf:
                industry_label = symbol  # ETF ticker as industry
            elif industry and industry != "N/A" and industry != "Unknown":
                industry_label = industry
            else:
                industry_label = None

            if industry_label:
                if industry_label not in industry_data:
                    industry_data[industry_label] = 0
                industry_data[industry_label] += port_pct

        # Convert dictionaries to arrays for pie charts
        category_array = [AllocationItem(name=k, value=round(v, 2)) for k, v in category_data.items()]
        sector_array = [AllocationItem(name=k, value=round(v, 2)) for k, v in sector_data.items()]
        industry_array = [AllocationItem(name=k, value=round(v, 2)) for k, v in industry_data.items()]

        return PortfolioAllocationResponse(
            company=company_data,
            category=category_array,
            sector=sector_array,
            industry=industry_array,
            last_updated=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Error calculating portfolio allocation: {e}", exc_info=True)
        raise
