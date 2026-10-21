"""Reading people from a CSV and writing results back. Pure apart from the file handles passed in."""

from __future__ import annotations

import csv
from collections.abc import Iterable, Iterator
from typing import Any, TextIO

NAME_COLUMNS = ("name", "full_name", "full name", "person", "contact")
DOMAIN_COLUMNS = ("domain", "website", "company_domain", "company website", "url", "site")
RESULT_COLUMNS = ("email", "pattern", "confidence", "known_domain", "accepts_mail")


def pick_column(headers: list[str], wanted: str | None, candidates: tuple[str, ...]) -> str | None:
    """The header to read: the one asked for, else the first that looks right (case-insensitive)."""
    by_lower = {h.strip().lower(): h for h in headers}
    if wanted:
        return by_lower.get(wanted.strip().lower())
    return next((by_lower[c] for c in candidates if c in by_lower), None)


def batches(items: list[Any], size: int) -> Iterator[list[Any]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


def result_fields(result: dict[str, Any]) -> dict[str, str]:
    """The columns a bulk run adds for one person."""
    best = (result.get("candidates") or [{}])[0]
    accepts = (result.get("mail") or {}).get("accepts_mail")
    return {
        "email": best.get("email") or "",
        "pattern": best.get("template") or "",
        "confidence": f"{best['confidence']:.3f}" if "confidence" in best else "",
        "known_domain": "yes" if result.get("known_domain") else "no",
        "accepts_mail": "" if accepts is None else ("yes" if accepts else "no"),
        **({"error": result["error"]} if result.get("error") else {}),
    }


def write_rows(out: TextIO, headers: list[str], rows: Iterable[dict[str, str]]) -> None:
    extra = [c for c in (*RESULT_COLUMNS, "error") if c not in headers]
    writer = csv.DictWriter(out, fieldnames=[*headers, *extra], extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
