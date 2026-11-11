# Mrsaal Scraper 0.6.0 — complete discovery workflow

Extend the one-click work in PR #42, which has not been merged or deployed.

- The panel bootstraps its account from the signed-in Mrsaal tab and reads the
  existing search setup from that tab. Account changes with a running/pending
  batch are blocked. Query, country, city, work mode, limit and auto-scroll are
  populated once, with an explicit Maps/jobs mode indicator and selected button.
- Maps searches reuse the bound Maps tab. An unchanged query activates it without
  reloading. Changed queries navigate that tab. Search URLs and app senders stay
  bounded; no global tabs permission or external extension messaging is added.
- Installation has clickable Chromium browser choices, a visible copyable manager
  address and a four-step animated illustration (unzip, developer mode, load
  unpacked, select folder). With the installed bridge it can open the current
  browser's extension manager. Without it, the address is copied for the address
  bar. Ordinary web pages cannot promise to launch a different installed browser.
  Firefox/Safari support is not claimed. The animation respects reduced motion.
- Recent batches open an owned-record modal table instead of linking back to Maps.
  Text remains text-only, closing restores focus, and each receipt is re-read
  through the authenticated ownership-checked endpoint.
- Maps has a large shadow-root waiting-game stage positioned beside the results
  pane. Snake and tic-tac-toe remain interactive while collection runs. Hiding it
  restores the map. Stop wakes collection; a verified import updates the stage.
- Maps parsing scopes each result card, separates rating/review text from address
  and industry, drops malformed contacts, and retains stable place identifiers.
  Coordinate-only Maps URL updates do not look like navigation to another search.
  Observed/excluded cards are tracked separately from accepted records, preventing
  a wrong-country result from becoming an endless "new result". A phone prefix
  is a country hint, not proof of an office location; imported details need review.
  Maps' own reload-error notice stops with an explicit warning, not fake completion.
- Posting details follow a bounded queue of same-origin listing links after the
  explicit details-permission action. Up to 20 visited pages/10 detailed jobs,
  no CAPTCHA bypass/login automation, and no unknown-origin traversal. Search
  links remain needs_review; actual descriptions are required for a detail save.
- Backend repeat-place detection also recognises query_place_id/cid/ftid URLs.
  Existing account isolation, caps, idempotent receipts and no-send behavior remain.

Validation: 409 Node tests passed. Targeted real-PGlite import assertions cover
place-ID aliases. Browser fixtures cover responsive AR/EN setup, owned batch popup,
trusted bridge launch, persisted input, panel auto-setup, delayed/virtualised Maps
cards, coordinate changes, error notices and playable full-size map games. Project
checks and targeted ESLint passed. Fixtures/Chrome transport doubles do not prove
native installed-extension sidebar prompts or extraction on every live job site.

Deployment acceptance still requires updating the installed unpacked extension to
0.6.0, reloading Mrsaal, then checking a small live batch and its owned receipt.
Confirm any pending save before replacing an installation. This PR is still held
for explicit production-merge approval; preparation is not deployment.
