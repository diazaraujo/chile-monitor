#!/usr/bin/env python3
"""Shim REST compatible con Upstash Redis para Chile Monitor (Enigma).

Cubre lo que usa worldmonitor: GET /get/<key>, POST / (un comando), POST /pipeline
(lista de comandos), POST /multi-exec (lista, envuelta en MULTI/EXEC).
Respuestas: {"result": ...} o [{"result": ...}, ...]. Errores: {"error": "..."}.
ponytail: un socket por request, sin pool; suficiente para un dashboard.
"""
import json, os, socket, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

REDIS = (os.environ.get("REDIS_HOST", "127.0.0.1"), int(os.environ.get("REDIS_PORT", "6381")))
TOKEN = os.environ.get("SHIM_TOKEN", "chilemonitor-local")
PORT = int(os.environ.get("SHIM_PORT", "8079"))


def encode(cmd):
    out = [f"*{len(cmd)}\r\n".encode()]
    for a in cmd:
        b = a if isinstance(a, bytes) else str(a).encode()
        out.append(f"${len(b)}\r\n".encode() + b + b"\r\n")
    return b"".join(out)


class Reader:
    def __init__(self, sock):
        self.sock, self.buf = sock, b""

    def line(self):
        while b"\r\n" not in self.buf:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("redis closed")
            self.buf += chunk
        line, self.buf = self.buf.split(b"\r\n", 1)
        return line

    def exact(self, n):
        while len(self.buf) < n + 2:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("redis closed")
            self.buf += chunk
        data, self.buf = self.buf[:n], self.buf[n + 2:]
        return data

    def parse(self):
        line = self.line()
        t, rest = line[:1], line[1:]
        if t == b"+":
            return rest.decode()
        if t == b"-":
            return {"__error__": rest.decode()}
        if t == b":":
            return int(rest)
        if t == b"$":
            n = int(rest)
            return None if n < 0 else self.exact(n).decode("utf-8", "replace")
        if t == b"*":
            n = int(rest)
            return None if n < 0 else [self.parse() for _ in range(n)]
        raise ValueError(f"RESP desconocido: {line!r}")


def run(cmds, multi=False):
    s = socket.create_connection(REDIS, timeout=30)
    try:
        wire = cmds if not multi else [["MULTI"], *cmds, ["EXEC"]]
        s.sendall(b"".join(encode(c) for c in wire))
        r = Reader(s)
        replies = [r.parse() for _ in wire]
    finally:
        s.close()
    if multi:
        exec_reply = replies[-1]
        return exec_reply if isinstance(exec_reply, list) else [exec_reply] * len(cmds)
    return replies


def wrap(v):
    return {"error": v["__error__"]} if isinstance(v, dict) and "__error__" in v else {"result": v}


class H(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _auth(self):
        ok = self.headers.get("Authorization", "") == f"Bearer {TOKEN}"
        if not ok:
            self._send(401, {"error": "Unauthorized"})
        return ok

    def do_GET(self):
        if not self._auth():
            return
        parts = [unquote(p) for p in self.path.split("?")[0].strip("/").split("/") if p]
        if not parts:
            return self._send(404, {"error": "not found"})
        try:
            self._send(200, wrap(run([parts])[0]))
        except Exception as e:  # noqa: BLE001
            self._send(500, {"error": str(e)})

    def do_POST(self):
        if not self._auth():
            return
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"null")
            path = self.path.split("?")[0].rstrip("/")
            if path == "":
                self._send(200, wrap(run([body])[0]))
            elif path in ("/pipeline", "/multi-exec"):
                self._send(200, [wrap(v) for v in run(body, multi=(path == "/multi-exec"))])
            else:
                self._send(404, {"error": "not found"})
        except Exception as e:  # noqa: BLE001
            self._send(500, {"error": str(e)})

    def log_message(self, *a):  # silencio
        pass


def selfcheck():
    assert run([["SET", "shim:probe", "1"], ["GET", "shim:probe"]]) == ["OK", "1"]
    assert run([["INCR", "shim:ctr"]], multi=True)[0] >= 1
    print("selfcheck ok")


if __name__ == "__main__":
    if "--check" in sys.argv:
        selfcheck(); sys.exit(0)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
