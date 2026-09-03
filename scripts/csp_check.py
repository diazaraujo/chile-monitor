#!/usr/bin/env python3
"""Verifica que cada <script> inline ejecutable del HTML tenga su sha256 en la CSP de nginx.
Uso: csp_check.py dashboard.html nginx.conf.template  → exit 1 si falta alguno."""
import base64
import hashlib
import re
import sys

html = open(sys.argv[1], encoding="utf-8").read()
conf = open(sys.argv[2], encoding="utf-8", errors="replace").read()
scripts = re.findall(r"<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>(.*?)</script>", html, flags=re.S)
listed = set(re.findall(r"sha256-[A-Za-z0-9+/=]+", conf))
print(f"inline ejecutables: {len(scripts)} · hashes en CSP: {len(listed)}")
missing = 0
for s in scripts:
    d = "sha256-" + base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()
    ok = d in listed
    missing += not ok
    print(("OK    " if ok else "FALTA ") + d + "  " + s.strip()[:40].replace("\n", " "))
sys.exit(1 if missing else 0)
