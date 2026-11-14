"""Memory-safe streaming reader for massive tabular datasets (up to terabytes).

Never reads entire files into RAM. Streams lines/chunks with constant memory footprint
and automatically handles diverse delimiters and encodings.
"""
import io
import os
from typing import Generator, List, Optional, Tuple


def detect_file_encoding(file_path: str, sample_size: int = 65536) -> str:
    """Detects encoding by probing the first sample_size bytes."""
    with open(file_path, "rb") as f:
        sample = f.read(sample_size)
    
    if sample.startswith(b"\xef\xbb\xbf"):
        return "utf-8-sig"
    if sample.startswith(b"\xff\xfe") or sample.startswith(b"\xfe\xff"):
        return "utf-16"

    # Test standard UTF-8
    try:
        sample.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        pass

    # Common scientific dataset encodings
    for enc in ("latin-1", "cp1252", "iso-8859-1"):
        try:
            sample.decode(enc)
            return enc
        except UnicodeDecodeError:
            continue

    return "utf-8"  # fallback with replace errors


def detect_delimiter(sample_lines: List[str]) -> str:
    """Detects delimiter from a few representative non-empty lines."""
    text = "\n".join(sample_lines[:10])
    counts = {
        ",": text.count(","),
        ";": text.count(";"),
        "\t": text.count("\t"),
    }
    best = max(counts, key=counts.get)
    return best if counts[best] > 0 else ","


class StreamRowReader:
    """Stream-based generator that parses delimited rows with bounded memory."""

    def __init__(self, file_path: str, delimiter: Optional[str] = None, encoding: Optional[str] = None):
        self.file_path = file_path
        self.file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        self.encoding = encoding or detect_file_encoding(file_path)
        self.delimiter = delimiter
        self.bytes_read = 0
        self.rows_count = 0

    def _split_row(self, line: str, delim: str) -> List[str]:
        """Custom high-speed split respecting quoted substrings."""
        row: List[str] = []
        cur: List[str] = []
        quoted = False
        i = 0
        n = len(line)
        while i < n:
            ch = line[i]
            if quoted:
                if ch == '"':
                    if i + 1 < n and line[i + 1] == '"':
                        cur.append('"')
                        i += 1
                    else:
                        quoted = False
                else:
                    cur.append(ch)
            elif ch == '"':
                quoted = True
            elif ch == delim:
                row.append("".join(cur).strip())
                cur = []
            else:
                cur.append(ch)
            i += 1
        row.append("".join(cur).strip())
        return row

    def stream_rows(self) -> Generator[Tuple[int, List[str]], None, None]:
        """Yields (row_index, columns_list) sequentially."""
        # Read header sample for delimiter detection if not provided
        if not self.delimiter:
            sample_lines: List[str] = []
            with open(self.file_path, "r", encoding=self.encoding, errors="replace") as f:
                for _ in range(15):
                    line = f.readline()
                    if not line:
                        break
                    if line.strip():
                        sample_lines.append(line)
            self.delimiter = detect_delimiter(sample_lines)

        self.bytes_read = 0
        self.rows_count = 0

        with open(self.file_path, "r", encoding=self.encoding, errors="replace", buffering=1024*1024) as f:
            for line_idx, line in enumerate(f):
                self.bytes_read += len(line.encode("utf-8", errors="ignore"))
                clean_line = line.strip("\r\n")
                if not clean_line.strip():
                    continue
                row = self._split_row(clean_line, self.delimiter)
                self.rows_count += 1
                yield line_idx, row

    @property
    def progress_fraction(self) -> float:
        if self.file_size == 0:
            return 1.0
        return min(1.0, self.bytes_read / self.file_size)
