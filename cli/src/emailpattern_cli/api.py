"""HTTP calls to the public API. The only module that talks to the network."""

from __future__ import annotations

import time
from typing import Any

import httpx

from emailpattern_cli import __version__

DEFAULT_API = "https://emailpattern.com"
MAX_BATCH = 50


class ApiError(Exception):
    """A response the CLI can explain to a person."""


class RateLimited(ApiError):
    def __init__(self, retry_after: int) -> None:
        super().__init__(f"Too many lookups. Try again in {retry_after} s.")
        self.retry_after = retry_after


class Client:
    def __init__(self, base_url: str = DEFAULT_API, transport: httpx.BaseTransport | None = None) -> None:
        self._http = httpx.Client(
            base_url=base_url.rstrip("/"),
            timeout=20,
            transport=transport,
            headers={"user-agent": f"emailpattern-cli/{__version__}"},
        )

    def find(self, domain: str, name: str | None = None) -> dict[str, Any]:
        params = {"domain": domain, **({"name": name} if name else {})}
        return self._json(self._http.get("/api/v1/find", params=params), allow_error_status=True)

    def domain(self, domain: str) -> dict[str, Any]:
        return self._json(self._http.get(f"/api/v1/domains/{domain}"), allow_error_status=True)

    def find_many(self, queries: list[dict[str, str]], retries: int = 3) -> list[dict[str, Any]]:
        """One POST for up to MAX_BATCH queries; waits out rate limits a few times."""
        for attempt in range(retries + 1):
            try:
                return self._json(self._http.post("/api/v1/find", json={"queries": queries}))["results"]
            except RateLimited as limited:
                if attempt == retries:
                    raise
                time.sleep(limited.retry_after)
        raise AssertionError("unreachable")

    def _json(self, response: httpx.Response, allow_error_status: bool = False) -> dict[str, Any]:
        if response.status_code == 429:
            raise RateLimited(int(response.headers.get("retry-after", "60")))
        # 422 carries a normal result whose `error` field says what was wrong with the input.
        if response.is_error and not (allow_error_status and response.status_code == 422):
            raise ApiError(f"The API answered {response.status_code}.")
        return response.json()
