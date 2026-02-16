"""
Portfolio Performance API Endpoint
Calculates portfolio performance metrics using MotherDuck + yfinance
"""

import logging
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import HTTPException

from .cache_manager import cache_manager

logger = logging.getLogger(__name__)


class Holding(BaseModel):
    """Portfolio holding model"""
    symbol: str = Field(..., description="Stock ticker symbol")
    cost_basis: float = Field(..., description="Purchase price per share")
    shares: float = Field(..., description="Number of shares owned")


class PortfolioRequest(BaseModel):
    """Portfolio performance request model"""
    holdings: List[Holding] = Field(..., description="List of portfolio holdings")


class PortfolioPerformanceData(BaseModel):
    """Portfolio performance response data for a single stock"""
    security: str = Field(..., description="Company name")
    ticker: str = Field(..., description="Stock ticker symbol")
    cost_basis: float = Field(..., description="User's cost basis")
    current_price: float = Field(..., description="Current price from yfinance")
    port_pct: float = Field(..., description="Percentage of total portfolio")
    daily_change_pct: float = Field(..., description="Daily percentage change")
    ytd_pct: float = Field(..., description="Year-to-date percentage change")
    yoy_pct: float = Field(..., description="Year-over-year percentage change")
    port_gain_pct: float = Field(..., description="Portfolio gain percentage")
    pct_below_52wk_high: float = Field(..., description="Percentage below 52-week high")
    chan_range_pct: float = Field(..., description="52-week channel range percentage")
    sector: str = Field(..., description="GICS sector")
    industry: str = Field(..., description="Industry classification")


class PortfolioPerformanceResponse(BaseModel):
    """Portfolio performance response model"""
    data: List[PortfolioPerformanceData]
    total_portfolio_value: float
    last_updated: str
    cache_info: Dict[str, Any]


def calculate_portfolio_performance(
    request: PortfolioRequest,
    force_refresh: bool = False
) -> PortfolioPerformanceResponse:
    """
    Calculate portfolio performance metrics
    
    Args:
        request: Portfolio holdings request
        force_refresh: If True, force refresh current prices (for manual refresh button)
    
    Returns:
        PortfolioPerformanceResponse with all calculated metrics
    """
    tickers = [h.symbol for h in request.holdings]
    
    logger.info(f"Processing portfolio performance for {len(tickers)} tickers (force_refresh={force_refresh})")
    
    # Step 1: Ensure MotherDuck data is loaded (once per day, cached)
    if not cache_manager.is_motherduck_cache_valid():
        logger.info("MotherDuck cache invalid or expired, fetching fresh data...")
        cache_manager.fetch_motherduck_data(tickers)
    else:
        logger.info("MotherDuck cache valid, using cached data")
    
    # Step 2: Get/Update current prices (auto 30 min, or manual refresh)
    if force_refresh or cache_manager.needs_price_refresh(tickers):
        logger.info("Refreshing current prices...")
        cache_manager.update_current_prices(tickers, force=force_refresh)
    else:
        logger.info("Current prices are fresh, using cache")
    
    # Step 3: Calculate metrics for each holding
    results = []
    total_portfolio_value = 0.0
    
    for holding in request.holdings:
        ticker = holding.symbol
        
        # Get current price
        price_data = cache_manager.get_current_price(ticker)
        if not price_data:
            logger.warning(f"No current price data for {ticker}, skipping")
            continue
        
        current_price = price_data['price']
        
        # Get MotherDuck data
        md = cache_manager.get_motherduck_data(ticker)
        if not md:
            logger.warning(f"No MotherDuck data for {ticker}, skipping")
            continue
        
        # Calculate position value
        position_value = current_price * holding.shares
        total_portfolio_value += position_value
        
        # Calculate metrics
        daily_change_pct = 0.0
        if md['prev_close']:
            daily_change_pct = ((current_price - md['prev_close']) / md['prev_close'] * 100)
        
        ytd_pct = 0.0
        if md['ytd_start_price']:
            ytd_pct = ((current_price - md['ytd_start_price']) / md['ytd_start_price'] * 100)
        
        yoy_pct = 0.0
        if md['year_ago_price']:
            yoy_pct = ((current_price - md['year_ago_price']) / md['year_ago_price'] * 100)
        
        port_gain_pct = ((current_price - holding.cost_basis) / holding.cost_basis * 100)
        
        pct_below_52wk_high = 0.0
        if md['week_52_high']:
            pct_below_52wk_high = ((md['week_52_high'] - current_price) / md['week_52_high'] * 100)
        
        chan_range_pct = 0.0
        if md['week_52_high'] and md['week_52_low'] and md['week_52_high'] != md['week_52_low']:
            chan_range_pct = ((current_price - md['week_52_low']) / (md['week_52_high'] - md['week_52_low']) * 100)
        
        # Get company name (use ticker as fallback)
        security = ticker  # TODO: Add company name lookup from fundamentals
        
        results.append({
            'security': security,
            'ticker': ticker,
            'cost_basis': holding.cost_basis,
            'current_price': current_price,
            'position_value': position_value,
            'daily_change_pct': round(daily_change_pct, 2),
            'ytd_pct': round(ytd_pct, 2),
            'yoy_pct': round(yoy_pct, 2),
            'port_gain_pct': round(port_gain_pct, 2),
            'pct_below_52wk_high': round(pct_below_52wk_high, 2),
            'chan_range_pct': round(chan_range_pct, 1),
            'sector': md['sector'],
            'industry': md['industry']
        })
    
    # Calculate portfolio percentages
    for result in results:
        if total_portfolio_value > 0:
            result['port_pct'] = round((result['position_value'] / total_portfolio_value * 100), 2)
        else:
            result['port_pct'] = 0.0
        # Remove position_value from response (internal use only)
        del result['position_value']
    
    # Get cache info
    motherduck_cache = cache_manager.motherduck_data
    cache_info = {
        'motherduck_cache_date': motherduck_cache.get('cache_date') if motherduck_cache else None,
        'motherduck_loaded_at': motherduck_cache.get('loaded_at') if motherduck_cache else None,
        'current_prices_count': len(cache_manager.get_all_current_prices()),
        'refresh_mode': 'forced' if force_refresh else 'auto'
    }
    
    from datetime import datetime
    
    return PortfolioPerformanceResponse(
        data=results,
        total_portfolio_value=round(total_portfolio_value, 2),
        last_updated=datetime.now().isoformat(),
        cache_info=cache_info
    )
