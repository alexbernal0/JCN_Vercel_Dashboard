"""
JCN Financial Dashboard - Portfolio Performance API
FastAPI-based serverless function for Vercel

This module provides portfolio performance data by:
1. Querying MotherDuck for historical price data and fundamentals
2. Fetching current prices from yfinance
3. Calculating all performance metrics with async parallel processing
4. Implementing robust caching and error handling

Author: Manus AI
Last Updated: 2026-02-15
Architecture: FastAPI (Official Vercel Standard)
"""

import os
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import duckdb
import yfinance as yf

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="JCN Portfolio Performance API",
    description="Portfolio performance tracking with MotherDuck and yfinance",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache configuration
CACHE_TTL_MOTHERDUCK = 24 * 60 * 60  # 24 hours
CACHE_TTL_PRICES = 5 * 60  # 5 minutes
cache_store: Dict[str, Dict[str, Any]] = {}


# Pydantic Models
class Holding(BaseModel):
    """Model for a single portfolio holding."""
    symbol: str = Field(..., description="Stock symbol (e.g., AAPL)")
    cost_basis: float = Field(..., gt=0, description="Cost basis per share")
    shares: int = Field(..., gt=0, description="Number of shares")


class PortfolioRequest(BaseModel):
    """Request model for portfolio performance endpoint."""
    holdings: List[Holding] = Field(..., min_items=1, description="List of portfolio holdings")


class PositionMetrics(BaseModel):
    """Model for position performance metrics."""
    symbol: str
    security_name: str
    cost_basis: float
    shares: int
    sector: str
    industry: str
    current_price: float
    daily_change_pct: float
    ytd_change_pct: float
    yoy_change_pct: float
    week_52_high: float
    week_52_low: float
    channel_range_52w: float
    portfolio_pct: float = 0.0


class PortfolioResponse(BaseModel):
    """Response model for portfolio performance endpoint."""
    success: bool
    data: List[PositionMetrics]
    total_positions: int
    total_value: float
    timestamp: str


class HealthResponse(BaseModel):
    """Response model for health check endpoint."""
    status: str
    timestamp: str
    cache_size: int


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


def set_cache(key: str, data: Any):
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


def get_motherduck_data(symbol: str) -> Dict[str, Any]:
    """
    Fetch historical data and fundamentals from MotherDuck.
    
    Args:
        symbol: Stock symbol (without .US suffix)
        
    Returns:
        Dictionary containing historical prices and fundamental data
    """
    cache_key = f"md_{symbol}"
    cached = get_from_cache(cache_key, CACHE_TTL_MOTHERDUCK)
    if cached:
        return cached
    
    try:
        conn = get_motherduck_connection()
        
        # Query historical prices (last 2 years for YoY calculation)
        symbol_with_suffix = f"{symbol}.US"
        query = """
        SELECT 
            date,
            adjusted_close as price
        FROM PROD_EODHD.PROD_EOD_Survivorship
        WHERE code = ?
            AND date >= CURRENT_DATE - INTERVAL '2 years'
        ORDER BY date DESC
        """
        
        prices_df = conn.execute(query, [symbol_with_suffix]).fetchdf()
        
        # Query fundamentals
        fundamentals_query = """
        SELECT 
            industry,
            sector
        FROM PROD_EODHD.PROD_EOD_Fundamentals
        WHERE code = ?
        LIMIT 1
        """
        
        fundamentals_df = conn.execute(fundamentals_query, [symbol_with_suffix]).fetchdf()
        
        conn.close()
        
        result = {
            'prices': prices_df.to_dict('records') if not prices_df.empty else [],
            'industry': fundamentals_df['industry'].iloc[0] if not fundamentals_df.empty else None,
            'sector': fundamentals_df['sector'].iloc[0] if not fundamentals_df.empty else None
        }
        
        set_cache(cache_key, result)
        return result
        
    except Exception as e:
        logger.error(f"Error fetching MotherDuck data for {symbol}: {str(e)}")
        return {'prices': [], 'industry': None, 'sector': None}


