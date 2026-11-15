"""Local, auditable SICES batch ingestion. No public upload endpoint.
Run: PYTHONPATH=python python -m sices.ingestion.batch_ingest --root cvs
Prerequisite: npx prisma db push (preserves existing data).
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
import os
import re
import sqlite3
from pathlib import Path
from zipfile import ZipFile, BadZipFile

PROJECT = Path(__file__).resolve().parents[3]
TABULAR = {".csv", ".xlsx"}
MAX_MEMBER = 128 * 1024 * 1024
MAX_ARCHIVE = 512 * 1024 * 1024

def database_path(override: str | None = None) -> Path:
    if override:
        return Path(override).expanduser().resolve()
    env = os.getenv("DATABASE_URL", "")
    if not env and (PROJECT / ".env").exists():
        match = re.search(r'^\s*DATABASE_URL\s*=\s*["\x27]?([^"\x27\r\n#]+)', (PROJECT / ".env").read_text(encoding="utf8"), re.M)
        env = match.group(1).strip() if match else ""
    if env and not env.startswith("file:"):
        raise ValueError("Solo se admiten bases SQLite file:")
    path = env[5:].split("?")[0] if env else "../db/custom.db"
    return (Path(path) if Path(path).is_absolute() else PROJECT / "prisma" / path).resolve()

def agency_of(path: Path, root: Path) -> str:
    parts = path.relative_to(root).parts
    return parts[0] if len(parts) > 1 else "SIN_AGENCIA"

def norm_header(s: object) -> str:
    return re.sub(r"\s+", " ", str(s or "").lower().strip().replace("_", " ").replace("₂", "2"))

def field(header: str):
    h = norm_header(header)
    if any(p in h for p in ("oxygen consumption", "oxygen flux", "consumo de oxígeno")):
        return None
    if re.search(r"\bo\s*2\b|oxygen|oxígeno|oxigeno", h):
        if not re.search(r"concentration|concentración|fraction|fracción|percentage|percent|%|^o\s*2", h):
            return None
        u = "fraction" if re.search(r"fraction|fracción|0-1|0–1", h) else ("%" if re.search(r"%|percent|porcentaje", h) else "")
        return ("o2Percent", u)
    if re.search(r"pressure|presión|presion|p ambient", h):
        u = next((u for u in ("kpa", "mpa", "mbar", "bar", "psi", "atm", "pa") if re.search(r"(?<![a-z])"+u+r"(?![a-z])", h)), "")
        return ("pressurePsi", u)
    if re.search(r"airflow|air flow|flow speed|flow velocity|velocidad del aire|velocidad de flujo", h):
        u = next((u for u in ("cm/s", "mm/s", "m/s", "cm s-1", "m s-1") if u in h), "")
        return ("airflowCmS", u)
    if "temperature" in h or "temperatura" in h:
        u = next((u for u in ("°c", "°f", "celsius", "fahrenheit", "kelvin", "(k)", "[k]", "(c)", "[c]") if u in h), "")
        return ("temperatureC", u)
    if re.search(r"gravity|gravedad", h):
        return ("gravityRegime", "")
    if re.search(r"hardware|rack|apparatus|facility|instrument", h):
        return ("hardware", "")
    if re.search(r"environment|entorno|habitat|scenario|escenario", h):
        return ("environment", "")
    if re.search(r"experiment.*(id|code)|código.*experimento", h):
        return ("experimentCode", "")
    if re.search(r"objective|objetivo", h):
        return ("objective", "")
    if re.search(r"earth application|terrestrial application|aplicación terrestre", h):
        return ("earthApplication", "")
    return None

def to_number(value: object):
    try:
        s = str(value).strip()
        if not s or s.lower() in ("nan", "n/a", "none", "inf", "-inf", "null"): return None
        x = float(s.replace(",", ".") if "." not in s else s.replace(",", ""))
        if not (float("-inf") < x < float("inf")): return None
        return x
    except (TypeError, ValueError): return None

def convert(key: str, unit: str, raw: object):
    x = to_number(raw)
    if x is None or not unit: return None
    if key == "o2Percent":
        y = x * 100 if unit == "fraction" else x
        return y if 0 <= y <= 100 else None
    if key == "pressurePsi":
        y = x * {"psi":1, "atm":14.6959487755, "kpa":.1450377377, "mpa":145.0377377, "pa":.0001450377377, "bar":14.50377377, "mbar":.01450377377}[unit]
        return y if y >= 0 else None
    if key == "airflowCmS":
        return x * {"cm/s":1, "mm/s":.1, "m/s":100, "cm s-1":1, "m s-1":100}[unit]
    if key == "temperatureC":
        if unit in ("(k)", "[k]", "kelvin"): return x - 273.15
        if unit in ("°f", "fahrenheit"): return (x - 32) * 5 / 9
        return x
    return None

def csv_rows(data: bytes):
    text = None
    for encoding in ("utf-8-sig", "utf-16", "cp1252"):
        try:
            text = data.decode(encoding)
            break
        except UnicodeError: pass
    if text is None: raise ValueError("Codificación de CSV desconocida")
    sample = text[:8192]
    try: dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error: dialect = csv.excel
    return [("CSV", csv.reader(io.StringIO(text, newline=""), dialect=dialect))]

def xlsx_rows(data: bytes):
    try: from openpyxl import load_workbook
    except ImportError as e: raise RuntimeError("Instala openpyxl para leer XLSX") from e
    book = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    return [(sheet.title, sheet.values) for sheet in book.worksheets]

def experiment_code(name: str, rows: list[dict]):
    m = re.search(r"PSI[-_ ]?(\d+)", name, re.I)
    if m: return "PSI-" + m.group(1)
    for row in rows[:40]:
        for k, v in row.items():
            f = field(k)
            if f and f[0] == "experimentCode" and v and len(str(v)) < 72:
                return str(v).strip()
    return None

def normalized_rows(blob: bytes, suffix: str):
    sources = csv_rows(blob) if suffix == ".csv" else xlsx_rows(blob)
    output = []
    warnings = []
    for sheet_name, source in sources:
        header = None
        mapped = {}
        count = 0
        for row_no, row in enumerate(source, start=1):
            values = list(row)
            if header is None:
                if not any(v is not None and str(v).strip() for v in values): continue
                header = [str(v or "").strip() for v in values]
                mapped = {i: f for i, h in enumerate(header) if (f := field(h))}
                if not mapped: warnings.append(f"{sheet_name}: cabeceras sin campos reconocibles")
                continue
            if not any(v is not None and str(v).strip() for v in values): continue
            count += 1
            raw = {f"{i}:{h or 'column'}": (str(values[i]) if i < len(values) and values[i] is not None else "") for i, h in enumerate(header)}
            record = {"rowNumber":row_no,"sheetName":sheet_name, "rawJson":json.dumps(raw, ensure_ascii=False),
                      "o2Percent":None, "pressurePsi":None, "airflowCmS":None, "temperatureC":None,
                      "gravityRegime":"", "hardware":"", "environment":""}
            for i, (key, unit) in mapped.items():
                v = values[i] if i < len(values) else None
                if key in ("gravityRegime","hardware","environment"):
                    if v is not None: record[key] = str(v).strip()[:150]
                elif key in ("o2Percent","pressurePsi","airflowCmS","temperatureC"):
                    record[key] = convert(key, unit, v)
            output.append(record)
    return output, warnings

def ensure_schema(conn: sqlite3.Connection):
    needed = ("Investigation","SourceAsset","NormalizedObservation")
    rows = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    missing = [n for n in needed if n not in rows]
    if missing: raise RuntimeError("Esquema Prisma sin migrar; ejecuta: npx prisma db push. Faltan: "+", ".join(missing))

def process(conn: sqlite3.Connection, agency: str, identity: str, blob: bytes, suffix: str, dry_run: bool):
    digest = hashlib.sha256(blob).hexdigest()
    old = conn.execute('SELECT id,sha256 FROM "SourceAsset" WHERE "sourcePath"=?',(identity,)).fetchone()
    if old and old["sha256"] == digest:
        return {"path":identity,"status":"UNCHANGED","rows":0}
    records, warns = normalized_rows(blob, suffix)
    code = experiment_code(identity, []) if agency.upper().startswith("NASA") else None
    inv = conn.execute('SELECT id FROM "Investigation" WHERE "psiCode"=?',(code,)).fetchone() if code else None
    inv_id = inv["id"] if inv else None
    mapped = sum(any(r[k] is not None for k in ("o2Percent","pressurePsi","airflowCmS","temperatureC")) or any(r[k] for k in ("gravityRegime","hardware","environment")) for r in records)
    status = "IMPORTED" if mapped else "UNMAPPED"
    if dry_run: return {"path":identity,"status":status,"rows":len(records),"mapped":mapped,"warnings":warns}
    with conn:
        if old:
            aid = old["id"]
            conn.execute('DELETE FROM "NormalizedObservation" WHERE "sourceAssetId"=?',(aid,))
            conn.execute('UPDATE "SourceAsset" SET "sha256"=?, "agency"=?, "fileType"=?, "status"=?, "warning"=?, "totalRows"=?, "normalizedRows"=?, "investigationId"=?, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=?',
                (digest,agency,suffix,status,"; ".join(warns)[:3000],len(records),mapped,inv_id,aid))
        else:
            aid = conn.execute('INSERT INTO "SourceAsset" ("sourcePath","sha256","agency","fileType","status","warning","totalRows","normalizedRows","investigationId","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
                (identity,digest,agency,suffix,status,"; ".join(warns)[:3000],len(records),mapped,inv_id)).lastrowid
        sql = 'INSERT INTO "NormalizedObservation" ("sourceAssetId","investigationId","rowNumber","sheetName","o2Percent","pressurePsi","airflowCmS","temperatureC","gravityRegime","hardware","environment","rawJson") VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
        conn.executemany(sql, [(aid,inv_id,r["rowNumber"],r["sheetName"],r["o2Percent"],r["pressurePsi"],r["airflowCmS"],r["temperatureC"],r["gravityRegime"],r["hardware"],r["environment"],r["rawJson"]) for r in records])
    return {"path":identity,"status":status,"rows":len(records),"mapped":mapped,"warnings":warns}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", default="cvs")
    p.add_argument("--db")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--report", default="reports/batch-ingest.json")
    args = p.parse_args()
    root = Path(args.root).expanduser()
    if not root.is_absolute(): root = PROJECT / root
    root = root.resolve()
    if not root.is_dir(): raise SystemExit(f"Dataset root not found: {root}")
    db = database_path(args.db)
    if not db.exists(): raise SystemExit(f"SQLite database not found: {db}; run npx prisma db push")
    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    ensure_schema(conn)
    report = []
    for path in sorted(root.rglob("*")):
        if not path.is_file(): continue
        agency = agency_of(path,root)
        suffix = path.suffix.lower()
        if suffix not in TABULAR and suffix != ".zip":
            report.append({"path":path.relative_to(root).as_posix(),"status":"UNSUPPORTED"})
            continue
        if suffix == ".zip":
            try:
                with ZipFile(path) as zipf:
                    total = 0
                    for member in zipf.infolist():
                        if member.is_dir(): continue
                        ext = Path(member.filename).suffix.lower()
                        identity = path.relative_to(root).as_posix()+"!"+member.filename
                        if ext not in TABULAR:
                            report.append({"path":identity,"status":"UNSUPPORTED"}); continue
                        total += member.file_size
                        if member.file_size > MAX_MEMBER or total > MAX_ARCHIVE:
                            report.append({"path":identity,"status":"REJECTED","error":"ZIP size limit"}); continue
                        try: report.append(process(conn,agency,identity,zipf.read(member),ext,args.dry_run))
                        except Exception as e: report.append({"path":identity,"status":"ERROR","error":str(e)[:500]})
            except (BadZipFile, OSError) as e:
                report.append({"path":path.relative_to(root).as_posix(),"status":"ERROR","error":str(e)})
        else:
            identity = path.relative_to(root).as_posix()
            try: report.append(process(conn,agency,identity,path.read_bytes(),suffix,args.dry_run))
            except Exception as e: report.append({"path":identity,"status":"ERROR","error":str(e)[:500]})
    conn.close()
    counts = {key:sum(x["status"] == key for x in report) for key in sorted({x["status"] for x in report})}
    payload = {"datasetRoot":str(root),"database":str(db),"dryRun":args.dry_run,"counts":counts,"files":report}
    out = Path(args.report)
    if not out.is_absolute(): out = PROJECT / out
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(payload,indent=2,ensure_ascii=False),encoding="utf8")
    print(json.dumps(counts,ensure_ascii=False))
    print("Report:",out)
    if counts.get("ERROR"): raise SystemExit(2)

if __name__ == "__main__": main()
