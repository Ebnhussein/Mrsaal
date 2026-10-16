# Scheduling validation at submission

A date selected before editing can expire while the draft is being written.
The campaign review dialog checks it again after pending edits finish saving,
and immediately before starting the campaign. Single-message confirmation does
the same; its expired-date correction input appears inside the existing preview,
without discarding the draft or marking the company as a failed delivery.
No expired schedule silently becomes an immediate send.

The browser converts datetime-local values to ISO timestamps with a timezone.
Server routes validate independently and return SCHEDULE_TIME_PAST or
SCHEDULE_TIME_INVALID, with Arabic/English error messages. The scheduler checks
again after acquiring its user lock; campaign start SQL also requires the
requested time to remain in the future at execution.

Files include public/assets/schedule-time.js and utils/schedule-time.js,
preview and campaign launch integration, localized errors and cache versions.
No database migration or environment variables are required.

Checks: project assets/syntax; 56 targeted tests covering sending, scheduling,
Cairo timezone conversion, expiry during draft autosave and database-lock wait,
field correction and localized errors. No live email was sent during testing.

Manual test after deployment:
1. Choose a schedule a minute ahead and open/write a draft.
2. Wait until it passes, then press Send/Start.
3. The field must show an error, with the existing draft still present and no send.
4. Change to a future time and submit again; confirm the recorded time matches
   the local time you chose.
5. Repeat in English and for an unscheduled Send now action.
