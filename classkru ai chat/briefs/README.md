# ClassKru AI Navigation Briefs

This directory is private server-side configuration. The local static server does not expose it.

Add a version by creating `versions/<id>/system.md`, `navigation.md`, and `config.json`, then add its ID and label to `registry.json`. Keep existing versions intact. `activeVersion` is used for ordinary teachers; `defaultVersion` is the safe fallback. Developer experiments are selected per conversation and never change either setting.

The brief controls model behavior only. The Action Registry and browser executor remain the authority for navigation, authentication, and data access. Never put API keys or student records in a brief.

When `CLASSKRU_AI_NAV_PROVIDER` is unset, the local `Open-ClassKru.cmd` launcher uses OpenRouter if an API key is configured; otherwise it stays in mock mode. Set the provider to `mock` to force simulation. The Developer API/model control loads OpenRouter models that support structured output and updates the shared Mini Lab V5 conversation model for the next request. The API key remains server-only.

For a deployed environment, set `CLASSKRU_AI_NAV_PROVIDER=openrouter`, `CLASSKRU_AI_NAV_OPENROUTER_API_KEY` (or the existing server-only `OPENROUTER_API_KEY`), and `CLASSKRU_AI_NAV_MODEL` (or `OPENROUTER_MODEL`). The mock provider remains available as the safe fallback.

Developer access uses the same `isClassKruMediaDeveloper` account check as Mini Lab. The existing ClassKru auth helper uses that check to show developer controls, while the API remains authoritative and verifies the account on every request. Other users only receive the active version.
