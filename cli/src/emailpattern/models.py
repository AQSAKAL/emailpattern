"""Typed results. Built from the API's JSON; the JSON itself stays available as `raw`."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Candidate:
    """One possible address and how likely it is."""

    email: str | None
    """The address, or None when no name was given (then only the format is known)."""
    pattern: str
    """Format id, e.g. "first-dot-last"."""
    template: str
    """The format written out, e.g. "{first}.{last}@acme.com"."""
    confidence: float
    """Share of the company's people expected to use this format, 0 to 1."""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Candidate:
        return cls(
            email=data.get("email"),
            pattern=data["pattern"],
            template=data["template"],
            confidence=float(data["confidence"]),
        )


@dataclass(frozen=True)
class Mail:
    accepts_mail: bool | None
    """Whether the domain has a mail server; None when the check failed."""
    host: str | None
    """Who runs its mail, e.g. "Google Workspace", when recognised."""


@dataclass(frozen=True)
class FindResult:
    """The answer for one lookup."""

    domain: str | None
    """The cleaned-up domain, or None when the input wasn't a website."""
    error: str | None
    """"invalid_domain" or "invalid_name" when the input couldn't be used, else None."""
    company_name: str | None
    known_domain: bool
    """True when the formats come from people seen at this company, False for the global defaults."""
    sample_count: int
    candidates: tuple[Candidate, ...]
    mail: Mail
    raw: dict[str, Any] = field(repr=False, compare=False)

    @property
    def ok(self) -> bool:
        return self.error is None

    @property
    def best(self) -> Candidate | None:
        """The most likely candidate, if there is one."""
        return self.candidates[0] if self.candidates else None

    @property
    def email(self) -> str | None:
        """The most likely address, or None without a name or a usable domain."""
        return self.best.email if self.best else None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> FindResult:
        mail = data.get("mail") or {}
        return cls(
            domain=data.get("domain"),
            error=data.get("error"),
            company_name=data.get("company_name"),
            known_domain=bool(data.get("known_domain")),
            sample_count=int(data.get("sample_count") or 0),
            candidates=tuple(Candidate.from_dict(c) for c in data.get("candidates") or []),
            mail=Mail(accepts_mail=mail.get("accepts_mail"), host=mail.get("host")),
            raw=data,
        )
