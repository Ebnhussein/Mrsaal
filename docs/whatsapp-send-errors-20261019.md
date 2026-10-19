# WhatsApp send preflight errors

The email/send endpoint previously caught WhatsApp readiness failures and returned only `error.message` with HTTP 409. MrsaalWA uses safe symbolic messages (for example `WA_NOT_CONNECTED`), so discarding `error.code` made the public error middleware replace the specific cause with a generic state-conflict message.

The endpoint now lets the shared error handler preserve the typed code, status and localisation. A missing or non-ready MrsaalWA session returns `WA_NOT_CONNECTED` with 409. Gateway auth/session/timeout codes remain distinct. No automatic relinking, sending or retries are introduced.

Both WhatsApp transports now use `WA_RECIPIENT_FORMAT` for a recipient missing international format, distinct from phone-pairing consent. Local numbers such as `01012345678` require an explicit country code, e.g. `+201012345678` for that Egyptian number. The application does not guess the recipient country. Invalid recipient format is a known pre-send failure; no gateway send occurs.

Tests cover the endpoint preserving readiness errors without delivery side effects, bilingual public descriptions, ready versus QR-only sessions, and rejection of local numbers before the gateway. Existing idempotency and uncertain-delivery safeguards remain unchanged.

After deployment, check the user's WhatsApp connection status. If it is disconnected/QR-only, complete linking from Communication channels. Correct the company contact data to international format. These code changes make the actual failure actionable; they do not establish that a deployed session is authenticated or that a message has been delivered.
