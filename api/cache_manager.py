"""
Cache Manager for Portfolio Performance API

ALL DATA FROM MOTHERDUCK - No external APIs!
- Current prices: Latest EOD close from MotherDuck
- Historical data: From MotherDuck PROD_EOD_survivorship table
- Caching: 24hr for all data (refreshes once per day)
"""

import os
import json
import time
import logging
from pathlib import Path
from datetime import datetime
from threading import Lock
from typing import Dict, List, Optional

# Set HOME to /tmp for DuckDB in serverless environment
os.environ['HOME'] = '/tmp'

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache configuration
CACHE_DIR = Path('/tmp/jcn_cache')
CACHE_DIR.mkdir(exist_ok=True)

MOTHERDUCK_DATA_FILE = CACHE_DIR / 'motherduck_data.json'

# Cache TTLs
MOTHERDUCK_TTL = 24 * 60 * 60  # 24 hours (refreshes once per day)


class CacheManager:
    """Manages caching for portfolio performance data - ALL FROM MOTHERDUCK"""
    
    def __init__(self):
        self._lock = Lock()
        self.motherduck_data = self._load_motherduck_data()
    
    # ========================================================================
    # MOTHERDUCK DATA - Load once per day, includes current prices!
    # ========================================================================
    
    def _load_motherduck_data(self) -> Optional[Dict]:
        """Load MotherDuck data from cache"""
        try:
            if MOTHERDUCK_DATA_FILE.exists():
                with open(MOTHERDUCK_DATA_FILE, 'r') as f:
                    cache = json.load(f)
                    
                    # Check if cache is from today
                    cache_date = cache.get('cache_date')
                    today = datetime.now().strftime('%Y-%m-%d')
                    
                    if cache_date == today:
                        logger.info(f"MotherDuck cache loaded (from {cache_date})")
                        return cache
                    else:
                        logger.info(f"MotherDuck cache expired (from {cache_date}, today is {today})")
        except Exception as e:
            logger.error(f"Error loading MotherDuck cache: {e}")
        
        return None
    
    def _save_motherduck_data(self, data: Dict):
        """Save MotherDuck data to persistent cache"""
        try:
            cache = {
                'cache_date': datetime.now().strftime('%Y-%m-%d'),
                'loaded_at': datetime.now().isoformat(),
                'data': data
            }
            
            with open(MOTHERDUCK_DATA_FILE, 'w') as f:
                json.dump(cache, f, indent=2)
            
            with self._lock:
                self.motherduck_data = cache
            
            logger.info(f"MotherDuck data cached for {cache['cache_date']}")
        except Exception as e:
            logger.error(f"Error saving MotherDuck cache: {e}")
    
    def get_motherduck_data(self, ticker: str) -> Optional[Dict]:
        """
        Get MotherDuck data from cache for a specific ticker
        
        Args:
            ticker: Ticker symbol (without .US suffix)
        
        Returns:
            Dict with historical data AND current price (latest_eod_close)
        """
        with self._lock:
            if self.motherduck_data:
                return self.motherduck_data['data'].get(f"{ticker}.US")
        return None
    
    def get_all_motherduck_data(self) -> Optional[Dict]:
        """Get all MotherDuck data from cache"""
        with self._lock:
            if self.motherduck_data:
                return self.motherduck_data['data'].copy()
        return None
    
    def fetch_motherduck_data(self, tickers: List[str]) -> Dict:
        """
        Fetch ALL data from MotherDuck (ONCE per day)
        
        This includes:
        - Current price (latest EOD close)
        - Previous close
        - YTD start price
        - Year ago price
        - 52-week high/low
        - Sector/Industry
        
        Called ONLY:
        1. On first load of the day
        2. When cache is expired (different day)
        
        Args:
            tickers: List of ticker symbols (without .US suffix)
        
        Returns:
            Dict of ticker.US -> all data including current price
        """
        import duckdb
        
        # Check if already loaded today AND all tickers are in cache
        with self._lock:
            if self.motherduck_data:
                cache_date = self.motherduck_data.get('cache_date')
                today = datetime.now().strftime('%Y-%m-%d')
                if cache_date == today:
                    # Check if ALL requested tickers are in cache
                    cached_data = self.motherduck_data.get('data', {})
                    missing_tickers = [t for t in tickers if f"{t}.US" not in cached_data]
                    
                    if not missing_tickers:
                        logger.info(f"MotherDuck data already loaded for today with all {len(tickers)} tickers, using cache")
                        return cached_data
                    else:
                        logger.info(f"Cache from today but missing {len(missing_tickers)} tickers: {missing_tickers[:5]}...")
                        # Fetch ALL tickers (including cached ones) to ensure consistency
                        pass  # Continue to fetch
        
        logger.info(f"Fetching fresh MotherDuck data for {len(tickers)} tickers (once per day)...")
        
        # Add .US suffix for MotherDuck query
        md_tickers = [f"{t}.US" for t in tickers]
        tickers_str = "', '".join(md_tickers)
        
        # Connect to MotherDuck
        motherduck_token = os.getenv('MOTHERDUCK_TOKEN')
        if not motherduck_token:
            raise ValueError("MOTHERDUCK_TOKEN not found in environment")
        
        # Connect to MotherDuck
        # HOME env var is set at module level to /tmp for serverless compatibility
        conn = duckdb.connect(f'md:?motherduck_token={motherduck_token}')
        
        try:
            # Single optimized query for all stocks
            query = f"""
            WITH portfolio_symbols AS (
                SELECT unnest(['{tickers_str}']) as symbol
            ),
            latest_eod AS (
                SELECT 
                    symbol,
                    close as latest_eod_close,
                    gics_sector,
                    industry
                FROM PROD_EODHD.main.PROD_EOD_survivorship
                WHERE symbol IN (SELECT symbol FROM portfolio_symbols)
                AND date = (SELECT MAX(date) FROM PROD_EODHD.main.PROD_EOD_survivorship)
            ),
            previous_close AS (
                SELECT 
                    symbol,
                    close as prev_close
                FROM PROD_EODHD.main.PROD_EOD_survivorship
                WHERE symbol IN (SELECT symbol FROM portfolio_symbols)
                AND date = (SELECT MAX(date) - INTERVAL '1 day' FROM PROD_EODHD.main.PROD_EOD_survivorship)
            ),
            ytd_start AS (
                SELECT 
                    symbol,
                    close as ytd_start_price
                FROM PROD_EODHD.main.PROD_EOD_survivorship
                WHERE symbol IN (SELECT symbol FROM portfolio_symbols)
                AND date >= '2026-01-01'
                QUALIFY ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date ASC) = 1
            ),
            year_ago AS (
                SELECT 
                    symbol,
                    close as year_ago_price
                FROM PROD_EODHD.main.PROD_EOD_survivorship
                WHERE symbol IN (SELECT symbol FROM portfolio_symbols)
                AND date >= CURRENT_DATE - INTERVAL '1 year'
                QUALIFY ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date ASC) = 1
            ),
            week_52_stats AS (
                SELECT 
                    symbol,
                    MAX(high) as week_52_high,
                    MIN(low) as week_52_low
                FROM PROD_EODHD.main.PROD_EOD_survivorship
                WHERE symbol IN (SELECT symbol FROM portfolio_symbols)
                AND date >= CURRENT_DATE - INTERVAL '52 weeks'
                GROUP BY symbol
            )
            SELECT 
                l.symbol,
                l.latest_eod_close,
                l.gics_sector,
                l.industry,
                p.prev_close,
                y.ytd_start_price,
                ya.year_ago_price,
                w.week_52_high,
                w.week_52_low
            FROM latest_eod l
            LEFT JOIN previous_close p ON l.symbol = p.symbol
            LEFT JOIN ytd_start y ON l.symbol = y.symbol
            LEFT JOIN year_ago ya ON l.symbol = ya.symbol
            LEFT JOIN week_52_stats w ON l.symbol = w.symbol
            """
            
            result = conn.execute(query).fetchall()
            
            # Build data dictionary
            data = {}
            for row in result:
                symbol, latest_close, sector, industry, prev_close, ytd_start, year_ago, week_52_high, week_52_low = row
                
                data[symbol] = {
                    'latest_eod_close': latest_close,  # THIS IS THE CURRENT PRICE!
                    'prev_close': prev_close,
                    'ytd_start_price': ytd_start,
                    'year_ago_price': year_ago,
                    'week_52_high': week_52_high,
                    'week_52_low': week_52_low,
                    'sector': sector,
                    'industry': industry
                }
            
            logger.info(f"Fetched data for {len(data)} tickers from MotherDuck")
            
            # Save to cache
            self._save_motherduck_data(data)
            
            return data
            
        finally:
            conn.close()
    
    def get_current_price(self, ticker: str) -> Optional[float]:
        """
        Get current price for a ticker (latest EOD close from MotherDuck)
        
        Args:
            ticker: Ticker symbol (without .US suffix)
        
        Returns:
            Current price (latest EOD close) or None
        """
        md_data = self.get_motherduck_data(ticker)
        if md_data and 'latest_eod_close' in md_data:
            return md_data['latest_eod_close']
        return None
    
    def get_cache_info(self) -> Dict:
        """Get cache status information"""
        with self._lock:
            if self.motherduck_data:
                return {
                    'motherduck_cache_date': self.motherduck_data.get('cache_date'),
                    'motherduck_loaded_at': self.motherduck_data.get('loaded_at'),
                    'tickers_count': len(self.motherduck_data.get('data', {})),
                    'source': 'MotherDuck (includes current prices)'
                }
            else:
                return {
                    'motherduck_cache_date': None,
                    'motherduck_loaded_at': None,
                    'tickers_count': 0,
                    'source': 'MotherDuck (not loaded yet)'
                }


# Global cache manager instance
_cache_manager = None

def get_cache_manager() -> CacheManager:
    """Get or create the global cache manager instance"""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = CacheManager()
    return _cache_manager
