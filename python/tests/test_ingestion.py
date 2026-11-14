"""Tests for SICES Python Streaming Ingestion & Decimation Engine."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

# Add python directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sices.ingestion.decimation import lttb
from sices.ingestion.streaming import StreamRowReader
from sices.ingestion.parser import DatasetParser
from sices.ingestion.job_manager import JobManager


class TestIngestionEngine(unittest.TestCase):
    def test_lttb_decimation(self):
        # 10,000 synthetic points with a sharp peak at x=5000
        points = [[float(i), float(i % 100)] for i in range(10000)]
        points[5000] = [5000.0, 9999.0]  # extreme peak

        sampled = lttb(points, 200)
        self.assertEqual(len(sampled), 200)
        self.assertEqual(sampled[0], [0.0, 0.0])
        self.assertEqual(sampled[-1], [9999.0, 99.0])
        
        # Verify the extreme peak was retained by LTTB
        peak_found = any(p[0] == 5000.0 and p[1] == 9999.0 for p in sampled)
        self.assertTrue(peak_found, "LTTB must preserve significant peaks")

    def test_streaming_reader(self):
        # Create a temporary CSV with 5,000 lines
        with tempfile.NamedTemporaryFile("w+", delete=False, suffix=".csv") as tmp:
            tmp.write("time,pressure,temp\n")
            for i in range(5000):
                tmp.write(f"{i*0.1},{1.0 + i*0.01},{300.0 + i*0.5}\n")
            tmp_path = tmp.name

        try:
            reader = StreamRowReader(tmp_path)
            rows = list(reader.stream_rows())
            self.assertEqual(len(rows), 5001)
            self.assertEqual(rows[0][1], ["time", "pressure", "temp"])
            self.assertEqual(reader.progress_fraction, 1.0)
        finally:
            os.unlink(tmp_path)

    def test_real_psi_parser(self):
        upload_dir = Path(__file__).resolve().parent.parent.parent / "upload"
        sample_file = upload_dir / "PSI-117_Analyzed Data_MST_2024_Dext.csv"
        
        if sample_file.exists():
            parser = DatasetParser(decimate=True, max_points=100)
            res = parser.parse_file(str(sample_file))
            self.assertEqual(res.get("psiCode"), "PSI-117")
            self.assertIsNotNone(res.get("dataset"))
            series = res["dataset"].get("series", [])
            self.assertGreater(len(series), 0)

    def test_job_manager_execution(self):
        upload_dir = Path(__file__).resolve().parent.parent.parent / "upload"
        sample_files = [
            str(upload_dir / "PSI-117_Analyzed Data_MST_2024_Dext.csv"),
            str(upload_dir / "PSI-117_Analyzed Data_MST_2024_Kavg.csv"),
        ]
        valid_files = [f for f in sample_files if os.path.exists(f)]
        
        if valid_files:
            manager = JobManager()
            job = manager.create_job(valid_files, dry_run=True)
            manager._run_job(job)  # Run synchronously for test
            
            self.assertIn(job.status, ("completed", "completed_with_errors"))
            self.assertEqual(job.completed_files, len(valid_files))
            self.assertEqual(job.progress, 1.0)
            self.assertGreater(len(job.reports), 0)


if __name__ == "__main__":
    unittest.main()
