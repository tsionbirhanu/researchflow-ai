# Google Sheets Log

Create a sheet with this header row (one column per field):

```
run_id | timestamp | email | topic | depth | style | num_sources_requested | sources_used | confidence | verdict | status | duration_sec | error_message
```

**Status values:** `started`, `completed`, `failed`, `insufficient_sources`

A row is appended with `started` at intake and updated (matched on `run_id`) when the run finishes or fails.
