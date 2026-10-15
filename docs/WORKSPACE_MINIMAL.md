# Minimal workspace — 15 October 2026

The pre-change source is preserved on GitHub at `backup/tool-before-minimal-20261015`, commit `4b059ab86f9258efd52f0c06722f7587ce0dcbd8`. This is a source backup, not a database backup.

The workspace defaults to minimal presentation. The tune button in the top bar switches between Minimal and Detailed, preserving the current inputs and selected recipients. Only this device preference is saved under `mrsaal-workspace-view`. `?view=detailed` opens the detailed presentation directly.

Optional controls are moved, not cloned: account preparation, examples and writing rules, CV text editing, company filters, campaigns/lists, model-selection help, account usage/privacy, and scheduling. Native details elements support keyboard navigation. Invalid inputs reveal their parent section; tours can open the parent details using their existing guidance behavior. Sender, recipients, attachment, delivery messages, and consent/review rules retain their existing behavior.

Changes are confined to `public/index.html`, `public/assets/workspace-minimal.js`, `public/assets/workspace-minimal.css`, and the associated test/document. No migrations or changes to authentication, quotas, AI, sending or stored user content are included.

## Deployment checks

- On desktop and mobile, compare both views in Arabic/English and light/dark themes.
- Type an unsaved writing instruction and CV edit; switch views and confirm both remain.
- Open filters; select a non-default status and verify the count badge. Confirm recipient selection remains unchanged.
- Import the example company sheet through Add companies; download remains inside import.
- Open scheduling, change the time, then switch views; confirm values remain.
- Run page guidance for writing, CV and sending; optional sections open for their target step.
- Open a draft and confirm recipient, sender, attachment and error status remain visible.
- Check bottom navigation, keyboard focus and long English labels at 360px/768px/1440px.

For presentation-only comparison use Detailed view. To undo this change permanently, revert the commit titled `Add a minimal workspace with optional details and preserve previous design` and redeploy. Reverting that commit preserves subsequent unrelated work; switching production to the backup branch would restore the entire older source version.
