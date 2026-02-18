"""
Benchmarks API Endpoint

Calculates portfolio performance vs. benchmark (SPY) using MotherDuck data.
Implements 24-hour caching for fast loading (same as Portfolio Performance).

Calculations:
1. Portfolio Est. Daily % Change - Weighted average of portfolio holdings
2. Benchmark Est. Daily % Change - SPY daily change from MotherDuck
3. Est. Daily Alpha - Portfolio return minus benchmark return
"""

import os
import json
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import duckdb

# Set HOME environment variable for DuckDB in serverless
os.environ['HOME'] = '/tmp'

# Cache directory
CACHE_DIR = '/tmp/jcn_cache'
BENCHMARKS_CACHE_FILE = f'{CACHE_DIR}/benchmarks_data.json'


class HoldingInput(BaseModel):
    """Portfolio holding input model"""
    symbol: str
    cost_basis: float
    shares: int


class BenchmarksRequest(BaseModel):
    """Request model for benchmarks calculation"""
    holdings: List[HoldingInput]


class BenchmarksResponse(BaseModel):
    """Response model for benchmarks calculation"""
    portfolio_daily_change: float
    benchmark_daily_change: float
    daily_alpha: float
    last_updated: str
    benchmark_symbol: str
    benchmark_date: str
    cache_info: Dict[str, Any]


def ensure_cache_dir():
    """Ensure cache directory exists"""
    os.makedirs(CACHE_DIR, exist_ok=True)


def load_cached_benchmarks() -> Optional[Dict[str, Any]]:
    """
    Load cached benchmarks data if available and fresh (same day).
    
    Returns:
    --------
    Optional[dict]
        Cached data if available and fresh, None otherwise
    """
    try:
        if not os.path.exists(BENCHMARKS_CACHE_FILE):
            return None
        
        with open(BENCHMARKS_CACHE_FILE, 'r') as f:
            cache = json.load(f)
        
        # Check if cache is from today
        cache_date = cache.get('cache_date')
        today = str(date.today())
        
        if cache_date == today:
            print(f"✅ Using cached benchmarks data from {cache_date}")
            return cache
        else:
            print(f"⚠️ Cache expired (cache: {cache_date}, today: {today})")
            return None
            
    except Exception as e:
        print(f"Error loading cached benchmarks: {e}")
        return None


def save_benchmarks_cache(data: Dict[str, Any]):
    """
    Save benchmarks data to cache.
    
    Parameters:
    -----------
    data : dict
        Benchmarks data to cache
    """
    try:
        ensure_cache_dir()
        
        cache = {
            'cache_date': str(date.today()),
            'loaded_at': datetime.now().isoformat(),
            'data': data
        }
        
        with open(BENCHMARKS_CACHE_FILE, 'w') as f:
            json.dump(cache, f, indent=2)
        
        print(f"✅ Benchmarks data cached to {BENCHMARKS_CACHE_FILE}")
        
    except Exception as e:
        print(f"Error saving benchmarks cache: {e}")


def get_spy_daily_change() -> Dict[str, Any]:
    """
    Get SPY's daily percentage change from MotherDuck.
    
    Returns:
    --------
    dict
        Contains 'daily_change', 'date', 'current_price', 'previous_price'
    """
    try:
        token = os.getenv('MOTHERDUCK_TOKEN')
        if not token:
            raise ValueError("MOTHERDUCK_TOKEN not found in environment")
        
        conn = duckdb.connect(f'md:PROD_EODHD?motherduck_token={token}')
        
        # Get last 2 trading days of SPY data
        query = """
            SELECT date, close
            FROM PROD_EODHD.main.PROD_EOD_ETFs
            WHERE symbol = 'SPY.US'
            ORDER BY date DESC
            LIMIT 2
        """
        
        result = conn.execute(query).fetchall()
        conn.close()
        
        if len(result) < 2:
            return {
                'daily_change': 0.0,
                'date': None,
                'current_price': None,
                'previous_price': None,
                'error': 'Insufficient SPY data'
            }
        
        # Most recent is first (DESC order)
        current_date, current_price = result[0]
        previous_date, previous_price = result[1]
        
        # Calculate daily percentage change
        daily_change = ((current_price - previous_price) / previous_price) * 100
        
        return {
            'daily_change': round(daily_change, 2),
            'date': str(current_date),
            'current_price': current_price,
            'previous_price': previous_price
        }
        
    except Exception as e:
        print(f"Error fetching SPY data: {e}")
        return {
            'daily_change': 0.0,
            'date': None,
            'current_price': None,
            'previous_price': None,
            'error': str(e)
        }


def get_stock_daily_change(symbol: str) -> float:
    """
    Get a stock's daily percentage change from MotherDuck.
    
    Parameters:
    -----------
    symbol : str
        Stock ticker symbol (without .US suffix)
    
    Returns:
    --------
    float
        Daily percentage change
    """
    try:
        token = os.getenv('MOTHERDUCK_TOKEN')
        if not token:
            return 0.0
        
        conn = duckdb.connect(f'md:PROD_EODHD?motherduck_token={token}')
        
        # Add .US suffix for MotherDuck query
        md_symbol = f"{symbol}.US"
        
        # Get last 2 trading days
        query = """
            SELECT date, adjusted_close
            FROM PROD_EODHD.main.PROD_EOD_survivorship
            WHERE symbol = ?
            ORDER BY date DESC
            LIMIT 2
        """
        
        result = conn.execute(query, [md_symbol]).fetchall()
        conn.close()
        
        if len(result) < 2:
            return 0.0
        
        current_price = result[0][1]
        previous_price = result[1][1]
        
        if previous_price == 0:
            return 0.0
        
        daily_change = ((current_price - previous_price) / previous_price) * 100
        return round(daily_change, 2)
        
    except Exception as e:
        print(f"Error fetching {symbol} data: {e}")
        return 0.0


