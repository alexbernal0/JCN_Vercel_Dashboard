"""
Cache Manager for JCN Dashboard
Handles persistent caching of current prices and MotherDuck data
"""

# CRITICAL: Set HOME directory for DuckDB in serverless environment
# DuckDB needs a writable home directory for extensions and config
# Must be set BEFORE importing duckdb
import os
os.environ['HOME'] = '/tmp'

import json
import time
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

# Cache directory
CACHE_DIR = Path("/tmp/jcn_cache")
CURRENT_PRICES_FILE = CACHE_DIR / "current_prices.json"
MOTHERDUCK_DATA_FILE = CACHE_DIR / "motherduck_data.json"

# Cache TTLs
CURRENT_PRICE_TTL = 30 * 60  # 30 minutes
MOTHERDUCK_TTL = 24 * 60 * 60  # 24 hours


class CacheManager:
    """
    Manages two-tier caching:
    1. Current prices (yfinance) - 30 min TTL, auto-refresh
    2. MotherDuck data (historical) - 24 hour TTL, load once per day
    """
    
    def __init__(self):
        """Initialize cache manager and create cache directory"""
        CACHE_DIR.mkdir(exist_ok=True)
        self.current_prices: Dict = self._load_current_prices()
        self.motherduck_data: Optional[Dict] = self._load_motherduck_data()
        self._lock = threading.Lock()
        logger.info("CacheManager initialized")
    
    # ========================================================================
    # CURRENT PRICES (yfinance) - Auto-refresh every 30 min
    # ========================================================================
    
    def _load_current_prices(self) -> Dict:
        """Load current prices from persistent cache"""
        try:
            if CURRENT_PRICES_FILE.exists():
                with open(CURRENT_PRICES_FILE, 'r') as f:
                    data = json.load(f)
                    logger.info(f"Loaded {len(data)} current prices from cache")
                    return data
        except Exception as e:
            logger.error(f"Error loading current prices cache: {e}")
        return {}
    
    def _save_current_prices(self):
        """Save current prices to persistent cache"""
        try:
            with open(CURRENT_PRICES_FILE, 'w') as f:
                json.dump(self.current_prices, f, indent=2)
            logger.info(f"Saved {len(self.current_prices)} current prices to cache")
        except Exception as e:
            logger.error(f"Error saving current prices cache: {e}")
    
    def get_current_price(self, ticker: str) -> Optional[Dict]:
        """
        Get current price from cache
        
        Returns:
            Dict with 'price', 'timestamp', 'last_updated' or None
        """
        with self._lock:
            return self.current_prices.get(ticker)
    
    def get_all_current_prices(self) -> Dict:
        """Get all current prices from cache"""
        with self._lock:
            return self.current_prices.copy()
    
    def update_current_prices(self, tickers: List[str], force: bool = False) -> Dict[str, float]:
        """
        Update current prices from yfinance
        
        Args:
            tickers: List of ticker symbols
            force: If True, force refresh even if cache is fresh
        
        Returns:
            Dict of ticker -> price
        """
        import yfinance as yf
        from concurrent.futures import ThreadPoolExecutor
        
        now = time.time()
        
        # Check if refresh needed
        if not force:
            needs_refresh = []
            for ticker in tickers:
                cached = self.current_prices.get(ticker)
                if not cached or (now - cached['last_updated']) > CURRENT_PRICE_TTL:
                    needs_refresh.append(ticker)
            
            if not needs_refresh:
                logger.info("All current prices are fresh, skipping refresh")
                return {t: self.current_prices[t]['price'] for t in tickers if t in self.current_prices}
            
            tickers = needs_refresh
        
        logger.info(f"Refreshing current prices for {len(tickers)} tickers...")
        
        def fetch_price(ticker: str) -> Optional[tuple]:
            """Fetch current price for a single ticker"""
            try:
                stock = yf.Ticker(ticker)
                # Try 1-minute intraday data first
                hist = stock.history(period="1d", interval="1m")
                if not hist.empty:
                    price = float(hist['Close'].iloc[-1])
                else:
                    # Fallback to daily data
                    hist = stock.history(period="5d")
                    if not hist.empty:
                        price = float(hist['Close'].iloc[-1])
                    else:
                        logger.warning(f"No price data for {ticker}")
                        return None
                
                return (ticker, price)
            except Exception as e:
                logger.error(f"Error fetching price for {ticker}: {e}")
                return None
        
        # Fetch all prices in parallel
        with ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(fetch_price, tickers))
        
        # Update cache
        updated_prices = {}
        with self._lock:
            for result in results:
                if result:
                    ticker, price = result
                    self.current_prices[ticker] = {
                        'price': price,
                        'timestamp': datetime.now().isoformat(),
                        'last_updated': now
                    }
                    updated_prices[ticker] = price
            
            # Save to disk
            self._save_current_prices()
        
        logger.info(f"Updated {len(updated_prices)} current prices")
        return updated_prices
    
    def needs_price_refresh(self, tickers: List[str]) -> bool:
        """Check if any ticker needs price refresh"""
        now = time.time()
        for ticker in tickers:
            cached = self.current_prices.get(ticker)
            if not cached or (now - cached['last_updated']) > CURRENT_PRICE_TTL:
                return True
        return False
    
    # ========================================================================
    # MOTHERDUCK DATA - Load once per day, NEVER manual refresh
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
            Dict with historical data or None
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
        Fetch historical data from MotherDuck (ONCE per day)
        
        This is called ONLY:
        1. On first load of the day
        2. When cache is expired (different day)
        
        NEVER called by manual refresh button!
        
        Args:
            tickers: List of ticker symbols (without .US suffix)
        
        Returns:
            Dict of ticker.US -> historical data
        """
        import duckdb
        
        # Check if already loaded today
        with self._lock:
            if self.motherduck_data:
                cache_date = self.motherduck_data.get('cache_date')
                today = datetime.now().strftime('%Y-%m-%d')
                if cache_date == today:
                    logger.info("MotherDuck data already loaded for today, using cache")
                    return self.motherduck_data['data']
        
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
                AND date >= CURRENT_DATE - INTERVAL '1 year'
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
            
            result = conn.execute(query).df()
            
            # Convert to dictionary
            data = {}
            for _, row in result.iterrows():
                data[row['symbol']] = {
                    'latest_eod_close': float(row['latest_eod_close']) if row['latest_eod_close'] else None,
                    'prev_close': float(row['prev_close']) if row['prev_close'] else None,
                    'ytd_start_price': float(row['ytd_start_price']) if row['ytd_start_price'] else None,
                    'year_ago_price': float(row['year_ago_price']) if row['year_ago_price'] else None,
                    'week_52_high': float(row['week_52_high']) if row['week_52_high'] else None,
                    'week_52_low': float(row['week_52_low']) if row['week_52_low'] else None,
                    'sector': row['gics_sector'] if row['gics_sector'] else 'N/A',
                    'industry': row['industry'] if row['industry'] else 'N/A'
                }
            
            # Save to cache
            self._save_motherduck_data(data)
            
            logger.info(f"Fetched MotherDuck data for {len(data)} tickers")
            return data
            
        finally:
            conn.close()
    
    def is_motherduck_cache_valid(self) -> bool:
        """Check if MotherDuck cache is valid for today"""
        with self._lock:
            if self.motherduck_data:
                cache_date = self.motherduck_data.get('cache_date')
                today = datetime.now().strftime('%Y-%m-%d')
                return cache_date == today
        return False


# Global cache manager instance
cache_manager = CacheManager()
