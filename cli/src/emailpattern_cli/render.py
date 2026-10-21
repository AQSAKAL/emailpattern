"""Turns API results into rich renderables, in the site's forest-and-leaf palette.

Pure: takes dicts, returns renderables. The commands decide where they are printed.
"""

from __future__ import annotations

import re
from typing import Any

from rich import box
from rich.console import Group, RenderableType
from rich.padding import Padding
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.theme import Theme

THEME = Theme(
    {
        "leaf": "bold #5fd47e",
        "lime": "#e6f7b0",
        "sage": "#7fa99b",
        "ink": "#0f1f1a",
        "frame": "#2c5a4c",
        "token.first": "bold #5fd47e",
        "token.last": "bold #7cc4d8",
        "token.f": "bold #b6d98a",
        "token.l": "bold #b6d98a",
        "brace": "#4a6b61",
        "muted": "#8fa69e",
        "warn": "bold #f08a6c",
    }
)

TOKEN = re.compile(r"\{(first|last|f|l)\}")
BAR_WIDTH = 18


def address_format(template: str) -> Text:
    """{first}.{last}@acme.com with each token coloured like on the site."""
    text = Text()
    position = 0
    for match in TOKEN.finditer(template):
        text.append(template[position : match.start()])
        token = match.group(1)
        text.append("{", style="brace")
        text.append(token, style=f"token.{token}")
        text.append("}", style="brace")
        position = match.end()
    at = template.find("@", position)
    if at == -1:
        text.append(template[position:])
    else:
        text.append(template[position:at])
        text.append(template[at:], style="muted")
    return text


def percent(share: float) -> str:
    """Whole percent; a share that rounds to zero but isn't zero reads "<1%"."""
    whole = int(share * 100 + 0.5)
    return "<1%" if share > 0 and whole < 1 else f"{whole}%"


def local_part(template: str) -> str:
    """The template without its @domain, for tables where the domain repeats on every row."""
    return template.split("@", 1)[0]


def bar(share: float, strong: bool = False) -> Text:
    filled = max(1, round(share * BAR_WIDTH)) if share > 0 else 0
    text = Text("━" * filled, style="leaf" if strong else "sage")
    text.append("━" * (BAR_WIDTH - filled), style="frame")
    return text


def mail_line(result: dict[str, Any]) -> Text:
    domain = result["domain"]
    mail = result.get("mail") or {}
    accepts = mail.get("accepts_mail")
    if accepts is False:
        return Text(f"✗ {domain} has no mail server, so messages will bounce.", style="warn")
    if accepts is None:
        return Text(f"? Couldn't check {domain}'s mail server.", style="muted")
    line = Text("✓ ", style="leaf").append(f"{domain} receives email")
    if mail.get("host"):
        line.append(f"  ·  {mail['host']}", style="muted")
    return line


def error_text(result: dict[str, Any]) -> Text | None:
    error = result.get("error")
    if error == "invalid_domain":
        return Text(f"“{result['query']['domain']}” doesn't look like a website. Try something like acme.com.", style="warn")
    if error == "invalid_name":
        return Text("Type a first name, or a first and last name.", style="warn")
    return None


def _evidence(result: dict[str, Any], top: dict[str, Any]) -> Text:
    if result.get("known_domain"):
        return Text(f"{percent(top['confidence'])} of the {result['sample_count']} people we have seen at {result['domain']} use this format.", style="muted")
    return Text(f"No addresses from {result['domain']} yet, so this is the most common format overall.", style="muted")


def find_result(result: dict[str, Any]) -> RenderableType:
    """The answer for one person: the best address in a panel, then the alternatives."""
    problem = error_text(result)
    if problem:
        return problem
    top, *rest = result["candidates"]
    headline = Text(top["email"] or "", style="bold") if top["email"] else address_format(top["template"])
    heading = Table.grid(expand=True)
    heading.add_column()
    heading.add_column(justify="right")
    heading.add_row(
        Text("MOST LIKELY ADDRESS" if top["email"] else f"FORMATS AT {result['domain'].upper()}", style="sage"),
        Text(f" {percent(top['confidence'])} ", style="ink on #5fd47e") if result.get("known_domain") else Text(""),
    )
    body = Group(heading, Text(""), headline, address_format(top["template"]), Text(""), _evidence(result, top), mail_line(result))
    panel = Panel(
        Padding(body, (0, 1)),
        title=Text(" @ emailpattern ", style="leaf"),
        title_align="left",
        border_style="frame",
        box=box.ROUNDED,
        padding=(1, 1),
    )
    if not rest:
        return panel
    return Group(panel, Text(""), alternatives(rest, with_email=bool(top["email"])))


def alternatives(candidates: list[dict[str, Any]], with_email: bool = True, title: str = "Other possibilities") -> Table:
    table = Table(
        title=Text(title.upper(), style="sage"),
        title_justify="left",
        box=box.SIMPLE_HEAD,
        header_style="muted",
        border_style="frame",
        pad_edge=False,
    )
    if with_email:
        table.add_column("Address")
    table.add_column("Format")
    table.add_column("Likelihood", justify="right")
    for i, c in enumerate(candidates):
        row: list[RenderableType] = [c["email"]] if with_email else []
        row += [address_format(local_part(c["template"])), Text.assemble(bar(c["confidence"], strong=i == 0 and not with_email), "  ", percent(c["confidence"]).rjust(4))]
        table.add_row(*row)
    return table


def domain_result(result: dict[str, Any]) -> RenderableType:
    """Every format a domain uses, with shares."""
    problem = error_text(result)
    if problem:
        return problem
    header = Text.assemble((result["domain"], "bold"), "  ")
    header.append(f"{result['company_name']}" if result.get("company_name") else "", style="muted")
    note = (
        Text(f"Based on {result['sample_count']} people at {result['domain']}.", style="muted")
        if result.get("known_domain")
        else Text(f"No addresses from {result['domain']} yet; these are the most common formats overall.", style="muted")
    )
    title = "Formats used" if result.get("known_domain") else "Most common formats"
    return Group(header, mail_line(result), Text(""), alternatives(result["candidates"], with_email=False, title=title), note)


def bulk_summary(found: int, known: int, failed: int, out_name: str) -> Text:
    return Text.assemble(
        ("✓ ", "leaf"),
        f"{found} addresses written to ",
        (out_name, "bold"),
        ("  ·  ", "muted"),
        (f"{known} from companies we know", "muted"),
        *((("  ·  ", "muted"), (f"{failed} {'row' if failed == 1 else 'rows'} skipped", "warn")) if failed else ()),
    )