def calculate_portfolio_daily_change(holdings: List[HoldingInput]) -> Dict[str, Any]:
    """
    Calculate portfolio's weighted daily percentage change.
    
    Formula:
    Portfolio Daily Change = Σ (Portfolio Weight × Stock Daily Change)
    
    Parameters:
    -----------
    holdings : List[HoldingInput]
        List of portfolio holdings with symbol, cost_basis, shares
    
    Returns:
    --------
    dict
        Contains 'daily_change', 'total_value', 'holdings_detail'
    """
    try:
        # First, get current prices and calculate position values
        holdings_detail = []
        total_value = 0.0
        
        for holding in holdings:
            # Get current price from MotherDuck
            token = os.getenv('MOTHERDUCK_TOKEN')
            if not token:
                continue
            
            conn = duckdb.connect(f'md:PROD_EODHD?motherduck_token={token}')
            md_symbol = f"{holding.symbol}.US"
            
            query = """
                SELECT adjusted_close
                FROM PROD_EODHD.main.PROD_EOD_survivorship
                WHERE symbol = ?
                ORDER BY date DESC
                LIMIT 1
            """
            
            result = conn.execute(query, [md_symbol]).fetchone()
            conn.close()
            
            if result:
                current_price = result[0]
                position_value = current_price * holding.shares
                total_value += position_value
                
                # Get daily change for this stock
                daily_change = get_stock_daily_change(holding.symbol)
                
                holdings_detail.append({
                    'symbol': holding.symbol,
                    'shares': holding.shares,
                    'current_price': current_price,
                    'position_value': position_value,
                    'daily_change': daily_change
                })
        
        if total_value == 0:
            return {
                'daily_change': 0.0,
                'total_value': 0.0,
                'holdings_detail': []
            }
        
        # Calculate weighted daily change
        weighted_change = 0.0
        for detail in holdings_detail:
            weight = detail['position_value'] / total_value
            weighted_change += weight * detail['daily_change']
        
        return {
            'daily_change': round(weighted_change, 2),
            'total_value': total_value,
            'holdings_detail': holdings_detail
        }
        
    except Exception as e:
        print(f"Error calculating portfolio daily change: {e}")
        return {
            'daily_change': 0.0,
            'total_value': 0.0,
            'holdings_detail': [],
            'error': str(e)
        }


async def calculate_benchmarks(request: BenchmarksRequest, force_refresh: bool = False) -> BenchmarksResponse:
    """
    Calculate portfolio benchmarks: portfolio return, benchmark return, and alpha.
    
    Implements 24-hour caching:
    - Loads cached data if available and fresh (same day)
    - Only queries MotherDuck if cache is missing or expired
    - force_refresh parameter is ignored (cache always used if available)
    
    Parameters:
    -----------
    request : BenchmarksRequest
        Contains list of portfolio holdings
    force_refresh : bool
        Ignored - benchmarks always use cached data if available (same day)
    
    Returns:
    --------
    BenchmarksResponse
        Contains portfolio_daily_change, benchmark_daily_change, daily_alpha
    """
    # Try to load from cache first
    cached = load_cached_benchmarks()
    
    if cached and not force_refresh:
        # Use cached data
        data = cached['data']
        return BenchmarksResponse(
            portfolio_daily_change=data['portfolio_daily_change'],
            benchmark_daily_change=data['benchmark_daily_change'],
            daily_alpha=data['daily_alpha'],
            last_updated=cached['loaded_at'],
            benchmark_symbol=data['benchmark_symbol'],
            benchmark_date=data['benchmark_date'],
            cache_info={
                'cache_hit': True,
                'cache_date': cached['cache_date'],
                'loaded_at': cached['loaded_at']
            }
        )
    
    # Cache miss or force refresh - calculate fresh data
    print("⚠️ Cache miss - calculating fresh benchmarks data from MotherDuck")
    
    # Calculate portfolio daily change
    portfolio_result = calculate_portfolio_daily_change(request.holdings)
    portfolio_daily_change = portfolio_result['daily_change']
    
    # Get SPY (benchmark) daily change
    spy_result = get_spy_daily_change()
    benchmark_daily_change = spy_result['daily_change']
    benchmark_date = spy_result['date'] or 'N/A'
    
    # Calculate alpha (excess return over benchmark)
    daily_alpha = round(portfolio_daily_change - benchmark_daily_change, 2)
    
    # Prepare response data
    response_data = {
        'portfolio_daily_change': portfolio_daily_change,
        'benchmark_daily_change': benchmark_daily_change,
        'daily_alpha': daily_alpha,
        'benchmark_symbol': 'SPY',
        'benchmark_date': benchmark_date
    }
    
    # Save to cache
    save_benchmarks_cache(response_data)
    
    return BenchmarksResponse(
        portfolio_daily_change=portfolio_daily_change,
        benchmark_daily_change=benchmark_daily_change,
        daily_alpha=daily_alpha,
        last_updated=datetime.now().isoformat(),
        benchmark_symbol='SPY',
        benchmark_date=benchmark_date,
        cache_info={
            'cache_hit': False,
            'cache_date': str(date.today()),
            'loaded_at': datetime.now().isoformat()
        }
    )
