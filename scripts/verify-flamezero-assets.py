#!/usr/bin/env python3
"""Comprueba que FlameZero se publicó con todos sus medios originales."""
from pathlib import Path
import json
import sys

root = Path(__file__).resolve().parents[1] / "public/games/flamezero"
project_file = root / "project.json"
if not project_file.is_file():
    sys.exit("ERROR: project.json no existe (ejecuta el publicador de FlameZero).")
project = json.loads(project_file.read_text(encoding="utf-8"))
targets = project.get("targets", [])
assets = {
    item.get("md5ext") or f"{item['assetId']}.{item['dataFormat']}"
    for target in targets
    for item in target.get("costumes", []) + target.get("sounds", [])
}
missing = [name for name in assets if not (root / "assets" / name).is_file()]
if missing:
    sys.exit(f"ERROR: faltan {len(missing)} archivos de Scratch: {missing[:10]}")
for file in ["game.js", "game.css", "index.html"]:
    if not (root / file).is_file():
        sys.exit(f"ERROR: falta {file}")
pngs = list((root / "assets").glob("*.png"))
for path in pngs:
    data = path.read_bytes()
    if not (data.startswith(b"\x89PNG\r\n\x1a\n") and data.endswith(b"IEND\xaeB`\x82")):
        sys.exit(f"ERROR: imagen PNG dañada: {path}")
print(f"PASS FlameZero: {len(targets)} objetivos, {len(assets)} medios originales, {len(pngs)} PNG")
