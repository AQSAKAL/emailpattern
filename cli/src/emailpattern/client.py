"""HTTP clients for the public API. The only module that talks to the network."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable, Iterable, Iterator, Mapping
from typing import Any, Union

import httpx

from emailpattern import __version__
from emailpattern.models import FindResult

DEFAULT_API = "https://emailpattern.com"
MAX_BATCH = 50
"""People per request; find_many splits longer lists itself."""

Person = Union[Mapping[str, str], tuple[str, str]]
"""A person to look up: {"name": ..., "domain": ...} or (name, domain)."""


class ApiError(Exception):
    """The API couldn't answer; the message says why in plain words."""


class RateLimited(ApiError):
    def __init__(self, retry_after: int) -> None:
        super().__init__(f"Too many lookups. Try again in {retry_after} s.")
        self.retry_after = retry_after


def _query(person: Person) -> dict[str, str]:
    if isinstance(person, tuple):
        name, domain = person
        return {"name": name, "domain": domain}
    return {"name": person.get("name", ""), "domain": person.get("domain", "")}


def _chunks(items: list[dict[str, str]], size: int) -> Iterator[list[dict[str, str]]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


def _decode(response: httpx.Response, allow_input_errors: bool = False) -> dict[str, Any]:
    if response.status_code == 429:
        raise RateLimited(int(response.headers.get("retry-after", "60")))
    # 422 carries a normal result whose `error` field says what was wrong with the input.
    if response.is_error and not (allow_input_errors and response.status_code == 422):
        raise ApiError(f"The API answered {response.status_code}.")
    return response.json()


def _headers(user_agent: str | None) -> dict[str, str]:
    return {"user-agent": user_agent or f"emailpattern-python/{__version__}"}


class Client:
    """Synchronous client.

    >>> from emailpattern import Client
    >>> with Client() as ep:
    ...     ep.find("Jane Doe", "acme.com").email
    """

    def __init__(
        self,
        base_url: str = DEFAULT_API,
        *,
        timeout: float = 20,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
        user_agent: str | None = None,
    ) -> None:
        self._http = httpx.Client(base_url=base_url.rstrip("/"), timeout=timeout, transport=transport, headers=_headers(user_agent))
        self._sleep = sleep

    def find(self, name: str, domain: str) -> FindResult:
        """The most likely address for a person at a company website or domain."""
        return FindResult.from_dict(self.find_raw(domain, name))

    def domain(self, domain: str) -> FindResult:
        """Every format a company uses, with shares (no name, so candidates have no email)."""
        return FindResult.from_dict(_decode(self._http.get(f"/api/v1/domains/{domain}"), allow_input_errors=True))

    def find_many(self, people: Iterable[Person], retries: int = 3) -> list[FindResult]:
        """Look up any number of people, MAX_BATCH per request, in order. Waits out rate limits."""
        return [FindResult.from_dict(r) for r in self.find_many_raw([_query(p) for p in people], retries)]

    def find_raw(self, domain: str, name: str | None = None) -> dict[str, Any]:
        params = {"domain": domain, **({"name": name} if name else {})}
        return _decode(self._http.get("/api/v1/find", params=params), allow_input_errors=True)

    def find_many_raw(self, queries: list[dict[str, str]], retries: int = 3) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for chunk in _chunks(queries, MAX_BATCH):
            for attempt in range(retries + 1):
                try:
                    results += _decode(self._http.post("/api/v1/find", json={"queries": chunk}))["results"]
                    break
                except RateLimited as limited:
                    if attempt == retries:
                        raise
                    self._sleep(limited.retry_after)
        return results

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> Client:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


class AsyncClient:
    """Asynchronous client with the same methods as Client.

    >>> async with AsyncClient() as ep:
    ...     (await ep.find("Jane Doe", "acme.com")).email
    """

    def __init__(
        self,
        base_url: str = DEFAULT_API,
        *,
        timeout: float = 20,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        user_agent: str | None = None,
    ) -> None:
        self._http = httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=timeout, transport=transport, headers=_headers(user_agent))
        self._sleep = sleep

    async def find(self, name: str, domain: str) -> FindResult:
        params = {"domain": domain, **({"name": name} if name else {})}
        return FindResult.from_dict(_decode(await self._http.get("/api/v1/find", params=params), allow_input_errors=True))

    async def domain(self, domain: str) -> FindResult:
        return FindResult.from_dict(_decode(await self._http.get(f"/api/v1/domains/{domain}"), allow_input_errors=True))

    async def find_many(self, people: Iterable[Person], retries: int = 3) -> list[FindResult]:
        results: list[FindResult] = []
        for chunk in _chunks([_query(p) for p in people], MAX_BATCH):
            for attempt in range(retries + 1):
                try:
                    response = await self._http.post("/api/v1/find", json={"queries": chunk})
                    results += [FindResult.from_dict(r) for r in _decode(response)["results"]]
                    break
                except RateLimited as limited:
                    if attempt == retries:
                        raise
                    await self._sleep(limited.retry_after)
        return results

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> AsyncClient:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()
