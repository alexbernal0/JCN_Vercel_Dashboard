"""
Reusable Caching Utilities for JCN Financial Dashboard

This module provides a standardized caching system for all API endpoints.
All new modules MUST use these utilities to ensure consistent caching behavior.

Version: 1.0.0
Last Updated: February 17, 2026
"""

import os
import json
from datetime import datetime, date
from pathlib import Path
from typing import Callable, Any, Optional
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache directory configuration
CACHE_DIR = Path("/tmp/jcn_cache")
CACHE_DIR.mkdir(exist_ok=True, parents=True)

# Cache duration (24 hours = 1 day)
CACHE_DURATION_HOURS = 24


def get_cache_file_path(module_name: str) -> Path:
    """
    Get the cache file path for a specific module.
    
    Args:
        module_name: Unique identifier for the module (e.g., 'portfolio_performance', 'benchmarks')
    
    Returns:
        Path object pointing to the cache file
    
    Example:
        >>> path = get_cache_file_path('benchmarks')
        >>> print(path)
        /tmp/jcn_cache/benchmarks_data.json
    """
    return CACHE_DIR / f"{module_name}_data.json"


def load_cache(module_name: str) -> Optional[dict]:
    """
    Load cached data if it exists and is still valid (from today).
    
    Args:
        module_name: Unique identifier for the module
    
    Returns:
        Cached data dict if valid, None if cache is invalid or doesn't exist
    
    Example:
        >>> data = load_cache('benchmarks')
        >>> if data:
        ...     print("Cache hit!")
        ... else:
        ...     print("Cache miss - need to fetch fresh data")
    """
    cache_file = get_cache_file_path(module_name)
    
    if not cache_file.exists():
        logger.info(f"❌ Cache MISS: {module_name} (file doesn't exist)")
        return None
    
    try:
        with open(cache_file, 'r') as f:
            cache = json.load(f)
        
        # Check if cache is from today
        cache_date = cache.get('cache_date')
        today = date.today().isoformat()
        
        if cache_date == today:
            logger.info(f"✅ Cache HIT: {module_name} (loaded from {cache_date})")
            return cache.get('data')
        else:
            logger.info(f"❌ Cache MISS: {module_name} (stale: {cache_date} != {today})")
            return None
            
    except json.JSONDecodeError as e:
        logger.error(f"Error decoding cache file for {module_name}: {e}")
        return None
    except Exception as e:
        logger.error(f"Error loading cache for {module_name}: {e}")
        return None


def save_cache(module_name: str, data: dict) -> bool:
    """
    Save data to cache with current date and timestamp.
    
    Args:
        module_name: Unique identifier for the module
        data: Data dictionary to cache
    
    Returns:
        True if save successful, False otherwise
    
    Example:
        >>> data = {"portfolio_value": 1000000, "stocks": [...]}
        >>> success = save_cache('portfolio_performance', data)
        >>> if success:
        ...     print("Data cached successfully!")
    """
    cache_file = get_cache_file_path(module_name)
    
    cache = {
        'cache_date': date.today().isoformat(),
        'loaded_at': datetime.now().isoformat(),
        'module_name': module_name,
        'data': data
    }
    
    try:
        with open(cache_file, 'w') as f:
            json.dump(cache, f, indent=2)
        logger.info(f"💾 Cache SAVED: {module_name} ({cache_file})")
        return True
    except Exception as e:
        logger.error(f"Error saving cache for {module_name}: {e}")
        return False


def clear_cache(module_name: Optional[str] = None) -> bool:
    """
    Clear cache for a specific module or all modules.
    
    Args:
        module_name: Module to clear cache for. If None, clears all caches.
    
    Returns:
        True if successful, False otherwise
    
    Example:
        >>> # Clear specific module cache
        >>> clear_cache('benchmarks')
        
        >>> # Clear all caches
        >>> clear_cache()
    """
    try:
        if module_name:
            # Clear specific module cache
            cache_file = get_cache_file_path(module_name)
            if cache_file.exists():
                cache_file.unlink()
                logger.info(f"🗑️  Cache CLEARED: {module_name}")
                return True
            else:
                logger.info(f"No cache file found for {module_name}")
                return False
        else:
            # Clear all caches
            count = 0
            for cache_file in CACHE_DIR.glob("*_data.json"):
                cache_file.unlink()
                count += 1
            logger.info(f"🗑️  All caches CLEARED ({count} files)")
            return True
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        return False


