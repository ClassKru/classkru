# Developer AI settings

The `/developer/` console has a dedicated AI settings tab. It stores the planner and media-builder model IDs separately and can load model IDs visible to the configured OpenAI account. The media API reads this configuration for each request, so changes take effect without a redeploy.

Before enabling the tab in production:

1. Apply `supabase/migrations/202609290001_media_ai_settings.sql` to the ClassKru Supabase project.
2. Set `DEV_CONFIG_ENCRYPTION_KEY` in Vercel to a random secret of at least 32 characters. Keep the same value across deployments and never expose it to the browser.
3. Sign in to `/developer/`, open “ตั้งค่า AI”, enter the OpenAI API key, load the available models, choose a model for planning and another for media generation, then save.

API keys are encrypted with AES-256-GCM before being stored in the service-only `developer_ai_settings` table. The browser receives only whether a key exists. If no key is saved in the console, the API continues to use `OPENAI_API_KEY`. If no model is saved, it uses `OPENAI_MEDIA_STUDIO_MODEL` or `gpt-5.6-luna`.

Both configured models must support the OpenAI Responses API and JSON Schema structured output used by this feature. The model catalog lists models available to the account; it can also include models that do not support those requirements.
