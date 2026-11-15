"""Curate SICES to NASA PSI validated observations and sourced scenarios.

No destructive operation occurs against a database unless --apply is passed.
Usage: PYTHONPATH=python python -m sices.ingestion.curate --db db/custom.db --apply
"""
from __future__ import annotations
import argparse
import csv
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCENARIOS = ROOT / "prisma" / "data" / "curated_scenarios.csv"

# Purely categorical tags based on documented platforms and study descriptions
# in the existing SICES NASA-PSI catalog; these are NOT invented measurements.
HARDWARE = {
    "BASS": "MSG",
    "BASS-II": "MSG",
    "FLEX": "MDCA / CIR",
    "FLEX-2": "MDCA / CIR",
    "FLEX Cool Flames": "MDCA / CIR (MST); NASA Glenn (PROCI)",
    "ACME / Flame Design": "CIR",
    "ACME CFI-G": "CIR",
    "ACME s-Flame": "CIR",
    "SAFFIRE-I": "Saffire / Cygnus",
    "SAFFIRE-II": "Saffire / Cygnus",
    "SAFFIRE-III": "Saffire / Cygnus",
}
DOMAINS = {
    "BASS":"PREVENTION", "BASS-II":"PREVENTION",
    "SAFFIRE-I":"PREVENTION", "SAFFIRE-II":"PREVENTION", "SAFFIRE-III":"PREVENTION",
    "SAME":"DETECTION", "SAME-R":"DETECTION", "SAME Data Modeling":"DETECTION",
    "FLEX":"SUPPRESSION", "FLEX-2":"SUPPRESSION",
}
SIMPLE = {
    "BASS":"¿Puede arder una tela dentro de una nave? BASS estudia cómo avanzan las llamas sobre materiales sólidos cuando casi no hay gravedad.",
    "BASS-II":"BASS-II observa cómo se queman materiales de distintas formas en el espacio. Ayuda a entender qué cosas podrían ser peligrosas en una nave.",
    "SAFFIRE-I":"¿Cómo crece un incendio grande en una nave espacial? Saffire-I investigó esta pregunta en una nave de carga sin tripulación.",
    "SAFFIRE-II":"Saffire-II comparó varios materiales para observar cómo podían arder dentro de una nave espacial.",
    "SAFFIRE-III":"Saffire-III estudió cómo el movimiento del aire cambia el crecimiento de un incendio en microgravedad.",
    "SAME":"SAME observa las pequeñas partículas que forman el humo. Entenderlas ayuda a diseñar mejores detectores para astronautas.",
    "SAME-R":"SAME-R continuó los estudios de humo en el espacio. Su objetivo fue entender mejor cómo detectar esas partículas.",
    "FLEX":"FLEX estudia cómo apagar llamas que rodean pequeñas gotas de combustible en el espacio. También investiga gases que ayudan a extinguirlas.",
    "FLEX-2":"FLEX-2 investiga cómo se encienden y apagan las llamas de gotas de distintos combustibles.",
    "ACME / Flame Design":"Este experimento estudia llamas hechas con gases en microgravedad para entender cómo cambian su forma y comportamiento.",
    "ACME CFI-G":"CFI-G estudia llamas de gases, incluidas llamas difíciles de ver. Sirve para comprender mejor la combustión dentro de una nave.",
    "FLEX Cool Flames":"Algunas gotas de combustible pueden seguir reaccionando sin una llama muy brillante. Aquí se estudia ese fenómeno y cómo se apaga.",
    "ACME s-Flame":"Este estudio analiza llamas de gas en microgravedad para comprender su forma y comportamiento.",
    "Concurrent Flame Spread Modeling":"Se usan cálculos por computadora para entender cómo podría extenderse una llama sobre materiales sólidos.",
    "SAME Data Modeling":"Mediante modelos por computadora se investiga cómo aparecen y se mueven las pequeñas partículas de humo.",
}
def connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path, timeout=120)
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def curate(conn: sqlite3.Connection) -> dict:
    before = {name:conn.execute(f'SELECT count(*) FROM "{name}"').fetchone()[0]
              for name in ("Investigation","Measurement","SourceAsset","NormalizedObservation","Dataset","DataSeries")}
    with conn:
        conn.execute('DELETE FROM "Measurement" WHERE "source"="DEMO"')
        # Discard unnormalized raw tables: the source files remain in git for potential reprocessing.
        conn.execute('DELETE FROM "NormalizedObservation" WHERE "o2Percent" IS NULL AND "pressurePsi" IS NULL AND "airflowCmS" IS NULL AND "temperatureC" IS NULL')
        conn.execute('DELETE FROM "SourceAsset" WHERE "agency" != "NASA_PSI"')
        conn.execute('DELETE FROM "SourceAsset" WHERE "id" NOT IN (SELECT DISTINCT "sourceAssetId" FROM "NormalizedObservation" UNION SELECT DISTINCT "sourceAssetId" FROM "Dataset" WHERE "sourceAssetId" IS NOT NULL)')
        conn.execute('UPDATE "SourceAsset" SET "normalizedRows"=(SELECT count(*) FROM "NormalizedObservation" WHERE "sourceAssetId"="SourceAsset"."id"),"totalRows"=(SELECT count(*) FROM "NormalizedObservation" WHERE "sourceAssetId"="SourceAsset"."id"),"status"="CURATED"')
        for code, name, platform, objective, description in conn.execute('SELECT "psiCode","shortName","platform","objectives","description" FROM "Investigation"').fetchall():
            if not code.startswith("PSI-"): continue
            if "modelado" in platform.lower() or name in ("Concurrent Flame Spread Modeling","SAME Data Modeling"):
                gravity = "MODELED"
            elif "tierra" in platform.lower() and "vuelo" in platform.lower():
                gravity = "MIXED"
            elif "ISS" in platform.upper() or "cygnus" in platform.lower():
                gravity = "MICROGRAVITY"
            else:
                gravity = ""
            summary = SIMPLE.get(name)
            if not summary:
                # No invented measurements: an evidence-only short caption from catalog metadata.
                summary = (description or objective or "").split(".")[0].strip()
                if summary: summary = summary[:310] + ("." if not summary.endswith(".") else "")
            conn.execute('UPDATE "Investigation" SET "agency"=?, "hardware"=?, "hardwareRack"=?, "gravityRegime"=?, "laymanSummary"=?, "safetyDomain"=?, "earthApplication"="", "updatedAt"=CURRENT_TIMESTAMP WHERE "psiCode"=?',
                         ("NASA_PSI", HARDWARE.get(name,""), HARDWARE.get(name,""), gravity, summary or "", DOMAINS.get(name,"RESEARCH"), code))
        conn.execute('DELETE FROM "ScenarioPreset"')
        with SCENARIOS.open(newline="",encoding="utf-8") as fp:
            for r in csv.DictReader(fp):
                conn.execute('INSERT INTO "ScenarioPreset" ("key","name","oxygenPercent","pressurePsi","gravityRegime","note","sourceUrl","category") VALUES (?,?,?,?,?,?,?,?)',
                             (r["key"],r["name"],float(r["oxygenPercent"]),float(r["pressurePsi"]),r["gravityRegime"],r["note"],r["sourceUrl"],r["category"]))
    after = {name:conn.execute(f'SELECT count(*) FROM "{name}"').fetchone()[0] for name in before}
    result={"before":before,"after":after,"scenarios":conn.execute('SELECT count(*) FROM "ScenarioPreset"').fetchone()[0]}
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db",default=str(ROOT/"db"/"custom.db"))
    parser.add_argument("--apply",action="store_true")
    parser.add_argument("--vacuum",action="store_true")
    args=parser.parse_args()
    path=Path(args.db).resolve()
    if not path.is_file(): raise SystemExit("No se encontró SQLite: "+str(path))
    if not args.apply: raise SystemExit("Modo seguro: agrega --apply para confirmar que se eliminarán datos no utilizables de la base indicada.")
    conn=connect(path)
    try:
        result=curate(conn)
        if args.vacuum: conn.execute("VACUUM")
        print(json.dumps(result,ensure_ascii=False,indent=2))
    finally: conn.close()

if __name__=="__main__": main()
