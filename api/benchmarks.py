"""
Benchmarks API Endpoint
Calculates portfolio performance vs. benchmark (SPY) using MotherDuck data.
Single connection, batch queries, 24-hour caching.
"""

import os
import json
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import duckdb

os.environ['HOME'] = '/tmp'

CACHE_DIR = '/tmp/jcn_cache'
BENCHMARKS_CACHE_FILE = f'{CACHE_DIR}/benchmarks_data.json'


class HoldingInput(BaseModel):
    symbol: str
    cost_basis: float
    shares: int


class BenchmarksRequest(BaseModel):
    holdings: List[HoldingInput]


class BenchmarksResponse(BaseModel):
    portfolio_daily_change: float
    benchmark_daily_change: float
    daily_alpha: float
    last_updated: str
    benchmark_symbol: str
    benchmark_date: str
    cache_info: Dict[str, Any]


def ensure_cache_dir():
    os.makedirs(CACHE_DIR, exist_ok=True)


def load_cached_benchmarks() -> Optional[Dict[str, Any]]:
    """Load cached benchmarks data if available and fresh (same day)."""
    try:
        if not os.path.exists(BENCHMARKS_CACHE_FILE):
            return None
        with open(BENCHMARKS_CACHE_FILE, 'r') as f:
            cache = json.load(f)
        cache_date = cache.get('cache_date')
        today = str(date.today())
        if cache_date == today:
            return cache
        return None
    except Exception:
        return None


def save_benchmarks_cache(data: Dict[str, Any]):
    """Save benchmarks data to cache."""
    try:
        ensure_cache_dir()
        cache = {
            'cache_date': str(date.today()),
            'loaded_at': datetime.now().isoformat(),
            'data': data
        }
        with open(BENCHMARKS_CACHE_FILE, 'w') as f:
            json.dump(cache, f, indent=2)
    except Exception:
        pass


def _fetch_live_price(symbol: str, api_key: str) -> dict:
    """Fetch real-time price + previousClose from EODHD for a single symbol.
    Returns {'close': float, 'previousClose': float} or empty dict on failure."""
    import urllib.request

    url = f"https://eodhd.com/api/real-time/{symbol}.US?api_token={api_key}&fmt=json"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "JCN-Dashboard/2.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        return {
            'close': float(data['close']) if data.get('close') is not None else None,
            'previousClose': float(data['previousClose']) if data.get('previousClose') is not None else None,
        }
    except Exception:
        return {}


