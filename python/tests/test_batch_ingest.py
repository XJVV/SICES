"""SICES batch ingestion: no invented units or data."""
import unittest
from sices.ingestion.batch_ingest import agency_of, field, convert
from pathlib import Path

class TestBatch(unittest.TestCase):
    def test_agency(self):
        self.assertEqual(agency_of(Path("/d/NASA_PSI/part.csv"),Path("/d")),"NASA_PSI")
        self.assertEqual(agency_of(Path("/d/JAXA_KIBO/file.zip"),Path("/d")),"JAXA_KIBO")
    def test_units(self):
        self.assertAlmostEqual(convert("pressurePsi","atm","1"),14.6959487755)
        self.assertEqual(convert("o2Percent","fraction","0.3"),30)
        self.assertEqual(convert("airflowCmS","m/s","0.2"),20)
        self.assertIsNone(convert("pressurePsi","","10"))
    def test_header(self):
        self.assertEqual(field("O2 concentration (%)"),("o2Percent","%"))
        self.assertIsNone(field("oxygen consumption (mg/s)"))
if __name__ == "__main__": unittest.main()
