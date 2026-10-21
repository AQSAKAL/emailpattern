from rich.console import Console

from emailpattern_cli import render

RESULT = {
    "query": {"domain": "acme.com", "name": "Jane Doe"},
    "domain": "acme.com",
    "error": None,
    "company_name": "Acme",
    "known_domain": True,
    "sample_count": 41,
    "candidates": [
        {"email": "jane.doe@acme.com", "pattern": "first-dot-last", "template": "{first}.{last}@acme.com", "confidence": 0.86},
        {"email": "jdoe@acme.com", "pattern": "flast", "template": "{f}{last}@acme.com", "confidence": 0.08},
    ],
    "mail": {"accepts_mail": True, "host": "Google Workspace"},
}


def plain(renderable) -> str:
    console = Console(width=100, record=True, color_system=None, theme=render.THEME)
    console.print(renderable)
    return console.export_text()


def test_address_format_colours_tokens_and_dims_domain():
    text = render.address_format("{f}.{last}@acme.com")
    assert text.plain == "{f}.{last}@acme.com"
    styles = {text.plain[span.start : span.end]: str(span.style) for span in text.spans}
    assert styles["f"] == "token.f"
    assert styles["last"] == "token.last"
    assert styles["@acme.com"] == "muted"


def test_percent_never_shows_a_real_share_as_zero():
    assert render.percent(0.86) == "86%"
    assert render.percent(0.004) == "<1%"
    assert render.percent(0.005) == "1%"
    assert render.percent(0) == "0%"


def test_find_result_shows_address_odds_and_mail():
    out = plain(render.find_result(RESULT))
    assert "jane.doe@acme.com" in out
    assert "86% of the 41 people" in out
    assert "Google Workspace" in out
    assert "jdoe@acme.com" in out


def test_find_result_for_unknown_domain_says_so():
    out = plain(render.find_result({**RESULT, "known_domain": False, "sample_count": 0}))
    assert "No addresses from acme.com yet" in out


def test_invalid_domain_is_explained():
    out = plain(render.find_result({**RESULT, "error": "invalid_domain", "query": {"domain": "nope"}, "candidates": []}))
    assert "doesn't look like a website" in out


def test_domain_result_lists_formats_without_repeating_the_domain():
    out = plain(render.domain_result({**RESULT, "candidates": [{**c, "email": None} for c in RESULT["candidates"]]}))
    assert "{first}.{last}" in out
    assert "{first}.{last}@acme.com" not in out
    assert "Based on 41 people" in out


def test_bulk_summary_counts():
    assert "1 row skipped" in render.bulk_summary(3, 2, 1, "out.csv").plain
    assert "skipped" not in render.bulk_summary(3, 2, 0, "out.csv").plain
