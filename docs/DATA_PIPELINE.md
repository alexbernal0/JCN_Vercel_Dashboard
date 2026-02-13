# Data Pipeline Documentation

**Last Updated:** February 13, 2026

This document describes the automated data pipeline that refreshes the JCN Financial Dashboard with data from MotherDuck.

## Overview

The data pipeline runs hourly via GitHub Actions, querying MotherDuck for the latest portfolio and market data, generating static JSON files, and triggering a Vercel deployment to update the dashboard.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions Cron Job                     │
│                     (Runs every hour at :00)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Python Data Generation Script                 │
│                                                                 │
│  1. Connect to MotherDuck using DuckDB client                  │
│  2. Execute SQL queries for portfolio data                     │
│  3. Execute SQL queries for market data                        │
│  4. Transform data into JSON format                            │
│  5. Write JSON files to data/ directory                        │
│  6. Update metadata.json with timestamp                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Git Commit & Push                           │
│                                                                 │
│  1. Stage all changed files in data/                           │
│  2. Commit with timestamp message                              │
│  3. Push to main branch                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Vercel Auto-Deploy                          │
│                                                                 │
│  1. Detect push to main branch                                 │
│  2. Trigger build process                                      │
│  3. Generate static pages with new data                        │
│  4. Deploy to global CDN                                       │
└─────────────────────────────────────────────────────────────────┘
```

## GitHub Actions Workflow

### Workflow File

`.github/workflows/data-refresh.yml`

```yaml
name: Data Refresh

on:
  schedule:
    # Run every hour at minute 0
    - cron: '0 * * * *'
  workflow_dispatch: # Allow manual triggering

jobs:
  refresh-data:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install duckdb python-dotenv
      
      - name: Run data generation script
        env:
          MOTHERDUCK_TOKEN: ${{ secrets.MOTHERDUCK_TOKEN }}
        run: |
          python scripts/generate-data.py
      
      - name: Commit and push changes
        run: |
          git config --local user.email "github-actions[bot]@users.noreply.github.com"
          git config --local user.name "github-actions[bot]"
          git add data/
          git diff --quiet && git diff --staged --quiet || (git commit -m "Data refresh: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" && git push)
      
      - name: Trigger Vercel revalidation
        env:
          REVALIDATE_SECRET: ${{ secrets.REVALIDATE_SECRET }}
          VERCEL_REVALIDATE_URL: ${{ secrets.VERCEL_REVALIDATE_URL }}
        run: |
          curl -X POST $VERCEL_REVALIDATE_URL \
            -H "x-revalidate-secret: $REVALIDATE_SECRET"
```

### Schedule

- **Frequency:** Every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
- **Timezone:** UTC
- **Manual Trigger:** Available via GitHub Actions UI

## Data Generation Script

### Script Location

`scripts/generate-data.py`

### Script Overview

```python
#!/usr/bin/env python3
"""
Data generation script for JCN Financial Dashboard.
Queries MotherDuck and generates static JSON files.
"""

import duckdb
import json
import os
from datetime import datetime
from pathlib import Path

# Configuration
MOTHERDUCK_TOKEN = os.environ.get('MOTHERDUCK_TOKEN')
DATA_DIR = Path(__file__).parent.parent / 'data'

def connect_to_motherduck():
    """Connect to MotherDuck database."""
    return duckdb.connect(f'md:jcn_db?motherduck_token={MOTHERDUCK_TOKEN}')

def fetch_portfolio_data(con, portfolio_id):
    """Fetch data for a specific portfolio."""
    query = f"""
    SELECT 
        id,
        name,
        performance_ytd,
        performance_1y,
        performance_3y,
        total_value,
        holdings
    FROM portfolios
    WHERE id = '{portfolio_id}'
    """
    return con.sql(query).fetchdf().to_dict('records')[0]

def fetch_market_data(con):
    """Fetch market overview data."""
    query = """
    SELECT 
        index_name,
        current_value,
        change_percent,
        volume
    FROM market_indices
    ORDER BY index_name
    """
    return con.sql(query).fetchdf().to_dict('records')

def generate_portfolio_files(con):
    """Generate JSON files for all portfolios."""
    portfolios = ['persistent-value', 'olivia-growth', 'pure-alpha']
    
    for portfolio_id in portfolios:
        data = fetch_portfolio_data(con, portfolio_id)
        data['updated_at'] = datetime.utcnow().isoformat() + 'Z'
        
        output_file = DATA_DIR / 'portfolios' / f'{portfolio_id}.json'
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f'Generated: {output_file}')

