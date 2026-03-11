"""
Cache Manager for Portfolio Performance API

ALL DATA FROM MOTHERDUCK - No external APIs!
- Current prices: Latest EOD close from MotherDuck
- Historical data: From MotherDuck PROD_EOD_survivorship + PROD_EOD_ETFs tables
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
        """Fetch ALL data from MotherDuck PROD_DASHBOARD_SNAPSHOT (ONCE per day)

        Tries the pre-computed snapshot table first.  If the table does not
        exist yet (first deploy), falls back to the legacy 5-CTE query with
        adjusted_close and UNION ALL for ETF support.
        """
        import duckdb
        
        # Check if already loaded today AND all tickers are in cache
        with self._lock:
            if self.motherduck_data:
                cache_date = self.motherduck_data.get('cache_date')
                today = datetime.now().strftime('%Y-%m-%d')
                if cache_date == today:
                    cached_data = self.motherduck_data.get('data', {})
                    missing_tickers = [t for t in tickers if f"{t}.US" not in cached_data]
                    
                    if not missing_tickers:
                        logger.info(f"MotherDuck data already loaded for today with all {len(tickers)} tickers, using cache")
                        return cached_data
                    else:
                        logger.info(f"Cache from today but missing {len(missing_tickers)} tickers: {missing_tickers[:5]}...")
                        pass  # Continue to fetch
        
        logger.info(f"Fetching fresh MotherDuck data for {len(tickers)} tickers from PROD_DASHBOARD_SNAPSHOT...")
        
        # Add .US suffix for MotherDuck query
        md_tickers = [f"{t}.US" for t in tickers]
        tickers_str = "', '".join(md_tickers)
        
        motherduck_token = os.getenv('MOTHERDUCK_TOKEN')
        if not motherduck_token:
            raise ValueError("MOTHERDUCK_TOKEN not found in environment")
        
        conn = duckdb.connect(f'md:?motherduck_token={motherduck_token}')
        
        try:
            data = self._fetch_from_snapshot(conn, tickers_str)
            
            # Check if snapshot returned all requested tickers
            missing_from_snapshot = [t for t in md_tickers if t not in data]
            if missing_from_snapshot:
                logger.warning(
                    f"Snapshot missing {len(missing_from_snapshot)} tickers: "
                    f"{missing_from_snapshot[:10]}... Falling back to legacy CTE for those."
                )
                missing_str = "', '".join(missing_from_snapshot)
                fallback_data = self._fetch_legacy_cte(conn, missing_str)
                data.update(fallback_data)
                
        except Exception as snapshot_err:
            logger.warning(f"PROD_DASHBOARD_SNAPSHOT query failed ({snapshot_err}), falling back to legacy 5-CTE query")
            data = self._fetch_legacy_cte(conn, tickers_str)
        finally:
            conn.close()
        
        logger.info(f"Fetched data for {len(data)} tickers from MotherDuck")
        self._save_motherduck_data(data)
        return data

    # ------------------------------------------------------------------
    # Snapshot path (preferred) - single SELECT from pre-computed table
    # ------------------------------------------------------------------
    def _fetch_from_snapshot(self, conn, tickers_str: str) -> Dict:
        """Query PROD_DASHBOARD_SNAPSHOT for all dashboard metrics."""
        query = f"""
        SELECT 
            symbol,
            adjusted_close,
            prev_close,
            ytd_start_price,
            year_ago_price,
            week_52_high,
            week_52_low,
            daily_change_pct,
            ytd_pct,
            yoy_pct,
            pct_below_52wk_high,
            chan_range_pct,
            gics_sector,
            industry,
            market_cap,
            is_etf
        FROM PROD_EODHD.main.PROD_DASHBOARD_SNAPSHOT
        WHERE symbol IN ('{tickers_str}')
        """
        
        result = conn.execute(query).fetchall()
        
        data = {}
        for row in result:
            symbol = row[0]
            data[symbol] = {
                'latest_eod_close': row[1],
                'prev_close': row[2],
                'ytd_start_price': row[3],
                'year_ago_price': row[4],
                'week_52_high': row[5],
                'week_52_low': row[6],
                'daily_change_pct': row[7],
                'ytd_pct': row[8],
                'yoy_pct': row[9],
                'pct_below_52wk_high': row[10],
                'chan_range_pct': row[11],
                'sector': row[12],
                'industry': row[13],
                'market_cap': row[14],
                'is_etf': row[15],
            }
        return data

    # ------------------------------------------------------------------
    # Legacy fallback - 5-CTE join with adjusted_close + ETF UNION ALL
    # ------------------------------------------------------------------
    def _fetch_legacy_cte(self, conn, tickers_str: str) -> Dict:
        """Fallback query when PROD_DASHBOARD_SNAPSHOT does not exist yet."""
        query = f"""
        WITH portfolio_symbols AS (
            SELECT unnest(['{tickers_str}']) as symbol
        ),
        combined_eod AS (
            SELECT symbol, date, adjusted_close, high, low,
                   gics_sector, industry, market_cap
            FROM PROD_EODHD.main.PROD_EOD_survivorship
            WHERE symbol IN (SELECT symbol FROM portfolio_symbols)
            UNION ALL
            SELECT symbol, date, adjusted_close, high, low,
                   NULL as gics_sector, NULL as industry, NULL as market_cap
            FROM PROD_EODHD.main.PROD_EOD_ETFs
            WHERE symbol IN (SELECT symbol FROM portfolio_symbols)
        ),
        latest_eod AS (
            SELECT 
                symbol,
                adjusted_close as latest_eod_close
            FROM combined_eod
            QUALIFY ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) = 1
        ),
        sector_backfill AS (
            SELECT 
                symbol,
                gics_sector,
                industry,
                market_cap
            FROM combined_eod
            WHERE gics_sector IS NOT NULL
            QUALIFY ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) = 1
        ),
        previous_close AS (
            SELECT 
                symbol,
                adjusted_close as prev_close
            FROM combined_eod
            QUALIFY ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) = 2
        ),
        ytd_start AS (
            SELECT 
                symbol,
                adjusted_close as ytd_start_price
            FROM combined_eod
            WHERE date >= DATE_TRUNC('year', CURRENT_DATE)
            QUALIFY ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date ASC) = 1
        ),
        year_ago AS (
            SELECT 
                symbol,
                adjusted_close as year_ago_price
            FROM combined_eod
            WHERE date >= CURRENT_DATE - INTERVAL '1 year'
            QUALIFY ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date ASC) = 1
        ),
        week_52_stats AS (
            SELECT 
                symbol,
                MAX(high) as week_52_high,
                MIN(low) as week_52_low
            FROM combined_eod
            WHERE date >= CURRENT_DATE - INTERVAL '52 weeks'
            GROUP BY symbol
        )
        SELECT 
            l.symbol,
            l.latest_eod_close,
            s.gics_sector,
            s.industry,
            s.market_cap,
            p.prev_close,
            y.ytd_start_price,
            ya.year_ago_price,
            w.week_52_high,
            w.week_52_low
        FROM latest_eod l
        LEFT JOIN sector_backfill s ON l.symbol = s.symbol
        LEFT JOIN previous_close p ON l.symbol = p.symbol
        LEFT JOIN ytd_start y ON l.symbol = y.symbol
        LEFT JOIN year_ago ya ON l.symbol = ya.symbol
        LEFT JOIN week_52_stats w ON l.symbol = w.symbol
        """
        
        result = conn.execute(query).fetchall()
        
        data = {}
        for row in result:
            (symbol, latest_close, sector, industry, market_cap,
             prev_close, ytd_start, year_ago, week_52_high, week_52_low) = row
            
            # Compute derived pct fields client-side for legacy path
            daily_change_pct = None
            if latest_close and prev_close:
                daily_change_pct = round((latest_close - prev_close) / prev_close * 100, 2)
            
            ytd_pct = None
            if latest_close and ytd_start:
                ytd_pct = round((latest_close - ytd_start) / ytd_start * 100, 2)
            
            yoy_pct = None
            if latest_close and year_ago:
                yoy_pct = round((latest_close - year_ago) / year_ago * 100, 2)
            
            pct_below_52wk_high = None
            if latest_close and week_52_high and week_52_high > 0:
                pct_below_52wk_high = round((week_52_high - latest_close) / week_52_high * 100, 2)
            
            chan_range_pct = None
            if latest_close and week_52_high and week_52_low and (week_52_high - week_52_low) > 0:
                chan_range_pct = round((latest_close - week_52_low) / (week_52_high - week_52_low) * 100, 2)
            
            data[symbol] = {
                'latest_eod_close': latest_close,
                'prev_close': prev_close,
                'ytd_start_price': ytd_start,
                'year_ago_price': year_ago,
                'week_52_high': week_52_high,
                'week_52_low': week_52_low,
                'daily_change_pct': daily_change_pct,
                'ytd_pct': ytd_pct,
                'yoy_pct': yoy_pct,
                'pct_below_52wk_high': pct_below_52wk_high,
                'chan_range_pct': chan_range_pct,
                'sector': sector,
                'industry': industry,
                'market_cap': market_cap,
                'is_etf': None,
            }
        return data
    
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
    
    def fetch_historical_prices(self, symbols: List[str], start_date: str, end_date: str) -> Dict:
        """
        Fetch historical daily closing prices from MotherDuck
        
        Args:
            symbols: List of ticker symbols (with .US suffix)
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
        
        Returns:
            Dictionary with symbol as key and list of {date, close} as value
        """
        import duckdb
        
        logger.info(f"Fetching historical prices for {len(symbols)} symbols from {start_date} to {end_date}")
        
        motherduck_token = os.getenv('MOTHERDUCK_TOKEN')
        if not motherduck_token:
            raise ValueError("MOTHERDUCK_TOKEN not found in environment")
        
        conn = duckdb.connect(f'md:?motherduck_token={motherduck_token}')
        
        try:
            symbols_str = "', '".join(symbols)
            
            # Query BOTH survivorship and ETFs with adjusted_close (Bug 7 fix)
            query = f"""
            SELECT symbol, date, adjusted_close as close
            FROM PROD_EODHD.main.PROD_EOD_survivorship
            WHERE symbol IN ('{symbols_str}')
              AND date >= '{start_date}' AND date <= '{end_date}'
            UNION ALL
            SELECT symbol, date, adjusted_close as close
            FROM PROD_EODHD.main.PROD_EOD_ETFs
            WHERE symbol IN ('{symbols_str}')
              AND date >= '{start_date}' AND date <= '{end_date}'
            ORDER BY symbol, date ASC
            """
            
            result = conn.execute(query).fetchall()
            
            price_data = {}
            for row in result:
                symbol, date, close = row
                clean_symbol = symbol.replace('.US', '')
                
                if clean_symbol not in price_data:
                    price_data[clean_symbol] = []
                
                price_data[clean_symbol].append({
                    'date': date.strftime('%Y-%m-%d') if hasattr(date, 'strftime') else str(date),
                    'close': float(close) if close else None
                })
            
            logger.info(f"Fetched {len(result)} price records for {len(price_data)} symbols")
            return price_data
            
        finally:
            conn.close()

    def fetch_weekly_ohlc(self, symbols: List[str], start_date: str, end_date: str) -> Dict:
        """
        Fetch weekly OHLC from MotherDuck (aggregated from daily data).
        Queries BOTH PROD_EOD_survivorship and PROD_EOD_ETFs.
        Uses adjusted_close for the close column (Bug 8 fix).
        """
        import duckdb

        logger.info(f"Fetching weekly OHLC for {len(symbols)} symbols from {start_date} to {end_date}")

        motherduck_token = os.getenv('MOTHERDUCK_TOKEN')
        if not motherduck_token:
            raise ValueError("MOTHERDUCK_TOKEN not found in environment")

        conn = duckdb.connect(f'md:?motherduck_token={motherduck_token}')

        try:
            symbols_str = "', '".join(symbols)
            query = f"""
            WITH daily_data AS (
                SELECT symbol, date, open, high, low, close, adjusted_close
                FROM PROD_EODHD.main.PROD_EOD_survivorship
                WHERE symbol IN ('{symbols_str}')
                  AND date >= '{start_date}' AND date <= '{end_date}'
                UNION ALL
                SELECT symbol, date, open, high, low, close, adjusted_close
                FROM PROD_EODHD.main.PROD_EOD_ETFs
                WHERE symbol IN ('{symbols_str}')
                  AND date >= '{start_date}' AND date <= '{end_date}'
            ),
            ranked AS (
                SELECT
                    symbol,
                    date_trunc('week', date)::date AS week_start,
                    date, open, high, low, adjusted_close,
                    row_number() OVER (PARTITION BY symbol, date_trunc('week', date) ORDER BY date ASC) AS rn_asc,
                    row_number() OVER (PARTITION BY symbol, date_trunc('week', date) ORDER BY date DESC) AS rn_desc
                FROM daily_data
            )
            SELECT
                symbol, week_start,
                max(CASE WHEN rn_asc = 1 THEN open END) AS open,
                max(high) AS high,
                min(low) AS low,
                max(CASE WHEN rn_desc = 1 THEN adjusted_close END) AS close
            FROM ranked
            GROUP BY symbol, week_start
            ORDER BY symbol, week_start ASC
            """
            result = conn.execute(query).fetchall()

            out: Dict[str, list] = {}
            for sym, week_start, o, h, l, c in result:
                clean = sym.replace('.US', '') if sym else sym
                if clean not in out:
                    out[clean] = []
                out[clean].append({
                    'date': week_start.strftime('%Y-%m-%d') if hasattr(week_start, 'strftime') else str(week_start),
                    'open': float(o) if o is not None else None,
                    'high': float(h) if h is not None else None,
                    'low': float(l) if l is not None else None,
                    'close': float(c) if c is not None else None,
                })

            logger.info(f"Fetched weekly OHLC: {sum(len(v) for v in out.values())} bars for {len(out)} symbols")
            return out

        finally:
            conn.close()
    
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
