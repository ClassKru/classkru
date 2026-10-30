# Science additional curriculum release

## Integration

The catalog loads the physics, chemistry, and biology additional curriculum from the existing Supabase curriculum tables. The generator APIs already accept the selected outcome codes and text, so no API schema change is required. These subjects are excluded from score-entry mapping.

## Data status

`supabase/seeds/science-additional-2560-draft.sql` contains 271 outcomes extracted from the teacher-provided IPST PDF. It inserts the source with status `draft`; the catalog deliberately hides it until the source is changed to `reviewed`. Review every extracted outcome against the PDF before enabling it.

The seed uses `ON CONFLICT DO NOTHING` and does not delete or update existing rows. It should be run only after confirming the curriculum catalog tables exist and the target source/outcome IDs are absent.

## Release checks

- Verify the target Supabase project and record the source/outcome counts before and after the seed.
- Keep the source in `draft` until all 271 outcomes are reviewed.
- Run `node --test tests/science-catalog.test.cjs tests/content-library-v5-navigation.test.cjs`.
- Check that each science subject remains unavailable while the source is `draft`, and appears only after a reviewed source has complete rows for all three subjects.