def generate_market_file(con):
    """Generate JSON file for market data."""
    data = {
        'indices': fetch_market_data(con),
        'updated_at': datetime.utcnow().isoformat() + 'Z'
    }
    
    output_file = DATA_DIR / 'market' / 'indices.json'
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f'Generated: {output_file}')

def update_metadata():
    """Update metadata file with refresh timestamp."""
    metadata = {
        'last_refresh': datetime.utcnow().isoformat() + 'Z',
        'status': 'success'
    }
    
    output_file = DATA_DIR / 'metadata.json'
    with open(output_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f'Updated: {output_file}')

def main():
    """Main execution function."""
    print('Starting data generation...')
    
    # Connect to MotherDuck
    con = connect_to_motherduck()
    print('Connected to MotherDuck')
    
    # Generate data files
    generate_portfolio_files(con)
    generate_market_file(con)
    update_metadata()
    
    print('Data generation complete!')

if __name__ == '__main__':
    main()
```

## Data File Structure

### Portfolio Data

`data/portfolios/{portfolio-id}.json`

```json
{
  "id": "persistent-value",
  "name": "Persistent Value",
  "performance_ytd": 12.5,
  "performance_1y": 18.3,
  "performance_3y": 45.2,
  "total_value": 1250000.00,
  "holdings": [
    {
      "symbol": "AAPL",
      "shares": 1000,
      "value": 175000.00,
      "weight": 14.0
    }
  ],
  "updated_at": "2026-02-13T10:00:00Z"
}
```

### Market Data

`data/market/indices.json`

```json
{
  "indices": [
    {
      "index_name": "S&P 500",
      "current_value": 5800.50,
      "change_percent": 0.75,
      "volume": 3500000000
    }
  ],
  "updated_at": "2026-02-13T10:00:00Z"
}
```

### Metadata

`data/metadata.json`

```json
{
  "last_refresh": "2026-02-13T10:00:00Z",
  "status": "success"
}
```

## Manual Data Refresh

### Via GitHub Actions UI

1. Go to the repository on GitHub
2. Click "Actions" tab
3. Select "Data Refresh" workflow
4. Click "Run workflow"
5. Select branch (usually `main`)
6. Click "Run workflow" button

### Via Local Script

```bash
# Set environment variable
export MOTHERDUCK_TOKEN="your_token_here"

# Run script
python scripts/generate-data.py

# Commit and push
git add data/
git commit -m "Manual data refresh"
git push
```

## On-Demand Revalidation

### User-Triggered Refresh

Users can trigger a data refresh via the dashboard UI:

1. Click "Refresh Data" button
2. Frontend calls `/api/revalidate` endpoint
3. API validates secret and triggers revalidation
4. GitHub Actions workflow is triggered
5. User sees notification: "Data refresh initiated"

### API Endpoint

`app/api/revalidate/route.ts`

```typescript
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  const secret = request.headers.get('x-revalidate-secret');
  
  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Revalidate all pages
  revalidatePath('/', 'layout');
  
  return Response.json({ 
    revalidated: true,
    timestamp: new Date().toISOString()
  });
}
```

## Monitoring & Logging

### GitHub Actions Logs

View execution logs for each workflow run:

1. Go to "Actions" tab
2. Click on a workflow run
3. View step-by-step execution logs

### Error Handling

If the data refresh fails:

1. GitHub Actions sends email notification
2. Workflow status shows as "Failed"
3. Previous data remains in place (no disruption)
4. Manual investigation required

### Success Metrics

- **Execution Time:** ~30-60 seconds per run
- **Success Rate:** Target 99.9%
- **Data Freshness:** Maximum 1 hour old

## Troubleshooting

### Connection Errors

If MotherDuck connection fails:

1. Verify `MOTHERDUCK_TOKEN` is set correctly
2. Check MotherDuck service status
3. Review network connectivity

### Data Generation Errors

If JSON generation fails:

1. Check SQL query syntax
2. Verify data exists in MotherDuck
3. Review Python script logs

### Deployment Errors

If Vercel deployment fails:

1. Check Vercel build logs
2. Verify JSON files are valid
3. Review Next.js configuration

## Future Enhancements

1. **Error Notifications:** Slack/email alerts on failure
2. **Data Validation:** Schema validation before commit
3. **Incremental Updates:** Only update changed portfolios
4. **Backup Strategy:** Automated data backups
5. **Performance Monitoring:** Track query execution times

---

**For questions or issues, contact the development team.**
