# Campaign beta: one development line

The owner selected **main site, gated beta** on October 28, 2026. The goal is to
finish PR #81, merge its reviewed code into main when authorized, then do campaign
fixes on short branches from main. Do not maintain a second long-lived campaign
implementation. C12's separate work is unchanged by this package.

## Beta access and reporting

- `CAMPAIGN_BETA_GUILD_IDS` is an optional comma-separated list of guild UUIDs
  configured on the canonical Worker through reviewed release configuration.
  Retain the selected allowlist in subsequent releases; do not rely on a dashboard
  value that the next deployment may overwrite. Missing, empty, malformed or wildcard
  configuration enables nobody. Enroll a dedicated beta guild, not a classroom
  guild by default. Its owning teacher and current members gain access; archive
  or membership removal revokes access. An account with multiple guilds only
  sees/uses campaigns for enrolled guilds. Direct creation, listing, options,
  gates, shops, adventure reads and actions enforce the same server restriction.
- The server returns availability without requiring campaign tables, so the
  disabled beta stays hidden before canonical migrations. Dashboard/lobby links
  display `Campaigns · Beta` only for eligible accounts. The existing isolated
  `campaign-preview` environment retains its access and saves.
- Campaign pages show a visible Beta notice and Report a bug dialog. The link
  opens a structured GitHub issue form; the reporter reviews/submits it. No
  account, campaign/session identifier, quiz answer, screenshot or other player
  data is automatically attached. Reports are public and require GitHub access;
  students can report through their teacher. This is an external issue link,
  not an automatic in-app submission service.
- Disabling the gate prevents new campaign API activity; it does not delete
  progress, undo rewards or destroy existing combat sessions. Active rooms retain
  their existing ownership/reconnect/settlement protections. Use coordinated
  maintenance, not this gate alone, to pause writers during a database upgrade.

## Release order

1. Finish exact-head CI, TypeScript, builds, migration/deployment regressions and
   all four Chromium jobs, including desktop/phone beta-report UI. Review
   [release safety](reviews/2026-10-28-campaign-release-safety.md). Resolve any
   GitHub mergeability disagreement from fresh refs without overwriting work.
   Main's roster release is deployed but its classroom acceptance is blocked
   by timeouts/Cloudflare 1102; resolve and pass that original operational gate
   before enabling the main-site beta. See [current baseline evidence](releases/2026-10-28-pr87.md).
2. Obtain authorization for the concrete merge, **canonical additive database
   migration**, production deployment and limited beta acceptance. No production
   release is implied by a preview attestation. Select the dedicated beta guild
   using verified production IDs; never copy preview IDs or student records.
3. On the separate preview, any authorized upgrade must use the exact identity,
   backup, quiescence, atomic bridge, deployment and guardian acceptance sequence
   in the safety review. Preserve the owner's current save. Preview acceptance
   is valuable evidence; it does not migrate that save to the main site.
4. After authorization, recheck main/PR heads and exact tests, merge using an
   expected-head guard and verify the merge tree. Verify production's actual ledger: AA-only is 19 rows; roster 0019 brings it
   to 20. Preserve main 0000–0019 and use the ordinary remaining forward
   migrations (campaign **0020–0024**), reaching 25 rows,
   through the established production release procedure. **Never use the legacy
   preview bridge on production.** Back up/verify AA wallets, receipts, loadouts,
   students and results, and retain existing room checkpoints.
5. Deploy the verified merged runtime with the beta initially closed. Verify
   canonical readiness and existing classroom/AA acceptance. Configure only the
   chosen beta guild(s), with explicit release evidence, then confirm authorized
   access, other-guild denial, bug-report UI, persistent resources, town services,
   reconnect and an authenticated owner guardian victory. Record its exactly-once
   post-cost stamina restoration (up to 20 percentage points, capped at 100%).
6. Record merged/deployed/accepted states. Close the campaign work stream and
   retire its development branch only after successful handoff. The preview may
   remain a test environment built from main; retaining an environment does not
   require divergent development. Keep its database/progress unless the owner
   separately requests a reviewed transfer or retirement.

## Rollback

Close the beta allowlist to limit new entry while investigating. Preserve AA
wallets/receipts, campaign saves, reward receipts and combat checkpoints. Use a
runtime containing AA compatibility and paid-appearance guards; never roll back
to a free-appearance runtime or remove/replay historical migrations. Restoring a
backup over newer player progress requires separate authorization and a recovery
plan; it is not an automatic deployment rollback.
