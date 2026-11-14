"""Command Line Interface for SICES High-Performance Data Pipeline.

Enables offline, direct-disk batch ingestion of multi-gigabyte and multi-terabyte datasets.
"""
import argparse
import glob
import os
import sys
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sices.config import UPLOAD_DIR
from sices.ingestion.job_manager import JobManager


def main() -> None:
    parser = argparse.ArgumentParser(description="SICES Ingestion CLI (2TB+ Streaming Engine)")
    subparsers = parser.add_subparsers(dest="command", help="Comandos disponibles")

    # Ingest command
    ingest_p = subparsers.add_parser("ingest", help="Importar archivos directamente a SICES")
    ingest_p.add_argument("paths", nargs="+", help="Ruta de archivos o carpetas (soporta comodines)")
    ingest_p.add_argument("--psi", dest="psi", default=None, help="Forzar código PSI (ej: PSI-117)")
    ingest_p.add_argument("--dry", action="store_true", help="Solo analizar sin persistir en base de datos")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "ingest":
        resolved_files = []
        for p in args.paths:
            path_obj = Path(p)
            if path_obj.is_dir():
                for ext in ("*.csv", "*.tsv", "*.txt"):
                    resolved_files.extend(str(f) for f in path_obj.glob(ext))
            elif "*" in p:
                resolved_files.extend(glob.glob(p))
            elif path_obj.exists():
                resolved_files.append(str(path_obj))

        if not resolved_files:
            print("❌ No se encontraron archivos para importar.")
            sys.exit(1)

        print(f"🚀 Iniciando procesamiento streaming de {len(resolved_files)} archivos...")
        manager = JobManager()
        job = manager.create_job(resolved_files, dry_run=args.dry, psi_override=args.psi)
        manager.start_job_async(job)

        while job.status in ("queued", "running"):
            pct = int(job.progress * 100)
            curr = job.current_file or "Iniciando..."
            print(f"\r⏳ [{pct:3d}%] Procesando: {curr[:45]:45s} (Completados: {job.completed_files}/{job.total_files})", end="", flush=True)
            time.sleep(0.3)

        print("\n" + "=" * 80)
        print(f"✅ Proceso completado con estado: {job.status}")
        print(f"📊 Series creadas: {job.total_series_created} | Puntos totales: {job.total_points_created}")
        print(f"⏱️ Tiempo transcurrido: {job.to_dict()['elapsedSeconds']} segundos")
        if job.errors:
            print("⚠️ Errores encontrados:")
            for err in job.errors:
                print(f"   - {err}")
        print("=" * 80)


if __name__ == "__main__":
    main()
