# Mrsaal Scraper — browser prototype

A Chrome/Edge Manifest V3 side panel for collecting public companies and job
postings from a user-chosen page. Default search targets Egypt and the six Gulf
countries, with remote, hybrid, on-site and unrestricted work arrangement filters.
Search can span the web or a specified job-site domain. Collection/import is
separate from job matching and from outreach/application submission.

## Isolated local trial (recommended)

Run `npm ci` and `npm run trial:scraper`, then open
`http://localhost:4174/app`. Download the trial extension ZIP from that page.
It connects only to the local test account/database, not production. See
[`ops/scraper-trial/README.md`](../../ops/scraper-trial/README.md) for the full steps.

## Install against a separately deployed backend

Deploy the matching `/api/discovery` backend changes first. In Chrome/Edge,
open the extensions management page, enable Developer mode, choose **Load
unpacked**, and select this directory. This is an unpacked development build,
not a Chrome Web Store release. No remote code or third-party extension is used.

1. Sign into `https://mrsaal.ebnhussein.co/app` in the same browser profile.
2. Open a public Maps/company/job result page and click the Mrsaal toolbar icon.
3. Connect the account in the side panel and verify the displayed email.
4. Set a batch limit and start collecting. Automatic loading is enabled by default; disable it for a single-page capture.
5. Results are added to that user's account. Companies appear in the existing
   Companies screen, unselected. Saved jobs are available in the panel.

The search buttons open Maps or a web search. Open the desired result page and
click the toolbar icon on that page to grant temporary `activeTab` access.

## Supported collection

- Google Maps place-result cards: visible name, public contact details, website,
  category, available location text and source link. Maps may offer a limited
  result set in some sessions. Missing email is left empty.
- Public `JobPosting` JSON-LD on any website: title, known employer, description,
  job URL, location and supplied employment/work-arrangement information.
- HTML tables with recognisable company/contact/job columns.
- Custom result-card CSS selector, with company/job mode, for other layouts.

These are general extractors, not a guarantee that every job site is supported.
A site may need a dedicated adapter; sign-in, cross-origin frames, inaccessible
content and verification challenges are not bypassed. No application forms
are filled or submitted by this prototype. No CV ranking is implemented yet.

Collection is user-started, at most 250 rows, 100 load attempts and two minutes per run. It stops
on navigation, cancellation, no new data or a detected verification challenge.
It does not follow arbitrary pagination links or crawl linked websites for email. A separate user-triggered job-detail action can open up to 10 saved posting links after explicit per-site permission, then closes only inactive tabs it created.
Unknown employers are saved as jobs without inventing a company record.

## Account and background behaviour

The worker fetches only fixed Mrsaal API paths through a signed-in Mrsaal
tab. Session cookies and API tokens are never read or copied into the extension.
There is no CORS/CSRF exemption. Every import is bound to the authenticated
server session and to the connected user ID; switching accounts requires
reconnecting. A pending batch/request key is kept in `chrome.storage.local` until a database receipt is independently verified. Interrupted saves can be retried with the same key without scraping or inserting twice. Session state holds the live UI. Importing does not select companies for
sending and never sends outreach.

Keep the source and Mrsaal tabs open during a run. The panel may be closed,
but the browser must remain running. Browser shutdown, tab suspension and
service-worker termination can interrupt a run; retrying is safe because of
server-side deduplication. This is not an unattended server crawler.

## Validation

`npm run check`

`node --test tests/discovery.test.cjs tests/scraper-worker.test.cjs`

`node tests/browser/scraper-extractor.cjs` (requires Playwright and Chromium)

The browser test exercises the real extractor on public-page fixtures and the
side panel with a mocked Chrome transport. It does not install the extension in
a user's browser or claim live Google Maps end-to-end validation.

## Version 0.2.0 — Maps loading and live feedback

Maps collection discovers the scrollable ancestor of the actual result cards,
including a pane outside `role=feed`. It waits for new place IDs through DOM
changes/polling, retains cards removed by virtualisation, and stops at the batch
limit, end notice, cancellation or a bounded no-growth timeout. The side panel,
toolbar badge and temporary page overlay show actual collected counts. Loading
and saving have distinct states; reduced-motion preferences disable animation.

Run `node tests/browser/maps-autoload.cjs` for delayed/virtualised nested-pane
regressions, and the existing panel browser test for live/reduced-motion UI.

## Version 0.3.0

- Site access can be granted from the collection button, in a direct user gesture,
  for only the selected origin. Optional host declarations do not grant all sites.
  Granted source sites can be followed across tab changes without repeated icon
  clicks; a new unknown site may still need one toolbar selection.
- Find Jobs opens search and collects posting links automatically. These are
  explicitly marked `needs_review`/link-only. A separate details button asks for
  the posting-site permissions and attempts real JobPosting/job-page extraction.
  Confirmed details upgrade the existing saved link rather than duplicate it.
- Successful saves require a committed import receipt and a second read of its
  owned records. Pending batches survive extension/browser restarts locally; the
  retry button uses the original request key and checks the connected account.
- Optional Snake and tic-tac-toe live behind a collapsed waiting-game disclosure.
  Games do not send messages, change collection counters or block the collector.
- The trial page refreshes automatically, shows the latest receipt/batch by
  default, and uses bounded source links rather than raw URLs in the table.

## Official pilot — v0.4.0

The exact extension name is **Mrsaal Scraper**, with the existing Mrsaal logo.
Run `npm run build:scraper:official` to build for `https://mrsaal.ebnhussein.co`.
Load `.mrsaal-trial/official-extension` unpacked; the panel marks it OFFICIAL PILOT.
The server must first deploy the discovery changes. Only configured `ADMIN_EMAILS`
and `SCRAPER_TRIAL_EMAILS` can connect. See
`docs/changes/scraper-official-pilot-20261109.md` for the live acceptance steps.
