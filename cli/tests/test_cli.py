import json

import httpx
from click.testing import CliRunner

from emailpattern_cli.api import Client
from emailpattern_cli.main import cli


def result(domain: str, name: str | None = None, error: str | None = None) -> dict:
    local = (name or "").lower().replace(" ", ".")
    return {
        "query": {"domain": domain, "name": name},
        "domain": None if error else domain,
        "error": error,
        "company_name": None,
        "known_domain": True,
        "sample_count": 12,
        "candidates": [] if error else [{"email": f"{local}@{domain}" if name else None, "pattern": "first-dot-last", "template": f"{{first}}.{{last}}@{domain}", "confidence": 0.9}],
        "mail": {"accepts_mail": True, "host": None},
    }


def handler(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/api/v1/find" and request.method == "GET":
        domain = request.url.params["domain"]
        if "." not in domain:
            return httpx.Response(422, json=result(domain, error="invalid_domain"))
        return httpx.Response(200, json=result(domain, request.url.params.get("name")))
    if request.url.path == "/api/v1/find" and request.method == "POST":
        queries = json.loads(request.content)["queries"]
        return httpx.Response(200, json={"results": [result(q["domain"], q["name"], None if "." in q["domain"] else "invalid_domain") for q in queries]})
    if request.url.path.startswith("/api/v1/domains/"):
        return httpx.Response(200, json=result(request.url.path.rsplit("/", 1)[1]))
    return httpx.Response(404)


def run(*args: str):
    client = Client("http://test", transport=httpx.MockTransport(handler))
    return CliRunner().invoke(cli, list(args), obj={"client": client}, catch_exceptions=False)


def test_find_prints_the_address():
    out = run("find", "Jane Doe", "acme.com")
    assert out.exit_code == 0
    assert "jane.doe@acme.com" in out.output


def test_find_json_is_the_raw_result():
    out = run("find", "Jane Doe", "acme.com", "--json")
    assert json.loads(out.output)["candidates"][0]["email"] == "jane.doe@acme.com"


def test_find_with_a_bad_domain_exits_2():
    out = run("find", "Jane", "nope")
    assert out.exit_code == 2
    assert "doesn't look like a website" in out.output


def test_domain_lists_formats():
    out = run("domain", "acme.com")
    assert out.exit_code == 0
    assert "{first}.{last}" in out.output


def test_bulk_writes_an_enriched_copy(tmp_path):
    source = tmp_path / "leads.csv"
    source.write_text("Full Name,Website\nJane Doe,acme.com\nBob,nope\n", encoding="utf-8")
    out = run("bulk", str(source))
    assert out.exit_code == 0, out.output
    lines = (tmp_path / "leads.emails.csv").read_text(encoding="utf-8").splitlines()
    assert lines[0] == "Full Name,Website,email,pattern,confidence,known_domain,accepts_mail,error"
    assert lines[1].startswith("Jane Doe,acme.com,jane.doe@acme.com")
    assert lines[2].endswith("invalid_domain")


def test_bulk_without_recognisable_columns_fails_clearly(tmp_path):
    source = tmp_path / "x.csv"
    source.write_text("a,b\n1,2\n", encoding="utf-8")
    out = run("bulk", str(source))
    assert out.exit_code == 1