def _fetch_benchmarks_batch(holdings: List[HoldingInput]) -> Dict[str, Any]:
    """
    Fetch ALL benchmark data using live EODHD prices (current) vs previousClose.
    Falls back to MotherDuck EOD data if EODHD_API_KEY is not set.

    Returns dict with:
    - portfolio_daily_change: weighted average daily change (live price vs prev close)
    - benchmark_daily_change: SPY daily change (live vs prev close)
    - daily_alpha: portfolio - benchmark
    - benchmark_date: "live" or date of DB data
    """
    api_key = os.getenv('EODHD_API_KEY', '')

    # ------- Primary path: EODHD live prices -------
    if api_key:
        all_symbols = list(set([h.symbol for h in holdings] + ['SPY']))

        # Fetch all live prices concurrently via ThreadPool
        from concurrent.futures import ThreadPoolExecutor
        prices = {}
        with ThreadPoolExecutor(max_workers=10) as pool:
            futures = {pool.submit(_fetch_live_price, sym, api_key): sym for sym in all_symbols}
            for future in futures:
                sym = futures[future]
                try:
                    prices[sym] = future.result(timeout=15)
                except Exception:
                    prices[sym] = {}

        # SPY benchmark
        spy = prices.get('SPY', {})
        spy_current = spy.get('close', 0) or 0
        spy_previous = spy.get('previousClose', 0) or 0
        benchmark_daily_change = 0.0
        if spy_previous and spy_previous != 0:
            benchmark_daily_change = round(((spy_current - spy_previous) / spy_previous) * 100, 4)

        # Portfolio weighted daily change
        total_value = 0.0
        weighted_change = 0.0

        for holding in holdings:
            sym_prices = prices.get(holding.symbol, {})
            current = sym_prices.get('close')
            previous = sym_prices.get('previousClose')

            if current and current > 0:
                position_value = current * holding.shares
                total_value += position_value

                if previous and previous > 0:
                    daily_change = ((current - previous) / previous) * 100
                else:
                    daily_change = 0.0

                weighted_change += position_value * daily_change

        portfolio_daily_change = round(weighted_change / total_value, 4) if total_value > 0 else 0.0
        daily_alpha = round(portfolio_daily_change - benchmark_daily_change, 4)

        return {
            'portfolio_daily_change': portfolio_daily_change,
            'benchmark_daily_change': benchmark_daily_change,
            'daily_alpha': daily_alpha,
            'benchmark_symbol': 'SPY',
            'benchmark_date': 'live',
        }

    # ------- Fallback: MotherDuck EOD (last 2 trading days) -------
    token = os.getenv('MOTHERDUCK_TOKEN')
    if not token:
        raise ValueError("Neither EODHD_API_KEY nor MOTHERDUCK_TOKEN found in environment")

    conn = duckdb.connect(f'md:?motherduck_token={token}')

    try:
        # Build list of ALL symbols we need (holdings + SPY)
        all_symbols = list(set([f"{h.symbol}.US" for h in holdings] + ["SPY.US"]))
        symbols_str = "', '".join(all_symbols)

        # Single query: get last 2 trading days for ALL symbols from BOTH tables
        query = f"""
        WITH combined AS (
            SELECT symbol, date, adjusted_close
            FROM PROD_EODHD.main.PROD_EOD_survivorship
            WHERE symbol IN ('{symbols_str}')
            UNION ALL
            SELECT symbol, date, adjusted_close
            FROM PROD_EODHD.main.PROD_EOD_ETFs
            WHERE symbol IN ('{symbols_str}')
        ),
        ranked AS (
            SELECT symbol, date, adjusted_close,
                   ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) as rn
            FROM combined
        )
        SELECT symbol, date, adjusted_close, rn
        FROM ranked
        WHERE rn <= 2
        ORDER BY symbol, rn
        """

        rows = conn.execute(query).fetchall()

        # Build lookup: symbol -> {current_price, previous_price, date}
        prices = {}
        for symbol, dt, adj_close, rn in rows:
            if symbol not in prices:
                prices[symbol] = {}
            if rn == 1:
                prices[symbol]['current'] = adj_close
                prices[symbol]['date'] = str(dt)
            elif rn == 2:
                prices[symbol]['previous'] = adj_close

        # Calculate SPY benchmark daily change
        spy = prices.get('SPY.US', {})
        spy_current = spy.get('current', 0)
        spy_previous = spy.get('previous', 0)
        benchmark_daily_change = 0.0
        benchmark_date = spy.get('date', 'N/A')
        if spy_previous and spy_previous != 0:
            benchmark_daily_change = round(((spy_current - spy_previous) / spy_previous) * 100, 4)

        # Calculate portfolio weighted daily change
        total_value = 0.0
        weighted_change = 0.0

        for holding in holdings:
            md_symbol = f"{holding.symbol}.US"
            sym_prices = prices.get(md_symbol, {})
            current = sym_prices.get('current')
            previous = sym_prices.get('previous')

            if current:
                position_value = current * holding.shares
                total_value += position_value

                if previous and previous != 0:
                    daily_change = ((current - previous) / previous) * 100
                else:
                    daily_change = 0.0

                weighted_change += position_value * daily_change

        portfolio_daily_change = round(weighted_change / total_value, 4) if total_value > 0 else 0.0
        daily_alpha = round(portfolio_daily_change - benchmark_daily_change, 4)

        return {
            'portfolio_daily_change': portfolio_daily_change,
            'benchmark_daily_change': benchmark_daily_change,
            'daily_alpha': daily_alpha,
            'benchmark_symbol': 'SPY',
            'benchmark_date': benchmark_date,
        }

    finally:
        conn.close()


async def calculate_benchmarks(request: BenchmarksRequest, force_refresh: bool = False) -> BenchmarksResponse:
    """Calculate portfolio benchmarks: portfolio return, benchmark return, and alpha."""
    # Try cache first
    cached = load_cached_benchmarks()
    if cached and not force_refresh:
        data = cached['data']
        return BenchmarksResponse(
            portfolio_daily_change=data['portfolio_daily_change'],
            benchmark_daily_change=data['benchmark_daily_change'],
            daily_alpha=data['daily_alpha'],
            last_updated=cached['loaded_at'],
            benchmark_symbol=data['benchmark_symbol'],
            benchmark_date=data['benchmark_date'],
            cache_info={'cache_hit': True, 'cache_date': cached['cache_date'], 'loaded_at': cached['loaded_at']}
        )
    
    # Cache miss — calculate fresh
    result = _fetch_benchmarks_batch(request.holdings)
    
    # Save to cache
    save_benchmarks_cache(result)
    
    return BenchmarksResponse(
        portfolio_daily_change=result['portfolio_daily_change'],
        benchmark_daily_change=result['benchmark_daily_change'],
        daily_alpha=result['daily_alpha'],
        last_updated=datetime.now().isoformat(),
        benchmark_symbol='SPY',
        benchmark_date=result['benchmark_date'],
        cache_info={'cache_hit': False, 'cache_date': str(date.today()), 'loaded_at': datetime.now().isoformat()}
    )

