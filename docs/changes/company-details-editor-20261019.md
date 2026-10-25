# Selected company details editor

The Companies and applications action bar remains visible with no selection. Prepare sending, Edit companies, Clear selection and Delete selected use real disabled states until companies are selected. Edit sits next to Prepare sending. Delete is no longer hidden in More and sits at the physical left end, retaining its existing confirmation.

Edit opens a native modal with a selected-company picker and name, email, phone, industry and location fields. Each company is saved separately; dirty edits cannot be discarded by switching companies. Closing dirty edits requires confirmation. Validation highlights missing/invalid fields and requires country-code phone format and at least one usable contact. The dialog has bilingual labels, keyboard-native focus handling, scrolling, and a single-column phone layout.

`PATCH /api/companies/:id/details` only updates the five editable fields. It scopes reads/writes to the signed-in owner, preserves status and selection, checks the original field values for stale edits, and blocks edits while the company has pending/processing schedules, processing/uncertain delivery logs, generating/in-flight campaign items or a ready item in a running campaign. Saved message text and historical reports are not rewritten. Existing campaign recipient-change protection remains in force.

No database migration or environment setting is needed. Product guide, walkthrough and help search explain the feature.

Verification: save success/failure, preserved dirty edits, multi-selection navigation, invalid recipient validation before an API call, selected-action enabled states, real PostgreSQL ownership/stale-edit/active-work checks, bilingual errors, existing project checks and full regression suite.

After deployment, check Arabic/English and phone/desktop layouts, edit one and multiple selected companies, clear selection to confirm disabled actions, and confirm that cancelled deletion retains the records. Real browser layout remains a manual verification step.
