#!/usr/bin/env python3
"""
CACHEFLOW — Python Alternative Server & Reverse Proxy
Serves the GUI and interfaces with cache_engine.exe or runs a local fallback.
"""

import http.server
import socketserver
import os
import sys
import subprocess
import json
import urllib.request
import webbrowser

PORT = 8080
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(SCRIPT_DIR, "frontend")

class CacheflowHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def main():
    exe_path = os.path.join(SCRIPT_DIR, "cache_engine.exe")
    if os.path.exists(exe_path):
        print("========================================================")
        print("  Starting Native C++ Engine cache_engine.exe...")
        print("========================================================")
        try:
            webbrowser.open(f"http://localhost:{PORT}")
            subprocess.run([exe_path, str(PORT)])
            return
        except Exception as e:
            print(f"[WARN] Could not run cache_engine.exe directly: {e}")

    # Fallback Python static server
    print(f"[INFO] Serving frontend on http://localhost:{PORT}")
    webbrowser.open(f"http://localhost:{PORT}")
    with socketserver.TCPServer(("", PORT), CacheflowHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    main()

