"""
Portfolio Allocation API Module
Transforms portfolio performance data into pie chart datasets for allocation visualization.
"""

import logging
from typing import List, Dict, Any
from pydantic import BaseModel
from datetime import datetime
from .cache_manager import get_cache_manager

logger = logging.getLogger(__name__)

class AllocationItem(BaseModel):
    """Single allocation item for pie chart"""
    name: str
    value: float
    ticker: str | None = None

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

def get_category_style(market_cap: float | None, pe_ratio: float | None, pb_ratio: float | None) -> str:
    """
    Determine investment category style based on market cap and valuation metrics.
    
    Logic from Streamlit:
    - Size: Large (>$10B), Mid ($2B-$10B), Small (<$2B)
    - Style: Growth (PE>25 or PB>3), Value (PE<15 and PB<2), Blend (other)
    """
    # Determine size category
    if market_cap is None or market_cap == 0:
        return 'Unknown'
    
    if market_cap >= 10_000_000_000:  # $10B+
        size = 'Large'
    elif market_cap >= 2_000_000_000:  # $2B - $10B
        size = 'Mid'
    else:
        size = 'Small'
    
    # Determine growth/value style
    if pe_ratio is not None and pb_ratio is not None:
        if pe_ratio > 25 or pb_ratio > 3:
            style = 'Growth'
        elif pe_ratio < 15 and pb_ratio < 2:
            style = 'Value'
        else:
            style = 'Blend'
    else:
        style = 'Blend'
    
    return f"{size} {style}"

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
            raise ValueError('Portfolio data required')
        
        # Extract symbols
        symbols = [item['symbol'] for item in portfolio]
        
        # Get cache manager and fetch MotherDuck data
        cache_mgr = get_cache_manager()
        
        # Try to get data from cache first, if not available, fetch from MotherDuck
        stock_data = cache_mgr.get_all_motherduck_data()
        
        # If cache is empty or doesn't have all symbols, fetch from MotherDuck
        if not stock_data or not all(f"{s}.US" in stock_data for s in symbols):
            logger.info("Cache miss or incomplete, fetching from MotherDuck")
            stock_data = cache_mgr.fetch_motherduck_data(symbols)
        
        # Filter to only requested symbols
        stock_data = {k: v for k, v in stock_data.items() if k.replace('.US', '') in symbols}
        
        # Create lookup for shares and cost basis
        portfolio_lookup = {item['symbol']: item for item in portfolio}
        
        # Initialize data structures
        company_data = []
        category_data: Dict[str, float] = {}
        sector_data: Dict[str, float] = {}
        industry_data: Dict[str, float] = {}
        
        total_value = 0.0
        
        # First pass: calculate total portfolio value
        for symbol_key, info in stock_data.items():
            symbol = symbol_key.replace('.US', '')
            if symbol not in portfolio_lookup:
                continue
            shares = portfolio_lookup[symbol]['shares']
            current_price = info.get('latest_eod_close', 0)
            current_value = current_price * shares
            total_value += current_value
        
        # Second pass: calculate percentages and group data
        for symbol_key, info in stock_data.items():
            symbol = symbol_key.replace('.US', '')
            if symbol not in portfolio_lookup:
                continue
            shares = portfolio_lookup[symbol]['shares']
            current_price = info.get('latest_eod_close', 0)
            current_value = current_price * shares
            
            # Calculate portfolio percentage
            port_pct = (current_value / total_value * 100) if total_value > 0 else 0
            
            # Get sector and industry
            sector = info.get('sector', 'N/A')
            industry = info.get('industry', 'N/A')
            
            # Company allocation
            company_data.append(AllocationItem(
                name=symbol,
                ticker=symbol,
                value=round(port_pct, 2)
            ))
            
            # Category style allocation
            # For now, default to Large Growth since we don't have market cap/PE/PB in cache yet
            # TODO: Add these fields to MotherDuck query
            category = 'Large Growth'
            if category not in category_data:
                category_data[category] = 0
            category_data[category] += port_pct
            
            # Sector allocation (skip N/A)
            if sector and sector != 'N/A' and sector != 'Unknown':
                if sector not in sector_data:
                    sector_data[sector] = 0
                sector_data[sector] += port_pct
            
            # Industry allocation (skip N/A)
            if industry and industry != 'N/A' and industry != 'Unknown':
                if industry not in industry_data:
                    industry_data[industry] = 0
                industry_data[industry] += port_pct
        
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
