"""
Benchmarks API Endpoint

Calculates portfolio performance vs. benchmark (SPY) using MotherDuck data.

Calculations:
1. Portfolio Est. Daily % Change - Weighted average of portfolio holdings
2. Benchmark Est. Daily % Change - SPY daily change from MotherDuck
3. Est. Daily Alpha - Portfolio return minus benchmark return
"""

import os
from datetime import datetime
from typing import List, Dict, Any
from pydantic import BaseModel
import duckdb

# Set HOME environment variable for DuckDB in serverless
os.environ['HOME'] = '/tmp'


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


async def calculate_benchmarks(request: BenchmarksRequest) -> BenchmarksResponse:
    """
    Calculate portfolio benchmarks: portfolio return, benchmark return, and alpha.
    
    Parameters:
    -----------
    request : BenchmarksRequest
        Contains list of portfolio holdings
    
    Returns:
    --------
    BenchmarksResponse
        Contains portfolio_daily_change, benchmark_daily_change, daily_alpha
    """
    # Calculate portfolio daily change
    portfolio_result = calculate_portfolio_daily_change(request.holdings)
    portfolio_daily_change = portfolio_result['daily_change']
    
    # Get SPY (benchmark) daily change
    spy_result = get_spy_daily_change()
    benchmark_daily_change = spy_result['daily_change']
    benchmark_date = spy_result['date'] or 'N/A'
    
    # Calculate alpha (excess return over benchmark)
    daily_alpha = round(portfolio_daily_change - benchmark_daily_change, 2)
    
    return BenchmarksResponse(
        portfolio_daily_change=portfolio_daily_change,
        benchmark_daily_change=benchmark_daily_change,
        daily_alpha=daily_alpha,
        last_updated=datetime.now().isoformat(),
        benchmark_symbol='SPY',
        benchmark_date=benchmark_date
    )
