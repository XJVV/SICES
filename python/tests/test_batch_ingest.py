"""SICES batch ingestion: no invented units or data."""
import unittest
from sices.ingestion.batch_ingest import agency_of, field, convert, normalized_rows
from pathlib import Path

class TestBatch(unittest.TestCase):
    def test_agency(self):
        self.assertEqual(agency_of(Path("/d/NASA_PSI/part.csv"),Path("/d")),"NASA_PSI")
        with self.assertRaises(ValueError):
            agency_of(Path("/d/JAXA_KIBO/file.zip"),Path("/d"))
    def test_units(self):
        self.assertAlmostEqual(convert("pressurePsi","atm","1"),14.6959487755)
        self.assertEqual(convert("o2Percent","fraction","0.3"),30)
        self.assertEqual(convert("airflowCmS","m/s","0.2"),20)
        self.assertIsNone(convert("pressurePsi","","10"))
    def test_oxygen_initial_vs_final(self):
        blob = b"O2 initial concentration (%),O2 final concentration (%),pressure (kPa)\n56,15,101.325\n"
        result, errors = normalized_rows(blob, ".csv")
        self.assertFalse(errors)
        self.assertEqual(result[0]["o2Percent"], 56)
        self.assertEqual(result[0]["o2FinalPercent"], 15)
        self.assertAlmostEqual(result[0]["pressurePsi"], 14.69594877, places=3)
    def test_header(self):
        self.assertEqual(field("O2 concentration (%)"),("o2Percent","%"))
        self.assertIsNone(field("oxygen consumption (mg/s)"))
if __name__ == "__main__": unittest.main()