def get_current_price(symbol: str) -> Optional[float]:
    """
    Fetch current price from yfinance.
    
    Args:
        symbol: Stock symbol
        
    Returns:
        Current price or None if unavailable
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
            logger.info(f"Fetched current price for {symbol}: ${price}")
            return price
        else:
            logger.warning(f"No current price available for {symbol}")
            return None
            
    except Exception as e:
        logger.error(f"Error fetching current price for {symbol}: {str(e)}")
        return None


def calculate_metrics(symbol: str, cost_basis: float, shares: int, md_data: Dict) -> Dict[str, Any]:
    """
    Calculate all performance metrics for a position.
    
    Args:
        symbol: Stock symbol
        cost_basis: Cost basis per share
        shares: Number of shares
        md_data: MotherDuck data containing historical prices
        
    Returns:
        Dictionary of calculated metrics
    """
    # Get current price
    current_price = get_current_price(symbol)
    if not current_price:
        return {
            'current_price': 0,
            'daily_change_pct': 0,
            'ytd_change_pct': 0,
            'yoy_change_pct': 0,
            'week_52_high': 0,
            'week_52_low': 0,
            'channel_range_52w': 0
        }
    
    prices = md_data.get('prices', [])
    if not prices:
        return {
            'current_price': round(current_price, 2),
            'daily_change_pct': 0,
            'ytd_change_pct': 0,
            'yoy_change_pct': 0,
            'week_52_high': 0,
            'week_52_low': 0,
            'channel_range_52w': 0
        }
    
    # Sort prices by date
    prices_sorted = sorted(prices, key=lambda x: x['date'], reverse=True)
    
    # Calculate daily change
    daily_change_pct = 0
    if len(prices_sorted) >= 2:
        yesterday_price = prices_sorted[1]['price']
        daily_change_pct = ((current_price - yesterday_price) / yesterday_price * 100) if yesterday_price else 0
    
    # Calculate YTD change
    ytd_change_pct = 0
    current_year = datetime.now().year
    ytd_prices = [p for p in prices_sorted if datetime.fromisoformat(str(p['date'])).year == current_year]
    if ytd_prices:
        ytd_start_price = ytd_prices[-1]['price']
        ytd_change_pct = ((current_price - ytd_start_price) / ytd_start_price * 100) if ytd_start_price else 0
    
    # Calculate YoY change
    yoy_change_pct = 0
    one_year_ago = datetime.now() - timedelta(days=365)
    yoy_prices = [p for p in prices_sorted if datetime.fromisoformat(str(p['date'])) <= one_year_ago]
    if yoy_prices:
        yoy_price = yoy_prices[0]['price']
        yoy_change_pct = ((current_price - yoy_price) / yoy_price * 100) if yoy_price else 0
    
    # Calculate 52-week high/low
    fifty_two_weeks_ago = datetime.now() - timedelta(days=365)
    recent_prices = [p['price'] for p in prices_sorted if datetime.fromisoformat(str(p['date'])) >= fifty_two_weeks_ago]
    
    week_52_high = max(recent_prices) if recent_prices else current_price
    week_52_low = min(recent_prices) if recent_prices else current_price
    
    # Calculate channel range
    channel_range_52w = 0
    if week_52_high > week_52_low:
        channel_range_52w = ((current_price - week_52_low) / (week_52_high - week_52_low) * 100)
    
    return {
        'current_price': round(current_price, 2),
        'daily_change_pct': round(daily_change_pct, 2),
        'ytd_change_pct': round(ytd_change_pct, 2),
        'yoy_change_pct': round(yoy_change_pct, 2),
        'week_52_high': round(week_52_high, 2),
        'week_52_low': round(week_52_low, 2),
        'channel_range_52w': round(channel_range_52w, 2)
    }


def process_single_holding(holding: Holding) -> Optional[Dict[str, Any]]:
    """
    Process a single holding with all data fetching and calculations.
    
    Args:
        holding: Holding object with symbol, cost_basis, and shares
        
    Returns:
        Complete position data or None if invalid
    """
    try:
        symbol = holding.symbol.upper()
        cost_basis = holding.cost_basis
        shares = holding.shares
        
        # Fetch data from MotherDuck
        md_data = get_motherduck_data(symbol)
        
        # Calculate metrics
        metrics = calculate_metrics(symbol, cost_basis, shares, md_data)
        
        # Build result
        result = {
            'symbol': symbol,
            'security_name': f"{symbol} Stock",
            'cost_basis': round(cost_basis, 2),
            'shares': shares,
            'sector': md_data.get('sector') or 'N/A',
            'industry': md_data.get('industry') or 'N/A',
            **metrics
        }
        
        logger.info(f"Processed {symbol} successfully")
        return result
        
    except Exception as e:
        logger.error(f"Error processing holding {holding.symbol}: {str(e)}")
        return None


@app.post("/api/portfolio/performance", response_model=PortfolioResponse)
async def portfolio_performance(request: PortfolioRequest):
    """
    Portfolio performance endpoint.
    Accepts POST requests with holdings data and returns performance metrics.
    Uses parallel processing for faster execution.
    """
    try:
        holdings = request.holdings
        
        logger.info(f"Processing {len(holdings)} positions in parallel")
        
        # Process holdings in parallel using ThreadPoolExecutor
        # (yfinance and duckdb are synchronous, so we use threads)
        results = []
        loop = asyncio.get_event_loop()
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [loop.run_in_executor(executor, process_single_holding, holding) for holding in holdings]
            completed_results = await asyncio.gather(*futures)
            
            # Filter out None results
            results = [r for r in completed_results if r is not None]
        
        if not results:
            raise HTTPException(status_code=400, detail="No valid holdings could be processed")
        
        # Calculate total value
        total_value = sum(r['current_price'] * r['shares'] for r in results)
        
        # Calculate portfolio percentages
        for result in results:
            position_value = result['current_price'] * result['shares']
            result['portfolio_pct'] = round((position_value / total_value * 100), 2) if total_value > 0 else 0
        
        logger.info(f"Successfully processed {len(results)} positions")
        
        return PortfolioResponse(
            success=True,
            data=results,
            total_positions=len(results),
            total_value=round(total_value, 2),
            timestamp=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        cache_size=len(cache_store)
    )


@app.get("/api/test")
async def hello_world():
    """Test endpoint from template."""
    return {"message": "Hello from FastAPI!", "framework": "FastAPI", "version": "2.0.0"}


# Export for Vercel (modern Python runtime supports ASGI natively)
# No Mangum needed - Vercel automatically detects and wraps the FastAPI app
