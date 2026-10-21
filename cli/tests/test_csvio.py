import io

from emailpattern._csv import DOMAIN_COLUMNS, NAME_COLUMNS, batches, pick_column, result_fields, write_rows


def test_pick_column_matches_common_headers_case_insensitively():
    headers = ["Full Name", "Website", "Notes"]
    assert pick_column(headers, None, NAME_COLUMNS) == "Full Name"
    assert pick_column(headers, None, DOMAIN_COLUMNS) == "Website"
    assert pick_column(headers, "notes", NAME_COLUMNS) == "Notes"
    assert pick_column(headers, "missing", NAME_COLUMNS) is None


def test_batches_split_evenly_with_a_remainder():
    assert [len(b) for b in batches(list(range(120)), 50)] == [50, 50, 20]


def test_result_fields_take_the_best_candidate():
    fields = result_fields(
        {
            "known_domain": True,
            "candidates": [{"email": "a@b.com", "template": "{first}@b.com", "confidence": 0.9}],
            "mail": {"accepts_mail": False},
        }
    )
    assert fields == {"email": "a@b.com", "pattern": "{first}@b.com", "confidence": "0.900", "known_domain": "yes", "accepts_mail": "no"}


def test_result_fields_keep_the_error():
    fields = result_fields({"error": "invalid_domain", "candidates": [], "mail": {"accepts_mail": None}})
    assert fields["error"] == "invalid_domain"
    assert fields["email"] == ""


def test_write_rows_appends_result_columns():
    out = io.StringIO()
    write_rows(out, ["name", "domain"], [{"name": "Jane", "domain": "b.com", "email": "jane@b.com"}])
    header, row = out.getvalue().splitlines()
    assert header == "name,domain,email,pattern,confidence,known_domain,accepts_mail,error"
    assert row.startswith("Jane,b.com,jane@b.com")
