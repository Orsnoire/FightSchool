# Fight creation: oversized CSV content and silent validation

## Reproduction and cause

The supplied 60-question practice CSV contained two embedded graph questions of
25,704 and 24,661 characters. Both exceed the existing 20,000-character question
limit. The CSV parser accepted all rows, but React Hook Form's shared Zod resolver
blocked Save before the POST request. The page supplied no invalid-submit handler
or visible nested question error, so the user saw an apparently broken button.

The affected shared contract was last changed October 12 and the authoring page
October 18. This reproduction does not implicate the campaign release.

The corrected CSV retains all 60 questions, answers and timers, with less dense
SVG sampling and a maximum question length of 10,266. Against the real importer,
full fight contract and authenticated HTTP handler with isolated in-memory
persistence, the original returns 400 and the corrected file returns 201. No
production records were created. The actual rich-content renderer processes all
293 equations and preserves both graph geometries and holes.

## Repair

- Share the existing question-array schema with CSV preflight, retaining every
  existing bound and the current import dialect.
- Reject a new invalid import atomically, retain the existing draft and permit
  retry of the same filename. Do not truncate graphs or discard oversized rows.
- Display schema-derived question numbers and limits on failed Save, using both
  a toast and an inline summary. Keep the draft available for correction/retry.
- Preserve campaign behavior, API contracts, authorization and database state.

## Verification and publication

- All **412 application tests**, TypeScript, client/Worker builds and diff
  whitespace checks pass locally.
- New tests cover the actual oversized-graph reproduction, exact question/answer
  and count boundaries, missing questions/enemies/title, and the real CSV hook's
  failed-import preservation followed by a successful corrected retry.
- A browser scenario is included for desktop and phone: rejected import, retry,
  missing enemy, oversized manual edit, visible feedback and successful creation
  with preserved question/answer contents. It is wired into the existing authoring
  CI job. Local Chromium downloads returned truncated archives; remote browser
  verification follows the exact PR head.
- [PR #94](https://github.com/Orsnoire/FightSchool/pull/94) is published with owner
  authorization. Its first head `25dd900` matches the locally verified tree.
  Browser run `40898711173` passed the pinned baseline and current authoring/lobby
  scenarios before the new scenario encountered a partial-text selector matching
  both the visible toast and its accessibility announcement. The test now selects
  the complete visible message exactly; application behavior and assertions are
  unchanged. Updated-head verification is pending and tracked in the PR.
- Automatic approval review rejected a direct main-branch discovery-note write.
  The documentation is therefore kept in PR #94, with main unchanged. Merge and
  deployment are separate from publication; no production release is claimed.

## Deployment follow-up

The owner subsequently authorized deployment. PR #94 is merged and its exact
runtime is live; publication-only restrictions above describe the earlier stage.
See the [release record](../releases/2026-10-29-fight-validation.md) for current
provider, verification and live acceptance status.
