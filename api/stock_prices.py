"""
Stock Price History API
Fetches historical daily closing prices for portfolio stocks from MotherDuck
Returns up to 20 years of data for client-side time filtering
"""

from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime, timedelta
from .cache_manager import CacheManager

# Initialize cache manager
cache_mgr = CacheManager()

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST request for stock price history"""
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            # Get symbols from request
            symbols = request_data.get('symbols', [])
            
            if not symbols:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'No symbols provided'}).encode())
                return
            
            # Fetch historical price data from MotherDuck
            # Get 20 years of data (or maximum available)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=20*365)  # 20 years
            
            # Prepare symbols with .US suffix for MotherDuck
            symbols_with_suffix = [f"{symbol}.US" for symbol in symbols]
            
            # Fetch data from MotherDuck
            price_data = cache_mgr.fetch_historical_prices(
                symbols_with_suffix,
                start_date.strftime('%Y-%m-%d'),
                end_date.strftime('%Y-%m-%d')
            )
            
            # Format response
            response = {
                'data': price_data,
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'symbols': symbols,
                'timestamp': datetime.now().isoformat()
            }
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_response = {'error': str(e)}
            self.wfile.write(json.dumps(error_response).encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
