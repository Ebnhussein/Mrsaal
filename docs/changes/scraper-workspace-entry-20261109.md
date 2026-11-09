# Discovery workspace entry

The official discovery APIs were deployed without a workspace entry. Users could
not discover the extension download or see saved jobs inside Mrsaal.

Add a Discover companies & jobs section to the sidebar and a shortcut in Companies
that also works on mobile. The section includes the authenticated official ZIP
download, desktop Chrome/Edge setup steps, Egypt/Gulf search launchers, recent
import receipts and saved jobs with review status and pagination. Search opens
source pages; collection still runs through the extension. No CV matching or
application submission is claimed.

The section is visible so users can find it. Existing server-side pilot access is
unchanged: unlisted accounts see a clear limited-pilot message and disabled
download/search controls. Missing deployment, expired sign-in and network failures
have distinct states. Stored titles are text-only and source links accept HTTP(S)
without embedded credentials. Results refresh while the section is active and on
returning to the tab; company review reloads the company list first.

`/app#discovery` opens the section after authentication. Bumped asset URLs ensure
returning users receive the navigation and translations after redeployment.

Validation: 402 Node tests passed; project check, targeted ESLint and whitespace
checks passed. Browser fixtures covered the real workspace markup/new script at
360/768/1440px in AR/EN, download, search filters, receipt refresh, safe job text
and URLs, restricted access, missing deployment and company-list refresh.
