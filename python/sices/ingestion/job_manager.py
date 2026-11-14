"""Background job manager for high-volume data imports.

Tracks real-time progress, throughput, and execution status of massive ingestion tasks.
"""
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from sices.ingestion.parser import DatasetParser
from sices.storage.engine import StorageEngine


class IngestionJob:
    def __init__(self, job_id: str, file_paths: List[str], dry_run: bool = False, psi_override: Optional[str] = None):
        self.job_id = job_id
        self.file_paths = file_paths
        self.dry_run = dry_run
        self.psi_override = psi_override
        self.status = "queued"  # queued | running | completed | failed
        self.progress: float = 0.0
        self.total_files = len(file_paths)
        self.completed_files = 0
        self.total_series_created = 0
        self.total_points_created = 0
        self.current_file: Optional[str] = None
        self.reports: List[Dict[str, Any]] = []
        self.errors: List[str] = []
        self.started_at: Optional[float] = None
        self.completed_at: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        elapsed = 0.0
        if self.started_at:
            end_time = self.completed_at or time.time()
            elapsed = round(end_time - self.started_at, 2)
            
        return {
            "jobId": self.job_id,
            "status": self.status,
            "progress": round(self.progress, 3),
            "totalFiles": self.total_files,
            "completedFiles": self.completed_files,
            "currentFile": self.current_file,
            "totalSeriesCreated": self.total_series_created,
            "totalPointsCreated": self.total_points_created,
            "elapsedSeconds": elapsed,
            "errors": self.errors,
            "reports": self.reports,
        }


class JobManager:
    _instance: Optional["JobManager"] = None
    _lock = threading.Lock()

    def __new__(cls) -> "JobManager":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance.jobs = {}
                cls._instance.storage = StorageEngine()
                cls._instance.parser = DatasetParser()
            return cls._instance

    def create_job(self, file_paths: List[str], dry_run: bool = False, psi_override: Optional[str] = None) -> IngestionJob:
        job_id = f"job_{uuid.uuid4().hex[:10]}"
        job = IngestionJob(job_id, file_paths, dry_run=dry_run, psi_override=psi_override)
        self.jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> Optional[IngestionJob]:
        return self.jobs.get(job_id)

    def start_job_async(self, job: IngestionJob) -> None:
        thread = threading.Thread(target=self._run_job, args=(job,), daemon=True)
        thread.start()

    def _run_job(self, job: IngestionJob) -> None:
        job.status = "running"
        job.started_at = time.time()

        for idx, fpath in enumerate(job.file_paths):
            path_obj = Path(fpath)
            job.current_file = path_obj.name
            try:
                parsed = self.parser.parse_file(str(path_obj), psi_code_override=job.psi_override)
                psi_code = parsed.get("psiCode")
                dataset_data = parsed.get("dataset")

                report: Dict[str, Any] = {
                    "fileName": path_obj.name,
                    "psiCode": psi_code,
                    "ok": True,
                    "warnings": parsed.get("warnings", []),
                }

                if dataset_data and psi_code:
                    inv_id = self.storage.get_or_create_investigation(psi_code)
                    save_res = self.storage.save_dataset(inv_id, dataset_data, dry_run=job.dry_run)
                    report["dataset"] = save_res
                    job.total_series_created += save_res.get("seriesCount", 0)
                    job.total_points_created += save_res.get("pointsTotal", 0)
                elif parsed.get("error"):
                    report["ok"] = False
                    report["error"] = parsed["error"]

                job.reports.append(report)
            except Exception as e:
                err_msg = f"Error procesando {path_obj.name}: {str(e)}"
                job.errors.append(err_msg)
                job.reports.append({
                    "fileName": path_obj.name,
                    "ok": False,
                    "error": err_msg,
                })

            job.completed_files += 1
            job.progress = job.completed_files / job.total_files

        job.status = "completed" if not job.errors else "completed_with_errors"
        job.completed_at = time.time()
        job.current_file = None
