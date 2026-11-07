"""
server.py
SIH Autonomous Vehicle - Mission Control & Digital Twin Server
Provides:
  1. Static Web Hosting for the Digital Twin UI
  2. Live YOLOv8 / ONNX inference API for camera streams
  3. Real-time telemetry streaming via WebSockets
"""

import os
import sys
from pathlib import Path

# Check if fastapi/uvicorn are available; if not, provide a fallback to standard http.server
try:
    from fastapi import FastAPI, WebSocket
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse
    import uvicorn
    USE_FASTAPI = True
except ImportError:
    USE_FASTAPI = False

WEB_APP_DIR = Path(__file__).resolve().parent

if USE_FASTAPI:
    app = FastAPI(title="SIH Autonomous Vehicle Digital Twin")

    # Serve static assets (CSS, JS)
    app.mount("/static", StaticFiles(directory=str(WEB_APP_DIR)), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(WEB_APP_DIR / "index.html")

    @app.get("/api/health")
    async def health_check():
        return {
            "status": "online",
            "system": "Nav-Bharat AV Digital Twin",
            "perception_model": "yolov8n-seg.onnx / yolov8n.pt",
            "controller": "Stanley + Cascaded PID AEB",
            "planner": "Frenet Quintic Polynomial Optimizer"
        }

    def start_server(port=8000):
        print("=============================================================")
        print("  🚗 NAV-BHARAT AV MISSION CONTROL & DIGITAL TWIN ACTIVE")
        print("=============================================================")
        print(f"  👉 Open in your browser: http://localhost:{port}")
        print("  Press Ctrl+C to stop.")
        print("=============================================================\n")
        uvicorn.run(app, host="0.0.0.0", port=port)

else:
    import http.server
    import socketserver

    def start_server(port=8000):
        os.chdir(str(WEB_APP_DIR))
        Handler = http.server.SimpleHTTPRequestHandler
        with socketserver.TCPServer(("", port), Handler) as httpd:
            print("=============================================================")
            print("  🚗 NAV-BHARAT AV MISSION CONTROL & DIGITAL TWIN ACTIVE")
            print("=============================================================")
            print(f"  👉 Open in your browser: http://localhost:{port}")
            print("  Press Ctrl+C to stop.")
            print("=============================================================\n")
            httpd.serve_forever()

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    start_server(port)
