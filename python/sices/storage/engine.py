"""Storage and database engine for SICES Python backend.

Bridges SQLite metadata and Parquet/DuckDB analytics.
"""
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from sices.config import DB_PATH, PARQUET_DIR


class StorageEngine:
    """Manages transactional insertion and retrieval of investigations, datasets, and series."""

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DB_PATH

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        try:
            yield conn
        finally:
            conn.close()

    def get_or_create_investigation(
        self,
        psi_code: str,
        short_name: Optional[str] = None,
        name: Optional[str] = None,
        combustion_type: str = "SOLID_SURFACE",
        category: str = "PRINCIPAL",
    ) -> int:
        """Finds existing investigation by PSI code or inserts a new one."""
        with self.connect() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM Investigation WHERE psiCode = ?", (psi_code,))
            row = cursor.fetchone()
            if row:
                return row["id"]

            s_name = short_name or psi_code
            full_name = name or f"Investigación {psi_code}"
            cursor.execute(
                """
                INSERT INTO Investigation (
                    psiCode, shortName, name, category, combustionType,
                    platform, period, investigator, doi, psiUrl,
                    description, objectives, methodology, fuel, oxygen,
                    pressure, temperature, flow, results, conclusions,
                    dataAvailable, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', datetime('now'), datetime('now'))
                """,
                (psi_code, s_name, full_name, category, combustion_type),
            )
            conn.commit()
            return cursor.lastrowid

    def save_dataset(
        self,
        investigation_id: int,
        dataset_data: Dict[str, Any],
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """Saves a parsed dataset with its series into the database.
        
        Returns a summary report indicating whether it was created or skipped.
        """
        key = dataset_data.get("key", "").strip()
        if not key:
            raise ValueError("Dataset key cannot be empty")

        with self.connect() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM Dataset WHERE key = ?", (key,))
            existing = cursor.fetchone()
            if existing:
                return {
                    "key": key,
                    "name": dataset_data.get("nameEs", key),
                    "tag": dataset_data.get("tag", ""),
                    "skipped": True,
                    "created": False,
                    "seriesCount": len(dataset_data.get("series", [])),
                    "message": "Dataset ya existía (idempotente)",
                }

            if dry_run:
                return {
                    "key": key,
                    "name": dataset_data.get("nameEs", key),
                    "tag": dataset_data.get("tag", ""),
                    "skipped": False,
                    "created": False,
                    "seriesCount": len(dataset_data.get("series", [])),
                    "message": "Modo análisis (dry run) - no se guardó en BD",
                }

            cursor.execute(
                """
                INSERT INTO Dataset (
                    investigationId, key, nameEs, nameEn, tag,
                    fuel, condition, doi, reference, sort
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    investigation_id,
                    key,
                    dataset_data.get("nameEs", key),
                    dataset_data.get("nameEn", key),
                    dataset_data.get("tag", ""),
                    dataset_data.get("fuel", ""),
                    dataset_data.get("condition", ""),
                    dataset_data.get("doi", ""),
                    dataset_data.get("reference", ""),
                    dataset_data.get("sort", 0),
                ),
            )
            dataset_id = cursor.lastrowid

            # Insert series
            series_list = dataset_data.get("series", [])
            total_points = 0
            for idx, s in enumerate(series_list):
                pts = s.get("points", [])
                total_points += len(pts)
                pts_json = json.dumps(pts)
                cursor.execute(
                    """
                    INSERT INTO DataSeries (
                        datasetId, metric, xKind, xUnit, yUnit,
                        label, source, pointsJson, sort
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        dataset_id,
                        s.get("metric", "unknown"),
                        s.get("xKind", "time_s"),
                        s.get("xUnit", "s"),
                        s.get("yUnit", ""),
                        s.get("label", f"Serie {idx + 1}"),
                        s.get("source", "EXPERIMENT"),
                        pts_json,
                        s.get("sort", idx),
                    ),
                )

            conn.commit()
            return {
                "key": key,
                "name": dataset_data.get("nameEs", key),
                "tag": dataset_data.get("tag", ""),
                "skipped": False,
                "created": True,
                "datasetId": dataset_id,
                "seriesCount": len(series_list),
                "pointsTotal": total_points,
            }
