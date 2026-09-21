# Media Studio chat update — 2026-09-21

Follow-up question buttons now submit a planning request through the existing authenticated API. Starter questions include the energy activity context. The conversation shows pending and failed request statuses; saved assistant_message responses appear as assistant turns. Refresh state after run completion even when another worker claimed the job. Prevent submission while a job is pending. Asset references bumped to 486.

Browser QA passed using a mocked AI API, including clicking a starter question and displaying the returned assistant text, build, preview, publish, revoke and sandbox checks. One run timed out; the repeat passed. No paid Production AI request was made; live provider credentials and account credit remain unverified.
