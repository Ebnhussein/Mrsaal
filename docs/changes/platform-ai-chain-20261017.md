# Platform AI: cloud providers with local fallback

`MRSAAL_AI_MODEL_CHAIN` explicitly enables the platform-owned chain, even when `LOCAL_AI_BASE_URL` is configured. Without it, existing local-only / legacy behavior remains unchanged. The old `AI_MODEL_CHAIN` config remains specific to the legacy path.

## Coolify runtime settings

Keep the existing local AI connection and Google/OpenRouter keys. Add the Groq key and these settings to the Mrsaal application, available at runtime (not build time):

```dotenv
GROQ_API_KEY=<your Groq key>
MRSAAL_AI_MODEL_CHAIN=[{"provider":"groq","model":"auto"},{"provider":"gemini","model":"auto"},{"provider":"openrouter","model":"openrouter/free"},{"provider":"local","model":"local-ai"}]
MRSAAL_AI_TOTAL_TIMEOUT_MS=45000
```

Existing variables used by this chain:

- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY`
- `LOCAL_AI_BASE_URL`, `LOCAL_AI_API_KEY`, `LOCAL_AI_MODEL`

Missing keys skip the corresponding provider. A fresh deployment is required. No database migration or new npm dependency is required. Do not paste API keys in support tickets or chat.

## Routing behavior

- Order is explicit in the JSON array. Groq, Google and OpenRouter default to 10 seconds per attempt; local fallback defaults to 12 seconds, all within one 45-second platform budget and the existing operation deadline. Discovery and body reading count toward their attempt deadline. These are upper budgets, not a guaranteed response time.
- A row may include `timeoutMs` (3000–30000). Total budget is configurable from 5000–90000, and never extends the enclosing operation budget.
- `auto` on Groq discovers available model IDs and prefers GPT OSS 20B, then available Llama alternatives. `auto` on Google discovers stable text Flash models, preferring Flash Lite. Model lists are cached for ten minutes by key fingerprint. This is availability discovery, not proof of remaining quota or successful generation.
- Specific model IDs can replace `auto` at any time. OpenRouter supports `openrouter/free` or an explicit `:free` model only. Providers can still have account charges/limits; no free quota is promised for Groq or Google.
- Failed models enter the existing health cooldown; rate-limit reset times are respected. Each chain entry is attempted once, with no repeated review pass. Invalid, empty or truncated results fall through to the next provider rather than being sent to the user.
- Local processing keeps its existing queue, slots, per-user rate checks, cancellation and usage meter. Prompts exceeding 5500 characters skip the CPU fallback; an approved CV summary can reduce the writing prompt. Long CVs remain usable with cloud providers and are not silently truncated for the local fallback.
- The support assistant keeps its existing product-only rules, current guide context and safe local guide fallback. This routing changes the transport, not its scope.
- Existing per-user usage reservation/refund, one active operation, and successful-draft accounting remain in force. Platform fallback does not use a user's personal keys unless the existing explicit personal-fallback setting allows it. Explicit personal-source selection continues to use only the personal chain.
- Platform requests send the relevant CV/style/assistant context to the configured external provider. Keys stay server-side. Local token metering remains local-only; this change does not create a combined external token/cost ledger.

## Verify after deployment

1. Leave a test account's AI source on Mrsaal AI. Generate a draft without adding personal keys.
2. Check safe logs for `Mrsaal AI trying` and `Mrsaal AI succeeded`, provider/model and elapsed time. No CV or key should be logged.
3. On a preview/test environment, temporarily omit the Groq key; Google should be next. Do not disrupt production keys for this check.
4. Ask the support assistant a product question. Check that the same routing is used and outside-product requests remain refused.
5. Choose Personal providers on the test account; verify it uses that choice rather than platform credentials.
6. Check one successful draft consumes one draft credit and a total failure refunds the reservation.

## Rollback

Remove `MRSAAL_AI_MODEL_CHAIN` and redeploy. The previously configured local-only behavior returns; local credentials and personal provider settings are preserved.
