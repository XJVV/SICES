#!/usr/bin/env python3
"""Inspecciona la estructura exacta (columnas) de los CSV de PSI-117."""
import csv
import os
import sys

UPLOAD = "/home/z/my-project/upload"

FILES = [
    "PSI-117_Analyzed Data_PROCI_2019_Stable_Cool.csv",
    "PSI-117_Analyzed Data_PROCI_2019_Oscillatory_Cool_Flame.csv",
    "PSI-117_Analyzed Data_PROCI_C12_2019_Three_Stage.csv",
    "PSI-117_Analyzed Data_PROCI_2023_Alkane_Extinction_Diameter_1atm.csv",
    "PSI-117_Analyzed Data_PROCI_2023_C12_Extinction_Diameter_vs_pressure.csv",
    "PSI-117_Analyzed Data_MST_2024_Burning_history_Flame_diameter.csv",
    "PSI-117_Analyzed Data_MST_2024_Dext.csv",
    "PSI-117_Analyzed Data_MST_2024_Kavg.csv",
    "PSI-117_Analyzed Data_MST_2024_Radiance_Flame_Diameter.csv",
]

only = sys.argv[1:] if len(sys.argv) > 1 else None

for fname in FILES:
    if only and not any(o in fname for o in only):
        continue
    path = os.path.join(UPLOAD, fname)
    print("=" * 100)
    print(fname)
    print("=" * 100)
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    print(f"total filas: {len(rows)}; anchura máxima: {max(len(r) for r in rows)}")
    for i in (0, 1, 2, len(rows) // 2, len(rows) - 2, len(rows) - 1):
        if i < 0 or i >= len(rows):
            continue
        cells = [f"[{j}]{c!r}" for j, c in enumerate(rows[i]) if c.strip() != ""]
        print(f"  fila {i:>4} ({len(rows[i])} cols): " + " | ".join(cells))
    print()
