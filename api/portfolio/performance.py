"""
JCN Financial Dashboard - Portfolio Performance API
Military-grade Python serverless function for Vercel

This module provides portfolio performance data by:
1. Querying MotherDuck for historical price data and fundamentals
2. Fetching current prices from yfinance
3. Calculating all performance metrics
4. Implementing robust caching and error handling

Author: Manus AI
Last Updated: 2026-02-13
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
import duckdb
import yfinance as yf

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="JCN Portfolio Performance API")

# Cache configuration
CACHE_TTL_MOTHERDUCK = 24 * 60 * 60  # 24 hours
CACHE_TTL_PRICES = 5 * 60  # 5 minutes
cache_store: Dict[str, Dict[str, Any]] = {}


def get_motherduck_connection():
    """
    Establish connection to MotherDuck database.
    
    Returns:
        duckdb.DuckDBPyConnection: Active database connection
        
    Raises:
        Exception: If connection fails
    """
    try:
        token = os.environ.get('MOTHERDUCK_TOKEN')
        if not token:
            raise ValueError("MOTHERDUCK_TOKEN environment variable not set")
        
        conn = duckdb.connect(f'md:?motherduck_token={token}')
        logger.info("Successfully connected to MotherDuck")
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to MotherDuck: {str(e)}")
        raise


def get_from_cache(key: str, ttl: int) -> Optional[Any]:
    """
    Retrieve data from cache if not expired.
    
    Args:
        key: Cache key
        ttl: Time-to-live in seconds
        
    Returns:
        Cached data if valid, None otherwise
    """
    if key in cache_store:
        cached = cache_store[key]
        age = (datetime.now() - cached['timestamp']).total_seconds()
        if age < ttl:
            logger.info(f"Cache hit for {key} (age: {age:.1f}s)")
            return cached['data']
        else:
            logger.info(f"Cache expired for {key} (age: {age:.1f}s)")
            del cache_store[key]
    return None


def set_cache(key: str, data: Any) -> None:
    """
    Store data in cache with timestamp.
    
    Args:
        key: Cache key
        data: Data to cache
    """
    cache_store[key] = {
        'data': data,
        'timestamp': datetime.now()
    }
    logger.info(f"Cached data for {key}")


def query_motherduck_data(symbol: str) -> Optional[Dict[str, Any]]:
    """
    Query MotherDuck for historical data and fundamentals.
    
    Args:
        symbol: Stock ticker (without .US suffix)
        
    Returns:
        Dictionary containing historical data and fundamentals
    """
    cache_key = f"motherduck_{symbol}"
    cached = get_from_cache(cache_key, CACHE_TTL_MOTHERDUCK)
    if cached:
        return cached
    
    try:
        conn = get_motherduck_connection()
        ticker_with_suffix = f"{symbol}.US"
        
        # Query for latest data
        query = f"""
        SELECT 
            symbol,
            date,
            close,
            high,
            low,
            industry
        FROM PROD_EODHD.PROD_EOD_Survivorship
        WHERE symbol = '{ticker_with_suffix}'
        ORDER BY date DESC
        LIMIT 300
        """
        
        result = conn.execute(query).fetchall()
        conn.close()
        
        if not result:
            logger.warning(f"No data found in MotherDuck for {symbol}")
            return None
        
        # Convert to list of dictionaries
        data = []
        for row in result:
            data.append({
                'symbol': row[0],
                'date': row[1],
                'close': float(row[2]) if row[2] else None,
                'high': float(row[3]) if row[3] else None,
                'low': float(row[4]) if row[4] else None,
                'industry': row[5]
            })
        
        result_data = {
            'symbol': symbol,
            'data': data,
            'industry': data[0]['industry'] if data else None
        }
        
        set_cache(cache_key, result_data)
        logger.info(f"Successfully queried MotherDuck for {symbol} ({len(data)} records)")
        return result_data
        
    except Exception as e:
        logger.error(f"Error querying MotherDuck for {symbol}: {str(e)}")
        return None


def fetch_current_price(symbol: str) -> Optional[float]:
    """
    Fetch current price from yfinance with caching.
    
    Args:
        symbol: Stock ticker
        
    Returns:
        Current price or None if fetch fails
    """
    cache_key = f"price_{symbol}"
    cached = get_from_cache(cache_key, CACHE_TTL_PRICES)
    if cached:
        return cached
    
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        price = info.get('currentPrice') or info.get('regularMarketPrice')
        
        if price:
            set_cache(cache_key, price)
            logger.info(f"Fetched current price for {symbol}: ${price:.2f}")
            return float(price)
        else:
            logger.warning(f"No price data available for {symbol}")
            return None
            
    except Exception as e:
        logger.error(f"Error fetching price for {symbol}: {str(e)}")
        return None


def calculate_metrics(historical_data: List[Dict], current_price: float, cost_basis: float) -> Dict[str, Any]:
    """
    Calculate all performance metrics from historical data.
    
    Args:
        historical_data: List of historical price records (sorted DESC by date)
        current_price: Current market price
        cost_basis: User's cost basis
        
    Returns:
        Dictionary of calculated metrics
    """
    try:
        # Sort data by date ascending for calculations
        # Convert date to string if it's a date object
        for d in historical_data:
            if not isinstance(d['date'], str):
                d['date'] = d['date'].isoformat() if hasattr(d['date'], 'isoformat') else str(d['date'])
        sorted_data = sorted(historical_data, key=lambda x: x['date'])
        
        # Get most recent data point
        latest = sorted_data[-1]
        
        # Daily % Change (compare to previous day)
        if len(sorted_data) >= 2:
            prev_close = sorted_data[-2]['close']
            daily_change = ((current_price - prev_close) / prev_close * 100) if prev_close else 0
        else:
            daily_change = 0
        
        # YTD % (from Jan 1 of current year)
        current_year = datetime.now().year
        ytd_data = [d for d in sorted_data if datetime.strptime(d['date'], '%Y-%m-%d').year == current_year]
        if ytd_data:
            ytd_start_price = ytd_data[0]['close']
            ytd_change = ((current_price - ytd_start_price) / ytd_start_price * 100) if ytd_start_price else 0
        else:
            ytd_change = 0
        
        # YoY % (365 days ago)
        one_year_ago = datetime.now() - timedelta(days=365)
        yoy_data = [d for d in sorted_data if datetime.strptime(d['date'], '%Y-%m-%d') <= one_year_ago]
        if yoy_data:
            yoy_start_price = yoy_data[-1]['close']
            yoy_change = ((current_price - yoy_start_price) / yoy_start_price * 100) if yoy_start_price else 0
        else:
            yoy_change = 0
        
        # 52-week high/low
        last_year_data = sorted_data[-252:] if len(sorted_data) >= 252 else sorted_data
        high_52w = max([d['high'] for d in last_year_data if d['high']])
        low_52w = min([d['low'] for d in last_year_data if d['low']])
        
        # % Below 52-week high
        pct_below_high = ((high_52w - current_price) / high_52w * 100) if high_52w else 0
        
        # 52-week channel range
        channel_range = ((current_price - low_52w) / (high_52w - low_52w) * 100) if (high_52w and low_52w and high_52w != low_52w) else 0
        
        # Portfolio gain %
        portfolio_gain = ((current_price - cost_basis) / cost_basis * 100) if cost_basis else 0
        
        return {
            'current_price': round(current_price, 2),
            'daily_change_pct': round(daily_change, 2),
            'ytd_pct': round(ytd_change, 2),
            'yoy_pct': round(yoy_change, 2),
            'portfolio_gain_pct': round(portfolio_gain, 2),
            'pct_below_52w_high': round(pct_below_high, 2),
            'channel_range_52w': round(channel_range, 2)
        }
        
    except Exception as e:
        logger.error(f"Error calculating metrics: {str(e)}")
        return {
            'current_price': current_price,
            'daily_change_pct': 0,
            'ytd_pct': 0,
            'yoy_pct': 0,
            'portfolio_gain_pct': 0,
            'pct_below_52w_high': 0,
            'channel_range_52w': 0
        }


@app.post("/api/portfolio/performance")
async def get_portfolio_performance(request: Request):
    """
    Main API endpoint for portfolio performance data.
    
    Request body:
        {
            "positions": [
                {"symbol": "AAPL", "cost_basis": 150.00, "shares": 100},
                ...
            ]
        }
        
    Returns:
        JSON response with performance data for all positions
    """
    try:
        body = await request.json()
        positions = body.get('positions', [])
        
        if not positions:
            raise HTTPException(status_code=400, detail="No positions provided")
        
        logger.info(f"Processing {len(positions)} positions")
        
        results = []
        total_value = 0
        
        for position in positions:
            symbol = position.get('symbol')
            cost_basis = float(position.get('cost_basis', 0))
            shares = float(position.get('shares', 0))
            
            if not symbol:
                continue
            
            # Get historical data from MotherDuck
            md_data = query_motherduck_data(symbol)
            if not md_data:
                logger.warning(f"Skipping {symbol} - no MotherDuck data")
                continue
            
            # Get current price from yfinance
            current_price = fetch_current_price(symbol)
            if not current_price:
                logger.warning(f"Skipping {symbol} - no current price")
                continue
            
            # Calculate metrics
            metrics = calculate_metrics(md_data['data'], current_price, cost_basis)
            
            # Calculate position value
            position_value = current_price * shares
            total_value += position_value
            
            # Build result
            result = {
                'symbol': symbol,
                'security_name': f"{symbol} Stock",  # Could be enhanced with company name
                'cost_basis': round(cost_basis, 2),
                'shares': shares,
                'sector': 'N/A',  # Sector not available in database
                'industry': md_data['industry'] or 'N/A',
                **metrics
            }
            
            results.append(result)
        
        # Calculate portfolio percentages
        for result in results:
            position_value = result['current_price'] * result['shares']
            result['portfolio_pct'] = round((position_value / total_value * 100), 2) if total_value > 0 else 0
        
        logger.info(f"Successfully processed {len(results)} positions")
        
        return JSONResponse(content={
            'success': True,
            'data': results,
            'total_positions': len(results),
            'total_value': round(total_value, 2),
            'timestamp': datetime.now().isoformat()
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/api/portfolio/health")
async def health_check():
    """Health check endpoint."""
    return JSONResponse(content={
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'cache_size': len(cache_store)
    })


# Vercel serverless function handler
handler = app
