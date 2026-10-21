import asyncio
import json

import httpx
import pytest

import emailpattern
from emailpattern import AsyncClient, Client, FindResult, RateLimited


def result(domain: str, name: str | None = None, error: str | None = None) -> dict:
    local = (name or "").lower().replace(" ", ".")
    return {
        "query": {"domain": domain, "name": name},
        "domain": None if error else domain,
        "error": error,
        "company_name": "Acme" if not error else None,
        "known_domain": True,
        "sample_count": 12,
        "candidates": []
        if error
        else [
            {"email": f"{local}@{domain}" if name else None, "pattern": "first-dot-last", "template": f"{{first}}.{{last}}@{domain}", "confidence": 0.9},
            {"email": f"{local[:1]}@{domain}" if name else None, "pattern": "first", "template": f"{{first}}@{domain}", "confidence": 0.1},
        ],
        "mail": {"accepts_mail": True, "host": "Google Workspace"},
    }


class Api:
    """A fake API that records batch sizes and can rate-limit the first N posts."""

    def __init__(self, limit_first: int = 0) -> None:
        self.batches: list[int] = []
        self.limit_first = limit_first

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/v1/find" and request.method == "GET":
            domain = request.url.params["domain"]
            if "." not in domain:
                return httpx.Response(422, json=result(domain, error="invalid_domain"))
            return httpx.Response(200, json=result(domain, request.url.params.get("name")))
        if request.url.path == "/api/v1/find":
            if self.limit_first:
                self.limit_first -= 1
                return httpx.Response(429, headers={"retry-after": "3"}, json={"error": "rate_limited"})
            queries = json.loads(request.content)["queries"]
            self.batches.append(len(queries))
            return httpx.Response(200, json={"results": [result(q["domain"], q["name"]) for q in queries]})
        if request.url.path.startswith("/api/v1/domains/"):
            return httpx.Response(200, json=result(request.url.path.rsplit("/", 1)[1]))
        return httpx.Response(404)


def test_find_returns_a_typed_result():
    with Client("http://test", transport=httpx.MockTransport(Api())) as client:
        found = client.find("Jane Doe", "acme.com")
    assert isinstance(found, FindResult)
    assert found.ok and found.email == "jane.doe@acme.com"
    assert found.best.template == "{first}.{last}@acme.com"
    assert found.mail.host == "Google Workspace"
    assert found.raw["company_name"] == "Acme"


def test_bad_input_is_a_result_not_an_exception():
    with Client("http://test", transport=httpx.MockTransport(Api())) as client:
        found = client.find("Jane", "nope")
    assert not found.ok and found.error == "invalid_domain"
    assert found.email is None and found.best is None


def test_domain_has_formats_without_addresses():
    with Client("http://test", transport=httpx.MockTransport(Api())) as client:
        formats = client.domain("acme.com")
    assert [c.pattern for c in formats.candidates] == ["first-dot-last", "first"]
    assert formats.email is None


def test_find_many_splits_into_batches_and_keeps_order():
    api = Api()
    people = [(f"Person {i}", "acme.com") for i in range(120)]
    with Client("http://test", transport=httpx.MockTransport(api)) as client:
        found = client.find_many(people)
    assert api.batches == [50, 50, 20]
    assert [f.email for f in found[:2]] == ["person.0@acme.com", "person.1@acme.com"]
    assert found[-1].email == "person.119@acme.com"


def test_find_many_accepts_dicts_and_waits_out_rate_limits():
    waits = []
    with Client("http://test", transport=httpx.MockTransport(Api(limit_first=1)), sleep=waits.append) as client:
        found = client.find_many([{"name": "Jane Doe", "domain": "acme.com"}])
    assert waits == [3]
    assert found[0].email == "jane.doe@acme.com"


def test_find_many_gives_up_after_retries():
    with Client("http://test", transport=httpx.MockTransport(Api(limit_first=5)), sleep=lambda _: None) as client:
        with pytest.raises(RateLimited):
            client.find_many([("Jane Doe", "acme.com")], retries=1)


def test_async_client_matches_the_sync_one():
    async def run():
        waits = []

        async def sleep(seconds):
            waits.append(seconds)

        async with AsyncClient("http://test", transport=httpx.MockTransport(Api(limit_first=1)), sleep=sleep) as client:
            one = await client.find("Jane Doe", "acme.com")
            many = await client.find_many([("Jane Doe", "acme.com")] * 60)
        return one, many, waits

    one, many, waits = asyncio.run(run())
    assert one.email == "jane.doe@acme.com"
    assert len(many) == 60 and waits == [3]


def test_module_level_helpers_exist():
    assert callable(emailpattern.find) and callable(emailpattern.domain)
    assert emailpattern.__version__ == "0.2.1"
