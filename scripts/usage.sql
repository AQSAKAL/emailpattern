-- Opens the usage log in DuckDB. Run from the folder that contains usage/ (see docs/usage-data.md):
--   duckdb -init /path/to/emailpattern/scripts/usage.sql
-- gives you two views, requests and lookups, over every daily file.

CREATE OR REPLACE VIEW requests AS
  SELECT * FROM read_json_auto('usage/requests-*.jsonl', union_by_name = true);

CREATE OR REPLACE VIEW lookups AS
  SELECT * FROM read_json_auto('usage/lookups-*.jsonl', union_by_name = true);
