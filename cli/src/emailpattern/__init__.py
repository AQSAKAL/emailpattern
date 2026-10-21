"""Find the email format any company uses, and the likely address for a person there.

    import emailpattern

    emailpattern.find("Jane Doe", "acme.com").email      # "jane.doe@acme.com"
    emailpattern.domain("acme.com").best.template        # "{first}.{last}@acme.com"

For many lookups, or to reuse a connection, use Client / AsyncClient. The same package
installs the `emailpattern` command line.
"""

__version__ = "0.2.0"

from emailpattern.client import DEFAULT_API, MAX_BATCH, ApiError, AsyncClient, Client, Person, RateLimited  # noqa: E402
from emailpattern.models import Candidate, FindResult, Mail  # noqa: E402


def find(name: str, domain: str) -> FindResult:
    """One lookup with a short-lived client."""
    with Client() as client:
        return client.find(name, domain)


def domain(domain: str) -> FindResult:
    """Every format a company uses, with a short-lived client."""
    with Client() as client:
        return client.domain(domain)


__all__ = [
    "DEFAULT_API",
    "MAX_BATCH",
    "ApiError",
    "AsyncClient",
    "Candidate",
    "Client",
    "FindResult",
    "Mail",
    "Person",
    "RateLimited",
    "__version__",
    "domain",
    "find",
]
