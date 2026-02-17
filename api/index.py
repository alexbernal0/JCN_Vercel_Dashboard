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
            "/api/benchmarks": "POST - Get portfolio benchmarks (vs SPY)",
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


# Vercel serverless function handler
# Vercel natively supports ASGI - just export the FastAPI app directly
# NO Mangum or adapters needed!
