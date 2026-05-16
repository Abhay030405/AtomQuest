from __future__ import annotations

import csv
import io
from typing import Any, Sequence

from fastapi.responses import StreamingResponse


def dict_to_csv(rows: Sequence[dict[str, Any]], fieldnames: list[str]) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore", lineterminator="\r\n")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


def generate_csv_streaming_response(content: str, filename: str) -> StreamingResponse:
    def _iter():
        yield content.encode("utf-8-sig")  # BOM so Excel opens correctly

    return StreamingResponse(
        _iter(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
