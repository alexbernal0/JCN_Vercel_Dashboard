"""
Stock Prices Module
Fetches historical daily closing prices from MotherDuck for normalized price comparison chart
"""

from pydantic import BaseModel
from typing import List, Dict
from datetime import datetime, timedelta
from .cache_manager import get_cache_manager

class StockPricesRequest(BaseModel):
    """Request model for stock prices"""
    symbols: List[str]

class StockPricesResponse(BaseModel):
    """Response model for stock prices"""
    data: Dict[str, List[Dict[str, any]]]  # {symbol: [{date, close}, ...]}
    start_date: str
    end_date: str
    symbols: List[str]
    timestamp: str

def get_stock_prices(request: StockPricesRequest) -> StockPricesResponse:
    """
    Fetch historical daily closing prices for portfolio stocks
    
    Args:
        request: StockPricesRequest with list of symbols
    
    Returns:
        StockPricesResponse with historical prices for each symbol
    """
    cache_mgr = get_cache_manager()
    
    # Calculate date range (5 years for faster loading)
    # Client can filter to shorter periods, and we can add longer periods later
    end_date = datetime.now()
    start_date = end_date - timedelta(days=5*365)
    
    # Add .US suffix for MotherDuck
    symbols_with_suffix = [f"{symbol}.US" for symbol in request.symbols]
    
    # Fetch from MotherDuck
    price_data = cache_mgr.fetch_historical_prices(
        symbols_with_suffix,
        start_date.strftime('%Y-%m-%d'),
        end_date.strftime('%Y-%m-%d')
    )
    
    return StockPricesResponse(
        data=price_data,
        start_date=start_date.strftime('%Y-%m-%d'),
        end_date=end_date.strftime('%Y-%m-%d'),
        symbols=request.symbols,
        timestamp=datetime.now().isoformat()
    )
