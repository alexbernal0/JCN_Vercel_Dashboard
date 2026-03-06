import os
import time
import json
import asyncio
import duckdb
import requests
from pathlib import Path
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
from pydantic import BaseModel

# Configuration
DB_PATH = os.environ.get('DUCKDB_PATH', 'jcn.duckdb')
CACHE_DIR = Path('/tmp') if os.environ.get('VERCEL') else Path('cache')
CACHE_FILE = CACHE_DIR / 'stage0_cache.json'
CACHE_DURATION = 300  # 5 minutes
OVERALL_TIMEOUT = 55  # Vercel limit is 60s for Hobby plan, give buffer

# Ensure cache directory exists
CACHE_DIR.mkdir(exist_ok=True)

class CheckResult(BaseModel):
    status: str
    message: str
    detail: str = ''

# Executor for sync DB calls in async context
_executor = ThreadPoolExecutor(max_workers=2)

# Timeout wrapper for individual checks
def run_with_timeout(func, timeout=10):
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            elapsed = time.time() - start_time
            return CheckResult(
                status='pass' if result['status'] else 'fail',
                message=f"{func.__name__.replace('check_', '')}: {result['message']}",
                detail=f"Completed in {elapsed:.1f}s"
            )
        except Exception as e:
            elapsed = time.time() - start_time
            return CheckResult(
                status='fail',
                message=f"{func.__name__.replace('check_', '')}: Error - {str(e)}",
                detail=f"Errored after {elapsed:.1f}s"
            )
    return wrapper

# Cache handling
def load_cache():
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, 'r') as f:
                data = json.load(f)
                if time.time() - data.get('timestamp', 0) < CACHE_DURATION:
                    return data.get('results', {})
        except:
            pass
    return None

def save_cache(results):
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump({
                'timestamp': time.time(),
                'results': results
            }, f)
    except:
        pass  # Cache write failure should not crash the run


# Individual check functions with specific exception handling
@run_with_timeout
def check_1_db_connection():
    start = time.time()
    try:
        conn = duckdb.connect(DB_PATH)
        conn.execute("SELECT 1")
        return {'status': True, 'message': f"DB connection successful ({time.time()-start:.1f}s)"}
    except Exception as e:
        return {'status': False, 'message': f"DB connection failed: {str(e)}"}

@run_with_timeout
def check_2_table_existence():
    try:
        conn = duckdb.connect(DB_PATH)
        # O(1) check for table existence, avoid full scan
        tables = conn.execute("SHOW TABLES").fetchall()
        has_table = any('PROD_EOD_survivorship' in row for row in tables)
        if not has_table:
            return {'status': False, 'message': "Table PROD_EOD_survivorship missing - run full sync (Settings -> Force Full Sync)"}
        # Quick sample check instead of COUNT(*)
        sample = conn.execute("SELECT COUNT(*) FROM PROD_EOD_survivorship LIMIT 1").fetchone()
        return {'status': True, 'message': f"Table PROD_EOD_survivorship exists ({sample[0] if sample else 0} rows sampled)"}
    except Exception as e:
        return {'status': False, 'message': f"Table check failed: {str(e)}"}

@run_with_timeout
def check_3_data_freshness():
    try:
        conn = duckdb.connect(DB_PATH)
        # Sample-based freshness check, avoid full table scan
        latest = conn.execute("SELECT MAX(Date) FROM PROD_EOD_survivorship LIMIT 1").fetchone()
        if latest and latest[0]:
            latest_date = datetime.strptime(latest[0], '%Y-%m-%d').date()
            today = datetime.now().date()
            age = (today - latest_date).days
            if age > 3:
                return {'status': False, 'message': f"Data stale: {age} days old - update now (Settings -> Force Full Sync)"}
            return {'status': True, 'message': f"Data fresh: {age} days old"}
        return {'status': False, 'message': "No data found - run full sync (Settings -> Force Full Sync)"}
    except Exception as e:
        return {'status': False, 'message': f"Freshness check failed: {str(e)}"}


@run_with_timeout
def check_4_symbol_format():
    try:
        conn = duckdb.connect(DB_PATH)
        # P0-1: Sample last 30 days instead of full table scan
        thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        invalid = conn.execute(f"""
            SELECT DISTINCT Symbol
            FROM PROD_EOD_survivorship
            WHERE Date >= '{thirty_days_ago}'
            AND Symbol NOT LIKE '%.US'
            LIMIT 5
        """).fetchall()
        if invalid:
            return {'status': False, 'message': f"Invalid symbols found: {', '.join(s[0] for s in invalid)} - correct format at source (EODHD)"}
        return {'status': True, 'message': "All symbols in correct format (last 30 days)"}
    except duckdb.CatalogException as e:
        return {'status': False, 'message': f"Schema error: {str(e)} - verify DB structure"}
    except Exception as e:
        return {'status': False, 'message': f"Symbol format check failed: {str(e)}"}

