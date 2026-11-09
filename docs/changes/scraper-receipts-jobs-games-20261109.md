# Scraper 0.3.0 — verified saves, jobs, source access and waiting games

The screenshot's cumulative total and newly-added count cannot alone establish
whether a particular batch is visible. Import now writes an owned receipt in
the same transaction as its records. A request key and payload hash make retries
idempotent; mismatched reuse fails. The extension independently reads that
receipt and its record IDs before displaying success. A pending batch survives
locally until confirmation and can be retried without rescraping, across restarts,
only against the original environment/account. No successful empty acknowledgement
is accepted from an older backend.

The trial page polls automatically, defaults to the newest receipt's records,
shows the cumulative total separately, preserves older data, and renders source
URLs as bounded links. Search-only job links are visibly distinguished from real
posting details; details upgrade existing links instead of duplicating jobs.

Find Jobs auto-collects Google result links after loading. General job-card,
JobPosting and job-page extractors cover multiple layouts. A second explicit
button requests the posting origins and attempts extraction from up to 10 saved
links using owned inactive tabs. Redirects without permission, verification/login
walls and unsupported layouts are skipped, without submission or circumvention.

Optional host permissions are requested for selected origins directly from a
button gesture. Source tabs with granted access are tracked across activation
and navigation, while unknown origins may still need one toolbar selection.
Global browsing metadata permissions are not requested. No all-site permission
is automatically granted.

Snake and tic-tac-toe are optional, collapsed waiting games. Keyboard input is
scoped to the game; game logic never changes data or collection counters. A
finished collection pauses Snake, and hiding the panel pauses its timer.

Validation includes transactional receipt/retry/ownership/rollback and job-upgrade
checks; lost-response recovery without a second extraction; automatic search and
posting-detail worker flows; actual HTTP import-to-trial-page refresh; Maps
loading regressions; and bilingual UI/game/site-permission interaction fixtures.
The installed extension's native Chrome permission prompts and live job sites
remain manual acceptance checks. This stays on trial PR #40, not production.

Update both the local server and unpacked extension, and refresh the source tab.
The extension version must be 0.3.0. Do not remove a pending-save queue while
updating; finish its confirmation first when possible.

Final checks: 399 Node tests passed, as did lint/syntax checks, delayed Maps
loading fixtures, real HTTP receipt-to-page auto-refresh, and the bilingual
panel/game/permission fixtures (including unlocking after pending-queue removal).