def fetch_with_cache(
    module_name: str,
    fetch_function: Callable[[], dict],
    force_refresh: bool = False
) -> dict:
    """
    Main caching wrapper function - USE THIS for all API endpoints!
    
    This function implements the two-tier caching strategy:
    1. Check cache first (unless force_refresh=True)
    2. If cache miss, call fetch_function to get fresh data
    3. Save fresh data to cache
    4. Return data
    
    Args:
        module_name: Unique identifier for the module
        fetch_function: Function that fetches fresh data (usually from MotherDuck)
        force_refresh: If True, bypass cache and fetch fresh data
    
    Returns:
        Data dictionary (either from cache or freshly fetched)
    
    Example:
        >>> def fetch_portfolio_data():
        ...     # Query MotherDuck
        ...     conn = duckdb.connect("md:...")
        ...     result = conn.execute("SELECT ...").fetchall()
        ...     return {"stocks": result}
        ...
        >>> data = fetch_with_cache(
        ...     module_name="portfolio_performance",
        ...     fetch_function=fetch_portfolio_data,
        ...     force_refresh=False
        ... )
        >>> print(data)
    """
    # Try to load from cache first (unless force refresh)
    if not force_refresh:
        cached_data = load_cache(module_name)
        if cached_data is not None:
            return cached_data
    else:
        logger.info(f"🔄 FORCE REFRESH: {module_name}")
    
    # Cache miss or force refresh - fetch fresh data
    logger.info(f"🔄 Fetching fresh data for: {module_name}")
    
    try:
        fresh_data = fetch_function()
        
        # Save to cache
        save_cache(module_name, fresh_data)
        
        return fresh_data
        
    except Exception as e:
        logger.error(f"Error fetching data for {module_name}: {e}")
        
        # Try to return stale cache as fallback
        cache_file = get_cache_file_path(module_name)
        if cache_file.exists():
            try:
                with open(cache_file, 'r') as f:
                    cache = json.load(f)
                logger.warning(f"⚠️  Returning STALE cache for {module_name} due to fetch error")
                return cache.get('data', {})
            except:
                pass
        
        # No cache available, re-raise the error
        raise


def get_cache_info(module_name: str) -> Optional[dict]:
    """
    Get metadata about a module's cache (without loading the data).
    
    Args:
        module_name: Unique identifier for the module
    
    Returns:
        Dict with cache metadata, or None if cache doesn't exist
    
    Example:
        >>> info = get_cache_info('benchmarks')
        >>> if info:
        ...     print(f"Cache from: {info['cache_date']}")
        ...     print(f"Loaded at: {info['loaded_at']}")
        ...     print(f"Valid: {info['is_valid']}")
    """
    cache_file = get_cache_file_path(module_name)
    
    if not cache_file.exists():
        return None
    
    try:
        with open(cache_file, 'r') as f:
            cache = json.load(f)
        
        cache_date = cache.get('cache_date')
        today = date.today().isoformat()
        
        return {
            'module_name': module_name,
            'cache_date': cache_date,
            'loaded_at': cache.get('loaded_at'),
            'is_valid': cache_date == today,
            'file_path': str(cache_file),
            'file_size_bytes': cache_file.stat().st_size
        }
    except Exception as e:
        logger.error(f"Error getting cache info for {module_name}: {e}")
        return None


def list_all_caches() -> list[dict]:
    """
    List all cache files and their metadata.
    
    Returns:
        List of cache info dicts
    
    Example:
        >>> caches = list_all_caches()
        >>> for cache in caches:
        ...     print(f"{cache['module_name']}: {cache['cache_date']}")
    """
    caches = []
    
    for cache_file in CACHE_DIR.glob("*_data.json"):
        module_name = cache_file.stem.replace('_data', '')
        info = get_cache_info(module_name)
        if info:
            caches.append(info)
    
    return caches


# Example usage in an API endpoint:
"""
from fastapi import APIRouter
from pydantic import BaseModel
from api.cache_utils import fetch_with_cache

router = APIRouter()

class YourModuleRequest(BaseModel):
    holdings: list[dict]
    force_refresh: bool = False

@router.post("/api/your-module")
async def your_module_endpoint(request: YourModuleRequest):
    def fetch_fresh_data():
        # Your MotherDuck query logic here
        conn = duckdb.connect("md:PROD_EODHD?motherduck_token=...")
        result = conn.execute("SELECT ...").fetchall()
        
        # Process and return data
        return {
            "stocks": result,
            "total_value": sum(...)
        }
    
    # Use caching wrapper - THIS IS ALL YOU NEED!
    data = fetch_with_cache(
        module_name="your_module",
        fetch_function=fetch_fresh_data,
        force_refresh=request.force_refresh
    )
    
    return {
        "data": data,
        "last_updated": datetime.now().isoformat(),
        "cache_info": get_cache_info("your_module")
    }
"""
