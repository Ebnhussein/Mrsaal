# Browser discovery prototype — 9 November 2026

## Product scope

Search focuses on Egypt, Saudi Arabia, UAE, Kuwait, Qatar, Bahrain and Oman,
with all work arrangements or remote/hybrid/on-site filters. Search can span
job websites or be limited to a specified domain. A Chrome/Edge side panel
collects from a page the user chooses, then saves results directly to the
connected Mrsaal account. Maps company outreach and actual advertised vacancies
have separate record types.

This implements discovery/import only. The requested guided CV builder, ATS
readability/job-fit checks, tailored CV/email bundles and browser application
assistance remain subsequent stages. This prototype neither claims CV-based
ranking nor submits applications or sends outreach.

## Implementation

- `extensions/mrsaal-scraper`: Manifest V3, bilingual side panel, search launch,
  bounded collection, stop control, result preview and saved-job list.
- General extractors: Maps place cards, JobPosting JSON-LD, labelled HTML tables,
  or a manually specified result-card selector. Site-specific adapters can be
  added; this is not universal support for every website or protected page.
- `/api/discovery/session`, `/api/discovery/import`, `/api/discovery/jobs`:
  normal authentication, request-origin guard, access control and rate limits.
- Session-bound import checks the connected account ID before writing.
- Company provenance is kept in `discovery_meta`; imported companies are
  unselected and missing contacts are left empty. No employer name is invented
  when a vacancy does not identify it.
- `discovered_jobs` isolates vacancies per user and deduplicates job URLs.
  Known tracking parameters are removed; company lookup also recognises Maps
  place identifiers. Imports enforce resource limits transactionally.

The extension needs only temporary active-tab access to the chosen source and
host access to Mrsaal. It does not read cookies or copy tokens. Same-origin
requests execute in an already signed-in Mrsaal tab; no CORS/CSRF exception is
introduced. The toolbar opens the panel; installation instructions are in the
extension README. This is an unpacked development build, not a store listing.

Keep the browser/source/Mrsaal tabs open during collection. It is not a server
crawler that continues after closing Chrome or turning off the computer.

## Verification

- `npm run check`: passed.
- ESLint: passed with no errors (existing repository warnings remain).
- `npm test`: 391 tests passed, including real server startup against PostgreSQL.
- Browser suite: Maps/JobPosting/table/custom-card fixtures, verification-stop,
  missing-contact/employer behaviour, panel XSS handling and bilingual layout at
  280/360/480 pixels passed.
- Live read-only browser inspection: Google Maps company results in Cairo and a
  Greenhouse vacancy/application form in Egypt. No real application was sent.

The browser suite uses a Chrome transport double for the side panel; it does
not prove an installed extension's live Maps-to-production import. That final
smoke test requires deploying this backend and installing the extension.

Run `node --test tests/discovery.test.cjs tests/scraper-worker.test.cjs` and
`node tests/browser/scraper-extractor.cjs` for targeted verification. The latter
accepts `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and a JSON `PLAYWRIGHT_LAUNCH_ARGS` array.
