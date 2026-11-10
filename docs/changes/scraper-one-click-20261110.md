# Mrsaal Scraper 0.5.0 — search and collect from one click

The workspace search button previously only opened a source URL. Add a packaged
content bridge on the configured Mrsaal /app page. It handles real button clicks
synchronously and sends a narrowly scoped launch command to the worker. The worker
starts the sidebar and Google optional-permission request before its first await,
verifies the signed-in account through that exact Mrsaal tab, then opens the search
and auto-collects after the target tab is loaded. Maps search inside the extension
now uses the same automatic collection path as job search.

Carry query, country, city, work arrangement, limit, auto-scroll and language;
show them in the extension panel. Search settings persist locally per account.
Show extension readiness, startup, count/progress and save verification on the
workspace. Disable duplicate starts, retain startup errors until retry, and explain
missing/old extensions rather than silently opening a search with no collection.
If Chrome refuses to open the side panel, collection can still run, and the launch
response tells the page to suggest the toolbar icon. Native permission denial,
changed account and existing pending saves prevent a new search/import.

## Scope and access

- No externally_connectable or fixed public extension ID.
- The bridge matches only the configured Mrsaal origin and /app; local builds
  rewrite the content-script match to the local trial origin.
- Worker accepts bridge commands only from its own top-frame content script on
  that exact app origin/path. No arbitrary URLs, API paths or scripts are accepted.
- Source URLs are built in the worker from bounded validated options.
- Only Google optional-host access is requested on the explicit search click.
- Existing server-side admin/tester gate, session cookies and receipt verification
  stay in place. No application submission or outreach is added.

## Update and accept

Download the new ZIP from Mrsaal, replace the existing unpacked extension folder,
and Reload the same installed extension. Confirm version 0.5.0, then reload /app.
Confirm any existing pending batch before changing an installation.

Enter options and click Maps: allow Google access once if Chrome asks. The sidebar
should open, Maps should load and collection should run automatically with the
requested limit. Verify the save receipt and related company records. Repeat from
inside the panel, test denied permissions, duplicate clicks and account changes.
Native installed-extension permission/sidebar behavior on the user's live browser
remains an acceptance check; transport doubles do not establish that result.

## Validation

405 Node tests passed, including account/origin/frame checks, synchronous launch
calls, denied permission, pending-save blocking, option forwarding, panel failure
fallback and verified Maps import. Browser fixtures using the actual content bridge
with a Chrome transport double passed trusted-click launch, missing-addon guidance,
option propagation, state/progress, no extra tab fallback and persisted options.
Existing panel/adapters/games/AR/EN/reduced-motion fixtures passed. Project assets,
syntax, targeted ESLint and whitespace checks passed.
