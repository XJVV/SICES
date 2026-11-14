#!/usr/bin/env python3
"""Descarga las fuentes woff2 (subconjunto latin) de Google Fonts y las guarda
en src/app/fonts/ para auto-hospedaje con next/font/local (funciona offline)."""
import re
import urllib.request
from pathlib import Path

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

FAMILIES = [
    ("Orbitron", "orbitron", [400, 500, 600, 700, 800]),
    ("Space Grotesk", "space-grotesk", [300, 400, 500, 600, 700]),
    ("JetBrains Mono", "jetbrains-mono", [400, 500, 700]),
]

OUT = Path("/home/z/my-project/src/app/fonts")
OUT.mkdir(parents=True, exist_ok=True)


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main() -> None:
    total = 0
    for family, slug, weights in FAMILIES:
        w = ";".join(str(x) for x in weights)
        css_url = f"https://fonts.googleapis.com/css2?family={family.replace(' ', '+')}:wght@{w}&display=swap"
        css = fetch(css_url).decode("utf-8")
        # Bloques precedidos por el comentario /* latin */
        blocks = re.findall(r"/\*\s*latin\s*\*/\s*@font-face\s*\{([^}]+)\}", css)
        got = {}
        for block in blocks:
            mw = re.search(r"font-weight:\s*(\d+)", block)
            mu = re.search(r"url\((https://[^)]+\.woff2)\)", block)
            if mw and mu:
                got[int(mw.group(1))] = mu.group(1)
        for weight in weights:
            if weight not in got:
                raise SystemExit(f"ERROR: {family} {weight} no encontrado en CSS")
            data = fetch(got[weight])
            dest = OUT / f"{slug}-{weight}.woff2"
            dest.write_bytes(data)
            total += 1
            print(f"OK  {dest.name:28s} {len(data)/1024:.1f} KB")
    print(f"\n{total} fuentes descargadas en {OUT}")


if __name__ == "__main__":
    main()