@run_with_timeout
def check_5_null_values():
    try:
        conn = duckdb.connect(DB_PATH)
        # Sample-based null check, avoid full scan
        nulls = conn.execute("""
            SELECT COUNT(*) AS null_count
            FROM PROD_EOD_survivorship
            WHERE Adjusted_Close IS NULL
            LIMIT 1
        """).fetchone()
        if nulls and nulls[0] > 0:
            return {'status': False, 'message': f"{nulls[0]} NULL values in Adjusted_Close - fill gaps at source (EODHD)"}
        return {'status': True, 'message': "No NULL values in Adjusted_Close (sampled)"}
    except duckdb.CatalogException as e:
        return {'status': False, 'message': f"Schema error: {str(e)} - verify DB structure"}
    except Exception as e:
        return {'status': False, 'message': f"NULL check failed: {str(e)}"}


@run_with_timeout
def check_6_price_validity():
    try:
        conn = duckdb.connect(DB_PATH)
        # Sample-based price check
        invalid = conn.execute("""
            SELECT COUNT(*) AS invalid_count
            FROM PROD_EOD_survivorship
            WHERE Adjusted_Close <= 0
            LIMIT 1
        """).fetchone()
        if invalid and invalid[0] > 0:
            return {'status': False, 'message': f"{invalid[0]} invalid prices (≤0) - correct at source (EODHD)"}
        return {'status': True, 'message': "All prices valid (sampled)"}
    except Exception as e:
        return {'status': False, 'message': f"Price validity check failed: {str(e)}"}

@run_with_timeout
def check_7_volume_validity():
    try:
        conn = duckdb.connect(DB_PATH)
        # Sample-based volume check
        invalid = conn.execute("""
            SELECT COUNT(*) AS invalid_count
            FROM PROD_EOD_survivorship
            WHERE Volume < 0
            LIMIT 1
        """).fetchone()
        if invalid and invalid[0] > 0:
            return {'status': False, 'message': f"{invalid[0]} invalid volumes (<0) - correct at source (EODHD)"}
        return {'status': True, 'message': "All volumes valid (sampled)"}
    except Exception as e:
        return {'status': False, 'message': f"Volume validity check failed: {str(e)}"}

@run_with_timeout
def check_8_duplicates():
    try:
        conn = duckdb.connect(DB_PATH)
        # P2-3: Check for duplicates in primary key
        dups = conn.execute("""
            SELECT Symbol, Date, COUNT(*) as cnt
            FROM PROD_EOD_survivorship
            GROUP BY Symbol, Date
            HAVING cnt > 1
            LIMIT 1
        """).fetchone()
        if dups:
            return {'status': False, 'message': f"Duplicates found for {dups[0]} on {dups[1]} - deduplicate at source"}
        return {'status': True, 'message': "No duplicates found (sampled)"}
    except Exception as e:
        return {'status': False, 'message': f"Duplicate check failed: {str(e)}"}


# Main function - must match signature for api/index.py
async def run_stage0() -> dict:
    overall_start = time.time()
    results = []
    checks = [
        check_1_db_connection,
        check_2_table_existence,
        check_3_data_freshness,
        check_4_symbol_format,
        check_5_null_values,
        check_6_price_validity,
        check_7_volume_validity,
        check_8_duplicates
    ]
    
    # Check cache first
    cached = load_cache()
    if cached:
        return {
            'status': 'cached',
            'results': cached,
            'message': f"Using cached results ({time.time() - overall_start:.1f}s total)",
            'elapsed': time.time() - overall_start
        }
    
    # Run checks with overall timeout
    for check in checks:
        if time.time() - overall_start > OVERALL_TIMEOUT:
            results.append(CheckResult(
                status='fail',
                message=f"Overall budget exceeded ({OVERALL_TIMEOUT}s) - aborted at {check.__name__.replace('check_', '')}",
                detail="Vercel 60s limit hit - run full sync locally if needed"
            ).dict())
            break
        
        # Execute DB calls in thread pool to avoid blocking async context
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(_executor, check)
        results.append(result.dict())
        
        # Early exit on critical failures (DB connection or table missing)
        if check in [check_1_db_connection, check_2_table_existence] and result.status == 'fail':
            results.append(CheckResult(
                status='fail',
                message="Critical failure - stopping remaining checks",
                detail="DB or table issue must be resolved first"
            ).dict())
            break
    
    # Save to cache if successful
    save_cache(results)
    
    overall_status = 'pass' if all(r['status'] == 'pass' for r in results) else 'fail'
    return {
        'status': overall_status,
        'results': results,
        'message': f"Stage 0 completed in {time.time() - overall_start:.1f}s",
        'elapsed': time.time() - overall_start
    }

