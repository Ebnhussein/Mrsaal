# Mrsaal Scraper 0.4.0 — official pilot

The extension uses the existing Mrsaal meem logo in the toolbar, extension list
and bilingual side panel. Its exact name is `Mrsaal Scraper` in both builds.
No additional browser permissions are introduced.

## Deploy the limited pilot

Deploy this version of the Node app through the existing Coolify service.
Existing `ADMIN_EMAILS` accounts can use discovery; optionally add other testers
with comma-separated `SCRAPER_TRIAL_EMAILS`. All discovery routes enforce this
server-side after normal authentication. Empty configuration allows nobody.
There is no public rollout switch or new public navigation/download link.

The local trial explicitly injects its own permissive access policy, uses its
isolated database and retains its own trial account. Production never bypasses
this policy based on a request header, hostname or extension input.

## Download or build the extension for the official app

After deployment, an allowed signed-in tester can download
`/api/discovery/extension.zip` on the official site. The endpoint uses the same
authentication and pilot gate as imports. No public menu entry is added.

To build manually:

```bash
npm run build:scraper:official
```

Output: `.mrsaal-trial/official-extension` and its sibling ZIP. Load this folder
unpacked, or replace/reload the previously installed folder. The required host
is only `https://mrsaal.ebnhussein.co/*`. The panel says OFFICIAL PILOT and shows
the connected origin; imports write to the displayed real account.

For local-only testing, keep using `npm run trial:scraper` and its download.
Do not change an installation with a pending batch until its save is confirmed.

## Acceptance on the official site

1. Deploy the server; a signed-in allowed account must get its own identity from
   `/api/discovery/session`. Unlisted accounts must get 403 PILOT_ONLY.
2. Sign in on the official app, connect the extension and verify the email.
3. Collect a small real batch (for example 3 Maps companies). Confirm the receipt
   and actual related records before reporting a successful save.
4. Refresh Companies on the official app and find the imported names. Repeat
   the same batch and confirm deduplication. No message or application is sent.

At preparation time the live discovery endpoint returned 404. A source-code
merge/build alone does not establish a successful deployment or live import.

Rollback: remove tester emails (and admin access if required) to close access,
or roll back the deployment. Existing imports are retained.

## Validation

402 Node tests passed. The final download route was then exercised by the real
isolated HTTP trial tests, including ZIP response and pilot middleware denial.
Project syntax/assets checks, targeted ESLint and whitespace checks passed.
Browser fixtures passed for AR/EN at 280/360/480 pixels, logo rendering, progress,
games, job adapters, source selection, pending-save unlock and reduced motion.
Live signed-in official import and native extension installation remain pending.
