# Database migrations

Numbered SQL files (`0001_name.sql`, `0002_name.sql`, ...) applied once, in order, at startup after the
existing `ensure*Schema()` bootstrap. Each file runs in its own transaction under an advisory lock, so it is
safe with more than one instance. Applied names are recorded in `schema_migrations`.

Rules: never edit an applied file (add a new one), keep each file idempotent where practical, and put new
schema changes here instead of adding more `ensure*` code.
