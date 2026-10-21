"""The `emailpattern` command, built on the SDK in emailpattern.client."""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any

import rich_click as click
from rich.console import Console
from rich.progress import BarColumn, MofNCompleteColumn, Progress, TextColumn

from emailpattern import __version__
from emailpattern import _render as render
from emailpattern.client import DEFAULT_API, MAX_BATCH, ApiError, Client
from emailpattern._csv import DOMAIN_COLUMNS, NAME_COLUMNS, batches, pick_column, result_fields, write_rows

# Help pages in the site's palette.
click.rich_click.STYLE_OPTION = "bold #5fd47e"
click.rich_click.STYLE_ARGUMENT = "bold #5fd47e"
click.rich_click.STYLE_COMMAND = "bold #5fd47e"
click.rich_click.STYLE_SWITCH = "bold #7cc4d8"
click.rich_click.STYLE_USAGE = "bold #7fa99b"
click.rich_click.STYLE_OPTIONS_PANEL_BORDER = "#2c5a4c"
click.rich_click.STYLE_COMMANDS_PANEL_BORDER = "#2c5a4c"
click.rich_click.STYLE_HELPTEXT_FIRST_LINE = "bold"
click.rich_click.TEXT_MARKUP = "markdown"

console = Console(theme=render.THEME, highlight=False)
errors = Console(theme=render.THEME, stderr=True, highlight=False)


def _client(ctx: click.Context) -> Client:
    return ctx.obj["client"]


def _print_json(data: Any) -> None:
    click.echo(json.dumps(data, indent=2, ensure_ascii=False))


def _fail(message: str) -> None:
    errors.print(f"[warn]✗[/] {message}")
    sys.exit(1)


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
@click.option("--api", envvar="EMAILPATTERN_API", default=DEFAULT_API, show_default=True, help="API base URL.")
@click.version_option(__version__, "-V", "--version", prog_name="emailpattern")
@click.pass_context
def cli(ctx: click.Context, api: str) -> None:
    """**Find anyone's business email address.**

    Give a name and a company website; get the format the company uses and the most likely address.
    Free, no account, no key.
    """
    ctx.ensure_object(dict)
    ctx.obj.setdefault("client", Client(api, user_agent=f"emailpattern-cli/{__version__}"))


@cli.command()
@click.argument("name")
@click.argument("domain")
@click.option("--json", "as_json", is_flag=True, help="Print the raw API result.")
@click.pass_context
def find(ctx: click.Context, name: str, domain: str, as_json: bool) -> None:
    """Find the most likely address for **NAME** at **DOMAIN**.

    `emailpattern find "Jane Doe" acme.com`
    """
    try:
        result = _client(ctx).find_raw(domain, name)
    except (ApiError, OSError) as error:
        _fail(str(error))
        return
    if as_json:
        _print_json(result)
    else:
        console.print(render.find_result(result))
    if result.get("error"):
        sys.exit(2)


@cli.command()
@click.argument("domain")
@click.option("--json", "as_json", is_flag=True, help="Print the raw API result.")
@click.pass_context
def domain(ctx: click.Context, domain: str, as_json: bool) -> None:
    """Show every email format **DOMAIN** uses, with shares.

    `emailpattern domain acme.com`
    """
    try:
        result = _client(ctx).domain(domain).raw
    except (ApiError, OSError) as error:
        _fail(str(error))
        return
    if as_json:
        _print_json(result)
    else:
        console.print(render.domain_result(result))
    if result.get("error"):
        sys.exit(2)


@cli.command()
@click.argument("source", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("-o", "--output", type=click.Path(dir_okay=False, path_type=Path), help="Where to write. Default: SOURCE with .emails.csv.")
@click.option("--name-column", help="Header of the name column. Default: name, full_name, …")
@click.option("--domain-column", help="Header of the website column. Default: domain, website, …")
@click.pass_context
def bulk(ctx: click.Context, source: Path, output: Path | None, name_column: str | None, domain_column: str | None) -> None:
    """Add the likely address to every row of a CSV.

    Reads **SOURCE**, looks people up 50 at a time and writes a copy with
    `email`, `pattern`, `confidence`, `known_domain` and `accepts_mail` columns.

    `emailpattern bulk leads.csv -o leads-with-emails.csv`
    """
    with source.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        headers = list(reader.fieldnames or [])
        rows = list(reader)

    name_key = pick_column(headers, name_column, NAME_COLUMNS)
    domain_key = pick_column(headers, domain_column, DOMAIN_COLUMNS)
    if not name_key or not domain_key:
        _fail(f"Couldn't find the name and website columns in {source.name} (headers: {', '.join(headers)}). Use --name-column and --domain-column.")
        return

    target = output or source.with_suffix(".emails.csv")
    client = _client(ctx)
    found = known = failed = 0
    with Progress(
        TextColumn("[sage]Looking up"),
        BarColumn(complete_style="#5fd47e", finished_style="#5fd47e", style="#2c5a4c"),
        MofNCompleteColumn(),
        console=errors,
        transient=True,
    ) as progress:
        task = progress.add_task("lookups", total=len(rows))
        for chunk in batches(rows, MAX_BATCH):
            queries = [{"domain": r.get(domain_key) or "", "name": r.get(name_key) or ""} for r in chunk]
            try:
                results = client.find_many_raw(queries)
            except (ApiError, OSError) as error:
                _fail(str(error))
                return
            for row, result in zip(chunk, results):
                fields = result_fields(result)
                row.update(fields)
                found += bool(fields["email"])
                known += fields["known_domain"] == "yes"
                failed += "error" in fields
            progress.advance(task, len(chunk))

    with target.open("w", newline="", encoding="utf-8") as out:
        write_rows(out, headers, rows)
    console.print(render.bulk_summary(found, known, failed, str(target)))


if __name__ == "__main__":
    cli()
