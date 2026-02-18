"""
JCN Financial Dashboard - Portfolio Performance API
FastAPI-based serverless function for Vercel

This module provides portfolio performance data by:
1. Querying MotherDuck for historical price data and fundamentals
2. Fetching current prices from yfinance
3. Calculating all performance metrics with persistent caching
4. Implementing robust error handling

Author: Manus AI
Last Updated: 2026-02-16
Architecture: FastAPI (Official Vercel Standard)
"""

import os
from pathlib import Path

# Load .env and .env.local from project root (for local dev; Vercel injects env at runtime)
try:
    from dotenv import load_dotenv
    _root = Path(__file__).resolve().parent.parent
    load_dotenv(_root / ".env")
    load_dotenv(_root / ".env.local")
except Exception:
    pass

import logging
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Import portfolio performance module
from .portfolio_performance import (
    PortfolioRequest,
    PortfolioPerformanceResponse,
    calculate_portfolio_performance
)

# Import benchmarks module
from .benchmarks import (
    BenchmarksRequest,
    BenchmarksResponse,
    calculate_benchmarks
)

# Import portfolio allocation module
from .portfolio_allocation import (
    PortfolioAllocationRequest,
    PortfolioAllocationResponse,
    calculate_portfolio_allocation
)

# Import stock prices module
from .stock_prices_module import (
    StockPricesRequest,
    StockPricesResponse,
    get_stock_prices
)

# Import portfolio fundamentals (scores) module
from .portfolio_fundamentals import (
    PortfolioFundamentalsRequest,
    PortfolioFundamentalsResponse,
    get_portfolio_fundamentals
)

# Import portfolio trends data (weekly OHLC) module
from .portfolio_trends_data import (
    PortfolioTrendsRequest,
    PortfolioTrendsResponse,
    get_portfolio_trends_data
)

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


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": "JCN Portfolio Performance API",
        "version": "2.0.0",
        "status": "operational",
        "endpoints": {
            "/api/portfolio/performance": "POST - Get portfolio performance data",
            "/api/portfolio/allocation": "POST - Get portfolio allocation for pie charts",
            "/api/portfolio/fundamentals": "POST - Get portfolio fundamentals (OBQ + Momentum scores)",
            "/api/portfolio/trends-data": "POST - Get weekly OHLC for portfolio trends charts",
            "/api/benchmarks": "POST - Get portfolio benchmarks (vs SPY)",
            "/api/stock/prices": "POST - Get historical stock prices for chart",
            "/api/health": "GET - Health check"
        }
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    # Check if MotherDuck token is available
    motherduck_token = os.getenv('MOTHERDUCK_TOKEN')
    
    return {
        "status": "healthy",
        "motherduck_configured": bool(motherduck_token),
        "timestamp": "2026-02-16"
    }


@app.post("/api/portfolio/performance", response_model=PortfolioPerformanceResponse)
async def get_portfolio_performance(
    request: PortfolioRequest,
    force_refresh: bool = Query(False, description="Force refresh current prices")
):
    """
    Get portfolio performance data
    
    This endpoint:
    1. Loads MotherDuck historical data (cached 24 hours, loaded once per day)
    2. Fetches current prices from yfinance (cached 30 min, auto-refresh)
    3. Calculates all performance metrics
    
    Args:
        request: Portfolio holdings (symbol, cost_basis, shares)
        force_refresh: If True, force refresh current prices (for "Refresh Data" button)
    
    Returns:
        PortfolioPerformanceResponse with calculated metrics for each stock
    
    Notes:
        - MotherDuck data is NEVER refreshed by force_refresh (only at start of new day)
        - force_refresh ONLY updates current prices from yfinance
        - Auto-refresh happens every 30 minutes for current prices
    """
    try:
        logger.info(f"Portfolio performance request: {len(request.holdings)} holdings, force_refresh={force_refresh}")
        
        result = calculate_portfolio_performance(request, force_refresh=force_refresh)
        
        logger.info(f"Portfolio performance calculated: {len(result.data)} stocks, total value: ${result.total_portfolio_value:,.2f}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error calculating portfolio performance: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error calculating portfolio performance: {str(e)}")


