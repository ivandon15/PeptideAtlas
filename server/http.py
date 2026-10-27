"""Loopback-only HTTP service for the personal workbench; no Codex process is auto-started."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote, quote
import json
import mimetypes
import re
from .store import Store, Invalid, Conflict


class Handler(BaseHTTPRequestHandler):
    store = None
    assets = Path(__file__).resolve().parents[1] / "dist"

    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def allow_local_request(self):
        # A loopback bind alone does not prevent a hostile DNS name from reaching localhost.
        port = self.server.server_port
        if self.headers.get("Host") not in (f"127.0.0.1:{port}", f"localhost:{port}"):
            self.send_json({"error": "仅允许本机地址访问"}, 403)
            return False
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            self.send_json({"error": "跨站调用不允许"}, 403)
            return False
        return True

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

    def send_json(self, value, status=200):
        raw = json.dumps(value, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_json({"error": "跨站调用不允许"}, 403)

    def do_GET(self):
        if not self.allow_local_request():
            return
        path = urlparse(self.path).path
        query = parse_qs(urlparse(self.path).query)
        try:
            if path == "/api/health":
                return self.send_json(
                    {
                        "ok": True,
                        "mode": "local",
                        "codexExecution": "manual",
                        "jev": "not-configured",
                    }
                )
            if path == "/api/state":
                return self.send_json(self.store.state())
            if path == "/api/history":
                return self.send_json(
                    self.store.history(query.get("kind", [""])[0], query.get("id", [""])[0])
                )
            m = re.fullmatch(r"/api/gaps/([A-Za-z0-9_.:-]+)/packet", path)
            if m:
                return self.send_json(self.store.packet(m[1]))
            m = re.fullmatch(r"/api/uploads/([a-f0-9]+)/content", path)
            if m:
                file, data = self.store.upload_path(m[1])
                raw = file.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header(
                    "Content-Disposition",
                    "attachment; filename*=UTF-8''" + quote(data["name"]),
                )
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
                return
            if path.startswith("/api/"):
                return self.send_json({"error": "接口不存在"}, 404)
            requested = (self.assets / unquote(path).lstrip("/")).resolve()
            if not requested.is_relative_to(self.assets.resolve()):
                return self.send_json({"error": "禁止路径"}, 403)
            if not requested.is_file():
                requested = self.assets / "index.html"
            if not requested.exists():
                return self.send_json(
                    {"error": "前端尚未构建；先 npm run build，开发时访问Vite地址。"}, 503
                )
            raw = requested.read_bytes()
            self.send_response(200)
            self.send_header(
                "Content-Type",
                mimetypes.guess_type(str(requested))[0] or "application/octet-stream",
            )
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        except (Invalid, ValueError) as e:
            self.send_json({"error": str(e)}, 400)
        except Exception as e:
            self.send_json({"error": "读取失败：" + str(e)[:300]}, 500)

    def do_POST(self):
        if not self.allow_local_request():
            return
        origin = self.headers.get("Origin")
        if (
            self.headers.get("X-Atlas-Client") != "workbench"
            or origin
            and urlparse(origin).hostname not in ("localhost", "127.0.0.1")
        ):
            return self.send_json({"error": "仅允许本地工作台写入"}, 403)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            require_size = 0 < size <= 31 * 1024 * 1024
            if not require_size:
                raise Invalid("请求为空或超过容量")
            raw = self.rfile.read(size)
            if len(raw) != size:
                raise Invalid("请求正文不完整")
            path = urlparse(self.path).path
            if path == "/api/commit":
                if size > 4 * 1024 * 1024:
                    raise Invalid("结构化更新超过4MB")
                return self.send_json(self.store.commit(json.loads(raw)))
            m = re.fullmatch(r"/api/gaps/([A-Za-z0-9_.:-]+)/uploads", path)
            if m:
                name = parse_qs(urlparse(self.path).query).get("name", ["upload.pdf"])[0]
                return self.send_json(self.store.add_upload(m[1], name, raw), 201)
            return self.send_json({"error": "接口不存在"}, 404)
        except Conflict as e:
            self.send_json({"error": str(e)}, 409)
        except (Invalid, ValueError, KeyError, TypeError) as e:
            self.send_json({"error": str(e)}, 400)
        except Exception as e:
            self.send_json({"error": "写入失败：" + str(e)[:300]}, 500)


def serve(store, port=8766):
    Handler.store = store
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("Peptide Atlas API: http://127.0.0.1:" + str(port), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
