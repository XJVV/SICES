"""Configuration for SICES Python Data Engine."""
import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "upload"
DATA_DIR = BASE_DIR / "data"
PARQUET_DIR = DATA_DIR / "parquet"
DB_PATH = BASE_DIR / "db" / "custom.db"

# Streaming & chunking configuration for 2TB+ scale
DEFAULT_CHUNK_SIZE_BYTES = 64 * 1024 * 1024  # 64 MB chunks
DEFAULT_ROW_BATCH_SIZE = 100_000             # 100K rows per batch
MAX_MEMORY_BUFFER_MB = 256                   # Constant memory envelope
DECIMATION_TARGET_POINTS = 2_000             # LTTB points for UI rendering

# Ensure required directories exist
for directory in (UPLOAD_DIR, DATA_DIR, PARQUET_DIR):
    directory.mkdir(parents=True, exist_ok=True)
