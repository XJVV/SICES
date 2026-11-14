"""Lightweight HTTP microservice for SICES Python Engine.

Provides zero-dependency REST endpoints for asynchronous ingestion, job tracking,
and high-speed series decimation. Compatible with FastAPI and standard http.server.
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sices.ingestion.decimation import lttb
from sices.ingestion.job_manager import JobManager


class SicesHttpHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: dict):
        response_bytes = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/health" or path == "/api/py/health":
            self._send_json(200, {
                "status": "ok",
                "engine": "sices-python-pipeline",
                "scale": "2TB+ streaming out-of-core",
            })
            return

        if path.startswith("/import/status/") or path.startswith("/api/py/import/status/"):
            job_id = path.split("/")[-1]
            job = JobManager().get_job(job_id)
            if not job:
                self._send_json(404, {"error": "Job not found"})
                return
            self._send_json(200, job.to_dict())
            return

        self._send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(body.decode("utf-8")) if body else {}
        except Exception:
            payload = {}

        if path == "/import/start" or path == "/api/py/import/start":
            file_paths = payload.get("files", [])
            dry_run = bool(payload.get("dry", False))
            psi_override = payload.get("psi")

            if not file_paths:
                self._send_json(400, {"error": "No files specified"})
                return

            manager = JobManager()
            job = manager.create_job(file_paths, dry_run=dry_run, psi_override=psi_override)
            manager.start_job_async(job)
            self._send_json(202, job.to_dict())
            return

        if path == "/query/decimate" or path == "/api/py/query/decimate":
            points = payload.get("points", [])
            target = int(payload.get("target", 2000))
            downsampled = lttb(points, target)
            self._send_json(200, {
                "originalCount": len(points),
                "decimatedCount": len(downsampled),
                "points": downsampled,
            })
            return

        self._send_json(404, {"error": "Endpoint not found"})


def run_server(port: int = 8000, host: str = "127.0.0.1"):
    server = ThreadingHTTPServer((host, port), SicesHttpHandler)
    print(f"🚀 SICES Python Data Engine activo en http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Apagando servidor Python...")
        server.server_close()


if __name__ == "__main__":
    port = int(os.environ.get("SICES_PY_PORT", 8000))
    run_server(port=port)