@app.post("/api/portfolio/allocation", response_model=PortfolioAllocationResponse)
async def get_portfolio_allocation(request: PortfolioAllocationRequest):
    """
    Get portfolio allocation data for 4 pie charts.
    
    This endpoint calculates:
    1. Company Allocation - Individual stock percentages
    2. Category Style Allocation - Large/Mid/Small Growth/Value/Blend
    3. Sector Allocation - GICS sector groupings
    4. Industry Allocation - Industry groupings
    
    Args:
        request: Portfolio holdings (symbol, cost_basis, shares)
    
    Returns:
        PortfolioAllocationResponse with data for 4 pie charts
    """
    try:
        logger.info(f"Portfolio allocation request: {len(request.portfolio)} holdings")
        
        result = calculate_portfolio_allocation(request)
        
        logger.info(f"Portfolio allocation calculated: {len(result.company)} companies, {len(result.sector)} sectors")
        
        return result
        
    except Exception as e:
        logger.error(f"Error calculating portfolio allocation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error calculating portfolio allocation: {str(e)}")


@app.post("/api/benchmarks", response_model=BenchmarksResponse)
async def get_benchmarks(
    request: BenchmarksRequest,
    force_refresh: bool = Query(False, description="Force refresh benchmarks data")
):
    """
    Get portfolio benchmarks vs SPY
    
    This endpoint calculates:
    1. Portfolio Est. Daily % Change - Weighted average of portfolio holdings
    2. Benchmark Est. Daily % Change - SPY daily change from MotherDuck
    3. Est. Daily Alpha - Portfolio return minus benchmark return
    
    All data comes from MotherDuck (no external APIs).
    
    Args:
        request: Portfolio holdings (symbol, cost_basis, shares)
    
    Returns:
        BenchmarksResponse with portfolio_daily_change, benchmark_daily_change, daily_alpha
    """
    try:
        logger.info(f"Benchmarks request: {len(request.holdings)} holdings")
        
        result = await calculate_benchmarks(request, force_refresh=force_refresh)
        
        logger.info(f"Benchmarks calculated: portfolio={result.portfolio_daily_change}%, benchmark={result.benchmark_daily_change}%, alpha={result.daily_alpha}%")
        
        return result
        
    except Exception as e:
        logger.error(f"Error calculating benchmarks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error calculating benchmarks: {str(e)}")


@app.post("/api/portfolio/fundamentals", response_model=PortfolioFundamentalsResponse)
async def get_portfolio_fundamentals_endpoint(request: PortfolioFundamentalsRequest):
    """
    Get latest OBQ and Momentum scores for portfolio symbols.
    One row per symbol, one column per score (from PROD_OBQ_Scores and PROD_OBQ_Momentum_Scores).
    """
    try:
        logger.info(f"Portfolio fundamentals request: {len(request.symbols)} symbols")
        result = get_portfolio_fundamentals(request)
        logger.info(f"Portfolio fundamentals: {len(result.data)} rows, {len(result.score_columns)} score columns")
        return result
    except Exception as e:
        logger.error(f"Error fetching portfolio fundamentals: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/portfolio/trends-data", response_model=PortfolioTrendsResponse)
async def get_portfolio_trends_data_endpoint(request: PortfolioTrendsRequest):
    """
    Get weekly OHLC for portfolio symbols for trends grid (candlestick + regression + drawdown).
    """
    try:
        logger.info(f"Portfolio trends data request: {len(request.symbols)} symbols")
        result = get_portfolio_trends_data(request)
        logger.info(f"Portfolio trends data: {len(result.data)} symbols")
        return result
    except Exception as e:
        logger.error(f"Error fetching portfolio trends data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/stock/prices", response_model=StockPricesResponse)
async def get_historical_stock_prices(request: StockPricesRequest):
    """
    Get historical daily closing prices for portfolio stocks.
    
    This endpoint fetches up to 20 years of daily closing prices from MotherDuck
    for all stocks in the portfolio. The client can then filter by time period
    without additional API calls.
    
    Args:
        request: List of stock symbols
    
    Returns:
        StockPricesResponse with historical prices for each symbol
    """
    try:
        logger.info(f"Stock prices request: {len(request.symbols)} symbols")
        
        result = get_stock_prices(request)
        
        logger.info(f"Stock prices fetched: {len(result.data)} symbols")
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching stock prices: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching stock prices: {str(e)}")


# Vercel serverless function handler
# Vercel natively supports ASGI - just export the FastAPI app directly
# NO Mangum or adapters needed!
